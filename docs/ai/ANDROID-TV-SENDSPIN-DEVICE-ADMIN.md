# Android TV Sendspin and Device Admin maintenance context

## Native Sendspin serialization

RoomGoblin Agent `0.3.1-agent-v2` must construct Moshi with Sendspin's `JsonOptionalAdapterFactory` before `KotlinJsonAdapterFactory`. `sendspin-jvm` uses `JsonOptional<T>` in partial server-state models. Keep the adapter order covered by regression tests.

## Device Administrator and agent replacement

Android refuses to uninstall an application while its `DeviceAdminReceiver` is active and may return `DELETE_FAILED_DEVICE_POLICY_MANAGER`.

Do not assume trusted ADB can silently revoke every Device Administrator. Stock Android's shell `dpm remove-active-admin` path rejects production/non-test administrators with `SecurityException: Attempt to remove non-test admin`. That is an Android policy boundary, not an ADB connectivity failure.

For an explicit administrator-approved Agent replacement, RoomGoblin must validate the staged APK/signing identity first and detect prior Device Admin state. Normal `org.roomgoblin.display` updates use `adb install -r`, preserve the same package/component, and therefore preserve Device Admin without a remove/re-add cycle.

When a legacy `org.classroomhub.display` migration or incompatible signing identity requires package replacement, RoomGoblin may attempt `dpm remove-active-admin`, but it must recognize the non-test-admin restriction. In that case open the native Device Administrator deactivation UI for the exact old component, return `device_admin_confirmation_required`, and stop before uninstalling anything. After the administrator confirms removal on the TV and retries the update, install the verified replacement, restore saved Agent v2/display configuration and trusted `WRITE_SECURE_SETTINGS`, restore persistent ADB policy, and then attempt `dpm set-active-admin` for the current package while verifying the resulting state.

Never claim Device Admin was restored merely because a shell command returned. If Android/OEM policy leaves it inactive, return `restoreRequiresUserConfirmation: true` and use the native approval helper. Never uninstall while verification still shows the old administrator active.

The standalone **Remove Device Admin** UI remains a user-confirmed native Android flow. Preserve enrollment IDs, ADB trust, display assignment, Agent token/configuration, persistent-ADB policy, and unrelated RoomGoblin data throughout replacement.
