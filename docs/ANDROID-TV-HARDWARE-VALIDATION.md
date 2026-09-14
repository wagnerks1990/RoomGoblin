# Android / Google TV hardware validation

This document records physical validation results for RoomGoblin managed-display behavior. It supplements the generic capability model; it must not be used to add product-specific backend branches.

## Validated target

- Manufacturer: onn
- Model: onn 4K Streaming Device
- Device/product: `wayne`
- Android: 14 / SDK 34
- Build fingerprint observed during validation: `onn/wayne/wayne:14/UKRB.260113.075.A1/15646418:user/release-keys`
- Agent: `0.3.0-agent-v2`

Site-specific network addresses, display URLs, credentials, tokens, and classroom identifiers are intentionally omitted.

## Physical results

### Device Administrator

Device Administrator activation is physically validated. Android displayed the system approval flow and the agent subsequently reported `deviceAdminActive:true`. The `sleepDisplay` capability changed to available with `mode:"device-admin"`.

Device Administrator remains optional and is not Device Owner. It does not grant silent install, arbitrary input, lock-task allowlisting, or DevicePolicyManager reboot.

### Accessibility global navigation

RoomGoblin Accessibility was explicitly enabled and the agent subsequently reported `accessibilityEnabled:true`.

- `GLOBAL_ACTION_HOME`: physically validated; the device returned to the Google TV home screen.
- `GLOBAL_ACTION_BACK`: physically validated from within an Android Settings submenu; the device returned to the prior Settings screen.
- `GLOBAL_ACTION_RECENTS`: Android returned success from `performGlobalAction`, but no visible Recents UI appeared on this validated firmware.

Therefore a successful Android Accessibility return value means the request was accepted by Android, not that an OEM launcher visibly changed state. Recents is OEM-dependent and must not be represented as universally effective on Android TV.

### Arbitrary input

Accessibility global navigation is not arbitrary input injection. Agent v2 currently does not implement arbitrary D-pad/keycode, text, tap, swipe, or coordinate injection through its authenticated native API. `inputInjection.available` must remain `false` until such an implementation exists and is separately validated.

ADB shell controls are a separate elevated recovery path and do not validate native Agent v2 arbitrary input.

## Capability-model rules

The agent exposes individual `navigationHome`, `navigationBack`, and `navigationRecents` capability entries while retaining aggregate `globalNavigation` for backward compatibility. `navigationRecents` is marked `accessibility-oem` because Android TV launchers may ignore the action or expose no Recents interface.

Managed Displays should disable Home/Back/Recents until Accessibility is enabled, show Device Administrator and Accessibility as already enabled once granted, and present a readable capability summary while keeping raw JSON available for diagnostics.

## Remaining hardware validation

The following still require separate physical acceptance testing before they should be described as validated on this target:

- sleep followed by recovery/wake behavior under the configured kiosk policy;
- boot auto-start after a full reboot;
- self-healing kiosk return after deliberate exit;
- network interruption/reconnection;
- current `org.roomgoblin.display` package migration state on the deployed device;
- native Sendspin registration, HDMI audio, volume behavior, reconnect, reboot recovery, and WebView-independent playback;
- Device Owner provisioning and lock-task behavior, if RoomGoblin later adds an intentionally managed provisioning workflow.
