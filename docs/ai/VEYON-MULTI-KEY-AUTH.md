# AI Context — Veyon Multi-Key Authentication

Treat Veyon authentication as a bounded encrypted keyring, not as a single global credential.

## Invariants

- Preserve the established Veyon compatibility credential path for upgrades.
- Additional private PEMs belong only in the encrypted `secret_store`; never place PEM contents in preferences, JSON configuration, logs, diagnostics, browser storage, API responses, documentation examples, or tests.
- Named key secrets use deterministic hashed secret names (`veyon.private-key.<digest>`). Key names themselves are non-secret metadata.
- Per-host successful-key memory stores only a key name and is bounded; it never stores private material.
- Authentication order is: the host's last successful credential, the administrator-preferred credential, the current compatibility credential, then other configured credentials.
- Only explicit Veyon key-authentication rejection (WebAPI codes 4/5/6) may advance to another key. Pool exhaustion (code 7), network errors, DNS errors, timeouts, and unrelated protocol failures must not spray credentials.
- Existing Veyon connection-pool ownership, command recovery, screenshot transport, and reversible classroom controls remain unchanged.
- Multi-key authentication must remain independent from DHCP inventory reconciliation. Hostname reconciliation owns workstation identity; the keyring owns authentication choice.
- The production appliance starts through `src/startup-recovery.js`; `src/veyon-keyring-bridge.js` must load before Express routes are created.

## Files

- `src/veyon-keyring.js` — encrypted named-key storage, ordering, host preference, legacy capture.
- `src/veyon-transport.js` — bounded transparent fallback for authentication POSTs.
- `src/veyon-keyring-bridge.js` — administrator key-management API and legacy integration-save capture.
- `public/controller/veyon-keyring-ui.js` — Settings keyring management UI; never renders PEM contents.
- `public/shared/branding.js` — loads the keyring UI on controller surfaces.
- `test/veyon-multikey.test.js` — encryption/fallback/no-key-spraying regressions.

When modifying Veyon authentication, verify DHCP reconciliation tests and the browser/controller validation in addition to keyring tests.