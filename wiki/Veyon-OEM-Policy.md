# Veyon OEM-only integration policy

RoomGoblin supports **upstream/OEM Veyon configuration and upstream/OEM add-ons only**.

## Supported boundary

RoomGoblin may integrate with the host-managed Veyon WebAPI for the existing reviewed classroom workflows: inventory and status, authenticated previews/live view, screen and input locks, messages, opening websites, launching applications, user login/logoff, reboot/shutdown, teacher demonstrations, connection-pool management, key management, DHCP/inventory reconciliation, and package lifecycle reporting.

Veyon authentication keys, configuration, package ownership, and add-on licensing remain Veyon/OEM responsibilities. Existing upstream/OEM add-ons may be discovered by Veyon; discovery is informational and does not create a RoomGoblin browser action automatically.

## Excluded from RoomGoblin

Do not add or restore custom/community Veyon native plugins, RoomGoblin-specific native Veyon bridges, arbitrary endpoint command surfaces, experimental Veyon browser tool panels, browser-to-native remote-input or clipboard adapters, local analysis services, pilot file/chat tools, custom pilot package builders, endpoint pilot installers, CI pilot artifacts, or configuration variables used only by those removed services.

Any new Veyon capability must come from an upstream/OEM Veyon release or upstream/OEM add-on and must be separately reviewed before RoomGoblin exposes an action. Licensing, authentication, endpoint support, recovery, and classroom acceptance remain mandatory.

## Upgrade and persistence

RoomGoblin updates must not replace or reset the host Veyon installation, keys, access rules, directory configuration, or OEM add-on state. Legacy database fields/preferences created by removed workflows may remain inert for rollback/data-preservation safety; current code must not read them to reactivate removed behavior.

The GitHub source tree, controller bundle, backend routes, CI workflow, documentation, and AI contributor context must remain free of custom Veyon extension implementations.

## Verification

1. Veyon and Veyon WebAPI host services remain installed/configured through the existing lifecycle path.
2. The Veyon workspace has no experimental/free-feature panel or custom extension controls.
3. Standard OEM-backed classroom controls and previews still operate through the reviewed WebAPI command allowlist.
4. No custom Veyon plugin/analysis source trees or pilot packaging jobs are present in the repository or validation workflow.
