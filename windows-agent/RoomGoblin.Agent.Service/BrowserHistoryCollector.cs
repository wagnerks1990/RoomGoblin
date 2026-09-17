using Microsoft.Data.Sqlite;
using Microsoft.Win32;

namespace RoomGoblin.Agent.Service;

internal sealed record BrowserHistoryItem(
    string Id,
    string Url,
    string Title,
    string VisitTime,
    int VisitCount,
    int TypedCount,
    string Browser,
    string Profile,
    string BrowserProfile,
    string HistoryFile,
    string RecordId);

internal sealed class BrowserHistoryCollector
{
    private readonly string _tempRoot =
        Path.Combine(AgentPaths.Root, "history-temp");

    public bool IsAvailable => OperatingSystem.IsWindows();

    public async Task<IReadOnlyList<BrowserHistoryItem>> CollectAsync(
        int limit,
        CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 500);
        Directory.CreateDirectory(_tempRoot);

        var items = new List<BrowserHistoryItem>();

        foreach (var profile in EnumerateProfiles())
        {
            ct.ThrowIfCancellationRequested();

            foreach (var source in EnumerateSources(profile.Path))
            {
                ct.ThrowIfCancellationRequested();

                foreach (var historyFile in source.Files)
                {
                    ct.ThrowIfCancellationRequested();

                    try
                    {
                        var records = await ReadDatabaseAsync(
                            profile,
                            source.Browser,
                            historyFile,
                            source.Query,
                            limit,
                            ct);

                        items.AddRange(records);
                    }
                    catch
                    {
                        // History is optional telemetry. One locked/corrupt browser
                        // profile must not prevent all other profiles from reporting.
                    }
                }
            }
        }

        return items
            .OrderByDescending(x => x.VisitTime, StringComparer.Ordinal)
            .Take(limit)
            .ToArray();
    }

    private async Task<IReadOnlyList<BrowserHistoryItem>> ReadDatabaseAsync(
        UserProfile profile,
        string browser,
        string historyFile,
        string query,
        int limit,
        CancellationToken ct)
    {
        var snapshot = Path.Combine(
            _tempRoot,
            $"{Guid.NewGuid():N}.sqlite");

        try
        {
            File.Copy(historyFile, snapshot, overwrite: true);
            CopySidecar(historyFile, snapshot, "-wal");
            CopySidecar(historyFile, snapshot, "-shm");

            var builder = new SqliteConnectionStringBuilder
            {
                DataSource = snapshot,
                Mode = SqliteOpenMode.ReadOnly,
                Cache = SqliteCacheMode.Private
            };

            await using var connection =
                new SqliteConnection(builder.ToString());
            await connection.OpenAsync(ct);

            await using var command = connection.CreateCommand();
            command.CommandText = query;
            command.Parameters.AddWithValue("$limit", limit);

            var list = new List<BrowserHistoryItem>();

            await using var reader =
                await command.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                var recordId = Convert.ToString(reader["record_id"]) ?? "";
                var browserProfile =
                    Path.GetFileName(Path.GetDirectoryName(historyFile))
                    ?? "";

                list.Add(new BrowserHistoryItem(
                    Id: $"{browser}-{profile.Sid}-{recordId}",
                    Url: Convert.ToString(reader["url"]) ?? "",
                    Title: Convert.ToString(reader["title"]) ?? "",
                    VisitTime: Convert.ToString(reader["visit_time"]) ?? "",
                    VisitCount: Convert.ToInt32(reader["visit_count"]),
                    TypedCount: Convert.ToInt32(reader["typed_count"]),
                    Browser: browser,
                    Profile: Path.GetFileName(profile.Path),
                    BrowserProfile: browserProfile,
                    HistoryFile: historyFile,
                    RecordId: recordId));
            }

            return list;
        }
        finally
        {
            DeleteIfExists(snapshot);
            DeleteIfExists(snapshot + "-wal");
            DeleteIfExists(snapshot + "-shm");
        }
    }

    private static IEnumerable<BrowserSource> EnumerateSources(
        string profilePath)
    {
        var chromeRoot = Path.Combine(
            profilePath,
            @"AppData\Local\Google\Chrome\User Data");
        var edgeRoot = Path.Combine(
            profilePath,
            @"AppData\Local\Microsoft\Edge\User Data");
        var firefoxRoot = Path.Combine(
            profilePath,
            @"AppData\Roaming\Mozilla\Firefox\Profiles");

        yield return new BrowserSource(
            "Chrome",
            EnumerateChromiumHistory(chromeRoot),
            ChromiumQuery);

        yield return new BrowserSource(
            "Edge",
            EnumerateChromiumHistory(edgeRoot),
            ChromiumQuery);

        yield return new BrowserSource(
            "Firefox",
            EnumerateFirefoxHistory(firefoxRoot),
            FirefoxQuery);
    }

    private static IEnumerable<string> EnumerateChromiumHistory(
        string root)
    {
        if (!Directory.Exists(root))
            yield break;

        foreach (var directory in Directory.EnumerateDirectories(root))
        {
            var file = Path.Combine(directory, "History");
            if (File.Exists(file))
                yield return file;
        }

    }

    private static IEnumerable<string> EnumerateFirefoxHistory(
        string root)
    {
        if (!Directory.Exists(root))
            yield break;

        foreach (var directory in Directory.EnumerateDirectories(root))
        {
            var file = Path.Combine(directory, "places.sqlite");
            if (File.Exists(file))
                yield return file;
        }
    }

    private static IEnumerable<UserProfile> EnumerateProfiles()
    {
        using var key = Registry.LocalMachine.OpenSubKey(
            @"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList");

        if (key is null)
            yield break;

        foreach (var sid in key.GetSubKeyNames())
        {
            using var profileKey = key.OpenSubKey(sid);
            var raw = profileKey?.GetValue("ProfileImagePath") as string;
            if (string.IsNullOrWhiteSpace(raw))
                continue;

            var path = Environment.ExpandEnvironmentVariables(raw);
            if (!Directory.Exists(path))
                continue;

            var leaf = Path.GetFileName(path);
            if (leaf.Equals("systemprofile", StringComparison.OrdinalIgnoreCase) ||
                leaf.Equals("LocalService", StringComparison.OrdinalIgnoreCase) ||
                leaf.Equals("NetworkService", StringComparison.OrdinalIgnoreCase))
                continue;

            yield return new UserProfile(sid, path);
        }
    }

    private static void CopySidecar(
        string sourceDatabase,
        string snapshotDatabase,
        string suffix)
    {
        var source = sourceDatabase + suffix;
        if (File.Exists(source))
            File.Copy(source, snapshotDatabase + suffix, overwrite: true);
    }

    private static void DeleteIfExists(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
        }
    }

    private sealed record UserProfile(string Sid, string Path);
    private sealed record BrowserSource(
        string Browser,
        IEnumerable<string> Files,
        string Query);

    private const string ChromiumQuery = """
        SELECT
          CAST(v.id AS TEXT) AS record_id,
          COALESCE(u.url, '') AS url,
          COALESCE(u.title, '') AS title,
          strftime(
            '%Y-%m-%dT%H:%M:%SZ',
            (v.visit_time / 1000000) - 11644473600,
            'unixepoch'
          ) AS visit_time,
          COALESCE(u.visit_count, 0) AS visit_count,
          COALESCE(u.typed_count, 0) AS typed_count
        FROM visits v
        JOIN urls u ON u.id = v.url
        ORDER BY v.visit_time DESC
        LIMIT $limit;
        """;

    private const string FirefoxQuery = """
        SELECT
          CAST(v.id AS TEXT) AS record_id,
          COALESCE(p.url, '') AS url,
          COALESCE(p.title, '') AS title,
          strftime(
            '%Y-%m-%dT%H:%M:%SZ',
            v.visit_date / 1000000,
            'unixepoch'
          ) AS visit_time,
          COALESCE(p.visit_count, 0) AS visit_count,
          0 AS typed_count
        FROM moz_historyvisits v
        JOIN moz_places p ON p.id = v.place_id
        ORDER BY v.visit_date DESC
        LIMIT $limit;
        """;
}
