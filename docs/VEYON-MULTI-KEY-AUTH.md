# Veyon Multi-Key Authentication

RoomGoblin can keep more than one named Veyon private authentication key. This is intended for classrooms where endpoints do not all share the same Veyon key pair, or while a key rotation is being completed.

## Storage and security

- Private PEM material is stored through RoomGoblin's encrypted SQLite secret store.
- Each named key uses a deterministic secret-store slot derived from a SHA-256 digest of the key name. The PEM is not placed in preferences, logs, diagnostics, browser storage, or API responses.
- The established `veyon.private-key` compatibility secret and `VEYON_PRIVATE_KEY_FILE` remain supported. On appliance startup/use, the compatibility key is captured into the named keyring before a replacement can overwrite that compatibility secret.
- API/UI responses contain only key names, the preferred key name, and a count.

## Authentication order

For each workstation, RoomGoblin uses this bounded order:

1. The credential that last authenticated that workstation successfully.
2. The administrator-selected preferred credential.
3. The current compatibility credential.
4. Remaining configured credentials.

Fallback occurs only after Veyon explicitly rejects key authentication (Veyon WebAPI error codes 4, 5, or 6). Pool exhaustion, connection refusal, DNS/network failure, timeout, or unrelated protocol errors do **not** cause RoomGoblin to try every key.

A successful key name is remembered per workstation. The preference cache is bounded to 512 workstation entries and contains no key material.

## Importing keys

Open **Settings → Integrations & Hardware → Veyon Classroom Computers**. RoomGoblin adds an **Additional Veyon authentication keys** panel underneath the existing compatibility key field.

Use **Import / Replace Key** to add a named PEM. Existing names can be replaced with a new PEM. Select **Prefer this key for new authentications** when appropriate. The stored PEM is cleared from the browser field after import and is never returned.

The original **Authentication key name / Private key (PEM)** fields remain supported. Saving through that compatibility path also captures the key in the encrypted named keyring so upgrades do not lose existing behavior. The maintenance/setup integration-save mirror follows the same capture path, so a Setup Wizard key replacement does not silently discard the previous named credential.

## Removing keys

Keys that are not the active compatibility credential can be removed from the keyring in Settings. RoomGoblin refuses browser removal of the active compatibility credential while it is still present, preventing an accidental loss of the established authentication path.

## DHCP interaction

The multi-key layer is independent of Veyon DHCP inventory reconciliation. Workstations are reconciled by hostname when DHCP addresses change, while authentication preference is learned from the workstation host used during the Veyon connection. A DHCP address change therefore does not attach classroom metadata to the wrong IP record, and a key-authentication fallback does not alter workstation identity.

## Acceptance checks

For a non-critical workstation:

1. Configure/import two Veyon keys where only one matches the endpoint.
2. Confirm the endpoint authenticates without exposing either PEM in the browser or diagnostics.
3. Repeat the action and confirm the previously successful key is tried first.
4. Simulate a wrong preferred key and confirm fallback succeeds only after Veyon rejects authentication.
5. Trigger Veyon connection-pool exhaustion or a network failure and confirm RoomGoblin does not cycle through all keys.
6. Renew/change the workstation DHCP lease and confirm hostname, display name, role, selection, preview, and reversible control remain attached to the same physical workstation.
