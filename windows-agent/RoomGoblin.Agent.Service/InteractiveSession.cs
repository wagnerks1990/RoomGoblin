using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;

namespace RoomGoblin.Agent.Service;

internal sealed record InteractiveSessionInfo(
    uint SessionId,
    string UserName,
    SecurityIdentifier UserSid);

internal static class InteractiveSession
{
    private const int WtsActive = 0;
    private const int WtsUserName = 5;
    private const int WtsDomainName = 7;
    private const int TokenUser = 1;

    [StructLayout(LayoutKind.Sequential)]
    private struct WtsSessionInfo
    {
        public uint SessionId;
        public IntPtr WinStationName;
        public int State;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SidAndAttributes
    {
        public IntPtr Sid;
        public uint Attributes;
    }

    [DllImport("wtsapi32.dll", SetLastError = true)]
    private static extern bool WTSEnumerateSessions(
        IntPtr serverHandle,
        int reserved,
        int version,
        out IntPtr sessionInfo,
        out int count);

    [DllImport("wtsapi32.dll")]
    private static extern void WTSFreeMemory(IntPtr memory);

    [DllImport("wtsapi32.dll", EntryPoint = "WTSQuerySessionInformationW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool WTSQuerySessionInformation(
        IntPtr serverHandle,
        uint sessionId,
        int infoClass,
        out IntPtr buffer,
        out int bytesReturned);

    [DllImport("wtsapi32.dll", SetLastError = true)]
    internal static extern bool WTSQueryUserToken(uint sessionId, out IntPtr token);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool GetTokenInformation(
        IntPtr tokenHandle,
        int tokenInformationClass,
        IntPtr tokenInformation,
        int tokenInformationLength,
        out int returnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool CloseHandle(IntPtr handle);

    public static InteractiveSessionInfo? TryGetActive()
    {
        if (!OperatingSystem.IsWindows())
            return null;

        if (!WTSEnumerateSessions(IntPtr.Zero, 0, 1, out var buffer, out var count))
            return null;

        try
        {
            var size = Marshal.SizeOf<WtsSessionInfo>();
            for (var i = 0; i < count; i++)
            {
                var item = Marshal.PtrToStructure<WtsSessionInfo>(buffer + i * size);
                if (item.State != WtsActive)
                    continue;

                var user = QueryString(item.SessionId, WtsUserName);
                if (string.IsNullOrWhiteSpace(user))
                    continue;

                var domain = QueryString(item.SessionId, WtsDomainName);
                var account = string.IsNullOrWhiteSpace(domain) ? user : $"{domain}\\{user}";

                if (!WTSQueryUserToken(item.SessionId, out var token))
                    continue;

                try
                {
                    var sid = GetUserSid(token);
                    if (sid is null)
                        continue;

                    return new InteractiveSessionInfo(item.SessionId, account, sid);
                }
                finally
                {
                    CloseHandle(token);
                }
            }
        }
        finally
        {
            WTSFreeMemory(buffer);
        }

        return null;
    }

    private static string QueryString(uint sessionId, int infoClass)
    {
        if (!WTSQuerySessionInformation(
                IntPtr.Zero,
                sessionId,
                infoClass,
                out var buffer,
                out _))
            return "";

        try
        {
            return Marshal.PtrToStringUni(buffer) ?? "";
        }
        finally
        {
            WTSFreeMemory(buffer);
        }
    }

    private static SecurityIdentifier? GetUserSid(IntPtr token)
    {
        GetTokenInformation(token, TokenUser, IntPtr.Zero, 0, out var needed);
        if (needed <= 0)
            return null;

        var buffer = Marshal.AllocHGlobal(needed);
        try
        {
            if (!GetTokenInformation(token, TokenUser, buffer, needed, out _))
                throw new Win32Exception(Marshal.GetLastWin32Error());

            var tokenUser = Marshal.PtrToStructure<SidAndAttributes>(buffer);
            return new SecurityIdentifier(tokenUser.Sid);
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
    }
}
