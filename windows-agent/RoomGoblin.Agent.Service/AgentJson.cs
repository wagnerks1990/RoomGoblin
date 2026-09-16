using System.Text.Json;
using System.Text.Json.Serialization;

namespace RoomGoblin.Agent.Service;

[JsonSerializable(typeof(AgentConfig))]
[JsonSerializable(typeof(HelloMessage))]
[JsonSerializable(typeof(HeartbeatMessage))]
[JsonSerializable(typeof(HealthFile))]
[JsonSerializable(typeof(CommandResultMessage))]
[JsonSerializable(typeof(BrowserHistoryMessage))]
[JsonSerializable(typeof(BrowserHistoryItem[]))]
[JsonSerializable(typeof(Dictionary<string, object?>))]
internal partial class AgentJson : JsonSerializerContext
{
    public static AgentJson Context { get; } = new(new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false
    });
}

internal sealed record AgentMeta(
    string Os,
    string[] Ipv4,
    bool InteractiveSession,
    bool SqliteHistory);

internal sealed record HelloMessage(
    string Type,
    string Role,
    string AgentId,
    string Hostname,
    string AgentVersion,
    string Credential,
    string EnrollmentToken,
    string[] Capabilities,
    AgentMeta Meta);

internal sealed record HeartbeatMessage(
    string Type,
    string Hostname,
    string User,
    string AgentVersion,
    long UptimeSeconds,
    string[] Capabilities,
    AgentMeta Meta);

internal sealed record HealthFile(
    string Version,
    string ConnectedAt,
    string Transport);

internal sealed record CommandResultMessage(
    string Type,
    string CommandId,
    string Action,
    bool Ok,
    string Message);

internal sealed record BrowserHistoryMessage(
    string Type,
    BrowserHistoryItem[] Items);
