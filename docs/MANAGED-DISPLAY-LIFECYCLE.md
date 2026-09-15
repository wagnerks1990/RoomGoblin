# Managed Display Lifecycle

Managed Displays are durable RoomGoblin enrollments. A device record may survive temporary ADB loss, Android reboots, randomized wireless-debugging ports, and Agent v2 transport changes.

## Lifecycle operations

- **Enable enrollment** — marks the record active.
- **Disable enrollment** — preserves configuration but excludes it from policy automation.
- **Remove from Hub** — removes only the RoomGoblin enrollment, not the Android app or TV data.

## Device Administrator

**Enable Device Admin** opens Android's native approval flow. Device Admin enables the fallback sleep/lock tier but is not Device Owner.

**Remove Device Admin** remains an explicit user-confirmed native Android operation when an administrator wants to revoke Device Admin independently of an upgrade.

## Agent replacement and Android's production-admin restriction

Normal updates of the current `org.roomgoblin.display` package use Android's in-place package update path (`adb install -r`). Device Admin remains attached to the same package/component, so RoomGoblin does not need to remove and re-add Device Admin for ordinary updates.

A package-identity migration from legacy `org.classroomhub.display`, or a replacement caused by an incompatible signing identity, is different: Android must uninstall the old package first. Android refuses to uninstall while that package owns an active Device Administrator and stock Android intentionally rejects `dpm remove-active-admin` for a production/non-test administrator with `SecurityException: Attempt to remove non-test admin`. ADB shell privilege does not bypass that policy boundary.

RoomGoblin therefore attempts the shell removal only when Android permits it. If Android reports the non-test-admin restriction, RoomGoblin opens the native Device Administrator screen for the exact old receiver, stops before uninstalling anything, and reports `device_admin_confirmation_required`. Confirm removal on the TV and retry **Update Agent**. This should be a one-time confirmation for the legacy package/signing migration; subsequent same-package updates remain in-place.

After a replacement RoomGoblin restores saved Agent v2/display configuration, supported trusted grants such as `WRITE_SECURE_SETTINGS`, persistent-ADB policy, and relaunches the kiosk. If Device Admin had been active before replacement, RoomGoblin attempts to reactivate the current `org.roomgoblin.display/.AgentDeviceAdminReceiver` and verifies the final state. OEM firmware may still require the native activation confirmation screen; RoomGoblin must report that requirement rather than claiming restoration succeeded.

This transaction prevents `DELETE_FAILED_DEVICE_POLICY_MANAGER` without pretending Android's production Device Admin security model can be bypassed remotely.

## Persistent ADB synchronization

`Configure v2` synchronizes the Hub-side persistent ADB policy and target port into the Android agent.

## Regression invariants

1. Managed display inventory remains visible when ADB is unavailable.
2. Removing Hub enrollment never removes the Android app or wipes unrelated data.
3. Agent replacement validates the replacement artifact before changing the installed package.
4. Never uninstall an app while its Device Admin receiver still verifies active.
5. Treat `Attempt to remove non-test admin` as an Android policy boundary, open the native deactivation UI, and stop before uninstall.
6. Preserve enrollment identity, Agent configuration, persistent ADB, trusted grants, and prior Device Admin intent after replacement.
7. Never report Device Admin restored without verifying it active.
8. Ordinary current-package updates remain in-place and must not unnecessarily revoke Device Admin.
