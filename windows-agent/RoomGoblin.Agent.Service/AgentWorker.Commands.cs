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
    private async Task HandleCommandAsync(
        ClientWebSocket socket,
        JsonElement root,
        CancellationToken ct)
    {
        if (!root.TryGetProperty("command", out var command) ||
            command.ValueKind != JsonValueKind.Object)
        {
            _logger.LogWarning(
                "Ignoring malformed lab.command without command object.");
            return;
        }

        var commandId = GetString(command, "id");
        var action = GetString(command, "action");

        if (string.IsNullOrWhiteSpace(commandId) ||
            string.IsNullOrWhiteSpace(action))
        {
            _logger.LogWarning(
                "Ignoring malformed lab.command without id/action.");
            return;
        }

        var payload = command.TryGetProperty(
                "payload",
                out var payloadNode) &&
            payloadNode.ValueKind == JsonValueKind.Object
                ? payloadNode
                : default;

        try
        {
            switch (action)
            {
                case "message":
                {
                    var text = payload.ValueKind == JsonValueKind.Object
                        ? GetString(payload, "text")
                        : "";

                    if (text.Length > 2000)
                        throw new InvalidOperationException(
                            "Message exceeds the 2,000-character Windows delivery limit.");

                    await RunProcessBoundedAsync(
                        Path.Combine(
                            Environment.SystemDirectory,
                            "msg.exe"),
                        new[] { "*", "/TIME:120", text },
                        TimeSpan.FromSeconds(15),
                        ct);

                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        "Message displayed",
                        ct);
                    break;
                }

                case "restart":
                    await SchedulePowerAsync(
                        restart: true,
                        ct);
                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        "Restart scheduled",
                        ct);
                    break;

                case "shutdown":
                    await SchedulePowerAsync(
                        restart: false,
                        ct);
                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        "Shutdown scheduled",
                        ct);
                    break;

                case "cancel-shutdown":
                    await RunProcessBoundedAsync(
                        Path.Combine(
                            Environment.SystemDirectory,
                            "shutdown.exe"),
                        new[] { "/a" },
                        TimeSpan.FromSeconds(10),
                        ct);
                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        "Pending shutdown cancelled",
                        ct);
                    break;

                case "logoff":
                {
                    var session = InteractiveSession.TryGetActive()
                        ?? throw new InvalidOperationException(
                            "No interactive Windows session is available");

                    await RunProcessBoundedAsync(
                        Path.Combine(
                            Environment.SystemDirectory,
                            "logoff.exe"),
                        new[] { session.SessionId.ToString() },
                        TimeSpan.FromSeconds(10),
                        ct);

                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        $"Interactive session {session.SessionId} logged off",
                        ct);
                    break;
                }

                case "lock":
                case "instructor-lock":
                {
                    var session = InteractiveSession.TryGetActive()
                        ?? throw new InvalidOperationException(
                            "No interactive Windows session is available");

                    var response = await _sessionBridge.InvokeAsync(
                        session,
                        new SessionRequest("lock"),
                        ct);

                    if (!response.Ok)
                        throw new InvalidOperationException(
                            response.Message);

                    var message = action == "instructor-lock"
                        ? "Windows secure lock applied. Custom image, message, timer, and passcode are intentionally not used."
                        : "Interactive workstation locked";

                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        message,
                        ct);
                    break;
                }

                case "instructor-unlock":
                    throw new InvalidOperationException(
                        "Windows secure workstations cannot be remotely unlocked safely. The student or administrator must authenticate.");

                case "app-lock":
                    throw new InvalidOperationException(
                        "Application/site lock requires Windows kiosk or AppLocker policy and is not enabled by this constrained agent. Use Veyon or managed Windows policy.");

                case "app-unlock":
                    throw new InvalidOperationException(
                        "No agent application lock was applied. Remove the managed kiosk/AppLocker policy through its management system.");

                case "screenshot":
                {
                    var session = InteractiveSession.TryGetActive()
                        ?? throw new InvalidOperationException(
                            "No interactive Windows user session is available for screen capture");

                    var quality = payload.ValueKind == JsonValueKind.Object &&
                                  payload.TryGetProperty(
                                      "quality",
                                      out var qualityNode) &&
                                  qualityNode.TryGetInt32(
                                      out var parsedQuality)
                        ? parsedQuality
                        : 70;
                    quality=Math.Clamp(quality,25,90);

                    var response = await _sessionBridge.InvokeAsync(
                        session,
                        new SessionRequest(
                            "screenshot",
                            Quality: quality),
                        ct);

                    if (!response.Ok ||
                        string.IsNullOrWhiteSpace(response.Data))
                        throw new InvalidOperationException(
                            response.Message);

                    var save = payload.ValueKind == JsonValueKind.Object &&
                               payload.TryGetProperty(
                                   "save",
                                   out var saveNode) &&
                               saveNode.ValueKind == JsonValueKind.True;

                    var alertId = payload.ValueKind == JsonValueKind.Object
                        ? GetString(payload, "alertId")
                        : "";
                    if(alertId.Length>128)
                        throw new InvalidOperationException("Screenshot alertId exceeds 128 characters.");
                    if(response.Bytes<=0||response.Bytes>7*1024*1024||
                       response.Data.Length>10*1024*1024)
                        throw new InvalidDataException("Session helper returned an oversized screenshot.");

                    await SendRawJsonAsync(
                        socket,
                        new
                        {
                            type = "lab.screenshot",
                            data = response.Data,
                            save,
                            alertId
                        },
                        ct);

                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        $"Screenshot captured ({response.Bytes} bytes)",
                        ct);
                    break;
                }

                case "run-preset":
                {
                    var preset = payload.ValueKind == JsonValueKind.Object
                        ? GetString(payload, "preset")
                        : "";

                    var spec = preset switch
                    {
                        "gpupdate" => (
                            Path.Combine(
                                Environment.SystemDirectory,
                                "gpupdate.exe"),
                            new[] { "/force" },
                            TimeSpan.FromSeconds(120)),
                        "flushdns" => (
                            Path.Combine(
                                Environment.SystemDirectory,
                                "ipconfig.exe"),
                            new[] { "/flushdns" },
                            TimeSpan.FromSeconds(30)),
                        "renew-network" => (
                            Path.Combine(
                                Environment.SystemDirectory,
                                "ipconfig.exe"),
                            new[] { "/renew" },
                            TimeSpan.FromSeconds(90)),
                        "system-info" => (
                            Path.Combine(
                                Environment.SystemDirectory,
                                "systeminfo.exe"),
                            Array.Empty<string>(),
                            TimeSpan.FromSeconds(60)),
                        _ => throw new InvalidOperationException(
                            "Unsupported preset")
                    };

                    await RunProcessBoundedAsync(
                        spec.Item1,
                        spec.Item2,
                        spec.Item3,
                        ct);

                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        $"Preset '{preset}' completed.",
                        ct);
                    break;
                }

                case "refresh-history":
                case "browser-history":
                {
                    var items = await _historyCollector.CollectAsync(500, ct);
                    var message = new BrowserHistoryMessage(
                        Type: "lab.history",
                        Items: items.ToArray());

                    await SendJsonAsync(
                        socket,
                        message,
                        AgentJson.Context.BrowserHistoryMessage,
                        ct);

                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        $"{items.Count} browser history records reported",
                        ct);
                    break;
                }

                case "update-agent":
                {
                    var config = await AgentConfig.LoadAsync(_configPath, ct);
                    var updater = new NativeUpdateClient();
                    var stage = await updater.StageAsync(config, ct);
                    var version = NativeUpdateClient.ReadVersion(stage);

                    NativeUpdateClient.LaunchUpdater(stage, version);

                    await SendCommandResultAsync(
                        socket,
                        commandId,
                        action,
                        true,
                        $"Native agent update to {version} verified and staged; restarting",
                        ct);

                    _lifetime.StopApplication();
                    break;
                }

                default:
                    throw new InvalidOperationException(
                        "Command is not supported by this native agent build");
            }
        }
        catch (Exception ex) when (
            ex is not OperationCanceledException ||
            !ct.IsCancellationRequested)
        {
            _logger.LogWarning(
                ex,
                "Native command {Action} failed.",
                action);

            await SendCommandResultAsync(
                socket,
                commandId,
                action,
                false,
                ex.Message,
                ct);
        }
    }

    private static async Task SchedulePowerAsync(
        bool restart,
        CancellationToken ct)
    {
        var arguments = new List<string>
        {
            restart ? "/r" : "/s",
            "/t",
            "30",
            "/d",
            "p:4:1",
            "/c",
            "RoomGoblin administrator request"
        };

        await RunProcessBoundedAsync(
            Path.Combine(
                Environment.SystemDirectory,
                "shutdown.exe"),
            arguments,
            TimeSpan.FromSeconds(10),
            ct);
    }

}
