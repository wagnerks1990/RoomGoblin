using System.Diagnostics;
using System.Text;

internal static class Program
{
    private const string ArgumentFixture = "spaces ! # $ \"quotes\" \\ ;";
    private static string Self => Environment.ProcessPath ?? throw new Exception("No fixture executable");

    private static async Task<int> Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "child") return await Child(args);
        var tests = new (string Name, Func<Task> Run)[] {
            ("output EOF shares command deadline", () => PipeDeadline(false)),
            ("output EOF honors caller cancellation", () => PipeDeadline(true)),
            ("large output has bounded retained memory", OutputMemory),
            ("successful child preserves arguments", Success),
            ("failed child keeps bounded error detail", Failure),
            ("pre-cancelled request never attempts launch", PreCancelled),
            ("caller cancellation stops owned child and preserves token", CallerCancellation),
            ("deadline stops owned child and reports timeout", Deadline),
            ("caller cancellation stops owned descendants", Descendants)
        };
        var failed = 0;
        foreach (var test in tests)
        {
            try { await test.Run(); Console.WriteLine("PASS " + test.Name); }
            catch (Exception error) { failed++; Console.Error.WriteLine("FAIL " + test.Name + ": " + error.Message); }
        }
        Console.WriteLine($"Native process tests: {tests.Length - failed} passed, {failed} failed, 0 skipped");
        return failed == 0 ? 0 : 1;
    }

    private static async Task<int> Child(string[] args)
    {
        switch (args[1])
        {
            case "pipe":
                var pipeInfo = new ProcessStartInfo(Self) { UseShellExecute = false, CreateNoWindow = true };
                foreach (var value in new[] { "child", "wait", args[2] }) pipeInfo.ArgumentList.Add(value);
                using (var inherited = Process.Start(pipeInfo) ?? throw new Exception("Fixture launch failed"))
                {
                    var startup = Stopwatch.StartNew();
                    while (!File.Exists(args[2]) && startup.Elapsed < TimeSpan.FromSeconds(5)) await Task.Delay(10);
                }
                return 0;
            case "verbose":
                var chunk = new string('x', 8192);
                for (var i=0;i<2048;i++) { Console.Out.Write(chunk); Console.Error.Write(chunk); }
                Console.Out.Flush(); Console.Error.Flush(); WriteMarker(args[2]);
                var outputWait = Stopwatch.StartNew();
                while (!File.Exists(args[2]+".release") && outputWait.Elapsed < TimeSpan.FromSeconds(10)) await Task.Delay(10);
                return 0;
            case "success": return args[2] == ArgumentFixture ? 0 : 9;
            case "failure": Console.Error.Write("fixture-" + new string('x', 8192)); return 7;
            case "wait":
                WriteMarker(args[2]);
                await Task.Delay(60000); return 0;
            case "tree":
                var info = new ProcessStartInfo(Self) { UseShellExecute = false, CreateNoWindow = true };
                foreach (var value in new[] { "child", "wait", args[2] + ".descendant" }) info.ArgumentList.Add(value);
                using (var descendant = Process.Start(info) ?? throw new Exception("Fixture child launch failed"))
                {
                    WriteMarker(args[2]);
                    await Task.Delay(60000);
                }
                return 0;
            default: return 8;
        }
    }

    private static void WriteMarker(string path)
    {
        File.WriteAllText(path + ".writing", Environment.ProcessId.ToString());
        File.Move(path + ".writing", path);
    }

    private static async Task PipeDeadline(bool cancel)
    {
        var marker = Path.Combine(AppContext.BaseDirectory, "pipe-" + Guid.NewGuid().ToString("N") + ".pid");
        using var stop = new CancellationTokenSource();
        var pending = RunProcessBoundedAsync(Self, new[] { "child", "pipe", marker }, TimeSpan.FromSeconds(cancel ? 20 : 2), stop.Token);
        Process? owned = null;
        try
        {
            var startup = Stopwatch.StartNew();
            while (!File.Exists(marker) && startup.Elapsed < TimeSpan.FromSeconds(5)) await Task.Delay(10);
            if (!File.Exists(marker)) throw new Exception("Owned pipe fixture did not start");
            owned = Process.GetProcessById(int.Parse(File.ReadAllText(marker)));
            await Task.Delay(200);
            if (cancel) stop.Cancel();
            try { await pending.WaitAsync(TimeSpan.FromSeconds(4)); throw new Exception("Pipe incorrectly completed"); }
            catch (OperationCanceledException error) when (cancel && error.CancellationToken == stop.Token) { }
            catch (TimeoutException error) when (!cancel && error.Message.Contains("timed out after 2 seconds")) { }
        }
        finally
        {
            stop.Cancel();
            if (owned is not null) { if (!owned.HasExited) owned.Kill(entireProcessTree:true); await owned.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3)); owned.Dispose(); }
            try { await pending.WaitAsync(TimeSpan.FromSeconds(3)); } catch { }
            if (File.Exists(marker)) File.Delete(marker);
        }
    }

    private static async Task OutputMemory()
    {
        await Success();
        var marker = Path.Combine(AppContext.BaseDirectory, "output-"+Guid.NewGuid().ToString("N")+".pid");
        using var stop = new CancellationTokenSource();
        var before = GC.GetTotalMemory(true);
        var pending = RunProcessBoundedAsync(Self, new[] { "child", "verbose", marker }, TimeSpan.FromSeconds(20), stop.Token);
        try
        {
            var startup = Stopwatch.StartNew();
            while (!File.Exists(marker) && startup.Elapsed < TimeSpan.FromSeconds(8)) await Task.Delay(10);
            if (!File.Exists(marker)) throw new Exception("Verbose fixture did not finish writing");
            // Keep both pipes open while measuring live buffers, not cumulative async allocations.
            var retained = GC.GetTotalMemory(true) - before;
            Console.WriteLine($"Retained output memory: {retained} bytes for 32 MiB of output");
            if (retained > 16L * 1024 * 1024) throw new Exception("Output retention grew with the command's output");
            File.WriteAllText(marker+".release", "release");
            await pending;
        }
        finally
        {
            stop.Cancel();
            try { await pending.WaitAsync(TimeSpan.FromSeconds(3)); } catch { }
            foreach (var path in new[] {marker,marker+".release"}) if(File.Exists(path)) File.Delete(path);
        }
    }

    private static Task Success() => RunProcessBoundedAsync(Self,
        new[] { "child", "success", ArgumentFixture }, TimeSpan.FromSeconds(5), CancellationToken.None);

    private static async Task Failure()
    {
        try { await RunProcessBoundedAsync(Self, new[] { "child", "failure" }, TimeSpan.FromSeconds(5), CancellationToken.None); }
        catch (InvalidOperationException error)
        {
            if (!error.Message.Contains("exit code 7: fixture-") || error.Message.Length > 2200)
                throw new Exception("Exit status or bounded failure detail was lost");
            return;
        }
        throw new Exception("Failed child was reported successful");
    }

    private static async Task PreCancelled()
    {
        using var stop = new CancellationTokenSource(); stop.Cancel();
        try { await RunProcessBoundedAsync(Path.Combine(AppContext.BaseDirectory, "never-launch-missing-fixture"),
            Array.Empty<string>(), TimeSpan.FromSeconds(5), stop.Token); }
        catch (OperationCanceledException error) when (error.CancellationToken == stop.Token) { return; }
        throw new Exception("Pre-cancelled request did not preserve caller cancellation");
    }

    private static Task CallerCancellation() => VerifyStopped(false, false);
    private static Task Deadline() => VerifyStopped(true, false);
    private static Task Descendants() => VerifyStopped(false, true);

    private static async Task VerifyStopped(bool deadline, bool tree)
    {
        var marker = Path.Combine(AppContext.BaseDirectory, "owned-" + Guid.NewGuid().ToString("N") + ".pid");
        using var stop = new CancellationTokenSource();
        var owned = new List<Process>();
        var paths = tree ? new[] { marker, marker + ".descendant" } : new[] { marker };
        var pending = RunProcessBoundedAsync(Self, new[] { "child", tree ? "tree" : "wait", marker },
            TimeSpan.FromSeconds(deadline ? 2 : 20), stop.Token);
        try
        {
            foreach (var path in paths)
            {
                var until = Stopwatch.StartNew();
                while (!File.Exists(path) && until.Elapsed < TimeSpan.FromSeconds(5)) await Task.Delay(10);
                if (!File.Exists(path)) throw new Exception("Owned fixture process did not start");
                owned.Add(Process.GetProcessById(int.Parse(File.ReadAllText(path))));
            }
            if (!deadline) stop.Cancel();
            try { await pending; throw new Exception("Interrupted process reported success"); }
            catch (OperationCanceledException error) when (!deadline && error.CancellationToken == stop.Token) { }
            catch (TimeoutException) when (deadline) { }
            foreach (var child in owned)
                await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3));
        }
        finally
        {
            stop.Cancel();
            // These handles come only from this fixture's unique marker files.
            foreach (var child in owned)
            {
                try { if (!child.HasExited) child.Kill(entireProcessTree: true); }
                finally { child.Dispose(); }
            }
            try { await pending.WaitAsync(TimeSpan.FromSeconds(3)); } catch { }
            foreach (var path in paths) if (File.Exists(path)) File.Delete(path);
        }
    }

/* ACTUAL_PROCESS_HELPER */

}
