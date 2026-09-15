# Android TV Sendspin and Device Admin maintenance context

## Native Sendspin serialization

RoomGoblin Agent `0.3.1-agent-v2` must construct Moshi with Sendspin's `JsonOptionalAdapterFactory` before `KotlinJsonAdapterFactory`. `sendspin-jvm` uses `JsonOptional<T>` in partial server-state models. Keep the adapter order covered by regression tests.

## Device Administrator and agent replacement

Android refuses to uninstall an application while its `DeviceAdminReceiver` is active and may return `DELETE_FAILED_DEVICE_POLICY_MANAGER`.

For an explicit administrator-approved Agent replacement, RoomGoblin's trusted ADB maintenance channel should make this transactional: verify the staged APK/signing identity first; detect whether the old package's Device Admin is active; request `dpm remove-active-admin`; verify it is inactive before uninstalling; install the verified replacement; restore saved Agent v2/display configuration and trusted `WRITE_SECURE_SETTINGS`; then attempt `dpm set-active-admin` for the current package and verify the resulting policy state.

Never claim Device Admin was restored merely because the command returned. If Android/OEM policy leaves it inactive, return `restoreRequiresUserConfirmation: true` and use the native approval helper. Never uninstall while verification still shows the old administrator active.

The standalone **Remove Device Admin** UI remains a user-confirmed native Android flow. Automatic removal is restricted to the explicit Agent replacement transaction over the already trusted ADB management channel.

Preserve enrollment IDs, ADB trust, display assignment, Agent token/configuration, persistent-ADB policy, and unrelated RoomGoblin data throughout replacement.
