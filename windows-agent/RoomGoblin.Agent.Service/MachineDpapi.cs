using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace RoomGoblin.Agent.Service;

internal static class MachineDpapi
{
    private const int CryptProtectLocalMachine = 0x4;

    [StructLayout(LayoutKind.Sequential)]
    private struct DataBlob
    {
        public int cbData;
        public IntPtr pbData;
    }

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(
        ref DataBlob pDataIn,
        string? szDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        int dwFlags,
        out DataBlob pDataOut);

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptUnprotectData(
        ref DataBlob pDataIn,
        IntPtr ppszDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        int dwFlags,
        out DataBlob pDataOut);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LocalFree(IntPtr hMem);

    public static string ProtectString(string value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        var bytes = Encoding.UTF8.GetBytes(value);
        return Convert.ToBase64String(Protect(bytes));
    }

    public static string UnprotectString(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "";

        var protectedBytes = Convert.FromBase64String(value);
        return Encoding.UTF8.GetString(Unprotect(protectedBytes));
    }

    private static byte[] Protect(byte[] input) =>
        InvokeDpapi(input, protect: true);

    private static byte[] Unprotect(byte[] input) =>
        InvokeDpapi(input, protect: false);

    private static byte[] InvokeDpapi(byte[] input, bool protect)
    {
        var inputPtr = Marshal.AllocHGlobal(input.Length);
        try
        {
            Marshal.Copy(input, 0, inputPtr, input.Length);
            var inputBlob = new DataBlob { cbData = input.Length, pbData = inputPtr };
            DataBlob outputBlob;

            var ok = protect
                ? CryptProtectData(
                    ref inputBlob, null, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
                    CryptProtectLocalMachine, out outputBlob)
                : CryptUnprotectData(
                    ref inputBlob, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
                    CryptProtectLocalMachine, out outputBlob);

            if (!ok)
                throw new Win32Exception(Marshal.GetLastWin32Error());

            try
            {
                var output = new byte[outputBlob.cbData];
                Marshal.Copy(outputBlob.pbData, output, 0, outputBlob.cbData);
                return output;
            }
            finally
            {
                if (outputBlob.pbData != IntPtr.Zero)
                    LocalFree(outputBlob.pbData);
            }
        }
        finally
        {
            Marshal.FreeHGlobal(inputPtr);
        }
    }
}
