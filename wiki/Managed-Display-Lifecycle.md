# Managed Display Lifecycle

RoomGoblin treats each Android TV enrollment as a durable managed-display record.

## Enrollment controls

- **Enable enrollment** resumes policy automation.
- **Disable enrollment** preserves the record but excludes it from automation.
- **Remove from Hub** removes only the RoomGoblin enrollment; it does not uninstall or factory-reset Android.

## Device Administrator

Device Admin is an optional fallback tier for already provisioned Android TV devices. **Enable Device Admin** uses Android's native approval flow. **Remove Device Admin** remains available as a standalone, user-confirmed revocation operation.

### Agent upgrades

Normal updates of the current `org.roomgoblin.display` package are in-place and preserve Device Admin; no remove/re-add cycle is needed.

Legacy `org.classroomhub.display` migration or an incompatible signing-identity replacement requires uninstalling the old package. Android will not uninstall a package with an active Device Administrator, and stock Android rejects ADB shell `dpm remove-active-admin` for production/non-test administrators with `SecurityException: Attempt to remove non-test admin`.

When that policy restriction is detected, RoomGoblin opens Android's native Device Administrator screen for the old receiver and stops before uninstalling anything. Confirm removal on the TV, then retry **Update Agent**. This is expected to be a one-time confirmation for the legacy/signing migration. RoomGoblin then installs the verified replacement, restores Agent configuration, trusted grants and persistent ADB policy, and attempts to restore Device Admin for the current package while verifying the final state.

RoomGoblin never treats a successful shell command as proof of Device Admin state and never force-uninstalls while the old administrator still verifies active.

## Device Owner

Device Owner remains the preferred target for new dedicated displays and should be provisioned during initial Android setup.

## Persistent ADB

Agent v2 configuration synchronizes the Hub-side persistent ADB policy and target port into the Android agent, and the replacement transaction restores that policy after installation.
