# AI context: HTTPS/public-origin migration

Read `docs/HTTPS-ENDPOINT-AUDIT.md` before changing URLs, hostnames, reverse proxies, Cloudflare ingress, agent enrollment, browser links, displays, media plane, Veyon, Music Assistant, or auxiliary web UIs.

## Invariants

- Tenant/school hostnames and LAN addresses are runtime data. Never hard-code them in source.
- The configured Cloudflare RoomGoblin hostname is the preferred browser/admin and authenticated RoomGoblin-agent origin when available.
- Direct LAN HTTP remains an explicit recovery/fallback path; do not delete it merely because HTTPS exists.
- Browser/agent HTTPS implies WSS for RoomGoblin WebSockets.
- Veyon WebAPI `127.0.0.1:11080`, maintenance `127.0.0.1:3010`, Host Agent socket, MQTT, ESPHome native API, Android Agent v2 `:8765`, and ADB must not be published directly.
- Veyon native endpoint transport (normally TCP 11100) is not HTTP and does not become HTTPS; browser Veyon controls travel through the RoomGoblin HTTPS API while the Hub keeps Veyon backend communication local/LAN.
- Music Assistant backend/API configuration remains the reviewed local service URL. Browser-facing remote access is a separate concern and needs an authenticated/protected proxy or dedicated hostname.
- Music Assistant Sendspin remains a local/LAN WS upstream; do not point displays directly at a public Sendspin port.
- Physical display URLs must not be mass-migrated to HTTPS until the dedicated media-plane behavior is preserved. `public/shared/attribution.js` currently switches uploaded media to port 3020 only for HTTP display origins.
- Never expose raw media-plane port 3020 merely to make it HTTPS.
- Do not add a generic localhost-port proxy.
- qBittorrent, MeTube, Node-RED and the torrent file browser are independent auxiliary UIs. Public exposure requires explicit access/security review; never auto-publish them.
- Preserve Cloudflare failure isolation: local classroom operation must survive Internet/Cloudflare outage.
- Preserve Morning Announcements priority, scheduler recovery, Background Music reconciliation, display stability and managed-device compatibility.

## Endpoint classes

### Prefer public HTTPS/WSS
- RoomGoblin Controller/Setup/API.
- RoomGoblin display and lab-agent WebSockets when those clients intentionally use the public origin.
- Windows PowerShell/native agent enrollment, downloads, updates and long-lived control channel.
- Browser links that are actually served through RoomGoblin or an explicitly managed protected integration hostname.

### Keep local/private
- Maintenance 3010.
- Host Agent Unix socket.
- Veyon WebAPI 11080 and native Veyon endpoint transport.
- MQTT 1883.
- ESPHome 6053.
- Android Agent v2 8765.
- ADB 5555.
- Music Assistant Sendspin 8927 and LAN stream/discovery services.
- Hardware integration endpoints such as Pluto.

### Needs separate design before public exposure
- Music Assistant UI/API 8095.
- Node-RED 1880.
- qBittorrent 8080.
- MeTube 8081.
- Torrent file browser 8090.
- Physical display media plane 3020.

## Implementation sequence

1. Central preferred-public-origin + local-fallback representation.
2. Prefer HTTPS for new Windows agent enrollment; preserve local fallback.
3. Migrate existing Windows agents only with a tested primary/fallback strategy.
4. Fix browser service links so a public RoomGoblin page never fabricates an unreachable `http://public-host:local-port` URL.
5. Design Music Assistant public access separately.
6. Preserve or securely proxy media plane before HTTPS display migration.
7. Optional auxiliary UI exposure only behind explicit per-service policy.

## Review checklist

- Search for `http://`, `https://`, `ws://`, `wss://`, `127.0.0.1`, `localhost`, `0.0.0.0`, `location.origin`, `location.hostname`, known service ports, and browser `window.open` helpers.
- Validate Windows legacy and native agents.
- Validate display WebSocket and media-plane behavior.
- Validate Cloudflare outage/local fallback.
- Confirm no privileged local endpoint was added to Cloudflare ingress.
- Update docs, Wiki and AI context with every endpoint-policy change.
