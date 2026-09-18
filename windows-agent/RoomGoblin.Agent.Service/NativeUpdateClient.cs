using System.Diagnostics;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Text.Json.Serialization;

namespace RoomGoblin.Agent.Service;

internal sealed record NativeManifestFile(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("sha256")] string Sha256,
    [property: JsonPropertyName("bytes")] long Bytes);

internal sealed record NativeManifest(
    [property: JsonPropertyName("ok")] bool Ok,
    [property: JsonPropertyName("version")] string Version,
    [property: JsonPropertyName("files")] NativeManifestFile[] Files);

internal sealed class NativeUpdateClient
{
    private const long MaxFileBytes = 256L * 1024 * 1024;
    private const long MaxPackageBytes = 512L * 1024 * 1024;
    private static readonly HashSet<string> AllowedFiles =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "RoomGoblinAgent.exe",
            "RoomGoblinSessionAgent.exe",
            "RoomGoblinAgentUpdater.exe",
            "RoomGoblinAgentBootstrap.exe"
        };

    public async Task<string> StageAsync(
        AgentConfig config,
        CancellationToken ct)
    {
        using var http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(45),
            MaxResponseContentBufferSize = 1024 * 1024
        };

        var origin = new Uri(config.HubUrl).GetLeftPart(
            UriPartial.Authority);

        var manifestUri =
            new Uri(origin + "/lab-agent/native/manifest.json");

        var manifest =
            await http.GetFromJsonAsync<NativeManifest>(
                manifestUri,
                cancellationToken: ct)
            ?? throw new InvalidDataException(
                "Hub returned an empty native agent manifest.");

        if (!manifest.Ok ||
            string.IsNullOrWhiteSpace(manifest.Version) ||
            manifest.Version.Length > 128 ||
            !Regex.IsMatch(manifest.Version,"^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$") ||
            manifest.Files is null ||
            manifest.Files.Length != AllowedFiles.Count)
        {
            throw new InvalidDataException(
                "Hub returned an invalid native agent manifest.");
        }

        if (manifest.Files.Select(x=>x.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count()!=AllowedFiles.Count ||
            manifest.Files.Any(
                x => !AllowedFiles.Contains(x.Name) ||
                     x.Bytes<=0 || x.Bytes>MaxFileBytes ||
                     !Regex.IsMatch(
                         x.Sha256 ?? "",
                         "^[0-9a-fA-F]{64}$")) ||
            manifest.Files.Sum(x=>x.Bytes)>MaxPackageBytes)
        {
            throw new InvalidDataException(
                "Hub native manifest contains an invalid file entry.");
        }

        var updateRoot = Path.Combine(
            AgentPaths.Root,
            "native-updates");
        Directory.CreateDirectory(updateRoot);

        var stage = Path.Combine(
            updateRoot,
            Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(stage);

        try
        {
            foreach (var file in manifest.Files)
            {
                var target = Path.Combine(stage, file.Name);
                var source = new Uri(
                    origin +
                    "/lab-agent/native/" +
                    Uri.EscapeDataString(file.Name));

                using (var response=await http.GetAsync(source,HttpCompletionOption.ResponseHeadersRead,ct))
                await using (var output =
                    new FileStream(
                        target,
                        FileMode.CreateNew,
                        FileAccess.Write,
                        FileShare.None,
                        1024 * 1024,
                        FileOptions.WriteThrough))
                {
                    response.EnsureSuccessStatusCode();
                    if(response.Content.Headers.ContentLength is long declared&&declared!=file.Bytes)
                        throw new InvalidDataException($"Native update size mismatch for {file.Name}.");
                    await using var input=await response.Content.ReadAsStreamAsync(ct);
                    var buffer=new byte[1024*1024];
                    long written=0;
                    while(true)
                    {
                        var count=await input.ReadAsync(buffer,ct);
                        if(count==0)break;
                        written+=count;
                        if(written>file.Bytes||written>MaxFileBytes)
                            throw new InvalidDataException($"Native update exceeds the declared size for {file.Name}.");
                        await output.WriteAsync(buffer.AsMemory(0,count),ct);
                    }
                    if(written!=file.Bytes)
                        throw new InvalidDataException($"Native update size mismatch for {file.Name}.");
                    await output.FlushAsync(ct);
                }

                await using var verified=File.OpenRead(target);
                var actual=Convert.ToHexString(await SHA256.HashDataAsync(verified,ct));

                if (!actual.Equals(
                        file.Sha256,
                        StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidDataException(
                        $"Native update hash verification failed for {file.Name}.");
                }

                AuthenticodeVerifier.Verify(
                    target,
                    config.TrustedPublisherThumbprint);
            }

            File.WriteAllText(
                Path.Combine(stage, "version.txt"),
                manifest.Version);

            return stage;
        }
        catch
        {
            try
            {
                Directory.Delete(stage, recursive: true);
            }
            catch
            {
            }

            throw;
        }
    }

    public static Process LaunchUpdater(
        string stage,
        string expectedVersion)
    {
        var installedUpdater = Path.Combine(
            AppContext.BaseDirectory,
            "RoomGoblinAgentUpdater.exe");

        if (!File.Exists(installedUpdater))
            throw new FileNotFoundException(
                "Native RoomGoblin updater is not installed.",
                installedUpdater);

        var detachedUpdater = Path.Combine(
            Path.GetDirectoryName(stage)!,
            "updater-" + Guid.NewGuid().ToString("N") + ".exe");

        File.Copy(
            installedUpdater,
            detachedUpdater,
            overwrite: true);

        var psi = new ProcessStartInfo
        {
            FileName = detachedUpdater,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        psi.ArgumentList.Add("--service");
        psi.ArgumentList.Add("RoomGoblinAgent");
        psi.ArgumentList.Add("--install-dir");
        psi.ArgumentList.Add(AppContext.BaseDirectory.TrimEnd(
            Path.DirectorySeparatorChar));
        psi.ArgumentList.Add("--stage");
        psi.ArgumentList.Add(stage);
        psi.ArgumentList.Add("--health");
        psi.ArgumentList.Add(AgentPaths.NativeHealthPath);
        psi.ArgumentList.Add("--version");
        psi.ArgumentList.Add(expectedVersion);

        return Process.Start(psi)
            ?? throw new InvalidOperationException(
                "Could not start the native RoomGoblin updater.");
    }

    public static string ReadVersion(string stage) =>
        File.ReadAllText(
            Path.Combine(stage, "version.txt")).Trim();
}
