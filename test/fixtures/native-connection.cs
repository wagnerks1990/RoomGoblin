using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;

internal sealed class AgentConfig
{
    public string HubUrl { get; set; } = "";
    public string FallbackHubUrl { get; set; } = "";
}
internal sealed class FixtureLog
{
    public void LogInformation(string message, object value) { }
    public void LogWarning(Exception error, string message, object value) { }
}
internal sealed class Worker
{
    private readonly FixtureLog _logger = new();
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(20);
    public Task<(ClientWebSocket Socket, Uri Uri)> Connect(AgentConfig config, CancellationToken ct) => ConnectToHubAsync(config, ct);
/* ACTUAL_CONNECTION */
}
internal static class Program
{
    private static async Task<int> Main()
    {
        var cases = new (string Name, Func<Task> Run)[] {
            ("healthy primary preserves configured preference", Primary),
            ("stalled handshake reaches fallback after its 15-second budget", DeadlineFallback),
            ("caller cancellation disposes the attempt without contacting fallback", Cancelled),
            ("pre-cancelled connection opens no socket", PreCancelled),
            ("all rejected origins preserve the final connection error", Rejected)
        };
        var failed = 0;
        foreach (var item in cases)
        {
            try { await item.Run(); Console.WriteLine("PASS " + item.Name); }
            catch (Exception error) { failed++; Console.Error.WriteLine("FAIL " + item.Name + ": " + error.Message); }
        }
        Console.WriteLine($"Native connection tests: {cases.Length-failed} passed, {failed} failed, 0 skipped");
        return failed == 0 ? 0 : 1;
    }
    private static AgentConfig Config(Endpoint primary, Endpoint fallback) => new() { HubUrl = primary.Origin, FallbackHubUrl = fallback.Origin };
    private static async Task Primary()
    {
        await using var primary = new Endpoint("open"); await using var fallback = new Endpoint("open");
        using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var result = await new Worker().Connect(Config(primary, fallback), stop.Token);
        using (result.Socket)
            if (result.Socket.State != WebSocketState.Open || result.Uri.Port != new Uri(primary.Origin).Port || fallback.Requests != 0)
                throw new Exception("Primary connection preference changed");
    }
    private static async Task DeadlineFallback()
    {
        await using var primary = new Endpoint("stall"); await using var fallback = new Endpoint("open");
        using var stop = new CancellationTokenSource();
        var pending = new Worker().Connect(Config(primary, fallback), stop.Token);
        try
        {
            await primary.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
            var result = await pending.WaitAsync(TimeSpan.FromSeconds(23));
            using (result.Socket)
                if (result.Socket.State != WebSocketState.Open || result.Uri.Port != new Uri(fallback.Origin).Port || primary.Requests != 1 || fallback.Requests != 1)
                    throw new Exception("Timed-out primary did not select the configured fallback once");
        }
        finally { stop.Cancel(); try { var result = await pending.WaitAsync(TimeSpan.FromSeconds(3)); result.Socket.Dispose(); } catch { } }
    }
    private static async Task Cancelled()
    {
        await using var primary = new Endpoint("stall"); await using var fallback = new Endpoint("open");
        using var stop = new CancellationTokenSource();
        var pending = new Worker().Connect(Config(primary, fallback), stop.Token);
        try
        {
            await primary.Started.Task.WaitAsync(TimeSpan.FromSeconds(5)); stop.Cancel();
            try { await pending.WaitAsync(TimeSpan.FromSeconds(3)); throw new Exception("Cancelled connection succeeded"); }
            catch (OperationCanceledException error) when (error.CancellationToken == stop.Token) { }
            if (fallback.Requests != 0) throw new Exception("Caller cancellation contacted fallback");
        }
        finally { stop.Cancel(); try { var result = await pending.WaitAsync(TimeSpan.FromSeconds(3)); result.Socket.Dispose(); } catch { } }
    }
    private static async Task PreCancelled()
    {
        await using var primary = new Endpoint("open"); await using var fallback = new Endpoint("open");
        using var stop = new CancellationTokenSource(); stop.Cancel();
        try { await new Worker().Connect(Config(primary, fallback), stop.Token); throw new Exception("Pre-cancelled connection succeeded"); }
        catch (OperationCanceledException error) when (error.CancellationToken == stop.Token) { }
        if (primary.Requests != 0 || fallback.Requests != 0) throw new Exception("Pre-cancelled request reached a peer");
    }
    private static async Task Rejected()
    {
        await using var primary = new Endpoint("reject"); await using var fallback = new Endpoint("reject");
        using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        try { await new Worker().Connect(Config(primary, fallback), stop.Token); throw new Exception("Rejected connection succeeded"); }
        catch (InvalidOperationException error) when (error.InnerException is WebSocketException && error.Message.Contains("any configured Hub origin")) { }
        if (primary.Requests != 1 || fallback.Requests != 1) throw new Exception("Configured origin attempts changed");
    }
    private sealed class Endpoint : IAsyncDisposable
    {
        private readonly TcpListener listener = new(IPAddress.Loopback, 0);
        private readonly CancellationTokenSource stop = new();
        private readonly Task serving;
        public string Origin { get; }
        public int Requests;
        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public Endpoint(string mode)
        {
            listener.Start(); Origin = "http://127.0.0.1:" + ((IPEndPoint)listener.LocalEndpoint).Port;
            serving = Serve(mode);
        }
        private async Task Serve(string mode)
        {
            using var client = await listener.AcceptTcpClientAsync(stop.Token);
            await using var stream = client.GetStream(); using var reader = new StreamReader(stream, Encoding.ASCII, leaveOpen: true);
            var key = "";
            while (await reader.ReadLineAsync(stop.Token) is string line && line.Length > 0)
                if (line.StartsWith("Sec-WebSocket-Key:", StringComparison.OrdinalIgnoreCase)) key = line.Split(':', 2)[1].Trim();
            Interlocked.Increment(ref Requests); Started.SetResult();
            if (mode == "reject")
            {
                await stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"), stop.Token);
                return;
            }
            if (mode == "open")
            {
                var accept = Convert.ToBase64String(SHA1.HashData(Encoding.ASCII.GetBytes(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")));
                await stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n"), stop.Token);
                await stream.FlushAsync(stop.Token);
            }
            await Task.Delay(Timeout.Infinite, stop.Token);
        }
        public async ValueTask DisposeAsync()
        {
            stop.Cancel(); listener.Stop(); try { await serving; } catch (OperationCanceledException) { }
            stop.Dispose();
        }
    }
}
