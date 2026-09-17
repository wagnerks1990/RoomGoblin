using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

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
var options = ParseOptions(args.Skip(1).ToArray());

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
    var freshEnrollment = HasFreshEnrollmentArguments(options);
    var createdFreshConfig = false;

    try
    {
        if (freshEnrollment)
        {
            if (options.TryGetValue("--enrollment-file", out var enrollmentFile) &&
                !string.IsNullOrWhiteSpace(enrollmentFile))
            {
                VerifyPackageManifest(required);
                WriteFreshEnrollmentConfigFromFile(config, enrollmentFile);
            }
            else
            {
                WriteFreshEnrollmentConfig(config, options);
            }
            createdFreshConfig = true;
        }
        else if (!File.Exists(config))
        {
            Console.Error.WriteLine(
                "Existing RoomGoblin configuration was not found. For a new computer, provide --hub-url, --agent-id and --enrollment-token.");
            return 11;
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Could not prepare RoomGoblin enrollment: {ex.Message}");
        return 12;
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

        if (createdFreshConfig)
        {
            try
            {
                if (File.Exists(config))
                    File.Delete(config);
            }
            catch
            {
            }
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

Dictionary<string, string?> ParseOptions(string[] optionArgs)
{
    var parsed = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < optionArgs.Length; i++)
    {
        var key = optionArgs[i];
        if (!key.StartsWith("--", StringComparison.Ordinal))
            throw new ArgumentException($"Unexpected argument: {key}");

        if (key.Equals("--allow-http", StringComparison.OrdinalIgnoreCase))
        {
            parsed[key] = "true";
            continue;
        }

        if (i + 1 >= optionArgs.Length || optionArgs[i + 1].StartsWith("--", StringComparison.Ordinal))
            throw new ArgumentException($"Missing value for {key}.");

        parsed[key] = optionArgs[++i];
    }

    return parsed;
}

bool HasFreshEnrollmentArguments(Dictionary<string, string?> parsed)
{
    var known = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "--hub-url", "--agent-id", "--enrollment-token", "--enrollment-file",
        "--allow-http", "--trusted-publisher-thumbprint"
    };

    foreach (var key in parsed.Keys)
        if (!known.Contains(key))
            throw new ArgumentException($"Unknown option: {key}");

    var enrollmentFile = parsed.ContainsKey("--enrollment-file");
    var supplied = new[] { "--hub-url", "--agent-id", "--enrollment-token" }
        .Count(parsed.ContainsKey);

    if (enrollmentFile && supplied > 0)
        throw new ArgumentException(
            "--enrollment-file cannot be combined with --hub-url, --agent-id or --enrollment-token.");

    if (enrollmentFile)
        return true;

    if (supplied == 0)
        return false;
    if (supplied != 3)
        throw new ArgumentException(
            "Fresh enrollment requires --hub-url, --agent-id and --enrollment-token together.");
    return true;
}

void VerifyPackageManifest(string[] required)
{
    var manifestPath = Path.Combine(sourceRoot, "manifest.json");
    if (!File.Exists(manifestPath))
        throw new InvalidDataException(
            "Native enrollment packages must include manifest.json next to the bootstrap.");

    using var manifest = JsonDocument.Parse(File.ReadAllText(manifestPath));
    var root = manifest.RootElement;
    if (!root.TryGetProperty("ok", out var ok) || ok.ValueKind != JsonValueKind.True ||
        !root.TryGetProperty("files", out var files) || files.ValueKind != JsonValueKind.Array)
    {
        throw new InvalidDataException("Invalid RoomGoblin native package manifest.");
    }

    var entries = files.EnumerateArray().ToArray();
    if (entries.Length != required.Length)
        throw new InvalidDataException("Native package manifest contains an unexpected file count.");

    var requiredSet = new HashSet<string>(required, StringComparer.OrdinalIgnoreCase);
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    foreach (var entry in entries)
    {
        var name = entry.GetProperty("name").GetString() ?? "";
        var expected = entry.GetProperty("sha256").GetString() ?? "";

        if (!requiredSet.Contains(name) || !seen.Add(name))
            throw new InvalidDataException($"Unexpected or duplicate native package file: {name}");

        if (!Regex.IsMatch(expected, "^[0-9a-fA-F]{64}$"))
            throw new InvalidDataException($"Invalid SHA-256 for {name}.");

        var path = Path.Combine(sourceRoot, name);
        using var stream = File.OpenRead(path);
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var actual = Convert.ToHexString(sha256.ComputeHash(stream));

        if (!actual.Equals(expected, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException($"SHA-256 verification failed for {name}.");
    }

    if (seen.Count != requiredSet.Count)
        throw new InvalidDataException("Native package manifest is incomplete.");
}

void WriteFreshEnrollmentConfigFromFile(string configPath, string enrollmentPath)
{
    var fullPath = Path.GetFullPath(enrollmentPath);
    string json;
    try
    {
        json = File.ReadAllText(fullPath);
    }
    finally
    {
        try
        {
            if (File.Exists(fullPath))
                File.Delete(fullPath);
        }
        catch
        {
        }
    }

    using var document = JsonDocument.Parse(json);
    var root = document.RootElement;
    var schema = root.TryGetProperty("schema", out var schemaValue)
        ? schemaValue.GetString()
        : null;
    if (!string.Equals(schema, "roomgoblin-native-enrollment-v1", StringComparison.Ordinal))
        throw new InvalidDataException("Unsupported RoomGoblin enrollment file schema.");

    string ReadRequired(string name)
    {
        if (!root.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            throw new InvalidDataException($"Enrollment file is missing {name}.");
        var text = value.GetString();
        if (string.IsNullOrWhiteSpace(text))
            throw new InvalidDataException($"Enrollment file contains an empty {name}.");
        return text;
    }

    var parsed = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
    {
        ["--hub-url"] = ReadRequired("hubUrl"),
        ["--agent-id"] = ReadRequired("agentId"),
        ["--enrollment-token"] = ReadRequired("enrollmentToken")
    };

    if (root.TryGetProperty("allowHttp", out var allowHttp) &&
        allowHttp.ValueKind == JsonValueKind.True)
    {
        parsed["--allow-http"] = "true";
    }

    if (root.TryGetProperty("trustedPublisherThumbprint", out var publisher) &&
        publisher.ValueKind == JsonValueKind.String &&
        !string.IsNullOrWhiteSpace(publisher.GetString()))
    {
        parsed["--trusted-publisher-thumbprint"] = publisher.GetString();
    }

    WriteFreshEnrollmentConfig(configPath, parsed);
}

void WriteFreshEnrollmentConfig(string configPath, Dictionary<string, string?> parsed)
{
    var hubUrl = RequireOption(parsed, "--hub-url").Trim().TrimEnd('/');
    var agentId = RequireOption(parsed, "--agent-id").Trim();
    var enrollmentToken = RequireOption(parsed, "--enrollment-token");
    var allowHttp = parsed.ContainsKey("--allow-http");
    var publisher = parsed.TryGetValue("--trusted-publisher-thumbprint", out var thumbprint)
        ? Regex.Replace(thumbprint ?? "", "\\s+", "").ToUpperInvariant()
        : "";

    if (!Uri.TryCreate(hubUrl, UriKind.Absolute, out var hubUri) ||
        string.IsNullOrWhiteSpace(hubUri.Host) ||
        (hubUri.Scheme != Uri.UriSchemeHttps && hubUri.Scheme != Uri.UriSchemeHttp))
    {
        throw new ArgumentException("--hub-url must be an absolute http:// or https:// URL.");
    }

    if (hubUri.Scheme == Uri.UriSchemeHttp && !allowHttp)
        throw new ArgumentException("HTTP enrollment requires the explicit --allow-http option.");

    if (!Regex.IsMatch(agentId, "^[A-Za-z0-9._-]{1,128}$"))
        throw new ArgumentException("--agent-id must contain only letters, digits, period, underscore or hyphen.");

    if (enrollmentToken.Length < 32 || enrollmentToken.Length > 4096)
        throw new ArgumentException("--enrollment-token has an invalid length.");

    if (publisher.Length > 0 && !Regex.IsMatch(publisher, "^(?:[0-9A-F]{40}|[0-9A-F]{64})$"))
        throw new ArgumentException("--trusted-publisher-thumbprint must be a SHA-1 or SHA-256 hexadecimal thumbprint.");

    Directory.CreateDirectory(dataRoot);
    RunProcess(
        "icacls.exe",
        new[] { dataRoot, "/inheritance:r", "/grant:r", "SYSTEM:(OI)(CI)(F)", "Administrators:(OI)(CI)(F)" });

    var configObject = new
    {
        hubUrl = hubUri.GetLeftPart(UriPartial.Authority),
        agentId,
        enrollmentToken = "",
        enrollmentTokenProtected = MachineDpapi.ProtectString(enrollmentToken),
        credentialProtected = "",
        trustedPublisherThumbprint = publisher
    };

    var temp = Path.Combine(dataRoot, $"lab-agent.{Guid.NewGuid():N}.tmp");
    try
    {
        File.WriteAllText(temp, JsonSerializer.Serialize(configObject), new UTF8Encoding(false));
        RunProcess(
            "icacls.exe",
            new[] { temp, "/inheritance:r", "/grant:r", "SYSTEM:(F)", "Administrators:(F)" });
        File.Move(temp, configPath, overwrite: true);
        RunProcess(
            "icacls.exe",
            new[] { configPath, "/inheritance:r", "/grant:r", "SYSTEM:(F)", "Administrators:(F)" });
    }
    finally
    {
        if (File.Exists(temp))
            File.Delete(temp);
    }
}

string RequireOption(Dictionary<string, string?> parsed, string key)
{
    if (!parsed.TryGetValue(key, out var value) || string.IsNullOrWhiteSpace(value))
        throw new ArgumentException($"Missing required option {key}.");
    return value;
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
        "Usage: RoomGoblinAgentBootstrap.exe [install|repair|uninstall] [--enrollment-file PATH | --hub-url URL --agent-id ID --enrollment-token TOKEN [--allow-http] [--trusted-publisher-thumbprint HEX]]");
    return 1;
}

internal sealed record ProcessResult(
    int ExitCode,
    string Output,
    string Error);

internal static class MachineDpapi
{
    private const int CryptProtectLocalMachine = 0x4;

    [StructLayout(LayoutKind.Sequential)]
    private struct DataBlob
    {
        public int cbData;
        public IntPtr pbData;
    }

    [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(
        ref DataBlob pDataIn,
        string? szDataDescr,
        IntPtr pOptionalEntropy,
        IntPtr pvReserved,
        IntPtr pPromptStruct,
        int dwFlags,
        out DataBlob pDataOut);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LocalFree(IntPtr hMem);

    public static string ProtectString(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var inputPtr = Marshal.AllocHGlobal(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, inputPtr, bytes.Length);
            var input = new DataBlob { cbData = bytes.Length, pbData = inputPtr };
            if (!CryptProtectData(
                    ref input,
                    null,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    CryptProtectLocalMachine,
                    out var output))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            try
            {
                var protectedBytes = new byte[output.cbData];
                Marshal.Copy(output.pbData, protectedBytes, 0, output.cbData);
                return Convert.ToBase64String(protectedBytes);
            }
            finally
            {
                if (output.pbData != IntPtr.Zero)
                    LocalFree(output.pbData);
            }
        }
        finally
        {
            Marshal.FreeHGlobal(inputPtr);
        }
    }
}
