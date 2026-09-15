# Managed Display Lifecycle

Managed Displays are durable RoomGoblin enrollments. A device record may survive temporary ADB loss, Android reboots, randomized wireless-debugging ports, and Agent v2 transport changes.

## Lifecycle operations

- **Enable enrollment** — marks the record active.
- **Disable enrollment** — preserves configuration but excludes it from policy automation.
- **Remove from Hub** — removes only the RoomGoblin enrollment, not the Android app or TV data.

## Device Administrator

**Enable Device Admin** opens Android's native approval flow. Device Admin enables the fallback sleep/lock tier but is not Device Owner.

**Remove Device Admin** remains an explicit user-confirmed native Android operation when an administrator wants to revoke Device Admin independently of an upgrade.

## Automatic Agent replacement

An explicit **Reinstall/Update Agent** operation may use the already trusted ADB management channel to preserve Device Admin across a package replacement. RoomGoblin validates the staged APK and appliance signing identity before changing the device. If the installed package has active Device Admin, it requests removal with Android's `dpm` shell interface and verifies that the receiver is inactive before uninstalling anything. If verification fails, replacement stops rather than forcing package deletion.

After installation RoomGoblin restores saved Agent v2/display configuration, supported trusted grants such as `WRITE_SECURE_SETTINGS`, persistent-ADB policy, and relaunches the kiosk. If Device Admin was active before replacement, RoomGoblin attempts to reactivate the current `org.roomgoblin.display/.AgentDeviceAdminReceiver` and verifies the resulting state. Some Android TV firmware may still require the native confirmation screen; in that case the result explicitly reports that confirmation is required rather than claiming restoration succeeded.

This transaction is particularly important when migrating legacy `org.classroomhub.display`, where Android otherwise returns `DELETE_FAILED_DEVICE_POLICY_MANAGER`.

## Persistent ADB synchronization

`Configure v2` synchronizes the Hub-side persistent ADB policy and target port into the Android agent.

## Regression invariants

1. Managed display inventory remains visible when ADB is unavailable.
2. Removing Hub enrollment never removes the Android app or wipes unrelated data.
3. Agent replacement validates the replacement artifact before changing the installed package.
4. Never uninstall an app while its Device Admin receiver still verifies active.
5. Restore enrollment identity, Agent configuration, persistent ADB, trusted grants, and prior Device Admin intent after replacement.
6. Never report Device Admin restored without verifying it active.
7. Standalone Device Admin removal remains distinct from the automatic replacement transaction.
