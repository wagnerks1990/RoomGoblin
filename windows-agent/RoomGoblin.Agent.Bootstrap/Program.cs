using System.Diagnostics;
using System.Security.Principal;
using System.Text.Json;

if (!OperatingSystem.IsWindows())
{
    Console.Error.WriteLine("RoomGoblin native agent bootstrap requires Windows.");
    return 2;
}

if (!IsAdministrator())
{
    Console.Error.WriteLine("Run RoomGoblinAgentBootstrap.exe as Administrator.");
    return 3;
}

var command = args.Length > 0
    ? args[0].ToLowerInvariant()
    : "install";

var sourceRoot = AppContext.BaseDirectory;
var installRoot = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
    "RoomGoblin",
    "Agent");

var dataRoot = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
    "ClassroomControlHub");

const string serviceName = "RoomGoblinAgent";
const string legacyTask = "RoomGoblin Agent";

return command switch
{
    "install" or "repair" => Install(),
    "uninstall" => Uninstall(),
    _ => Usage()
};

int Install()
{
    var required = new[]
    {
        "RoomGoblinAgent.exe",
        "RoomGoblinSessionAgent.exe",
        "RoomGoblinAgentUpdater.exe",
        "RoomGoblinAgentBootstrap.exe"
    };

    foreach (var name in required)
    {
        var source = Path.Combine(sourceRoot, name);
        if (!File.Exists(source))
        {
            Console.Error.WriteLine($"Missing package file: {source}");
            return 10;
        }
    }

    var config = Path.Combine(dataRoot, "lab-agent.json");
    if (!File.Exists(config))
    {
        Console.Error.WriteLine(
            $"Existing RoomGoblin configuration not found: {config}");
        return 11;
    }

    Directory.CreateDirectory(installRoot);

    var legacyExisted = ScheduledTaskExists(legacyTask);
    var legacyWasEnabled = legacyExisted;

    if (legacyExisted)
    {
        RunProcess(
            "schtasks.exe",
            new[] { "/End", "/TN", legacyTask },
            allowFailure: true);

        RunProcess(
            "schtasks.exe",
            new[] { "/Change", "/TN", legacyTask, "/Disable" },
            allowFailure: true);
    }

    try
    {
        StopAndDeleteService(serviceName);

        foreach (var name in required)
        {
            var source = Path.GetFullPath(Path.Combine(sourceRoot, name));
            var target = Path.GetFullPath(Path.Combine(installRoot, name));

            if (!source.Equals(target, StringComparison.OrdinalIgnoreCase))
                File.Copy(source, target, overwrite: true);
        }

        var exe = Path.Combine(installRoot, "RoomGoblinAgent.exe");

        RunProcess(
            "sc.exe",
            new[]
            {
                "create",
                serviceName,
                "binPath=",
                exe,
                "start=",
                "delayed-auto",
                "DisplayName=",
                "RoomGoblin Agent"
            });

        RunProcess(
            "sc.exe",
            new[]
            {
                "failure",
                serviceName,
                "reset=",
                "86400",
                "actions=",
                "restart/5000/restart/15000/restart/60000"
            });

        RunProcess(
            "sc.exe",
            new[] { "failureflag", serviceName, "1" },
            allowFailure: true);

        var health = Path.Combine(dataRoot, "native-service-health.json");
        if (File.Exists(health))
            File.Delete(health);

        RunProcess(
            "sc.exe",
            new[] { "start", serviceName });

        if (!WaitForFreshHealth(
                health,
                TimeSpan.FromSeconds(35)))
        {
            throw new InvalidOperationException(
                "Native service did not report a fresh RoomGoblin connection.");
        }

        Console.WriteLine("RoomGoblin native agent installed and connected.");
        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex);

        StopAndDeleteService(serviceName);

        if (legacyExisted && legacyWasEnabled)
        {
            RunProcess(
                "schtasks.exe",
                new[] { "/Change", "/TN", legacyTask, "/Enable" },
                allowFailure: true);

            RunProcess(
                "schtasks.exe",
                new[] { "/Run", "/TN", legacyTask },
                allowFailure: true);
        }

        return 20;
    }
}

int Uninstall()
{
    StopAndDeleteService(serviceName);

    if (ScheduledTaskExists(legacyTask))
    {
        RunProcess(
            "schtasks.exe",
            new[] { "/Change", "/TN", legacyTask, "/Enable" },
            allowFailure: true);

        RunProcess(
            "schtasks.exe",
            new[] { "/Run", "/TN", legacyTask },
            allowFailure: true);
    }

    try
    {
        if (Directory.Exists(installRoot))
            Directory.Delete(installRoot, recursive: true);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(
            $"Warning: could not remove install directory: {ex.Message}");
    }

    Console.WriteLine(
        "RoomGoblin native service removed. Legacy scheduled-task agent restored when available.");
    return 0;
}

void StopAndDeleteService(string name)
{
    RunProcess(
        "sc.exe",
        new[] { "stop", name },
        allowFailure: true);

    WaitForServiceStopped(name, TimeSpan.FromSeconds(15));

    RunProcess(
        "sc.exe",
        new[] { "delete", name },
        allowFailure: true);

    Thread.Sleep(500);
}

bool ScheduledTaskExists(string name)
{
    var result = RunProcess(
        "schtasks.exe",
        new[] { "/Query", "/TN", name },
        capture: true,
        allowFailure: true);

    return result.ExitCode == 0;
}

bool WaitForFreshHealth(string healthPath, TimeSpan timeout)
{
    var deadline = DateTimeOffset.UtcNow + timeout;

    while (DateTimeOffset.UtcNow < deadline)
    {
        Thread.Sleep(1000);

        try
        {
            if (!File.Exists(healthPath))
                continue;

            using var doc = JsonDocument.Parse(
                File.ReadAllText(healthPath));

            var connected = doc.RootElement
                .GetProperty("connectedAt")
                .GetString();

            if (DateTimeOffset.TryParse(connected, out var at) &&
                DateTimeOffset.UtcNow - at < TimeSpan.FromMinutes(1))
            {
                return true;
            }
        }
        catch
        {
        }
    }

    return false;
}

void WaitForServiceStopped(string name, TimeSpan timeout)
{
    var deadline = DateTimeOffset.UtcNow + timeout;

    while (DateTimeOffset.UtcNow < deadline)
    {
        var result = RunProcess(
            "sc.exe",
            new[] { "query", name },
            capture: true,
            allowFailure: true);

        if (result.ExitCode != 0 ||
            result.Output.Contains(
                "STOPPED",
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        Thread.Sleep(500);
    }
}

ProcessResult RunProcess(
    string file,
    IEnumerable<string> arguments,
    bool capture = false,
    bool allowFailure = false)
{
    var psi = new ProcessStartInfo
    {
        FileName = file,
        UseShellExecute = false,
        CreateNoWindow = true,
        RedirectStandardOutput = capture,
        RedirectStandardError = capture
    };

    foreach (var argument in arguments)
        psi.ArgumentList.Add(argument);

    using var process = Process.Start(psi)
        ?? throw new InvalidOperationException($"Could not start {file}.");

    var outputTask = capture
        ? process.StandardOutput.ReadToEndAsync()
        : Task.FromResult("");

    var errorTask = capture
        ? process.StandardError.ReadToEndAsync()
        : Task.FromResult("");

    process.WaitForExit();

    var output = outputTask.GetAwaiter().GetResult();
    var error = errorTask.GetAwaiter().GetResult();

    if (process.ExitCode != 0 && !allowFailure)
    {
        throw new InvalidOperationException(
            $"{file} failed with exit code {process.ExitCode}" +
            (string.IsNullOrWhiteSpace(error) ? "" : $": {error.Trim()}"));
    }

    return new ProcessResult(process.ExitCode, output, error);
}

bool IsAdministrator()
{
    using var identity = WindowsIdentity.GetCurrent();
    return new WindowsPrincipal(identity)
        .IsInRole(WindowsBuiltInRole.Administrator);
}

int Usage()
{
    Console.WriteLine(
        "Usage: RoomGoblinAgentBootstrap.exe [install|repair|uninstall]");
    return 1;
}

internal sealed record ProcessResult(
    int ExitCode,
    string Output,
    string Error);
