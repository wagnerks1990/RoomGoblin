using System.Text.Json;
using System.Text.Json.Serialization;

namespace RoomGoblin.Agent.Service;

internal sealed class AgentConfig
{
    [JsonPropertyName("hubUrl")]
    public string HubUrl { get; set; } = "";

    [JsonPropertyName("agentId")]
    public string AgentId { get; set; } = "";

    [JsonPropertyName("enrollmentToken")]
    public string EnrollmentToken { get; set; } = "";

    [JsonPropertyName("enrollmentTokenProtected")]
    public string EnrollmentTokenProtected { get; set; } = "";

    [JsonPropertyName("credentialProtected")]
    public string CredentialProtected { get; set; } = "";

    [JsonPropertyName("trustedPublisherThumbprint")]
    public string TrustedPublisherThumbprint { get; set; } = "";

    public static async Task<AgentConfig> LoadAsync(string path, CancellationToken ct)
    {
        await using var stream = File.OpenRead(path);
        var config = await JsonSerializer.DeserializeAsync<AgentConfig>(
            stream,
            AgentJson.Context.AgentConfig,
            ct
        );
        return config ?? throw new InvalidDataException("RoomGoblin agent configuration is empty.");
    }

    public async Task SaveAtomicAsync(string path, CancellationToken ct)
    {
        var dir = Path.GetDirectoryName(path)
            ?? throw new InvalidOperationException("Configuration path has no parent directory.");

        Directory.CreateDirectory(dir);
        var temp = Path.Combine(
            dir,
            $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.tmp"
        );

        try
        {
            await using (var stream = new FileStream(
                temp,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                4096,
                FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, this, AgentJson.Context.AgentConfig, ct);
                await stream.FlushAsync(ct);
            }

            if (File.Exists(path))
            {
                var backup = path + ".bak";
                if (File.Exists(backup))
                    File.Delete(backup);

                File.Replace(temp, path, backup, ignoreMetadataErrors: true);
                // A prior configuration can contain a legacy plaintext enrollment
                // token. Do not retain that secret in the replacement backup.
                if (File.Exists(backup))
                    File.Delete(backup);
            }
            else
            {
                File.Move(temp, path);
            }
        }
        finally
        {
            if (File.Exists(temp))
                File.Delete(temp);
        }
    }
}
