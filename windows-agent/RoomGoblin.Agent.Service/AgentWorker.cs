using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace RoomGoblin.Agent.Service;

internal sealed partial class AgentWorker : BackgroundService
{
    private static readonly string AgentVersion =
        typeof(AgentWorker).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? typeof(AgentWorker).Assembly.GetName().Version?.ToString()
        ?? "unknown";
    private const int MaxMessageBytes = 4 * 1024 * 1024;
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan ReconnectDelay = TimeSpan.FromSeconds(10);

    private readonly ILogger<AgentWorker> _logger;
    private readonly IHostApplicationLifetime _lifetime;
    private readonly string _configPath;
    private readonly SessionBridge _sessionBridge = new();
    private readonly BrowserHistoryCollector _historyCollector = new();
    // ClientWebSocket permits one concurrent sender and one receiver. Heartbeats,
    // telemetry, and command results share this gate so frames never overlap.
    private readonly SemaphoreSlim _sendGate = new(1, 1);

    public AgentWorker(
        ILogger<AgentWorker> logger,
        IHostApplicationLifetime lifetime)
    {
        _logger = logger;
        _lifetime = lifetime;
        _configPath = AgentPaths.DefaultConfigPath;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(AgentPaths.Root);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunSessionAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RoomGoblin native agent session failed.");
            }

            try
            {
                await Task.Delay(ReconnectDelay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task RunSessionAsync(CancellationToken ct)
    {
        var config = await AgentConfig.LoadAsync(_configPath, ct);
        ValidateConfig(config);

        var credential = MachineDpapi.UnprotectString(config.CredentialProtected);
        var enrollment = !string.IsNullOrWhiteSpace(config.EnrollmentTokenProtected)
            ? MachineDpapi.UnprotectString(config.EnrollmentTokenProtected)
            : config.EnrollmentToken ?? "";

        if (!string.IsNullOrWhiteSpace(config.EnrollmentToken) &&
            string.IsNullOrWhiteSpace(config.EnrollmentTokenProtected))
        {
            config.EnrollmentTokenProtected =
                MachineDpapi.ProtectString(config.EnrollmentToken);
            config.EnrollmentToken = "";
            await config.SaveAtomicAsync(_configPath, ct);
            enrollment =
                MachineDpapi.UnprotectString(config.EnrollmentTokenProtected);
        }

        var connection = await ConnectToHubAsync(config, ct);
        using var socket = connection.Socket;
        var uri = connection.Uri;

        var capabilities = GetCapabilities();
        var meta = GetMeta();

        var hello = new HelloMessage(
            Type: "hello",
            Role: "lab-agent",
            AgentId: config.AgentId,
            Hostname: Environment.MachineName,
            AgentVersion: AgentVersion,
            Credential: credential,
            EnrollmentToken: enrollment,
            Capabilities: capabilities,
            Meta: meta);

        await SendJsonAsync(
            socket,
            hello,
            AgentJson.Context.HelloMessage,
            ct);

        using var heartbeatCts =
            CancellationTokenSource.CreateLinkedTokenSource(ct);
        var heartbeatTask =
            HeartbeatLoopAsync(socket, heartbeatCts.Token);

        try
        {
            while (socket.State == WebSocketState.Open &&
                   !ct.IsCancellationRequested)
            {
                var payload = await ReceiveTextAsync(socket, ct);
                if (payload is null)
                    break;

                using var document = JsonDocument.Parse(payload);
                if (!document.RootElement.TryGetProperty(
                        "type",
                        out var typeNode))
                    continue;

                var type = typeNode.GetString();
                if (string.Equals(
                        type,
                        "hello.ack",
                        StringComparison.Ordinal))
                {
                    await HandleHelloAckAsync(
                        document.RootElement,
                        config,
                        ct);
                }
                else if (string.Equals(
                    type,
                    "lab.command",
                    StringComparison.Ordinal))
                {
                    await HandleCommandAsync(
                        socket,
                        document.RootElement,
                        ct);
                }
            }
        }
        finally
        {
            heartbeatCts.Cancel();
            try
            {
                await heartbeatTask;
            }
            catch (OperationCanceledException)
            {
            }

            if (socket.State is
                WebSocketState.Open or
                WebSocketState.CloseReceived)
            {
                try
                {
                    await socket.CloseOutputAsync(
                        WebSocketCloseStatus.NormalClosure,
                        "RoomGoblin native agent session ending",
                        CancellationToken.None);
                }
                catch
                {
                }
            }
        }
    }

}
