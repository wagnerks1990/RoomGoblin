using System.Diagnostics;

internal static class Program
{
    private const string ArgumentFixture = "spaces ! # $ \"quotes\" \\ ;";
    private static string Self => Environment.ProcessPath ?? throw new Exception("No fixture executable");

    private static async Task<int> Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "child") return await Child(args);
        var tests = new (string Name, Func<Task> Run)[] {
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
