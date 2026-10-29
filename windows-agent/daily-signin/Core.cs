using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RoomGoblin.SignIn;

internal sealed record Enrollment(string Format, string GroupId, string GroupName, string TimeZone,
    string ComputerName, string Username, string Seed, DateTimeOffset IssuedAt, DateTimeOffset ExpiresAt);
internal sealed record Envelope(string Format, int Iterations, string Salt, string Nonce, string Ciphertext, string Tag);
internal static class Codes
{
    internal const string Format = "roomgoblin-daily-signin-v1";
    internal static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    internal static string Day(string zone, DateTimeOffset now) =>
        TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(zone)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    internal static string ForDay(byte[] seed, string groupId, string day)
    {
        if (seed.Length != 32 || !Guid.TryParseExact(groupId, "D", out _) ||
            !DateOnly.TryParseExact(day, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            throw new InvalidDataException("Invalid daily-code identity.");
        var digest = HMACSHA256.HashData(seed, Encoding.UTF8.GetBytes($"{Format}\n{groupId}\n{day}"));
        try { return (BinaryPrimitives.ReadUInt64BigEndian(digest) % 100000000).ToString("D8", CultureInfo.InvariantCulture); }
        finally { CryptographicOperations.ZeroMemory(digest); }
    }

    internal static Enrollment Decrypt(byte[] file, string passphrase, DateTimeOffset now, string computer)
    {
        if (file.Length > 16384 || passphrase.Length < 16 || Encoding.UTF8.GetByteCount(passphrase) > 1024)
            throw new InvalidDataException("Invalid enrollment size or passphrase.");
        var envelope = JsonSerializer.Deserialize<Envelope>(file, Json) ?? throw new InvalidDataException("Missing enrollment.");
        if (envelope.Format != Format || envelope.Iterations != 600000) throw new InvalidDataException("Unsupported enrollment format.");
        var salt = Convert.FromBase64String(envelope.Salt); var nonce = Convert.FromBase64String(envelope.Nonce);
        var tag = Convert.FromBase64String(envelope.Tag); var encrypted = Convert.FromBase64String(envelope.Ciphertext);
        if (salt.Length != 16 || nonce.Length != 12 || tag.Length != 16 || encrypted.Length > 8192)
            throw new InvalidDataException("Invalid enrollment envelope.");
        var key = Rfc2898DeriveBytes.Pbkdf2(passphrase, salt, 600000, HashAlgorithmName.SHA256, 32);
        var plain = new byte[encrypted.Length];
        try
        {
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(nonce, encrypted, tag, plain, Encoding.UTF8.GetBytes(Format));
            var value = JsonSerializer.Deserialize<Enrollment>(plain, Json) ?? throw new InvalidDataException("Missing policy.");
            if (value.Format != Format || !Guid.TryParseExact(value.GroupId, "D", out _) ||
                !string.Equals(value.ComputerName, computer, StringComparison.OrdinalIgnoreCase) ||
                value.IssuedAt > now.AddMinutes(5) || value.ExpiresAt <= now || value.ExpiresAt <= value.IssuedAt ||
                value.ExpiresAt > value.IssuedAt.AddHours(24) || value.Username.Length is < 1 or > 20 ||
                value.Username.IndexOfAny("\\/[]:;|=,+*?<>@\"".ToCharArray()) >= 0 || value.Username.Any(char.IsControl))
                throw new InvalidDataException("Enrollment expired, belongs to another computer, or has invalid account data.");
            var seed = Convert.FromBase64String(value.Seed);
            try { _ = ForDay(seed, value.GroupId, Day(value.TimeZone, now)); }
            finally { CryptographicOperations.ZeroMemory(seed); }
            return value;
        }
        finally { CryptographicOperations.ZeroMemory(key); CryptographicOperations.ZeroMemory(plain); }
    }
}

// Persist before returning credentials. Missing/corrupt state never resets a cooldown.
internal sealed class Attempts
{
    public long LatestUtc { get; set; }
    public long BlockedUntil { get; set; }
    public int Failures { get; set; }
    internal bool Accept(string supplied, string expected, DateTimeOffset now)
    {
        long seconds = now.ToUnixTimeSeconds();
        if (LatestUtc < 0 || BlockedUntil < 0 || Failures < 0 || seconds < LatestUtc - 300) return false;
        LatestUtc = Math.Max(LatestUtc, seconds);
        if (seconds < BlockedUntil) return false;
        bool matches = supplied.Length == 8 && supplied.All(c => c is >= '0' and <= '9') &&
            CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(supplied), Encoding.ASCII.GetBytes(expected));
        if (matches) { Failures = 0; BlockedUntil = 0; return true; }
        Failures = Math.Min(Failures + 1, 1000);
        if (Failures >= 5) BlockedUntil = seconds + Math.Min(900, 60 * (Failures - 4));
        return false;
    }
}
