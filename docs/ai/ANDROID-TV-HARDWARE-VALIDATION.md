# AI Maintainer Context — Android TV Hardware Validation

Read this with `docs/ai/ANDROID-TV-CONTEXT.md` before changing Android capability reporting or Managed Displays controls.

## Physically validated Onn Android 14 behavior

On the validated `onn 4K Streaming Device` (`wayne`, Android 14 / SDK 34) running Agent `0.3.0-agent-v2`:

- Device Administrator activation succeeded and `deviceAdminActive:true` was observed afterward.
- `sleepDisplay` became available through the device-admin tier.
- Accessibility activation succeeded and `accessibilityEnabled:true` was observed afterward.
- Accessibility Home is physically validated.
- Accessibility Back is physically validated from inside Android Settings.
- Accessibility Recents returned Android success but produced no visible Recents UI on this firmware.

Do not interpret `AccessibilityService.performGlobalAction(...) == true` as proof that an OEM launcher visibly changed state. It means Android accepted the request.

## Capability-model invariant

Accessibility global actions and arbitrary input are separate capabilities.

`inputInjection.available` MUST remain `false` for the current Agent v2 implementation. Accessibility does not provide the current agent with arbitrary D-pad, keycode, text, tap, swipe, or coordinate injection. ADB shell controls are a separate elevated recovery plane and are not evidence that the authenticated native agent supports arbitrary input.

Keep the backward-compatible aggregate `globalNavigation` capability, but expose individual `navigationHome`, `navigationBack`, and `navigationRecents` entries. Recents is OEM-dependent and should be described as such rather than hard-coding Onn-specific backend behavior.

## UI invariant

Managed Displays should derive optional Agent v2 controls from the live capability response. Once Accessibility or Device Administrator is enabled, the corresponding activation control should show the granted state rather than continuing to look like an unmet setup step. Home/Back/Recents must be disabled until Accessibility is enabled. Recents must warn that OEM Android TV launchers may accept the request without displaying a Recents UI.

Raw capability JSON remains a diagnostic surface; normal administration should use the readable capability summary.

## Remaining validation

Do not claim the following as physically validated until separately tested on hardware: full reboot recovery, sleep/wake recovery, deliberate-exit kiosk recovery, network interruption recovery, current-package migration state on the deployed unit, native Sendspin playback/reconnect/reboot behavior, Device Owner, or lock-task kiosk.
