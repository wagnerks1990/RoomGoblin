# Security

See [Host Networking](Host-Networking) for the current Linux container topology, loopback-only maintenance API, explicit add-on migration, listener ports and recovery rules.

RoomGoblin controls real classroom infrastructure and should be treated as an administrative system.

## Core principles

- Keep production secrets out of Git.
- Avoid privileged containers when a narrow host agent can perform the required operation.
- Restrict controller access to trusted users/networks.
- Require authentication and authorization for write-capable APIs.
- Keep logs and diagnostics free of credentials.
- Back up production state securely.
- Keep direct HTTP transport restricted to the trusted management network; use reviewed HTTPS for remote access.

## Trusted-LAN HTTP and optional remote HTTPS

The appliance retains direct trusted-LAN HTTP on TCP/3000. Optional managed Cloudflare HTTPS terminates through the same-host loopback connector; Caddy is not part of the current deployment.

Default network settings:

```text
HUB_BIND_ADDRESS=0.0.0.0
HUB_PORT=3000
TRUST_PROXY_HOPS=0
```

Because HTTP does not encrypt credentials or session traffic, the appliance must be limited to a trusted classroom/admin LAN or equivalent protected management segment. Do not port-forward TCP/3000 to the Internet and do not expose it to an untrusted guest/student wireless network.

Use host/network firewall rules to limit access to expected management subnets. Keep the maintenance service bound to loopback and keep the Host Agent reachable only through its local Unix socket.

Use the reviewed managed Cloudflare flow for remote HTTPS; it remains optional and outside local health and rollback gates. Cloudflare Access supplements rather than replaces RoomGoblin login and capabilities. Do not restore Caddy ad hoc on individual appliances.

## Full Recovery secrets and transport

A `.rgbak` Full Recovery Export can reconstruct the appliance and must be
handled like a private key. It is encrypted and authenticated with AES-256-GCM
using a key derived from the administrator's passphrase by scrypt. Keep the
bundle and passphrase in separate approved storage, never attach either to a
support case, and periodically test-import the bundle on an isolated host.

Recovery passphrases are accepted only over a direct loopback connection or
HTTPS terminated by a same-host loopback reverse proxy. For the proxy case,
configure the exact `TRUST_PROXY_HOPS` count and block direct client access to
the backend listener. Remote direct HTTP remains forbidden for export, import,
unlock/plan, restore start, and encrypted-bundle download even on a trusted LAN.

A loopback proxy socket is not evidence that its browser client is local. A
request containing known forwarding headers, even empty ones, cannot use the
direct-localhost exception. Supplied Host and Origin values must identify a
loopback authority for that exception. Direct localhost and SSH-forwarded browser
sessions remain supported without changing the configured proxy setting.

For a forwarded request, the immediate peer must be loopback, proxy trust must
be explicitly configured (the managed topology uses `TRUST_PROXY_HOPS=1`), and
the complete `X-Forwarded-Proto` value must contain HTTPS entries only. Missing,
empty, mixed HTTP/HTTPS, malformed or overlong chains are rejected. The proxy
must overwrite that header from the original client connection, not relay
client-supplied values. Do not strip all forwarding headers and rewrite Host to
localhost: that would erase the evidence distinguishing a proxy from a local
browser. Never test these restrictions with a real recovery passphrase.

The transport policy regression command is:

```bash
node --test test/recovery-transport-policy.test.js test/recovery-transport-boundary.test.js
```

It covers the decision logic and local HTTP header handling, not a real tunnel
or a complete appliance restore. Those require separate isolated acceptance.

Decryption/authentication, the exact manifest inventory, archive path/type/
capacity checks, and the Host Agent's independent staging validation must pass
before mutation. The Host Agent owns destination paths and restricts ownership
and modes to reviewed values. Its durable journal and safety copies are also
sensitive: retain them only as required to finish or roll back the transaction,
and do not expose `/var/lib/classroom-hub/full-recovery` or
`${HOST_BACKUP_DIR}/recovery-staging` through a file share or web server.

## Windows lab-agent transport

Windows agent enrollment over HTTP requires the explicit `-AllowHttp` switch because that exchange is otherwise unencrypted.

Prefer the configured managed HTTPS/WSS origin. Use `-AllowHttp` only for an explicit trusted, isolated classroom/admin LAN fallback; do not assume agents can satisfy an interactive Cloudflare Access challenge.

## Secrets

Use runtime environment variables, mounted secret files, or encrypted application storage for passwords, API tokens, MQTT credentials, Music Assistant tokens, private keys, and other sensitive values.

Never commit `.env`, production databases, backups, SSH keys, or certificate/private-key material.

`MAINTENANCE_TOKEN` must remain non-empty and synchronized between the native Host Agent, main application, and maintenance service. Troubleshooting should compare token presence/length rather than printing the secret.

The master encryption key is stored at:

```text
/etc/classroom-control-hub/master.key
```

Upgrades from the older `/etc/classroom-hub/master.key` location must preserve the existing key rather than silently rotating it.

## Display credentials

Stable URL access for enabled configured display IDs is the intentional default on a trusted classroom network. This does not authenticate the physical browser, so isolate the display network and reject unknown, removed, or disabled IDs.

Where per-browser revocation is required, enroll every enabled receiver with a one-time link before explicitly enabling individual display authentication. The resulting credential is unique, revocable, bound to a stable display ID, and stored locally by that receiver. Enrollment links expire and cannot be reused. The database stores only SHA-256 hashes, and administration APIs expose metadata rather than raw tokens. Disable the legacy shared display token after migration.

## Host privileges

The main application should not receive unrestricted access to the Docker socket or host filesystem merely for convenience. Host-level actions belong in the Host Agent with a narrow authenticated API and explicit allowlist of operations.

The shared application data root intentionally uses `root:10001` ownership so the non-root app and hardened maintenance container can both traverse it without allowing the app to lock maintenance out by changing the shared root to mode `0700`.

## Public repository sanitization

Before publishing production-derived code, review for:

- credentials and tokens
- internal IP addresses and topology
- private DNS names
- student/user information
- room-specific device secrets
- private certificates/keys
- production database contents
- diagnostic bundles and backups

Some infrastructure identifiers may not be secret by themselves, but they should still be externalized when they are deployment-specific and unnecessary for the generic project.

## Updates

Review dependency and container-image updates before production rollout. Validate the new build against a copy of persistent state and preserve a rollback path.

A successful update must verify direct HTTP backend health, database/scheduler readiness, maintenance health, Host Agent health, and version convergence. TLS/Caddy is intentionally not a current release gate.

## Reporting

Security concerns should be reported without posting live credentials, student information, or exploitable production details in a public GitHub issue. The repository `SECURITY.md` contains the current public reporting policy.
