# AI context: Cloudflare Tunnel

RoomGoblin has an optional remotely-managed Cloudflare Tunnel integration. Read `docs/CLOUDFLARE-TUNNEL.md` before changing network exposure, reverse-proxy trust, recovery transport, installer/update behavior, or remote-access documentation.

## Invariants

- Cloudflare is optional and must never become a dependency for local classroom operation or RoomGoblin health.
- The connector is a host service named `cloudflared-roomgoblin.service`.
- The tunnel origin is `http://127.0.0.1:${HUB_PORT:-3000}`.
- The tunnel token is host secret state at `/etc/cloudflared/roomgoblin.token`, mode `0600`; never commit it, place it in RoomGoblin `.env`, log it, or include it in diagnostics/recovery exports.
- The connector uses `cloudflared tunnel --no-autoupdate run --token-file ...`; `--token-file` requires cloudflared 2025.4.0 or newer.
- Cloudflare's remotely-managed tunnel configuration owns the public hostname. RoomGoblin does not store Cloudflare account IDs, zone IDs, DNS records, Access policies, or API tokens.
- `TRUST_PROXY_HOPS=1` is the reviewed Cloudflare topology. Do not increase it without a topology/security review and tests.
- Full Recovery forwarded HTTPS remains trusted only when the backend's immediate peer is loopback. Do not weaken `src/recovery-transport-policy.js` to trust arbitrary remote `X-Forwarded-Proto` headers.
- Existing `HUB_BIND_ADDRESS=0.0.0.0` LAN access may remain so displays/agents continue to work; cloudflared still reaches the Hub through loopback.
- Never publish maintenance port 3010, the Host Agent socket, Docker, MQTT, Veyon, Music Assistant, SSH, or arbitrary local services through this integration.
- Cloudflare Access may provide an additional outer gate, but it never replaces RoomGoblin authentication, capabilities, audit behavior, or recovery authorization.
- A Cloudflare outage must affect only the remote Cloudflare path. Morning Announcements, scheduler recovery, Background Music reconciliation, managed displays, local administration and update/rollback behavior must remain independent.
- Do not add cloudflared status to core `/health`, update acceptance, database readiness, scheduler readiness, maintenance readiness, or rollback decisions.

## Change review

Any change to the Cloudflare integration should verify:

1. `deploy/configure-cloudflare-tunnel.sh` passes `bash -n` and its regression test;
2. tunnel tokens never enter process arguments, tracked files or RoomGoblin `.env`;
3. the origin remains loopback-only from cloudflared's perspective;
4. direct remote HTTP cannot satisfy Full Recovery transport checks;
5. Cloudflare remains optional and failure-isolated;
6. documentation and the Git-tracked Wiki remain synchronized.
