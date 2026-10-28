using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RoomGoblin.Agent.Service;

// Only platform/configuration dependencies are replaced; NativeUpdateClient is copied unchanged.
internal sealed class AgentConfig
{
    public string HubUrl { get; set; } = "";
    public string FallbackHubUrl { get; set; } = "";
    public string TrustedPublisherThumbprint { get; set; } = "fixture-publisher";
}
internal static class AgentPaths
{
    public static string Root { get; } = Path.Combine(AppContext.BaseDirectory, "owned-" + Guid.NewGuid().ToString("N"));
    public static string NativeHealthPath => Path.Combine(Root, "health.json");
}
internal static class AuthenticodeVerifier
{
    public static int Calls;
    public static void Verify(string path, string thumbprint)
    {
        if (!File.ReadAllBytes(path).SequenceEqual(new byte[] { 1, 2, 3 }) || thumbprint != "fixture-publisher")
            throw new Exception("Signature verifier received unexpected verified bytes or publisher policy");
        Calls++; // This fixture checks dispatch after hashing, not Windows signature validation.
    }
}
internal static class Program
{
    private static async Task<int> Main()
    {
        var cases = new (string Name, Func<Task> Run)[] {
            ("four verified files and version are staged", Success),
            ("configured manifest fallback remains available", Fallback),
            ("pre-cancelled staging sends no request", PreCancelled),
            ("caller cancellation interrupts a stalled body and removes staging", CallerCancellation),
            ("45-second download budget includes the response body", BodyDeadline),
            ("declared length mismatch removes staging", () => Rejected("declared")),
            ("unadvertised excess bytes remove staging", () => Rejected("excess")),
            ("truncated body removes staging", () => Rejected("short")),
            ("hash mismatch cannot reach signature verification", () => Rejected("hash")),
            ("duplicate manifest entries cannot create a stage", () => Rejected("duplicate"))
        };
        var failed = 0;
        foreach (var item in cases)
        {
            AuthenticodeVerifier.Calls = 0;
            try { await item.Run(); Console.WriteLine("PASS " + item.Name); }
            catch (Exception error) { failed++; Console.Error.WriteLine("FAIL " + item.Name + ": " + error.Message); }
            finally
            {
                if (Path.GetDirectoryName(AgentPaths.Root) != AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar))
                    throw new Exception("Fixture cleanup escaped its generated application directory");
                if (Directory.Exists(AgentPaths.Root)) Directory.Delete(AgentPaths.Root, recursive: true);
            }
        }
        Console.WriteLine($"Native transfer tests: {cases.Length - failed} passed, {failed} failed, 0 skipped");
        return failed == 0 ? 0 : 1;
    }

    private static async Task Success()
    {
        await using var server = new FixtureServer("success");
        var stage = await new NativeUpdateClient().StageAsync(new AgentConfig { HubUrl = server.Origin }, CancellationToken.None);
        if (NativeUpdateClient.ReadVersion(stage) != "1.2.3" || Directory.GetFiles(stage).Length != 5 || AuthenticodeVerifier.Calls != 4)
            throw new Exception("Verified package/version dispatch was lost");
    }
    private static async Task Fallback()
    {
        var closed = new TcpListener(IPAddress.Loopback, 0); closed.Start();
        var port = ((IPEndPoint)closed.LocalEndpoint).Port; closed.Stop();
        await using var server = new FixtureServer("success");
        var stage = await new NativeUpdateClient().StageAsync(new AgentConfig {
            HubUrl = $"http://127.0.0.1:{port}", FallbackHubUrl = server.Origin }, CancellationToken.None);
        if (NativeUpdateClient.ReadVersion(stage) != "1.2.3" || AuthenticodeVerifier.Calls != 4)
            throw new Exception("Configured fallback did not stage a verified package");
    }
    private static async Task PreCancelled()
    {
        await using var server = new FixtureServer("success");
        using var stop = new CancellationTokenSource(); stop.Cancel();
        await Throws<OperationCanceledException>(() => new NativeUpdateClient().StageAsync(new AgentConfig { HubUrl = server.Origin }, stop.Token));
        if (server.Requests != 0) throw new Exception("Pre-cancelled staging sent a request");
        NoStage();
    }
    private static async Task CallerCancellation()
    {
        await using var server = new FixtureServer("stall");
        using var stop = new CancellationTokenSource();
        var pending = new NativeUpdateClient().StageAsync(new AgentConfig { HubUrl = server.Origin }, stop.Token);
        try
        {
            await server.BinaryStarted.Task.WaitAsync(TimeSpan.FromSeconds(5)); stop.Cancel();
            var error = await Throws<OperationCanceledException>(() => pending.WaitAsync(TimeSpan.FromSeconds(3)));
            if (error.CancellationToken != stop.Token) throw new Exception("Caller cancellation token was lost");
            NoStage();
        }
        finally { stop.Cancel(); try { await pending.WaitAsync(TimeSpan.FromSeconds(3)); } catch { } }
    }
    private static async Task BodyDeadline()
    {
        await using var server = new FixtureServer("stall");
        using var stop = new CancellationTokenSource();
        var pending = new NativeUpdateClient().StageAsync(new AgentConfig { HubUrl = server.Origin }, stop.Token);
        try
        {
            await server.BinaryStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var error = await Throws<TimeoutException>(() => pending.WaitAsync(TimeSpan.FromSeconds(49)));
            if (!error.Message.Contains("Native update download timed out")) throw new Exception("Body outlived its transfer deadline");
            NoStage();
        }
        finally { stop.Cancel(); try { await pending.WaitAsync(TimeSpan.FromSeconds(3)); } catch { } }
    }
    private static async Task Rejected(string mode)
    {
        await using var server = new FixtureServer(mode);
        try
        {
            await new NativeUpdateClient().StageAsync(new AgentConfig { HubUrl = server.Origin }, CancellationToken.None);
            throw new Exception("Invalid transfer was accepted");
        }
        catch (Exception error) when (error is InvalidDataException or HttpRequestException or IOException) { }
        if (AuthenticodeVerifier.Calls != 0) throw new Exception("Invalid bytes reached signature verification");
        NoStage();
    }
    private static async Task<T> Throws<T>(Func<Task> operation) where T : Exception
    {
        try { await operation(); } catch (T error) { return error; }
        throw new Exception("Expected " + typeof(T).Name);
    }
    private static void NoStage()
    {
        var path = Path.Combine(AgentPaths.Root, "native-updates");
        if (Directory.Exists(path) && Directory.EnumerateFileSystemEntries(path).Any()) throw new Exception("Incomplete update stage remains");
    }

    private sealed class FixtureServer : IAsyncDisposable
    {
        private readonly TcpListener listener = new(IPAddress.Loopback, 0);
        private readonly CancellationTokenSource stop = new();
        private readonly List<Task> clients = new();
        private readonly Task accepting;
        private readonly string mode;
        public string Origin { get; }
        public int Requests;
        public TaskCompletionSource BinaryStarted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public FixtureServer(string mode)
        {
            this.mode = mode; listener.Start(); Origin = "http://127.0.0.1:" + ((IPEndPoint)listener.LocalEndpoint).Port;
            accepting = Accept();
        }
        private async Task Accept()
        {
            while (!stop.IsCancellationRequested) clients.Add(Serve(await listener.AcceptTcpClientAsync(stop.Token)));
        }
        private async Task Serve(TcpClient client)
        {
            using (client)
            await using (var stream = client.GetStream())
            {
                using var reader = new StreamReader(stream, Encoding.ASCII, leaveOpen: true);
                var first = await reader.ReadLineAsync(stop.Token) ?? "";
                while (await reader.ReadLineAsync(stop.Token) is string line && line.Length > 0) { }
                Interlocked.Increment(ref Requests);
                var manifest = first.Contains("/manifest.json ");
                byte[] bytes;
                if (manifest)
                {
                    var names = new[] { "RoomGoblinAgent.exe", "RoomGoblinSessionAgent.exe", "RoomGoblinAgentUpdater.exe", "RoomGoblinAgentBootstrap.exe" };
                    if (mode == "duplicate") names[1] = names[0];
                    bytes = JsonSerializer.SerializeToUtf8Bytes(new { ok = true, version = "1.2.3", files = names.Select(name => new {
                        name, sha256 = Convert.ToHexString(SHA256.HashData(new byte[] { 1, 2, 3 })), bytes = 3 }) });
                }
                else bytes = mode switch { "hash" => new byte[] { 4, 5, 6 }, "short" => new byte[] { 1, 2 }, "excess" => new byte[] { 1, 2, 3, 4 }, _ => new byte[] { 1, 2, 3 } };
                var length = manifest ? bytes.Length : mode == "declared" ? 4 : 3;
                var lengthHeader = !manifest && mode == "excess" ? "" : $"Content-Length: {length}\r\n";
                await stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n" + lengthHeader + "Connection: close\r\n\r\n"), stop.Token);
                if (!manifest && mode == "stall")
                {
                    await stream.FlushAsync(stop.Token); BinaryStarted.TrySetResult();
                    await Task.Delay(Timeout.Infinite, stop.Token);
                }
                await stream.WriteAsync(bytes, stop.Token); await stream.FlushAsync(stop.Token);
                if (!manifest) BinaryStarted.TrySetResult();
            }
        }
        public async ValueTask DisposeAsync()
        {
            stop.Cancel(); listener.Stop();
            try { await accepting; } catch (OperationCanceledException) { } catch (SocketException) { }
            try { await Task.WhenAll(clients); } catch (OperationCanceledException) { }
            stop.Dispose();
        }
    }
}
