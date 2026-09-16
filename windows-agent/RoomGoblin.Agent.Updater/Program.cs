using System.Diagnostics;
using System.Text.Json;

var options = ParseArgs(args);

if (!options.TryGetValue("service", out var serviceName) ||
    !options.TryGetValue("install-dir", out var installDir) ||
    !options.TryGetValue("stage", out var stageDir) ||
    !options.TryGetValue("health", out var healthPath) ||
    !options.TryGetValue("version", out var expectedVersion))
{
    Console.Error.WriteLine("Missing updater arguments.");
    return 2;
}

var updateRoot = Path.GetDirectoryName(stageDir)
    ?? throw new InvalidOperationException("Update stage has no parent.");

var backupDir = Path.Combine(
    updateRoot,
    "rollback-" + Guid.NewGuid().ToString("N"));

Directory.CreateDirectory(backupDir);

var files = new[]
{
    "RoomGoblinAgent.exe",
    "RoomGoblinSessionAgent.exe",
    "RoomGoblinAgentUpdater.exe",
    "RoomGoblinAgentBootstrap.exe"
};

try
{
    Thread.Sleep(1500);

    RunProcess(
        "sc.exe",
        new[] { "stop", serviceName },
        allowFailure: true);

    WaitForServiceStopped(
        serviceName,
        TimeSpan.FromSeconds(20));

    foreach (var file in files)
    {
        var current = Path.Combine(installDir, file);
        if (File.Exists(current))
        {
            File.Copy(
                current,
                Path.Combine(backupDir, file),
                overwrite: true);
        }
    }

    foreach (var file in files)
    {
        var staged = Path.Combine(stageDir, file);
        if (!File.Exists(staged))
        {
            throw new FileNotFoundException(
                $"Staged native update is missing {file}.",
                staged);
        }

        File.Copy(
            staged,
            Path.Combine(installDir, file),
            overwrite: true);
    }

    if (File.Exists(healthPath))
        File.Delete(healthPath);

    RunProcess(
        "sc.exe",
        new[] { "start", serviceName });

    if (!WaitForHealth(
            healthPath,
            expectedVersion,
            TimeSpan.FromSeconds(45)))
    {
        throw new InvalidOperationException(
            "Updated native agent did not report healthy.");
    }

    TryDeleteDirectory(backupDir);
    TryDeleteDirectory(stageDir);

    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex);

    RunProcess(
        "sc.exe",
        new[] { "stop", serviceName },
        allowFailure: true);

    WaitForServiceStopped(
        serviceName,
        TimeSpan.FromSeconds(15));

    foreach (var file in files)
    {
        var backup = Path.Combine(backupDir, file);
        if (!File.Exists(backup))
            continue;

        File.Copy(
            backup,
            Path.Combine(installDir, file),
            overwrite: true);
    }

    RunProcess(
        "sc.exe",
        new[] { "start", serviceName },
        allowFailure: true);

    return 1;
}

static bool WaitForHealth(
    string path,
    string version,
    TimeSpan timeout)
{
    var deadline = DateTimeOffset.UtcNow + timeout;

    while (DateTimeOffset.UtcNow < deadline)
    {
        Thread.Sleep(1000);

        try
        {
            if (!File.Exists(path))
                continue;

            using var doc = JsonDocument.Parse(
                File.ReadAllText(path));

            var reported = doc.RootElement
                .GetProperty("version")
                .GetString();

            var connected = doc.RootElement
                .GetProperty("connectedAt")
                .GetString();

            if (string.Equals(
                    reported,
                    version,
                    StringComparison.Ordinal) &&
                DateTimeOffset.TryParse(connected, out var at) &&
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

static void WaitForServiceStopped(
    string serviceName,
    TimeSpan timeout)
{
    var deadline = DateTimeOffset.UtcNow + timeout;

    while (DateTimeOffset.UtcNow < deadline)
    {
        var result = RunProcess(
            "sc.exe",
            new[] { "query", serviceName },
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

static ProcessResult RunProcess(
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

static Dictionary<string, string> ParseArgs(string[] args)
{
    var result = new Dictionary<string, string>(
        StringComparer.OrdinalIgnoreCase);

    for (var i = 0; i + 1 < args.Length; i += 2)
    {
        if (!args[i].StartsWith("--", StringComparison.Ordinal))
            continue;

        result[args[i][2..]] = args[i + 1];
    }

    return result;
}

static void TryDeleteDirectory(string path)
{
    try
    {
        if (Directory.Exists(path))
            Directory.Delete(path, recursive: true);
    }
    catch
    {
    }
}

internal sealed record ProcessResult(
    int ExitCode,
    string Output,
    string Error);
