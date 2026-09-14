# ESPHome discovery

RoomGoblin can discover already-flashed ESPHome devices through the native API mDNS advertisement (`_esphomelib._tcp.local`) without Home Assistant or a separate ESPHome dashboard.

Open **Room controls → ESPHome devices** as an administrator. Discovery runs automatically when the workspace opens and periodically while it stays open; **Scan network** forces a fresh scan. Results show advertisement data such as name, private address, API port, MAC when available, ESPHome version, platform, and board. API encryption keys are never discoverable through mDNS.

Select **Configure / adopt** to populate the enrollment form. RoomGoblin still verifies the native API and hardware identity before saving anything.

A device whose ESPHome native API is intentionally unencrypted can be enrolled with the key field blank. RoomGoblin labels that connection as unencrypted and stores no fake secret. An encrypted device still requires its exact existing `api.encryption.key`; RoomGoblin does not guess, bypass, replace, or silently downgrade an unknown encrypted configuration.

If an encrypted key has been lost, recovery requires a device-side firmware/OTA action that has sufficient existing authorization. Discovery alone cannot recover the key.

Same-subnet mDNS works with RoomGoblin's host-network deployment. Routed VLANs may require an mDNS reflector. Discovery may show mDNS hostnames and IPv6 addresses, but the current control endpoint remains a pinned private IPv4 address plus hardware MAC; hostname/IPv6 enrollment is follow-up work.

Discovery is administrator-only, rate-limited, bounded, briefly cached, read-only, and has no access to stored ESPHome credentials. See `docs/ESPHOME-DISCOVERY.md` for the complete security and operating contract.
