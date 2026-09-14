# AI context — ESPHome discovery

RoomGoblin's ESPHome integration has two separate responsibilities:

1. `src/esphome.js` + `src/esphome/worker.py`: enrolled-device registry, secret handling, persistent native API connections, entity state, and bounded commands.
2. `src/esphome/discovery.py`: credential-free, read-only mDNS discovery of `_esphomelib._tcp.local` advertisements.

`src/esphome/worker_entry.py` is the production worker entry point. It preserves the original worker's private-IPv4 and port validation while allowing an empty `key` to represent a device whose ESPHome native API is intentionally unencrypted. A non-empty key must still be a valid 32-byte base64 Noise PSK. Do not make unknown encrypted devices fall back to unencrypted operation.

Discovery is not authorization. It may populate the administrator enrollment form, but enrollment must still probe the native API and pin the returned hardware MAC before persisting a device. mDNS data must never be treated as trusted hardware identity by itself.

Do not add API-key extraction, guessing, downgrade, or implicit firmware changes. ESPHome encryption keys are secrets and are not published in mDNS. If an encrypted device's key is unknown, the integration must report that a key/device-side recovery is required.

Discovery runs only for authenticated administrators, is rate-limited, bounded to 128 results, and briefly cached. It must not gain access to the RoomGoblin master key or stored integration secrets. Keep it read-only.

The current enrollment endpoint remains private IPv4-only even though discovery can observe hostnames and IPv6 addresses. Hostname/IPv6 control requires a separate design that preserves SSRF/rebinding protections and hardware identity pinning.

Preserve existing RoomGoblin priorities and isolation: Morning Announcements, scheduler recovery, Background Music reconciliation, display stability, Veyon, Full Recovery writer draining, and managed-device compatibility must not depend on ESPHome discovery success.
