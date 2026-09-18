using System.ComponentModel;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;

namespace RoomGoblin.Agent.Service;

internal sealed record SessionRequest(
    string Type,
    string? Text = null,
    int Quality = 70);

internal sealed record SessionResponse(
    bool Ok,
    string Message,
    string? Data = null,
    int Bytes = 0);

internal sealed class SessionBridge
{
    private readonly string _sessionExe;

    public SessionBridge()
    {
        _sessionExe = Path.Combine(
            AppContext.BaseDirectory,
            "RoomGoblinSessionAgent.exe");
    }

    public async Task<SessionResponse> InvokeAsync(
        InteractiveSessionInfo session,
        SessionRequest request,
        CancellationToken ct)
    {
        if (!File.Exists(_sessionExe))
            throw new FileNotFoundException(
                "RoomGoblin session helper is not installed.",
                _sessionExe);

        var pipeName = $"RoomGoblin.Session.{session.SessionId}.{Guid.NewGuid():N}";
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(
            new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
            PipeAccessRights.FullControl,
            AccessControlType.Allow));
        security.AddAccessRule(new PipeAccessRule(
            session.UserSid,
            PipeAccessRights.ReadWrite,
            AccessControlType.Allow));

        await using var pipe = NamedPipeServerStreamAcl.Create(
            pipeName,
            PipeDirection.InOut,
            1,
            PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous | PipeOptions.WriteThrough,
            0,
            0,
            security);

        using var process = LaunchInSession(
            session.SessionId,
            _sessionExe,
            $"--pipe {Quote(pipeName)} --token {Quote(token)}");

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        await pipe.WaitForConnectionAsync(timeout.Token);

        using var reader = new StreamReader(
            pipe,
            new UTF8Encoding(false),
            detectEncodingFromByteOrderMarks: false,
            bufferSize: 4096,
            leaveOpen: true);
        using var writer = new StreamWriter(
            pipe,
            new UTF8Encoding(false),
            bufferSize: 4096,
            leaveOpen: true)
        {
            AutoFlush = true
        };

        var authLine = await ReadLineBoundedAsync(reader,4096,timeout.Token);
        if (authLine is null)
            throw new InvalidDataException("Session helper disconnected before authentication.");

        using (var authDoc = JsonDocument.Parse(authLine))
        {
            if (!authDoc.RootElement.TryGetProperty("token", out var tokenNode) ||
                !CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(token),
                    Encoding.UTF8.GetBytes(tokenNode.GetString() ?? "")))
            {
                throw new UnauthorizedAccessException(
                    "Session helper authentication failed.");
            }
        }

        await writer.WriteLineAsync(JsonSerializer.Serialize(request));

        var responseLine = await ReadLineBoundedAsync(reader,10*1024*1024,timeout.Token);
        if (responseLine is null)
            throw new InvalidDataException("Session helper disconnected without a response.");

        var response = JsonSerializer.Deserialize<SessionResponse>(responseLine)
            ?? throw new InvalidDataException("Session helper returned an empty response.");

        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
        }

        return response;
    }

    private static async Task<string?> ReadLineBoundedAsync(
        StreamReader reader,
        int maxChars,
        CancellationToken ct)
    {
        var value=new StringBuilder(Math.Min(maxChars,4096));
        var buffer=new char[4096];
        while(true)
        {
            var count=await reader.ReadAsync(buffer.AsMemory(0,buffer.Length),ct);
            if(count==0)return value.Length==0?null:value.ToString();
            var newline=Array.IndexOf(buffer,'\n',0,count);
            var appendCount=newline>=0?newline:count;
            if(value.Length+appendCount>maxChars)
                throw new InvalidDataException("Session helper response exceeds the safe size limit.");
            value.Append(buffer,0,appendCount);
            if(newline>=0)return value.ToString().TrimEnd('\r');
        }
    }

    private static System.Diagnostics.Process LaunchInSession(
        uint sessionId,
        string executable,
        string arguments)
    {
        if (!InteractiveSession.WTSQueryUserToken(sessionId, out var userToken))
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "WTSQueryUserToken failed.");

        try
        {
            if (!DuplicateTokenEx(
                    userToken,
                    0xF01FF,
                    IntPtr.Zero,
                    2,
                    1,
                    out var primaryToken))
            {
                throw new Win32Exception(
                    Marshal.GetLastWin32Error(),
                    "DuplicateTokenEx failed.");
            }

            try
            {
                if (!CreateEnvironmentBlock(
                        out var environment,
                        primaryToken,
                        false))
                {
                    throw new Win32Exception(
                        Marshal.GetLastWin32Error(),
                        "CreateEnvironmentBlock failed.");
                }

                try
                {
                    var startup = new StartupInfo
                    {
                        cb = Marshal.SizeOf<StartupInfo>(),
                        lpDesktop = @"winsta0\default"
                    };

                    var commandLine = new StringBuilder(
                        $"{Quote(executable)} {arguments}");

                    if (!CreateProcessAsUser(
                            primaryToken,
                            null,
                            commandLine,
                            IntPtr.Zero,
                            IntPtr.Zero,
                            false,
                            0x00000400 | 0x00000010,
                            environment,
                            Path.GetDirectoryName(executable),
                            ref startup,
                            out var processInfo))
                    {
                        throw new Win32Exception(
                            Marshal.GetLastWin32Error(),
                            "CreateProcessAsUser failed.");
                    }

                    try
                    {
                        return System.Diagnostics.Process.GetProcessById(
                            unchecked((int)processInfo.dwProcessId));
                    }
                    finally
                    {
                        InteractiveSession.CloseHandle(processInfo.hThread);
                        InteractiveSession.CloseHandle(processInfo.hProcess);
                    }
                }
                finally
                {
                    DestroyEnvironmentBlock(environment);
                }
            }
            finally
            {
                InteractiveSession.CloseHandle(primaryToken);
            }
        }
        finally
        {
            InteractiveSession.CloseHandle(userToken);
        }
    }

    private static string Quote(string value) =>
        "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public int cb;
        public string? lpReserved;
        public string? lpDesktop;
        public string? lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool DuplicateTokenEx(
        IntPtr hExistingToken,
        uint dwDesiredAccess,
        IntPtr lpTokenAttributes,
        int impersonationLevel,
        int tokenType,
        out IntPtr phNewToken);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool CreateEnvironmentBlock(
        out IntPtr lpEnvironment,
        IntPtr hToken,
        bool bInherit);

    [DllImport("userenv.dll", SetLastError = true)]
    private static extern bool DestroyEnvironmentBlock(IntPtr lpEnvironment);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessAsUser(
        IntPtr hToken,
        string? lpApplicationName,
        StringBuilder lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string? lpCurrentDirectory,
        ref StartupInfo lpStartupInfo,
        out ProcessInformation lpProcessInformation);
}
