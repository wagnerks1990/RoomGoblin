# Security Policy

## Host-network deployment contract

The Linux Hub and maintenance containers retain host networking; maintenance is loopback-only. Add-ons use reviewed per-service networking: Music Assistant and Govee2MQTT use host networking, while Mosquitto uses the named integration bridge with a loopback-only published listener. Preserve explicit bind addresses, persistent mounts and secrets, and never silently recreate adopted containers. See [Host networking and migration](docs/HOST-NETWORKING.md) for preflight, port inventory, compatibility, acceptance tests and rollback.

RoomGoblin can control real classroom displays, AV equipment, lighting, media, and lab infrastructure. Treat every deployment as an administrative system.

## Do not commit secrets

Never commit:

- `.env`
- production databases
- API tokens or passwords
- MQTT credentials
- private keys or certificates
- recovery backups
- real site-specific secret configuration

## Recommended deployment

- Place the controller behind HTTPS.
- Require the built-in authentication and capability checks. An authenticated reverse proxy or Zero Trust layer is an additional gate, never a replacement.
- Use a strong `MAINTENANCE_TOKEN`.
- Keep the maintenance API unexposed to the public network.
- Keep the host agent on its local Unix socket.
- Do not mount the Docker socket into web-facing containers. Maintenance Docker requests cross the local Host Agent and its operation/container/image allowlist.
- Back up the database and encryption master key separately and securely.

## Full Recovery transport

Full Recovery passphrases require actual socket TLS, reviewed HTTPS termination
at a trusted same-host loopback proxy, or a direct localhost/SSH-forwarded browser.
A proxy's loopback socket alone does not make the original client local or secure.
Known forwarding headers, including empty values, disable the direct-localhost
exception; a supplied Host or Origin must also identify localhost for that exception.

The proxy must overwrite `X-Forwarded-Proto` from the original client connection.
The configured trusted hop count must be an integer from 1 through 5; the managed
Cloudflare topology uses 1. Every supplied protocol entry must be HTTPS, with no
empty entries and no more entries than trusted hops. HTTP, mixed, missing or
malformed forwarding evidence must not authorize a recovery operation. A direct
remote peer cannot gain trust by supplying these headers.

Keep reverse-proxy configuration under administrator control. A proxy that strips
all forwarding evidence and rewrites Host to localhost is indistinguishable from
a direct local client; do not deploy that configuration. Ordinary trusted-LAN HTTP
administration, login/capability checks, recovery encryption, and host-owned
rollback are unchanged. See [Cloudflare transport](docs/CLOUDFLARE-TUNNEL.md) and
[recovery architecture](docs/DATABASE-FIRST-RECOVERY.md).

Focused regression command:

```bash
node --test test/recovery-transport-policy.test.js test/recovery-transport-boundary.test.js
```

These tests cover the transport decision and real local HTTP header handling, not
a live Cloudflare tunnel or an appliance restore. Validate those separately on an
isolated authorized installation using test data, never real passphrases over HTTP.

## Classroom display credentials

Stable URL access for enabled configured display IDs is the intentional default
on a trusted classroom network. It does not authenticate the physical browser,
so isolate the display network and reject unknown, removed, or disabled IDs.

Where per-browser revocation is required, enroll every enabled receiver with a
one-time link before explicitly enabling individual display authentication.
Each enrolled display receives its own revocable credential; the database
stores only its SHA-256 hash. Disable the legacy shared `DISPLAY_TOKEN` after
migration. Raw display credentials and enrollment codes must not appear in
logs, diagnostics, database records, or administrative read APIs.

## Classroom computer agents and student data

Enroll every Windows classroom computer with a one-time GUI-generated command.
Each computer receives a revocable credential whose raw value is DPAPI-protected
locally and stored only as a hash in the Hub database. Disable the legacy shared
lab-agent token after migration. If Authenticode enforcement is configured, the
installer and self-update path reject scripts not signed by the selected publisher.

Browser history, screenshots, Veyon framebuffers, and monitoring alerts require
the `lab.sensitive.read` capability. Configure the retention periods under
**Settings → Student Data Retention** and apply the shortest policy appropriate
for the school. Do not include student information in diagnostic bundles or
public issue reports.

## Reporting vulnerabilities

Do not publish credentials, exploit details against a live school network, or student information in public issues. Use a private contact method with the repository owner for sensitive reports.

### Maintenance mutation boundary

Authenticated maintenance mutations share an appliance-wide limit of 30 requests per 60 seconds, enforced after token authentication and before both legacy and extension-wrapped routes. Excess writes return HTTP 429 with a Retry-After header; GET/HEAD/OPTIONS polling and health checks do not consume this budget. Forwarding headers cannot create new budgets. The counter is in memory and resets on a maintenance process restart.
