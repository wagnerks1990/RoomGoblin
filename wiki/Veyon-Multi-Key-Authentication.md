# Veyon Multi-Key Authentication

RoomGoblin supports multiple named Veyon private authentication keys while retaining the existing default/legacy key path.

In **Settings → Integrations & Hardware → Veyon Classroom Computers**, use the **Additional Veyon authentication keys** panel to import or replace a named PEM, choose a preferred key, review configured key names, or remove non-default keys. Imports must be cryptographically valid private PEMs no larger than 64 KiB. Private PEM contents are encrypted in SQLite and are never returned to the browser after import.

For each workstation RoomGoblin remembers the key that last authenticated successfully and tries it first. Otherwise it tries the preferred key, the current compatibility/default key, then the remaining configured keys. Fallback is restricted to Veyon authentication-key rejection; network failures, timeouts, and connection-pool exhaustion do not trigger attempts with every credential.

The original Veyon key-name/private-key settings remain supported for upgrades and existing deployments. Saving a key there also captures a named encrypted keyring copy. The active compatibility/default key cannot be removed from the browser while the legacy secret is still active.

This behavior is independent from DHCP inventory reconciliation. Hostname-based reconciliation keeps workstation metadata associated with the physical computer even when DHCP changes its address.

See `docs/VEYON-MULTI-KEY-AUTH.md` for the storage model, fallback order, security boundaries, and acceptance checks.
