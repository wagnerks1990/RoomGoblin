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
- Never expose maintenance port 3010, Host Agent, Docker, SSH, Veyon, MQTT, arbitrary URLs, or lab subnets. Music Assistant is limited to the explicit protected auxiliary exception below.
- `TRUST_PROXY_HOPS=1` is the reviewed topology. Full Recovery forwarded HTTPS still requires an immediate loopback peer.
- Do not weaken `src/recovery-transport-policy.js` to trust arbitrary forwarded headers.
- A loopback proxy socket is not the direct-localhost recovery exception. Any known forwarding header (including an empty value) disables that exception; supplied Host/Origin values must be loopback authorities. Preserve direct localhost and SSH-forwarded access.
- Forwarded recovery requires a loopback peer, an explicit integer proxy trust count from 1 to 5, and a bounded complete `X-Forwarded-Proto` chain containing only HTTPS entries, with no empty entries and no more entries than trusted hops. Never discard an HTTP prefix or filter out empty entries to obtain a passing decision.
- The trusted proxy must overwrite `X-Forwarded-Proto` from the original client connection. A proxy that strips all forwarding metadata and rewrites Host to localhost cannot be distinguished from a direct client; that configuration is unsupported. The transport decision is not a replacement for administrator authentication or recovery authorization.
- Preserve the existing `{allowed, encrypted, loopback}` response shape. `loopback` describes the immediate peer, not proof that the original browser is local. Routes must enforce `allowed`, not `loopback` alone.
- Same-name tunnels are not automatically adopted. Explicit adoption is required because RoomGoblin replaces the tunnel ingress configuration.
- Persist Cloudflare resource IDs/ownership before invoking the host connector installer so a host-side failure remains safely retryable and does not orphan a RoomGoblin-created tunnel.
- Conflicting DNS takeover requires explicit consent.
- Cloudflare Access is optional and requires an explicit Allow selector. RoomGoblin authentication/capabilities remain mandatory.
- Safe managed defaults are proxied DNS, Tunnel, Always Use HTTPS, Automatic HTTPS Rewrites, HTTP/3, and Brotli.
- Do not automatically enable Bot Fight Mode, Cache Everything/authenticated caching, HSTS, WARP/private-network routing, or arbitrary service publication.
- Cloudflare status must never become part of core `/health`, scheduler/update/maintenance readiness, or rollback decisions.
- Auxiliary ingress is allowlisted, never generic. The only currently reviewed auxiliary public resource is Music Assistant UI/API on a separate hostname -> `http://127.0.0.1:8095`.
- Publishing Music Assistant requires an Access allowed email domain. Never silently publish it without Access.
- Never add Veyon WebAPI 11080, maintenance 3010, media 3020, local AI 3025, Android Agent 8765, ADB 5555, MQTT 1883, ESPHome 6053, native Veyon 11100, Docker or SSH to tunnel ingress.
- Main-hostname Cloudflare Access is browser-oriented. Do not assume Windows agents can satisfy an interactive Access challenge; machine-agent public transport needs RoomGoblin agent authentication and an Access-compatible machine policy before enabling that combination.
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

1. Run `node --check src/cloudflare.js`, `node --check src/cloudflare-bridge.js`, and `node --check src/recovery-transport-policy.js` separately.
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
12. Run `node --test test/recovery-transport-policy.test.js test/recovery-transport-boundary.test.js`. These cover policy decisions and real local HTTP header handling; they do not prove a live Cloudflare tunnel or complete appliance recovery.
