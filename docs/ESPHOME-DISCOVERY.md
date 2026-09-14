# ESPHome discovery and adoption

RoomGoblin can discover already-flashed ESPHome devices that advertise the native API over mDNS (`_esphomelib._tcp.local`). This complements the direct native API integration; it does not require Home Assistant or a separately deployed ESPHome dashboard.

## Operator workflow

Open **Room controls → ESPHome devices** as an administrator. RoomGoblin automatically performs a bounded discovery scan when the workspace opens and periodically while it remains open. **Scan network** forces a fresh scan.

A discovery result contains only network advertisement data such as the device name, private address, native API port, MAC when advertised, ESPHome version, platform, and board. It never contains or reveals an API encryption key.

Choose **Configure / adopt** to copy the discovered private IPv4 address, port, and name into the normal enrollment form. RoomGoblin then verifies the native API and hardware identity before it stores the device.

## Devices without an API encryption key

ESPHome permits a native API that is intentionally configured without Noise encryption. RoomGoblin may enroll such a device with the key field blank. The device remains marked as **unencrypted native API** in the workspace. This is useful for existing lab devices but is weaker than encrypted API transport; use a trusted isolated network and migrate devices to encryption when practical.

RoomGoblin never creates a pretend key for an unencrypted device and never silently changes firmware configuration.

## Devices encrypted with an unknown key

Discovery does not make an encrypted device adoptable without its real key. The encryption key is a secret and is not published through mDNS or readable from the native API before authentication. If a device is already encrypted, enter its existing `api.encryption.key`.

If that key has been lost, recovery requires a device-side action such as rebuilding/reflashing firmware or an authenticated OTA/configuration path that already has sufficient credentials. RoomGoblin must not bypass, guess, replace, or downgrade an unknown encrypted configuration.

## Network behavior

Discovery runs inside the existing RoomGoblin backend, which uses host networking, so same-LAN mDNS advertisements are visible without adding a new exposed service. Routed VLANs normally require an mDNS reflector/repeater if multicast DNS does not cross the boundary.

Only private addresses are shown. Current enrollment still pins the selected private IPv4 address and hardware MAC. Hostname/IPv6 enrollment remains separate follow-up work; mDNS hostnames and IPv6 addresses may be displayed by discovery but are not used as the control endpoint yet.

Discovery is administrator-only, rate-limited, bounded to 128 results, cached briefly, and runs without access to RoomGoblin secrets. It does not queue commands or alter a discovered device.

## Security boundary

An unencrypted ESPHome API exposes its native protocol in plaintext on the local network. Discovery does not make that condition safer or worse; it simply reports the advertisement. RoomGoblin clearly distinguishes encrypted versus unencrypted enrolled connections. Prefer API encryption for devices that can be updated safely.

The RoomGoblin controller is currently HTTP-only in this alpha. Entering an encryption key through that controller is therefore protected only by the trusted-network boundary until HTTPS is introduced.
