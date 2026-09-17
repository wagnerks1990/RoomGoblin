using System.Drawing;
using System.Drawing.Imaging;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);

var parsed = ParseArgs(args);
if (!parsed.TryGetValue("pipe", out var pipeName) ||
    !parsed.TryGetValue("token", out var token) ||
    string.IsNullOrWhiteSpace(pipeName) ||
    string.IsNullOrWhiteSpace(token))
{
    return 2;
}

try
{
    using var pipe = new NamedPipeClientStream(
        ".",
        pipeName,
        PipeDirection.InOut,
        PipeOptions.Asynchronous,
        TokenImpersonationLevel.Identification);

    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
    await pipe.ConnectAsync(timeout.Token);

    using var reader = new StreamReader(
        pipe,
        new UTF8Encoding(false),
        false,
        4096,
        leaveOpen: true);
    using var writer = new StreamWriter(
        pipe,
        new UTF8Encoding(false),
        4096,
        leaveOpen: true)
    {
        AutoFlush = true
    };

    await writer.WriteLineAsync(JsonSerializer.Serialize(new
    {
        token,
        pid = Environment.ProcessId
    }));

    var line = await reader.ReadLineAsync(timeout.Token);
    if (line is null)
        return 3;

    var request = JsonSerializer.Deserialize<SessionRequest>(line)
        ?? throw new InvalidDataException("Empty session request.");

    var response = request.Type switch
    {
        "lock" => Lock(),
        "screenshot" => CaptureScreenshot(request.Quality),
        _ => new SessionResponse(
            false,
            $"Unsupported session request '{request.Type}'.")
    };

    await writer.WriteLineAsync(JsonSerializer.Serialize(response));
    return response.Ok ? 0 : 1;
}
catch
{
    return 1;
}

static SessionResponse Lock()
{
    if (!LockWorkStation())
        return new SessionResponse(false, "LockWorkStation failed.");

    return new SessionResponse(true, "Interactive workstation locked.");
}

static SessionResponse CaptureScreenshot(int quality)
{
    quality = Math.Clamp(quality <= 0 ? 70 : quality, 25, 90);

    var bounds = SystemInformation.VirtualScreen;
    if (bounds.Width <= 0 || bounds.Height <= 0)
        return new SessionResponse(false, "Interactive desktop has invalid bounds.");

    using var bitmap = new Bitmap(
        bounds.Width,
        bounds.Height,
        PixelFormat.Format24bppRgb);
    using (var graphics = Graphics.FromImage(bitmap))
    {
        graphics.CopyFromScreen(
            bounds.Left,
            bounds.Top,
            0,
            0,
            bounds.Size,
            CopyPixelOperation.SourceCopy);
    }

    var codec = ImageCodecInfo.GetImageEncoders()
        .First(x => x.MimeType == "image/jpeg");

    using var parameters = new EncoderParameters(1);
    parameters.Param[0] = new EncoderParameter(
        System.Drawing.Imaging.Encoder.Quality,
        (long)quality);

    using var stream = new MemoryStream();
    bitmap.Save(stream, codec, parameters);

    if (stream.Length > 7L * 1024 * 1024)
        return new SessionResponse(
            false,
            "Screenshot exceeds the safe 7 MB upload limit.");

    var bytes = stream.ToArray();
    return new SessionResponse(
        true,
        $"Screenshot captured ({bytes.Length} bytes).",
        Convert.ToBase64String(bytes),
        bytes.Length);
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

[DllImport("user32.dll", SetLastError = true)]
static extern bool LockWorkStation();

internal sealed record SessionRequest(
    string Type,
    string? Text = null,
    int Quality = 70);

internal sealed record SessionResponse(
    bool Ok,
    string Message,
    string? Data = null,
    int Bytes = 0);
