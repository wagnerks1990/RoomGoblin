# Android TV Sendspin and Device Admin maintenance context

## Native Sendspin serialization

RoomGoblin Agent `0.3.1-agent-v2` must construct Moshi with Sendspin's `JsonOptionalAdapterFactory` before `KotlinJsonAdapterFactory`. `sendspin-jvm` uses `JsonOptional<T>` in partial server-state models. A bare `Moshi.Builder().build()` causes runtime serialization failures such as `Cannot serialize abstract class com.sendspin.protocol.JsonOptional` and prevents connection to Music Assistant.

Keep the adapter order covered by regression tests when upgrading `sendspin-jvm` or Moshi.

## Device Administrator removal

Android refuses to uninstall an application while its `DeviceAdminReceiver` is active. This matters during migration from legacy `org.classroomhub.display` to current `org.roomgoblin.display` and may surface as `DELETE_FAILED_DEVICE_POLICY_MANAGER`.

Managed Displays exposes **Remove Device Admin**. It does not silently revoke Device Admin. The maintenance bridge opens Android TV's native Device Administrator screen for the installed RoomGoblin/Classroom Hub package and Android requires user confirmation on the TV. During legacy migration, prefer the legacy package when it is still installed.

Do not replace this with unattended policy removal, factory reset, or package deletion. Preserve enrollment, ADB trust, display assignment, and agent configuration while the user completes the Android confirmation flow.
