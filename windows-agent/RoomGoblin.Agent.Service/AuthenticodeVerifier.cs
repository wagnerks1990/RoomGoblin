using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;

namespace RoomGoblin.Agent.Service;

internal static class AuthenticodeVerifier
{
    private static readonly Guid GenericVerifyV2 =
        new("00AAC56B-CD44-11D0-8CC2-00C04FC295EE");

    public static void Verify(
        string path,
        string trustedPublisherThumbprint)
    {
        if (string.IsNullOrWhiteSpace(trustedPublisherThumbprint))
            return;

        var fileInfo = new WinTrustFileInfo(path);
        try
        {
            var data = new WinTrustData(fileInfo);
            try
            {
                var action = GenericVerifyV2;
                var status = WinVerifyTrust(
                    IntPtr.Zero,
                    ref action,
                    ref data);

                if (status != 0)
                    throw new InvalidDataException(
                        $"Authenticode verification failed for {Path.GetFileName(path)} (0x{status:X8}).");

                var cert = new X509Certificate2(
                    X509Certificate.CreateFromSignedFile(path));

                var expected = Normalize(trustedPublisherThumbprint);
                var actual = Normalize(cert.Thumbprint ?? "");

                if (!string.Equals(
                        expected,
                        actual,
                        StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidDataException(
                        $"{Path.GetFileName(path)} is not signed by the configured RoomGoblin publisher.");
                }
            }
            finally
            {
                data.Dispose();
            }
        }
        finally
        {
            fileInfo.Dispose();
        }
    }

    private static string Normalize(string value) =>
        new(value.Where(Uri.IsHexDigit).ToArray());

    [DllImport("wintrust.dll", ExactSpelling = true, PreserveSig = true)]
    private static extern int WinVerifyTrust(
        IntPtr hwnd,
        ref Guid pgActionID,
        ref WinTrustData pWVTData);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private sealed class WinTrustFileInfo : IDisposable
    {
        private readonly IntPtr _filePath;

        public uint cbStruct = (uint)Marshal.SizeOf<WinTrustFileInfo>();
        public IntPtr pcwszFilePath;
        public IntPtr hFile = IntPtr.Zero;
        public IntPtr pgKnownSubject = IntPtr.Zero;

        public WinTrustFileInfo(string filePath)
        {
            _filePath = Marshal.StringToCoTaskMemUni(filePath);
            pcwszFilePath = _filePath;
        }

        public void Dispose()
        {
            if (_filePath != IntPtr.Zero)
                Marshal.FreeCoTaskMem(_filePath);
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private sealed class WinTrustData : IDisposable
    {
        private readonly IntPtr _fileInfoPtr;

        public uint cbStruct = (uint)Marshal.SizeOf<WinTrustData>();
        public IntPtr pPolicyCallbackData = IntPtr.Zero;
        public IntPtr pSIPClientData = IntPtr.Zero;
        public uint dwUIChoice = 2;
        public uint fdwRevocationChecks = 0;
        public uint dwUnionChoice = 1;
        public IntPtr pFile;
        public uint dwStateAction = 0;
        public IntPtr hWVTStateData = IntPtr.Zero;
        public IntPtr pwszURLReference = IntPtr.Zero;
        public uint dwProvFlags = 0x00000010;
        public uint dwUIContext = 0;

        public WinTrustData(WinTrustFileInfo fileInfo)
        {
            _fileInfoPtr = Marshal.AllocCoTaskMem(
                Marshal.SizeOf<WinTrustFileInfo>());
            Marshal.StructureToPtr(
                fileInfo,
                _fileInfoPtr,
                false);
            pFile = _fileInfoPtr;
        }

        public void Dispose()
        {
            if (_fileInfoPtr != IntPtr.Zero)
            {
                Marshal.DestroyStructure<WinTrustFileInfo>(_fileInfoPtr);
                Marshal.FreeCoTaskMem(_fileInfoPtr);
            }
        }
    }
}
