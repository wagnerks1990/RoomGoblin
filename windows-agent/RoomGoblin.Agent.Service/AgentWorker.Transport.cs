using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace RoomGoblin.Agent.Service;

internal sealed partial class AgentWorker
{
    private static async Task SendCommandResultAsync(
        ClientWebSocket socket,
        string commandId,
        string action,
        bool ok,
        string message,
        CancellationToken ct)
    {
        var result =
            new CommandResultMessage(
                Type: "lab.command.result",
                CommandId: commandId,
                Action: action,
                Ok: ok,
                Message: message);

        await SendJsonAsync(
            socket,
            result,
            AgentJson.Context.CommandResultMessage,
            ct);
    }

    private static async Task SendRawJsonAsync(
        ClientWebSocket socket,
        object value,
        CancellationToken ct)
    {
        var payload =
            JsonSerializer.SerializeToUtf8Bytes(value);

        await socket.SendAsync(
            payload,
            WebSocketMessageType.Text,
            true,
            ct);
    }

    private static async Task RunProcessBoundedAsync(
        string fileName,
        IEnumerable<string> arguments,
        TimeSpan timeout,
        CancellationToken ct)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        foreach (var argument in arguments)
            startInfo.ArgumentList.Add(argument);

        using var process =
            new Process
            {
                StartInfo = startInfo
            };

        if (!process.Start())
            throw new InvalidOperationException(
                $"Could not start {Path.GetFileName(fileName)}.");

        var stdoutTask =
            process.StandardOutput.ReadToEndAsync();
        var stderrTask =
            process.StandardError.ReadToEndAsync();

        using var timeoutCts =
            CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(timeout);

        try
        {
            await process.WaitForExitAsync(
                timeoutCts.Token);
        }
        catch (OperationCanceledException)
            when (!ct.IsCancellationRequested)
        {
            try
            {
                process.Kill(
                    entireProcessTree: true);
            }
            catch
            {
            }

            throw new TimeoutException(
                $"{Path.GetFileName(fileName)} timed out after {(int)timeout.TotalSeconds} seconds.");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            var detail =
                string.IsNullOrWhiteSpace(stderr)
                    ? stdout
                    : stderr;

            detail = detail.Trim();
            if (detail.Length > 2048)
                detail = detail[..2048];

            throw new InvalidOperationException(
                $"{Path.GetFileName(fileName)} failed with exit code {process.ExitCode}" +
                (detail.Length > 0
                    ? $": {detail}"
                    : "."));
        }
    }

    private static async Task SendJsonAsync<T>(
        ClientWebSocket socket,
        T value,
        JsonTypeInfo<T> typeInfo,
        CancellationToken ct)
    {
        var payload =
            JsonSerializer.SerializeToUtf8Bytes(
                value,
                typeInfo);

        await socket.SendAsync(
            payload,
            WebSocketMessageType.Text,
            true,
            ct);
    }

    private static async Task<string?> ReceiveTextAsync(
        ClientWebSocket socket,
        CancellationToken ct)
    {
        var buffer = new byte[64 * 1024];
        await using var stream =
            new MemoryStream();

        while (true)
        {
            var result =
                await socket.ReceiveAsync(
                    buffer,
                    ct);

            if (result.MessageType ==
                WebSocketMessageType.Close)
                return null;

            if (result.MessageType !=
                WebSocketMessageType.Text)
            {
                throw new InvalidDataException(
                    "RoomGoblin agent received a non-text WebSocket message.");
            }

            if (stream.Length + result.Count >
                MaxMessageBytes)
            {
                throw new InvalidDataException(
                    "RoomGoblin WebSocket message exceeds 4 MB.");
            }

            await stream.WriteAsync(
                buffer.AsMemory(
                    0,
                    result.Count),
                ct);

            if (result.EndOfMessage)
                break;
        }

        return Encoding.UTF8.GetString(
            stream.ToArray());
    }

    private static async Task WriteAtomicJsonAsync<T>(
        string path,
        T value,
        CancellationToken ct)
    {
        var dir =
            Path.GetDirectoryName(path)
            ?? throw new InvalidOperationException(
                "Health path has no parent directory.");

        Directory.CreateDirectory(dir);

        var temp = Path.Combine(
            dir,
            $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.tmp");

        try
        {
            await using (
                var stream = new FileStream(
                    temp,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    4096,
                    FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(
                    stream,
                    value,
                    AgentJson.Context.HealthFile,
                    ct);

                await stream.FlushAsync(ct);
            }

            if (File.Exists(path))
            {
                File.Replace(
                    temp,
                    path,
                    null,
                    true);
            }
            else
            {
                File.Move(
                    temp,
                    path);
            }
        }
        finally
        {
            if (File.Exists(temp))
                File.Delete(temp);
        }
    }
}
