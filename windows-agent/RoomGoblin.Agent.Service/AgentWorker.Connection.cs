using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace RoomGoblin.Agent.Service;

internal sealed partial class AgentWorker
{
    private async Task HandleHelloAckAsync(
        JsonElement root,
        AgentConfig config,
        CancellationToken ct)
    {
        if (root.TryGetProperty(
                "credential",
                out var credentialNode))
        {
            var credential = credentialNode.GetString();
            if (!string.IsNullOrWhiteSpace(credential))
            {
                config.CredentialProtected =
                    MachineDpapi.ProtectString(credential);
                config.EnrollmentToken = "";
                config.EnrollmentTokenProtected = "";
                await config.SaveAtomicAsync(
                    _configPath,
                    ct);
            }
        }

        var health = new HealthFile(
            Version: AgentVersion,
            ConnectedAt: DateTimeOffset.UtcNow.ToString("O"),
            Transport: "native-windows-service");

        await WriteAtomicJsonAsync(
            AgentPaths.NativeHealthPath,
            health,
            ct);

        _logger.LogInformation(
            "RoomGoblin native agent handshake completed.");
    }

    private async Task HeartbeatLoopAsync(
        ClientWebSocket socket,
        CancellationToken ct)
    {
        using var timer =
            new PeriodicTimer(HeartbeatInterval);

        while (await timer.WaitForNextTickAsync(ct))
        {
            if (socket.State != WebSocketState.Open)
                return;

            var session = InteractiveSession.TryGetActive();
            var meta = GetMeta();
            var heartbeat = new HeartbeatMessage(
                Type: "heartbeat",
                Hostname: Environment.MachineName,
                User: session?.UserName ?? "",
                AgentVersion: AgentVersion,
                UptimeSeconds:
                    Environment.TickCount64 / 1000,
                Capabilities: GetCapabilities(),
                Meta: meta);

            await SendJsonAsync(
                socket,
                heartbeat,
                AgentJson.Context.HeartbeatMessage,
                ct);
        }
    }

    private static string[] GetCapabilities()
    {
        var capabilities = new List<string>
        {
            "message",
            "restart",
            "shutdown",
            "cancel-shutdown",
            "run-preset"
        };

        if (InteractiveSession.TryGetActive() is not null)
        {
            capabilities.Add("lock");
            capabilities.Add("logoff");
            capabilities.Add("screenshot");
            capabilities.Add("instructor-lock");
        }

        capabilities.Add("refresh-history");
        capabilities.Add("browser-history");

        if (File.Exists(
                Path.Combine(
                    AppContext.BaseDirectory,
                    "RoomGoblinAgentUpdater.exe")))
        {
            capabilities.Add("update-agent");
        }

        return capabilities.ToArray();
    }

    private static AgentMeta GetMeta()
    {
        var ipv4 =
            NetworkInterface.GetAllNetworkInterfaces()
                .Where(
                    i => i.OperationalStatus ==
                         OperationalStatus.Up)
                .SelectMany(
                    i => i.GetIPProperties()
                        .UnicastAddresses)
                .Where(
                    a => a.Address.AddressFamily ==
                         AddressFamily.InterNetwork &&
                         !IPAddress.IsLoopback(a.Address))
                .Select(a => a.Address.ToString())
                .Distinct(StringComparer.Ordinal)
                .OrderBy(
                    x => x,
                    StringComparer.Ordinal)
                .ToArray();

        return new AgentMeta(
            Os: Environment.OSVersion.VersionString,
            Ipv4: ipv4,
            InteractiveSession:
                InteractiveSession.TryGetActive() is not null,
            SqliteHistory: true);
    }

    private static IReadOnlyList<string> HubCandidates(AgentConfig config)
    {
        var values = new[] { config.HubUrl, config.FallbackHubUrl };
        return values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim().TrimEnd('/'))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static bool TryNormalizeHttpOrigin(string value, out string origin)
    {
        origin = "";
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            string.IsNullOrWhiteSpace(uri.Host) ||
            !string.IsNullOrWhiteSpace(uri.UserInfo) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return false;
        origin = uri.GetLeftPart(UriPartial.Authority);
        return true;
    }

    private static bool TryNormalizePreferredHttpsOrigin(string value, out string origin)
    {
        origin = "";
        if (!TryNormalizeHttpOrigin(value, out var normalized))
            return false;
        var uri = new Uri(normalized, UriKind.Absolute);
        if (uri.Scheme != Uri.UriSchemeHttps)
            return false;
        origin = normalized;
        return true;
    }

    private static Uri BuildWebSocketUri(
        string hubUrl)
    {
        var baseUri = new Uri(
            hubUrl.TrimEnd('/'),
            UriKind.Absolute);

        var builder = new UriBuilder(baseUri)
        {
            Scheme = baseUri.Scheme.Equals(
                "https",
                StringComparison.OrdinalIgnoreCase)
                ? "wss"
                : "ws",
            Port = baseUri.IsDefaultPort
                ? -1
                : baseUri.Port,
            Path = "/ws",
            Query = ""
        };

        return builder.Uri;
    }

    private static void ValidateConfig(
        AgentConfig config)
    {
        if (string.IsNullOrWhiteSpace(config.AgentId))
            throw new InvalidDataException(
                "RoomGoblin agent configuration is missing agentId.");

        if (!TryNormalizeHttpOrigin(config.HubUrl, out _))
        {
            throw new InvalidDataException(
                "RoomGoblin agent configuration has an invalid hubUrl.");
        }

        if (!string.IsNullOrWhiteSpace(config.FallbackHubUrl) &&
            !TryNormalizeHttpOrigin(config.FallbackHubUrl, out _))
        {
            throw new InvalidDataException(
                "RoomGoblin agent configuration has an invalid fallbackHubUrl.");
        }

        if (string.IsNullOrWhiteSpace(
                config.CredentialProtected) &&
            string.IsNullOrWhiteSpace(
                config.EnrollmentTokenProtected) &&
            string.IsNullOrWhiteSpace(
                config.EnrollmentToken))
        {
            throw new InvalidDataException(
                "RoomGoblin agent configuration has no usable credential or enrollment token.");
        }
    }

    private static string GetString(
        JsonElement element,
        string property)
    {
        return element.TryGetProperty(
                   property,
                   out var value) &&
               value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : "";
    }

}
