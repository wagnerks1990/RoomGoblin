using System.Diagnostics;
using System.Text;
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

static void WaitForServiceStopped(string serviceName, TimeSpan timeout)
{
    var elapsed = Stopwatch.StartNew();
    while (elapsed.Elapsed < timeout)
    {
        var remaining = timeout - elapsed.Elapsed;
        if (remaining <= TimeSpan.Zero) break;
        var result = RunProcess(
            "sc.exe", new[] { "query", serviceName },
            capture: true, allowFailure: true, timeout: remaining);
        if (result.ExitCode == 1060) return; // ERROR_SERVICE_DOES_NOT_EXIST
        if (result.ExitCode != 0)
            throw new InvalidOperationException($"Could not confirm that {serviceName} stopped (query exit code {result.ExitCode}).");
        if (result.Output.Contains("STOPPED", StringComparison.OrdinalIgnoreCase)) return;
        remaining = timeout - elapsed.Elapsed;
        if (remaining > TimeSpan.Zero)
            Thread.Sleep(remaining < TimeSpan.FromMilliseconds(500) ? remaining : TimeSpan.FromMilliseconds(500));
    }
    throw new TimeoutException($"Timed out waiting for {serviceName} to stop.");
}

static ProcessResult RunProcess(
    string file,
    IEnumerable<string> arguments,
    bool capture = false,
    bool allowFailure = false,
    TimeSpan? timeout = null)
{
    var budget = timeout ?? TimeSpan.FromSeconds(30);
    if (budget <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(timeout));
    var psi = new ProcessStartInfo
    {
        FileName = file,
        UseShellExecute = false,
        CreateNoWindow = true,
        RedirectStandardOutput = capture,
        RedirectStandardError = capture
    };
    foreach (var argument in arguments) psi.ArgumentList.Add(argument);
    using var process = Process.Start(psi)
        ?? throw new InvalidOperationException($"Could not start {file}.");
    using var deadline = new CancellationTokenSource(budget);
    var outputTask = capture ? ReadProcessOutputAsync(process.StandardOutput, deadline.Token) : Task.FromResult("");
    var errorTask = capture ? ReadProcessOutputAsync(process.StandardError, deadline.Token) : Task.FromResult("");
    try
    {
        Task.WhenAll(process.WaitForExitAsync(deadline.Token), outputTask, errorTask).GetAwaiter().GetResult();
    }
    catch (OperationCanceledException)
    {
        try { process.Kill(entireProcessTree: true); } catch { }
        throw new TimeoutException($"{file} timed out after {budget.TotalSeconds:0.###} seconds.");
    }
    var output = outputTask.GetAwaiter().GetResult();
    var error = errorTask.GetAwaiter().GetResult();
    if (process.ExitCode != 0 && !allowFailure)
    {
        var detail = error.Trim();
        if (detail.Length > 2048) detail = detail[..2048];
        throw new InvalidOperationException(
            $"{file} failed with exit code {process.ExitCode}" +
            (detail.Length == 0 ? "" : $": {detail}"));
    }
    return new ProcessResult(process.ExitCode, output, error);
}

static async Task<string> ReadProcessOutputAsync(StreamReader reader, CancellationToken ct)
{
    const int maxChars = 64 * 1024;
    var retained = new StringBuilder();
    var buffer = new char[4096];
    while (true)
    {
        var count = await reader.ReadAsync(buffer.AsMemory(), ct);
        if (count == 0) return retained.ToString();
        var keep = Math.Min(count, maxChars - retained.Length);
        if (keep > 0) retained.Append(buffer, 0, keep);
    }
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
