namespace RoomGoblin.Agent.Service;

internal static class AgentPaths
{
    public static string Root =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ClassroomControlHub");

    public static string DefaultConfigPath => Path.Combine(Root, "lab-agent.json");

    public static string NativeHealthPath => Path.Combine(Root, "native-service-health.json");
}
