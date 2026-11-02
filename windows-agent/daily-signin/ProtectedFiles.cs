using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.Json;

namespace RoomGoblin.SignIn;

internal sealed record Configuration(Enrollment Policy, string AccountSid, string WindowsPassword, bool Active, string? RecoveryPassword = null);
internal static class ProtectedFiles
{
    internal static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RoomGoblin", "DailySignIn");
    internal static readonly string Install = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RoomGoblin", "SignIn");
    internal static string ConfigPath => Path.Combine(Root, "identity.dat");
    internal static string StatePath => Path.Combine(Root, "attempts.dat");
    internal static void NoLinks(string path)
    {
        for (var current = Path.GetFullPath(path); !string.IsNullOrEmpty(current); current = Path.GetDirectoryName(current))
            if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("Reparse points are not allowed in sign-in paths.");
    }
    internal static void SecureDirectory(string path)
    {
        NoLinks(path);
        if (Directory.Exists(path))
        {
            // Existing shared program parents are inspected, never tightened:
            // changing their inheritance could break the ordinary Lab Agent.
            var current = new DirectoryInfo(path).GetAccessControl();
            var owner = current.GetOwner(typeof(SecurityIdentifier)) as SecurityIdentifier;
            bool Trusted(SecurityIdentifier sid) => sid.IsWellKnown(WellKnownSidType.LocalSystemSid) ||
                sid.IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid) || sid == WindowsIdentity.GetCurrent().User;
            if (owner == null || !Trusted(owner)) throw new IOException("Sign-in parent directory has an untrusted owner.");
            const FileSystemRights writes = FileSystemRights.Write | FileSystemRights.Delete | FileSystemRights.DeleteSubdirectoriesAndFiles | FileSystemRights.ChangePermissions | FileSystemRights.TakeOwnership;
            foreach (FileSystemAccessRule rule in current.GetAccessRules(true, true, typeof(SecurityIdentifier)))
                if (rule.AccessControlType == AccessControlType.Allow && (rule.PropagationFlags & PropagationFlags.InheritOnly) == 0 &&
                    (rule.FileSystemRights & writes) != 0 && !Trusted((SecurityIdentifier)rule.IdentityReference))
                    throw new IOException("Sign-in parent directory is writable by another identity.");
            return;
        }
        // Atomic creation must succeed; do not take over a directory another
        // process creates between the existence check and this call.
        if (!CreateDirectory(path, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
        var security = new DirectorySecurity(); security.SetAccessRuleProtection(true, false);
        security.SetOwner(new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null));
        foreach (var sid in new[] {WellKnownSidType.LocalSystemSid, WellKnownSidType.BuiltinAdministratorsSid})
            security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid, null), FileSystemRights.FullControl,
                InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
        new DirectoryInfo(path).SetAccessControl(security);
    }
    internal static void Write<T>(string path, T value)
    {
        NoLinks(path); var plain = JsonSerializer.SerializeToUtf8Bytes(value, Codes.Json);
        byte[] encrypted;
        try { encrypted = Crypt(plain, true); } finally { CryptographicOperations.ZeroMemory(plain); }
        string stage = path + ".new-" + Guid.NewGuid().ToString("N");
        try
        {
            using (var stream = new FileStream(stage, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            { stream.Write(encrypted); stream.Flush(true); }
            File.Move(stage, path, true);
        }
        finally { if (File.Exists(stage)) File.Delete(stage); }
    }
    internal static T Read<T>(string path)
    {
        NoLinks(path);
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length is < 1 or > 65536) throw new InvalidDataException("Invalid protected sign-in file.");
        var bytes = new byte[(int)stream.Length]; stream.ReadExactly(bytes);
        var plain = Crypt(bytes, false);
        try { return JsonSerializer.Deserialize<T>(plain, Codes.Json) ?? throw new InvalidDataException("Missing protected sign-in data."); }
        finally { CryptographicOperations.ZeroMemory(plain); }
    }

    [StructLayout(LayoutKind.Sequential)] private struct Blob { public int Length; public IntPtr Data; }
    [DllImport("crypt32.dll", SetLastError=true, CharSet=CharSet.Unicode)] private static extern bool CryptProtectData(ref Blob input, string? description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
    [DllImport("crypt32.dll", SetLastError=true)] private static extern bool CryptUnprotectData(ref Blob input, IntPtr description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr pointer);
    [DllImport("kernel32.dll", EntryPoint="CreateDirectoryW", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool CreateDirectory(string path, IntPtr attributes);
    private static byte[] Crypt(byte[] input, bool encrypt)
    {
        var memory = Marshal.AllocHGlobal(input.Length); Blob output = default;
        try
        {
            Marshal.Copy(input, 0, memory, input.Length); var blob = new Blob {Length=input.Length, Data=memory};
            bool ok = encrypt ? CryptProtectData(ref blob, null, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 5, out output)
                : CryptUnprotectData(ref blob, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, out output);
            if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error());
            var result = new byte[output.Length]; Marshal.Copy(output.Data, result, 0, result.Length); return result;
        }
        finally
        {
            Marshal.Copy(new byte[input.Length], 0, memory, input.Length); Marshal.FreeHGlobal(memory);
            if (output.Data != IntPtr.Zero) { Marshal.Copy(new byte[output.Length], 0, output.Data, output.Length); LocalFree(output.Data); }
        }
    }
}
