using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace RoomGoblin.SignIn;

internal static class Installer
{
    internal const string ServiceName = "RoomGoblinDailySignIn";
    internal const string ClassId = "{D9D7C883-47D8-4A46-BD48-0AC61F329D80}";
    private const string ProviderKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\Credential Providers\" + ClassId;
    private const string ClassKey = @"SOFTWARE\Classes\CLSID\" + ClassId;
    private const string SettingsKey = @"SOFTWARE\RoomGoblin\DailySignIn";
    private static readonly string[] Files = {"RoomGoblinSignIn.exe", "RoomGoblinCredentialProvider.dll"};

    internal static int Run(string[] args)
    {
        if (args.Length == 1 && args[0] == "version")
        { Console.WriteLine(typeof(Installer).Assembly.GetCustomAttributes(false).OfType<System.Reflection.AssemblyInformationalVersionAttribute>().Single().InformationalVersion); return 0; }
        if (!OperatingSystem.IsWindows() || RuntimeInformation.OSArchitecture != Architecture.X64 || !Environment.Is64BitProcess ||
            !new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator))
            throw new UnauthorizedAccessException();
        using var ownership = new Mutex(true, @"Global\RoomGoblin.DailySignIn.Install", out bool acquired);
        if (!acquired) throw new InvalidOperationException("Another sign-in installation or recovery is running.");
        if (args.Length == 2 && args[0] == "install") { Install(args[1]); return 0; }
        if (args.Length == 1 && args[0] == "recover") { Recover(); return 0; }
        Console.WriteLine("RoomGoblin daily sign-in (Windows x64 pilot).\nInstall from a separate administrator desktop: RoomGoblinSignIn.exe install <encrypted-enrollment.json>\nRemove sign-in requirement and set a manual password: RoomGoblinSignIn.exe recover\nNever install on your only administrator account. Kyle Wagner.");
        return 2;
    }
    private static string ReadSecret(string prompt)
    {
        if (Console.IsInputRedirected) throw new InvalidOperationException("Interactive console required.");
        Console.Write(prompt); var value = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(true);
            if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return value.ToString(); }
            if (key.Key == ConsoleKey.Escape) throw new OperationCanceledException();
            if (key.Key == ConsoleKey.Backspace) { if (value.Length > 0) value.Length--; }
            else if (!char.IsControl(key.KeyChar) && value.Length < 1024) value.Append(key.KeyChar);
        }
    }
    private static void Install(string enrollmentFile)
    {
        ProtectedFiles.NoLinks(ProtectedFiles.Root); ProtectedFiles.NoLinks(ProtectedFiles.Install);
        if (Directory.Exists(ProtectedFiles.Root) || Directory.Exists(ProtectedFiles.Install) || Registry.LocalMachine.OpenSubKey(ProviderKey) != null)
            throw new InvalidOperationException("Existing sign-in state requires recovery before installation.");
        var artifacts = ValidatePackage();
        ProtectedFiles.NoLinks(enrollmentFile);
        using var input = new FileStream(enrollmentFile, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (input.Length is < 1 or > 16384) throw new InvalidDataException();
        var bytes = new byte[(int)input.Length]; input.ReadExactly(bytes);
        var policy = Codes.Decrypt(bytes, ReadSecret("Enrollment passphrase (hidden): "), DateTimeOffset.UtcNow, Environment.MachineName);
        var sid = AccountSid(policy.Username);
        if (IsAdministrator(policy.Username) || sid.EndsWith("-500", StringComparison.Ordinal) || WindowsIdentity.GetCurrent().User?.Value == sid)
            throw new InvalidOperationException("The esports account must be a separate standard local account.");
        using var administrator = WindowsIdentity.GetCurrent();
        if (!administrator.Name.StartsWith(Environment.MachineName + "\\", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Use a separate local administrator account for this offline pilot.");
        var adminPassword = ReadSecret("Current local administrator password (hidden; verifies recovery access): ");
        if (adminPassword.Length == 0) throw new InvalidOperationException("The recovery administrator must have a password.");
        using (var token = Authenticate(administrator.Name.Split('\\')[1], adminPassword))
        {
            using var verified = new WindowsIdentity(token.DangerousGetHandle());
            if (verified.User?.Value != administrator.User?.Value) throw new UnauthorizedAccessException();
        }
        adminPassword = "";
        RejectActiveSession(policy.Username);
        // This first pilot deliberately accepts only the user's existing blank-password account.
        // An existing password/Hello configuration needs a separately qualified migration.
        using (var token = Authenticate(policy.Username, "")) { }
        Console.WriteLine("This pilot replaces blank-password automatic sign-in with offline daily-code sign-in.\nKeep this administrator account and a VM snapshot or system backup for recovery.\nType ENABLE to apply to the enrolled local account:");
        if (Console.ReadLine() != "ENABLE") throw new OperationCanceledException();
        using var winlogon = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon", true) ?? throw new InvalidOperationException();
        if (winlogon.GetValue("AutoAdminLogon")?.ToString() == "1" &&
            !string.Equals(winlogon.GetValue("DefaultUserName")?.ToString(), policy.Username, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Automatic sign-in belongs to another account.");
        // Protect the parent too: DELETE_CHILD rights on a student-owned parent
        // would otherwise let that owner replace a correctly ACLed policy folder.
        ProtectedFiles.SecureDirectory(Path.GetDirectoryName(ProtectedFiles.Root)!);
        ProtectedFiles.SecureDirectory(Path.GetDirectoryName(ProtectedFiles.Install)!);
        ProtectedFiles.SecureDirectory(ProtectedFiles.Root); ProtectedFiles.SecureDirectory(ProtectedFiles.Install);
        foreach (var name in Files)
        {
            var source = Path.Combine(AppContext.BaseDirectory, name); ProtectedFiles.NoLinks(source);
            using var file = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.Read);
            if (!string.Equals(Convert.ToHexString(SHA256.HashData(file)), artifacts[name], StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Package changed after validation.");
            file.Position = 0;
            using var destination = new FileStream(Path.Combine(ProtectedFiles.Install, name), FileMode.CreateNew, FileAccess.Write, FileShare.None);
            file.CopyTo(destination); destination.Flush(true);
        }
        var password = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)) + "aA1!";
        var config = new Configuration(policy, sid, password, false);
        ProtectedFiles.Write(ProtectedFiles.ConfigPath, config);
        ProtectedFiles.Write(ProtectedFiles.StatePath, new Attempts {LatestUtc=DateTimeOffset.UtcNow.ToUnixTimeSeconds()});
        // Prepared identity is durable BEFORE changing Windows. Any interruption retains
        // both the recovery executable and the protected password for administrator recovery.
        winlogon.SetValue("AutoAdminLogon", "0"); winlogon.DeleteValue("DefaultPassword", false);
        DeleteAutologonSecret();
        using (var policyKey = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"))
            policyKey.SetValue("DisableAutomaticRestartSignOn", 1, RegistryValueKind.DWord);
        ChangePassword(policy.Username, "", password);
        using (var token = Authenticate(policy.Username, password)) { }
        using (var settings = Registry.LocalMachine.CreateSubKey(SettingsKey))
        { settings.SetValue("AccountSid", sid); settings.SetValue("Username", policy.Username); }
        using (var cls = Registry.LocalMachine.CreateSubKey(ClassKey + @"\InprocServer32"))
        { cls.SetValue("", Path.Combine(ProtectedFiles.Install, Files[1])); cls.SetValue("ThreadingModel", "Apartment"); }
        using (var provider = Registry.LocalMachine.CreateSubKey(ProviderKey)) provider.SetValue("", "RoomGoblin daily code");
        RunSc("create", ServiceName, "binPath=", $"\"{Path.Combine(ProtectedFiles.Install, Files[0])}\" service", "start=", "auto", "DisplayName=", "RoomGoblin Daily Sign-In");
        RunSc("failure", ServiceName, "reset=", "86400", "actions=", "restart/5000/restart/15000/restart/60000");
        ProtectedFiles.Write(ProtectedFiles.ConfigPath, config with {Active=true});
        RunSc("start", ServiceName);
        using (var service = new System.ServiceProcess.ServiceController(ServiceName))
            service.WaitForStatus(System.ServiceProcess.ServiceControllerStatus.Running, TimeSpan.FromSeconds(20));
        Console.WriteLine("Installed. Keep the administrator session available. Test Windows sign-in with today's code on this pilot PC.\nIf sign-in fails, use the separate administrator account and run the installed RoomGoblinSignIn.exe recover.\nDelete the encrypted enrollment file after the test; it expires for new installations after 24 hours.");
    }
    private static void Recover()
    {
        var config = ProtectedFiles.Read<Configuration>(ProtectedFiles.ConfigPath);
        if (AccountSid(config.Policy.Username) != config.AccountSid) throw new InvalidOperationException("Account identity changed.");
        RejectActiveSession(config.Policy.Username);
        string password = ReadSecret("New manual Windows password (at least 16 characters): ");
        if (password.Length < 16 || password.Length > 128 || password != ReadSecret("Repeat new password: ")) throw new InvalidDataException();
        // Change using the prior password, preserving Windows user encryption keys.
        // Prepared installs may have stopped before their initial password change.
        string previous = config.RecoveryPassword ?? config.WindowsPassword;
        try { using var token = Authenticate(config.Policy.Username, previous); }
        catch
        {
            previous = config.WindowsPassword;
            try { using var token = Authenticate(config.Policy.Username, previous); }
            catch when (!config.Active && config.RecoveryPassword == null)
            { using var token = Authenticate(config.Policy.Username, ""); previous = ""; }
        }
        // Journal both credentials before the OS write. A retry after a crash can
        // authenticate whichever side of the change reached Windows.
        ProtectedFiles.Write(ProtectedFiles.ConfigPath, config with {WindowsPassword=previous, RecoveryPassword=password});
        ChangePassword(config.Policy.Username, previous, password);
        using (var token = Authenticate(config.Policy.Username, password)) { }
        Registry.LocalMachine.DeleteSubKeyTree(ProviderKey, false);
        Registry.LocalMachine.DeleteSubKeyTree(ClassKey, false);
        Registry.LocalMachine.DeleteSubKeyTree(SettingsKey, false);
        try
        {
            using var service = new System.ServiceProcess.ServiceController(ServiceName);
            if (service.Status != System.ServiceProcess.ServiceControllerStatus.Stopped)
            { service.Stop(); service.WaitForStatus(System.ServiceProcess.ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(20)); }
            RunSc("delete", ServiceName);
        }
        catch (InvalidOperationException error) when (error.InnerException is Win32Exception {NativeErrorCode:1060})
        { /* Only a confirmed missing service is safe after an interrupted prepare. */ }
        File.Delete(ProtectedFiles.ConfigPath); File.Delete(ProtectedFiles.StatePath);
        // Loaded DLL/executable removal is deferred to the administrator after reboot.
        Console.WriteLine("Daily-code sign-in removed. Use the new manual Windows password. Automatic sign-in remains disabled.\nAfter restarting Windows, the administrator can remove the empty policy directory and the sign-in program directory.");
    }
    private static Dictionary<string,string> ValidatePackage()
    {
        var manifestPath = Path.Combine(AppContext.BaseDirectory, "manifest.json"); ProtectedFiles.NoLinks(manifestPath);
        if (new FileInfo(manifestPath).Length > 16384) throw new InvalidDataException();
        using var manifest = JsonDocument.Parse(File.ReadAllBytes(manifestPath));
        var entries = manifest.RootElement.GetProperty("files").EnumerateArray().ToArray();
        if (entries.Length != 2 || !entries.Select(x=>x.GetProperty("file").GetString()).Order().SequenceEqual(Files.Order())) throw new InvalidDataException();
        foreach (var entry in entries)
        {
            var path = Path.Combine(AppContext.BaseDirectory, entry.GetProperty("file").GetString()!); ProtectedFiles.NoLinks(path);
            using var stream = File.OpenRead(path);
            if (stream.Length != entry.GetProperty("size").GetInt64() || stream.Length is < 1 or > 150000000 ||
                !string.Equals(Convert.ToHexString(SHA256.HashData(stream)), entry.GetProperty("sha256").GetString(), StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException("Package integrity failed.");
        }
        return entries.ToDictionary(x=>x.GetProperty("file").GetString()!, x=>x.GetProperty("sha256").GetString()!, StringComparer.Ordinal);
    }
    private static void RunSc(params string[] arguments)
    {
        var info = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "sc.exe")) {UseShellExecute=false, CreateNoWindow=true, RedirectStandardOutput=true, RedirectStandardError=true};
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        using var process = Process.Start(info) ?? throw new IOException();
        // sc.exe output is fixed, bounded metadata; never contains passwords.
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(20000)) { process.Kill(true); throw new TimeoutException(); }
        if (process.ExitCode != 0) throw new IOException("Service operation failed.");
    }
    internal static string AccountSid(string username)
    {
        int result = NetUserGetInfo(null, username, 23, out var data);
        if (result != 0) throw new Win32Exception(result);
        try { var info = Marshal.PtrToStructure<User23>(data); if ((info.Flags & 2) != 0) throw new InvalidOperationException(); return new SecurityIdentifier(info.Sid).Value; }
        finally { NetApiBufferFree(data); }
    }
    internal static bool IsAdministrator(string username)
    {
        int result = NetUserGetLocalGroups(null, username, 0, 1, out var data, -1, out int read, out _);
        if (result != 0) throw new Win32Exception(result);
        try
        {
            for (int i=0; i<read; i++)
            {
                var name = Marshal.PtrToStringUni(Marshal.ReadIntPtr(data, i * IntPtr.Size))!;
                var sid = (SecurityIdentifier)new NTAccount(name).Translate(typeof(SecurityIdentifier));
                if (sid.IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid)) return true;
            }
            return false;
        }
        finally { NetApiBufferFree(data); }
    }
    private static Microsoft.Win32.SafeHandles.SafeAccessTokenHandle Authenticate(string username, string password)
    {
        if (!LogonUser(username, Environment.MachineName, password, 2, 0, out var token)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return token;
    }
    private static void ChangePassword(string username, string oldPassword, string newPassword)
    { int result = NetUserChangePassword(null, username, oldPassword, newPassword); if (result != 0) throw new Win32Exception(result); }
    private static void RejectActiveSession(string username)
    {
        if (!WTSEnumerateSessions(IntPtr.Zero, 0, 1, out var data, out int count)) throw new Win32Exception(Marshal.GetLastWin32Error());
        try
        {
            int size = Marshal.SizeOf<Session>();
            for (int i=0; i<count; i++)
            {
                var session = Marshal.PtrToStructure<Session>(data + i*size);
                if (!WTSQuerySessionInformation(IntPtr.Zero, session.Id, 5, out var value, out _)) throw new Win32Exception(Marshal.GetLastWin32Error());
                try { if (string.Equals(Marshal.PtrToStringUni(value), username, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Sign the esports account out first."); }
                finally { WTSFreeMemory(value); }
            }
        }
        finally { WTSFreeMemory(data); }
    }
    private static void DeleteAutologonSecret()
    {
        var attributes = new ObjectAttributes {Length=Marshal.SizeOf<ObjectAttributes>()};
        int result = LsaOpenPolicy(IntPtr.Zero, ref attributes, 0x20, out var policy);
        if (result != 0) throw new Win32Exception((int)LsaNtStatusToWinError(result));
        var name = new LsaString("DefaultPassword");
        try { result = LsaStorePrivateData(policy, ref name, IntPtr.Zero); if (result != 0 && LsaNtStatusToWinError(result) != 2) throw new Win32Exception((int)LsaNtStatusToWinError(result)); }
        finally { Marshal.FreeHGlobal(name.Buffer); LsaClose(policy); }
    }
    [StructLayout(LayoutKind.Sequential)] private struct User23 { public IntPtr Name, FullName, Comment; public uint Flags; public IntPtr Sid; }
    [StructLayout(LayoutKind.Sequential)] private struct Session { public int Id; public IntPtr Name; public int State; }
    [StructLayout(LayoutKind.Sequential)] private struct ObjectAttributes { public int Length; public IntPtr Root, Name; public uint Attributes; public IntPtr Security, Quality; }
    [StructLayout(LayoutKind.Sequential)] private struct LsaString { public ushort Length, MaximumLength; public IntPtr Buffer; public LsaString(string value) {Length=(ushort)(value.Length*2); MaximumLength=(ushort)(Length+2); Buffer=Marshal.StringToHGlobalUni(value);} }
    [DllImport("netapi32.dll", CharSet=CharSet.Unicode)] private static extern int NetUserGetInfo(string? server, string user, int level, out IntPtr data);
    [DllImport("netapi32.dll", CharSet=CharSet.Unicode)] private static extern int NetUserGetLocalGroups(string? server, string user, int level, int flags, out IntPtr data, int max, out int read, out int total);
    [DllImport("netapi32.dll")] private static extern int NetApiBufferFree(IntPtr data);
    [DllImport("netapi32.dll", CharSet=CharSet.Unicode)] private static extern int NetUserChangePassword(string? domain, string username, string oldPassword, string newPassword);
    [DllImport("advapi32.dll", EntryPoint="LogonUserW", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool LogonUser(string username, string domain, string password, int type, int provider, out Microsoft.Win32.SafeHandles.SafeAccessTokenHandle token);
    [DllImport("wtsapi32.dll", EntryPoint="WTSEnumerateSessionsW", SetLastError=true)] private static extern bool WTSEnumerateSessions(IntPtr server, int reserved, int version, out IntPtr sessions, out int count);
    [DllImport("wtsapi32.dll", EntryPoint="WTSQuerySessionInformationW", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool WTSQuerySessionInformation(IntPtr server, int session, int info, out IntPtr value, out int bytes);
    [DllImport("wtsapi32.dll")] private static extern void WTSFreeMemory(IntPtr value);
    [DllImport("advapi32.dll")] private static extern int LsaOpenPolicy(IntPtr system, ref ObjectAttributes attributes, uint access, out IntPtr policy);
    [DllImport("advapi32.dll")] private static extern int LsaStorePrivateData(IntPtr policy, ref LsaString key, IntPtr data);
    [DllImport("advapi32.dll")] private static extern uint LsaNtStatusToWinError(int status);
    [DllImport("advapi32.dll")] private static extern int LsaClose(IntPtr policy);
}
