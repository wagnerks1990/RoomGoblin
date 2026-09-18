# AI context: Cloudflare managed provisioning

Read `docs/CLOUDFLARE-TUNNEL.md` before changing Cloudflare, public exposure, proxy trust, Full Recovery transport, Setup/Controller Cloudflare UI, or connector installation.

## Invariants

- Cloudflare is optional and failure-isolated from local classroom operation.
- Managed Cloudflare logic lives in `src/cloudflare.js`; administrator routes are registered by `src/cloudflare-bridge.js`.
- Site domains, account/zone/resource IDs, and tenant-specific values are runtime configuration. Never hard-code a school domain or Cloudflare tenant identifier into public source.
- API Tokens and Global API Keys are encrypted secret-store values. Browser responses expose only configured flags.
- Prefer scoped API Tokens. Global API Key support is compatibility-only.
- Tunnel connector tokens are not persisted in SQLite. They move server-side to maintenance/Host Agent and end at `/etc/cloudflared/roomgoblin.token` mode 0600.
- Never place Cloudflare credentials in process arguments, `.env`, Git, logs, diagnostics, browser state, recovery exports, or documentation.
- The connector service is `cloudflared-roomgoblin.service`; do not take over a generic `cloudflared.service`.
- The sandboxed Host Agent must retain only the exact Cloudflare write exceptions `/etc/cloudflared` and `/etc/systemd/system/cloudflared-roomgoblin.service`; never broaden this to all of `/etc/systemd/system` or disable `ProtectSystem=full`.
- Never install `cloudflared` packages from the Host Agent. Root install/update runners own package installation; Host Agent connector provisioning must use `--skip-install` and fail closed if the binary is unavailable or too old.
- Recover only an exact `/etc/systemd/system/cloudflared-roomgoblin.service -> /dev/null` stale mask. Preserve a regular existing unit file; never overwrite it with an empty placeholder during routine updates and never touch a generic `cloudflared.service` mask.
- After writing a connector token, explicitly restart `cloudflared-roomgoblin.service`; `enable --now` does not reload credentials for an already-running connector and can leave a stale tunnel token active.
- Host Agent token files must be the exact token plus a real `\n` byte terminator, never a literal backslash + `n` sequence.
- Controller reload must preserve visible configured/credential/public-URL state independently from live tunnel connectivity.
- Cloudflare API retries are limited to idempotent GET/PUT/PATCH/DELETE calls. Do not blindly retry POST creates; report the failing method/path without exposing credentials.
- Tunnel ingress exposes only the configured RoomGoblin hostname to `http://127.0.0.1:${PORT:-3000}`, followed by terminal `http_status:404`.
- Never expose maintenance port 3010, Host Agent, Docker, SSH, Veyon, MQTT, Music Assistant, arbitrary URLs, or lab subnets.
- `TRUST_PROXY_HOPS=1` is the reviewed topology. Full Recovery forwarded HTTPS still requires an immediate loopback peer.
- Do not weaken `src/recovery-transport-policy.js` to trust arbitrary forwarded headers.
- Same-name tunnels are not automatically adopted. Explicit adoption is required because RoomGoblin replaces the tunnel ingress configuration.
- Persist Cloudflare resource IDs/ownership before invoking the host connector installer so a host-side failure remains safely retryable and does not orphan a RoomGoblin-created tunnel.
- Conflicting DNS takeover requires explicit consent.
- Cloudflare Access is optional and requires an explicit Allow selector. RoomGoblin authentication/capabilities remain mandatory.
- Safe managed defaults are proxied DNS, Tunnel, Always Use HTTPS, Automatic HTTPS Rewrites, HTTP/3, and Brotli.
- Do not automatically enable Bot Fight Mode, Cache Everything/authenticated caching, HSTS, WARP/private-network routing, or arbitrary service publication.
- Cloudflare status must never become part of core `/health`, scheduler/update/maintenance readiness, or rollback decisions.
- Preserve Morning Announcements priority, scheduler recovery, Background Music reconciliation, display stability, and managed-device compatibility.

## Host boundary

Automatic connector provisioning follows:

```text
admin API
 -> loopback maintenance API
 -> authenticated Host Agent Unix socket
 -> tracked deploy/configure-cloudflare-tunnel.sh
 -> root-only temporary token file
 -> /etc/cloudflared/roomgoblin.token
```

The Host Agent accepts only a bounded non-whitespace connector token and invokes only the reviewed installer. Do not convert this into arbitrary shell/package/systemd execution.

The installer runs with `--no-restart`; the GUI exposes a separate deliberate Hub restart so an in-flight provisioning response is not destroyed.

## Review checklist

1. `node --check src/cloudflare.js src/cloudflare-bridge.js`.
2. Cloudflare unit tests use mocked APIs; CI requires no real Cloudflare credential.
3. `bash -n deploy/configure-cloudflare-tunnel.sh`.
4. Host Agent Python compiles.
5. Browser/static validation passes.
6. No secret appears in responses, logs, fixtures, command arguments, or tracked examples.
7. Existing tunnel/DNS takeover remains opt-in.
8. Access still requires an explicit Allow rule.
9. Tunnel ingress remains loopback-only.
10. Cloudflare remains absent from core availability decisions.
11. Operator docs, Wiki, AI context, and changelog remain synchronized.
