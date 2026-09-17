using System.Text.Json;

namespace RoomGoblin.Agent.Service;

internal static class SelfTest
{
    public static async Task<int> RunAsync(string configPath)
    {
        try
        {
            if (!OperatingSystem.IsWindows())
            {
                Console.Error.WriteLine("Self-test requires Windows because the existing RoomGoblin credential uses LocalMachine DPAPI.");
                return 2;
            }

            var config = await AgentConfig.LoadAsync(configPath, CancellationToken.None);

            if (string.IsNullOrWhiteSpace(config.AgentId))
                throw new InvalidDataException("agentId is empty.");

            _ = new Uri(config.HubUrl, UriKind.Absolute);

            var credential = MachineDpapi.UnprotectString(config.CredentialProtected);
            var enrollment = MachineDpapi.UnprotectString(config.EnrollmentTokenProtected);

            if (string.IsNullOrWhiteSpace(credential) && string.IsNullOrWhiteSpace(enrollment))
                throw new InvalidDataException("No decryptable permanent credential or enrollment token is present.");

            var roundTrip = Guid.NewGuid().ToString("N");
            var protectedRoundTrip = MachineDpapi.ProtectString(roundTrip);
            var unprotectedRoundTrip = MachineDpapi.UnprotectString(protectedRoundTrip);

            if (!string.Equals(roundTrip, unprotectedRoundTrip, StringComparison.Ordinal))
                throw new InvalidOperationException("LocalMachine DPAPI round-trip failed.");

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                ok = true,
                configPath,
                config.AgentId,
                config.HubUrl,
                hasPermanentCredential = !string.IsNullOrWhiteSpace(credential),
                hasEnrollmentToken = !string.IsNullOrWhiteSpace(enrollment),
                dpapiRoundTrip = true
            }));

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            return 1;
        }
    }
}
