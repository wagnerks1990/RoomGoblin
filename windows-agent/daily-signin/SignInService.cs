using System.Buffers.Binary;
using System.Diagnostics;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using Microsoft.Extensions.Hosting;

namespace RoomGoblin.SignIn;

internal sealed class SignInService : BackgroundService
{
    internal const string PipeName = "RoomGoblin.DailySignIn.v1";
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!WindowsIdentity.GetCurrent().IsSystem) throw new UnauthorizedAccessException();
        var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false);
        security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
        while (!stoppingToken.IsCancellationRequested)
        {
            using var pipe = NamedPipeServerStreamAcl.Create(PipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous | PipeOptions.FirstPipeInstance, 1024, 2048, security);
            await pipe.WaitForConnectionAsync(stoppingToken);
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken); deadline.CancelAfter(TimeSpan.FromSeconds(5));
            var response = new byte[1292]; // DWORD status + UTF-16 username[257], domain[257], password[130].
            try
            {
                if (!IsLogonUi(pipe)) continue;
                var request = new byte[26]; await pipe.ReadExactlyAsync(request, deadline.Token);
                if (BinaryPrimitives.ReadUInt32LittleEndian(request) != 0x52475349 || BinaryPrimitives.ReadUInt32LittleEndian(request.AsSpan(4)) != 1 || request[24] != 0 || request[25] != 0) continue;
                string code = Encoding.Unicode.GetString(request, 8, 16);
                CryptographicOperations.ZeroMemory(request);
                var config = ProtectedFiles.Read<Configuration>(ProtectedFiles.ConfigPath);
                if (!config.Active || config.RecoveryPassword != null || !string.Equals(config.Policy.ComputerName, Environment.MachineName, StringComparison.OrdinalIgnoreCase)) continue;
                // A removed/replaced account must never inherit the former account's authorization.
                if (Installer.AccountSid(config.Policy.Username) != config.AccountSid || Installer.IsAdministrator(config.Policy.Username)) continue;
                var attempts = ProtectedFiles.Read<Attempts>(ProtectedFiles.StatePath);
                var seed = Convert.FromBase64String(config.Policy.Seed); var now = DateTimeOffset.UtcNow;
                bool accepted;
                try { accepted = attempts.Accept(code, Codes.ForDay(seed, config.Policy.GroupId, Codes.Day(config.Policy.TimeZone, now)), now); }
                finally { CryptographicOperations.ZeroMemory(seed); }
                ProtectedFiles.Write(ProtectedFiles.StatePath, attempts);
                if (accepted)
                {
                    BinaryPrimitives.WriteUInt32LittleEndian(response, 1);
                    Put(response, 4, 257, config.Policy.Username);
                    Put(response, 518, 257, Environment.MachineName);
                    Put(response, 1032, 130, config.WindowsPassword);
                }
                await pipe.WriteAsync(response, deadline.Token);
                await pipe.FlushAsync(deadline.Token);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch { /* Fail closed; never log passwords, codes, or enrollment contents. */ }
            finally { CryptographicOperations.ZeroMemory(response); }
        }
    }
    private static void Put(byte[] buffer, int offset, int characters, string value)
    {
        if (value.Length >= characters) throw new InvalidDataException();
        Encoding.Unicode.GetBytes(value, 0, value.Length, buffer, offset);
    }
    private static bool IsLogonUi(NamedPipeServerStream pipe)
    {
        if (!GetNamedPipeClientProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out uint pid)) return false;
        var process = OpenProcess(0x1000, false, pid);
        if (process == IntPtr.Zero) return false;
        try
        {
            var path = new StringBuilder(1024); uint length = 1024;
            return QueryFullProcessImageName(process, 0, path, ref length) && string.Equals(path.ToString(),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "LogonUI.exe"), StringComparison.OrdinalIgnoreCase);
        }
        finally { CloseHandle(process); }
    }
    [DllImport("kernel32.dll", SetLastError=true)] private static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out uint pid);
    [DllImport("kernel32.dll", SetLastError=true)] private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder path, ref uint length);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
}
