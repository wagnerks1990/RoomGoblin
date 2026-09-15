# Managed Display Lifecycle

RoomGoblin treats each Android TV enrollment as a durable managed-display record.

## Enrollment controls

- **Enable enrollment** resumes policy automation.
- **Disable enrollment** preserves the record but excludes it from automation.
- **Remove from Hub** removes only the RoomGoblin enrollment; it does not uninstall or factory-reset Android.

## Device Administrator

Device Admin is an optional fallback tier for already provisioned Android TV devices. **Enable Device Admin** uses Android's native approval flow. **Remove Device Admin** remains available as a standalone, user-confirmed revocation operation.

### Agent upgrades

When an administrator explicitly chooses **Reinstall/Update Agent**, RoomGoblin can use the existing trusted ADB channel to make package replacement transactional. It verifies the staged APK/signing identity first, detects prior Device Admin state, removes the active admin through Android's `dpm` shell interface, verifies it is inactive, replaces the package, restores Agent configuration and trusted grants, and attempts to restore Device Admin for the new package.

RoomGoblin verifies the final Device Admin state. If the firmware still requires native confirmation, the upgrade reports that requirement instead of claiming success. It never uninstalls while the old Device Admin still verifies active. This handles legacy `org.classroomhub.display` migrations that would otherwise fail with `DELETE_FAILED_DEVICE_POLICY_MANAGER`.

## Device Owner

Device Owner remains the preferred target for new dedicated displays and should be provisioned during initial Android setup.

## Persistent ADB

Agent v2 configuration synchronizes the Hub-side persistent ADB policy and target port into the Android agent, and the replacement transaction restores that policy after installation.
