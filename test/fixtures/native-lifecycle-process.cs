using System.Diagnostics;
using System.Text;

internal sealed record ProcessResult(int ExitCode, string Output, string Error);
internal interface IRunner
{
    ProcessResult Invoke(string file, IEnumerable<string> arguments, bool capture, bool allowFailure, TimeSpan? timeout = null);
}
internal sealed class BootstrapRunner : IRunner
{
    public ProcessResult Invoke(string file, IEnumerable<string> arguments, bool capture, bool allowFailure, TimeSpan? timeout = null) => RunProcess(file, arguments, capture, allowFailure, timeout);
/* BOOTSTRAP_PROCESS */
}
internal sealed class UpdaterRunner : IRunner
{
    public ProcessResult Invoke(string file, IEnumerable<string> arguments, bool capture, bool allowFailure, TimeSpan? timeout = null) => RunProcess(file, arguments, capture, allowFailure, timeout);
/* UPDATER_PROCESS */
}
internal interface IWaiter
{
    List<TimeSpan?> Budgets { get; }
    void Invoke(TimeSpan timeout, Func<ProcessResult> query);
}
internal sealed class BootstrapWaiter : IWaiter
{
    private static Func<ProcessResult> query = () => throw new Exception("Unconfigured query fixture");
    private static readonly List<TimeSpan?> budgets = new();
    public List<TimeSpan?> Budgets => budgets;
    public void Invoke(TimeSpan timeout, Func<ProcessResult> next) { query = next; budgets.Clear(); WaitForServiceStopped("fixture-service", timeout); }
    private static ProcessResult RunProcess(string file, IEnumerable<string> arguments, bool capture, bool allowFailure, TimeSpan? timeout = null)
    {
        if (file != "sc.exe" || !arguments.SequenceEqual(new[] { "query", "fixture-service" }) || !capture || !allowFailure)
            throw new Exception("Unexpected service command in fixture");
        budgets.Add(timeout); return query();
    }
/* BOOTSTRAP_WAIT */
}
internal sealed class UpdaterWaiter : IWaiter
{
    private static Func<ProcessResult> query = () => throw new Exception("Unconfigured query fixture");
    private static readonly List<TimeSpan?> budgets = new();
    public List<TimeSpan?> Budgets => budgets;
    public void Invoke(TimeSpan timeout, Func<ProcessResult> next) { query = next; budgets.Clear(); WaitForServiceStopped("fixture-service", timeout); }
    private static ProcessResult RunProcess(string file, IEnumerable<string> arguments, bool capture, bool allowFailure, TimeSpan? timeout = null)
    {
        if (file != "sc.exe" || !arguments.SequenceEqual(new[] { "query", "fixture-service" }) || !capture || !allowFailure)
            throw new Exception("Unexpected service command in fixture");
        budgets.Add(timeout); return query();
    }
/* UPDATER_WAIT */
}
internal sealed class InstallFixture : IDisposable
{
    private readonly string sourceRoot, installRoot, dataRoot, root, mode;
    private readonly bool fresh;
    private readonly bool? legacyEnabled;
    private const string serviceName = "fixture-native", legacyTask = "fixture-legacy";
    private readonly Dictionary<string, string?> options = new();
    public readonly List<string> Calls = new();
    public InstallFixture(string mode, bool fresh, bool? legacyEnabled = true)
    {
        this.mode = mode; this.fresh = fresh; this.legacyEnabled = legacyEnabled;
        root = Path.Combine(AppContext.BaseDirectory, "owned-" + Guid.NewGuid().ToString("N"));
        sourceRoot = Path.Combine(root, "source"); installRoot = Path.Combine(root, "install"); dataRoot = Path.Combine(root, "data");
        Directory.CreateDirectory(sourceRoot); Directory.CreateDirectory(dataRoot);
        if (!fresh) File.WriteAllText(Path.Combine(dataRoot, "lab-agent.json"), "synthetic-existing-identity");
        foreach (var name in new[] { "RoomGoblinAgent.exe", "RoomGoblinSessionAgent.exe", "RoomGoblinAgentUpdater.exe", "RoomGoblinAgentBootstrap.exe" })
            File.WriteAllText(Path.Combine(sourceRoot, name), "synthetic-package");
        if (mode == "directory") File.WriteAllText(installRoot, "blocked-path");
    }
    public int Run() => Install();
    public bool IdentitySafe => fresh ? !File.Exists(Path.Combine(dataRoot, "lab-agent.json")) : File.ReadAllText(Path.Combine(dataRoot, "lab-agent.json")) == "synthetic-existing-identity";
    private bool HasFreshEnrollmentArguments(Dictionary<string, string?> parsed) => fresh;
    private void VerifyPackageManifest(string[] files) => throw new Exception("Unexpected manifest path in fixture");
    private void WriteFreshEnrollmentConfigFromFile(string config, string file) => throw new Exception("Unexpected enrollment-file path in fixture");
    private void WriteFreshEnrollmentConfig(string config, Dictionary<string, string?> parsed) => File.WriteAllText(config, "synthetic-fresh-identity");
    private bool? ReadScheduledTaskEnabled(string task)
    {
        if (mode == "query") throw new TimeoutException("Fixture query timeout");
        return legacyEnabled;
    }
    private void StopAndDeleteService(string name)
    {
        Calls.Add("native-stop");
        if (mode == "native-always" || mode == "native-once" && Calls.Count(x => x == "native-stop") == 1)
            throw new TimeoutException("Fixture native stop timeout");
    }
    private bool WaitForFreshHealth(string file, TimeSpan timeout) => mode != "health";
    private void RunProcess(string file, IEnumerable<string> arguments, bool capture = false, bool allowFailure = false)
    {
        var parts = arguments.ToArray(); Calls.Add(string.Join(" ", parts));
        if (mode == "end" && parts.Contains("/End") || mode == "disable" && parts.Contains("/Disable"))
            throw new TimeoutException("Fixture legacy timeout");
        if (mode == "disable-rejected" && parts.Contains("/Disable") && !allowFailure)
            throw new InvalidOperationException("Fixture disable access denied");
    }
    public void Dispose()
    {
        if (Path.GetDirectoryName(root) != AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar)) throw new Exception("Unsafe fixture cleanup");
        Directory.Delete(root, recursive: true);
    }
/* BOOTSTRAP_INSTALL */
}
internal static class Program
{
    private const string ArgumentFixture = "spaces ! # $ \"quotes\" \\ ;";
    private static string Self => Environment.ProcessPath ?? throw new Exception("No fixture executable");
    private static async Task<int> Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "child") return await Child(args);
        var tests = new List<(string Name, Func<Task> Run)>();
        foreach (var owner in new (string Name, IRunner Run, IWaiter Wait)[] {
            ("Bootstrap", new BootstrapRunner(), new BootstrapWaiter()), ("Updater", new UpdaterRunner(), new UpdaterWaiter()) })
        {
            void Add(string name, Action action) => tests.Add((owner.Name + " " + name, () => { action(); return Task.CompletedTask; }));
            Add("preserves process arguments", () => Success(owner.Run, false));
            Add("captures successful diagnostics", () => Success(owner.Run, true));
            Add("retains allowed nonzero exit status", () => FailureAllowed(owner.Run));
            Add("bounds rejected error detail", () => FailureRejected(owner.Run));
            tests.Add((owner.Name + " bounds retained output", () => OutputMemory(owner.Run)));
            tests.Add((owner.Name + " enforces its real 30-second default", () => Deadline(owner.Run, false, true)));
            tests.Add((owner.Name + " stops uncaptured processes at deadline", () => Deadline(owner.Run, false, false)));
            tests.Add((owner.Name + " bounds inherited output pipe waits", () => Deadline(owner.Run, true, false)));
            Add("accepts confirmed stopped state", () => Confirmed(owner.Wait, 0));
            Add("accepts absent service only by explicit error", () => Confirmed(owner.Wait, 1060));
            Add("rejects service query errors", () => QueryError(owner.Wait));
            Add("fails when service remains running", () => Running(owner.Wait));
            Add("rejects an exhausted stop budget without querying", () => ZeroBudget(owner.Wait));
            Add("passes shrinking budget to later queries", () => RemainingBudget(owner.Wait));
        }
        foreach (var scenario in new (string Mode, bool Fresh)[] {
            ("end", false), ("disable", false), ("query", false), ("directory", false),
            ("query", true), ("directory", true), ("native-once", false), ("native-always", false) })
            tests.Add(($"Bootstrap install failure ownership: {scenario.Mode}, fresh={scenario.Fresh}", () => { InstallFailure(scenario.Mode, scenario.Fresh); return Task.CompletedTask; }));
        var failed = 0;
        foreach (var test in tests)
        {
            try { await test.Run(); Console.WriteLine("PASS " + test.Name); }
            catch (Exception error) { failed++; Console.Error.WriteLine("FAIL " + test.Name + ": " + error.Message); }
        }
        Console.WriteLine($"Native lifecycle tests: {tests.Count-failed} passed, {failed} failed, 0 skipped");
        return failed == 0 ? 0 : 1;
    }
    private static async Task<int> Child(string[] args)
    {
        if (args[1] == "success") { Console.Out.Write("fixture-out"); Console.Error.Write("fixture-error"); return args[2] == ArgumentFixture ? 0 : 9; }
        if (args[1] == "error") { Console.Error.Write("fixture-" + new string('x', 8192)); return 7; }
        if (args[1] == "pipe")
        {
            var start = new ProcessStartInfo(Self) { UseShellExecute = false, CreateNoWindow = true };
            foreach (var value in new[] { "child", "wait", args[2] }) start.ArgumentList.Add(value);
            using var child = Process.Start(start) ?? throw new Exception("Fixture child failed");
            await MarkerReady(args[2]); return 0;
        }
        if (args[1] == "verbose")
        {
            var chunk = new string('x', 8192);
            for (var i = 0; i < 2048; i++) { Console.Out.Write(chunk); Console.Error.Write(chunk); }
            Console.Out.Flush(); Console.Error.Flush();
        }
        WriteMarker(args[2]);
        while (!File.Exists(args[2] + ".release")) await Task.Delay(10);
        return 0;
    }
    private static string NewMarker() => Path.Combine(AppContext.BaseDirectory, "owned-" + Guid.NewGuid().ToString("N") + ".pid");
    private static void WriteMarker(string path) { File.WriteAllText(path + ".writing", Environment.ProcessId.ToString()); File.Move(path + ".writing", path); }
    private static async Task MarkerReady(string path)
    {
        var elapsed = Stopwatch.StartNew();
        while (!File.Exists(path) && elapsed.Elapsed < TimeSpan.FromSeconds(8)) await Task.Delay(10);
        if (!File.Exists(path)) throw new Exception("Owned fixture did not reach its marker");
    }
    private static async Task Cleanup(string marker, Process? child, Task pending)
    {
        if (child is not null)
        {
            if (!child.HasExited) child.Kill(entireProcessTree: true);
            await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3)); child.Dispose();
        }
        try { await pending.WaitAsync(TimeSpan.FromSeconds(3)); } catch { }
        foreach (var path in new[] { marker, marker + ".release" }) if (File.Exists(path)) File.Delete(path);
    }
    private static void Success(IRunner owner, bool capture)
    {
        var result = owner.Invoke(Self, new[] { "child", "success", ArgumentFixture }, capture, false);
        if (result.ExitCode != 0 || result.Output != (capture ? "fixture-out" : "") || result.Error != (capture ? "fixture-error" : ""))
            throw new Exception("Argument or capture semantics changed");
    }
    private static void FailureAllowed(IRunner owner)
    {
        var result = owner.Invoke(Self, new[] { "child", "error" }, true, true);
        if (result.ExitCode != 7 || !result.Error.StartsWith("fixture-") || result.Output != "") throw new Exception("Allowed failure lost diagnostics");
    }
    private static void FailureRejected(IRunner owner)
    {
        try { owner.Invoke(Self, new[] { "child", "error" }, true, false); }
        catch (InvalidOperationException error)
        {
            var prefix = Self + " failed with exit code 7: ";
            if (!error.Message.StartsWith(prefix + "fixture-") || error.Message.Length - prefix.Length > 2048) throw new Exception("Error detail/status was not bounded");
            return;
        }
        throw new Exception("Failed process was accepted");
    }
    private static async Task OutputMemory(IRunner owner)
    {
        var marker = NewMarker(); var before = GC.GetTotalMemory(true);
        var pending = Task.Run(() => owner.Invoke(Self, new[] { "child", "verbose", marker }, true, false)); Process? child = null;
        try
        {
            await MarkerReady(marker); child = Process.GetProcessById(int.Parse(File.ReadAllText(marker)));
            var retained = GC.GetTotalMemory(true) - before;
            if (retained > 16L * 1024 * 1024) throw new Exception($"Output retained {retained} bytes");
            File.WriteAllText(marker + ".release", "release"); var result = await pending;
            if (result.Output.Length > 64 * 1024 || result.Error.Length > 64 * 1024) throw new Exception("Returned output exceeded its bound");
        }
        finally { await Cleanup(marker, child, pending); }
    }
    private static async Task Deadline(IRunner owner, bool pipe, bool useDefault)
    {
        var marker = NewMarker(); var timeout = useDefault ? (TimeSpan?)null : TimeSpan.FromSeconds(2);
        var pending = Task.Run(() => owner.Invoke(Self, new[] { "child", pipe ? "pipe" : "wait", marker }, pipe || useDefault, false, timeout)); Process? child = null;
        try
        {
            await MarkerReady(marker); child = Process.GetProcessById(int.Parse(File.ReadAllText(marker)));
            try { await pending.WaitAsync(TimeSpan.FromSeconds(useDefault ? 35 : 5)); throw new Exception("Stalled process succeeded"); }
            catch (TimeoutException error)
            {
                if (!error.Message.Contains($"timed out after {(useDefault ? 30 : 2)} seconds")) throw new Exception("Process/output outlived its own deadline");
            }
            if (!pipe) await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3));
        }
        finally { await Cleanup(marker, child, pending); }
    }
    private static void Confirmed(IWaiter owner, int exit)
    {
        owner.Invoke(TimeSpan.FromMilliseconds(100), () => new ProcessResult(exit, exit == 0 ? "STATE : 1 STOPPED" : "", ""));
        if (owner.Budgets.Count != 1 || owner.Budgets[0] is not TimeSpan budget || budget <= TimeSpan.Zero || budget > TimeSpan.FromMilliseconds(100))
            throw new Exception("Query did not receive the remaining stop budget");
    }
    private static void QueryError(IWaiter owner)
    {
        try { owner.Invoke(TimeSpan.FromMilliseconds(100), () => new ProcessResult(5, "", "Access denied")); }
        catch (InvalidOperationException error) when (error.Message.Contains("query exit code 5")) { return; }
        throw new Exception("Failed query was treated as a stopped service");
    }
    private static void Running(IWaiter owner)
    {
        var elapsed = Stopwatch.StartNew();
        try { owner.Invoke(TimeSpan.FromMilliseconds(50), () => new ProcessResult(0, "STATE : 4 RUNNING", "")); }
        catch (TimeoutException)
        {
            if (elapsed.Elapsed > TimeSpan.FromMilliseconds(450)) throw new Exception("Polling sleep outlived the remaining stop budget");
            return;
        }
        throw new Exception("Expired wait reported a stopped service");
    }
    private static void ZeroBudget(IWaiter owner)
    {
        try { owner.Invoke(TimeSpan.Zero, () => throw new Exception("Expired budget queried a service")); }
        catch (TimeoutException) { if (owner.Budgets.Count == 0) return; }
        throw new Exception("Exhausted budget was accepted");
    }
    private static void RemainingBudget(IWaiter owner)
    {
        var count = 0;
        owner.Invoke(TimeSpan.FromSeconds(2), () => new ProcessResult(0, ++count == 1 ? "RUNNING" : "STOPPED", ""));
        if (count != 2 || owner.Budgets.Any(x => x is null || x <= TimeSpan.Zero) || owner.Budgets[1] >= owner.Budgets[0])
            throw new Exception("A later query received a fresh deadline");
    }
    private static void InstallFailure(string mode, bool fresh)
    {
        using var fixture = new InstallFixture(mode, fresh);
        var originalError = Console.Error;
        using var diagnostic = new StringWriter();
        try
        {
            Console.SetError(diagnostic);
            if (mode == "native-always")
            {
                try { fixture.Run(); throw new Exception("Unsafe rollback reported completion"); }
                catch (TimeoutException) { }
                if (fixture.Calls.Any(x => x.Contains("/Enable") || x.Contains("/Run"))) throw new Exception("Legacy runtime started with native stop unconfirmed");
            }
            else
            {
                if (fixture.Run() != 20) throw new Exception("Installation failure status was lost");
                if (mode == "end" || mode == "disable" || mode == "native-once")
                    if (!fixture.Calls.Any(x => x.Contains("/Enable")) || !fixture.Calls.Any(x => x.Contains("/Run"))) throw new Exception("Legacy recovery was not attempted");
            }
            var expectedStops = mode.StartsWith("native-") ? 2 : 0;
            if (fixture.Calls.Count(x => x == "native-stop") != expectedStops || !fixture.IdentitySafe)
                throw new Exception("Failure changed an unowned native service or credential identity");
            if (diagnostic.ToString().Length == 0) throw new Exception("Installation failure was hidden");
        }
        finally { Console.SetError(originalError); }
    }
}
