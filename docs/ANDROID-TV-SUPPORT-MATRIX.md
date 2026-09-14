# Android / Google TV Support Matrix

This document records hardware/firmware behavior observed during physical validation. A device is not considered fully supported until all required rows have been tested on that exact model/build. The detailed current Agent v2 capability results are recorded in [Android / Google TV hardware validation](ANDROID-TV-HARDWARE-VALIDATION.md).

## Onn 4K Streaming Device — Android 14

Status: **Supported for the validated capabilities below**

Observed beginning 2026-09-09, with later Agent v2 capability validation recorded separately:

| Capability | Result | Notes |
| --- | --- | --- |
| Wireless ADB pairing | Pass | Pairing-code flow works through RoomGoblin GUI. |
| Pairing authorization after reboot | Pass | Device still listed the Hub as paired after reboot. |
| Device identification | Pass | Manufacturer `onn`, model `onn 4K Streaming Device`, Android 14. |
| ADB Home / Back / OK | Pass | Recovery/control-plane remote key actions verified from Managed Displays. This is separate from native Agent v2 Accessibility capability. |
| Volume control | Pass | Volume actions verified. |
| Screenshot | Pass | PNG screenshot retrieval verified. |
| ADB sleep / wake | Pass | Android endpoint sleep and wake were verified through the recovery/control plane; kiosk-policy recovery after sleep is a separate acceptance test. |
| Reboot command | Pass | Device rebooted successfully. Reboot API must treat transport loss as expected. |
| Wireless Debugging toggle after reboot | Fail / firmware behavior | The device disabled Wireless Debugging after reboot while preserving pairing authorization. |
| Secure ADB port after reboot | Dynamic | Port changed after reboot. |
| Reconnect after manually re-enabling Wireless Debugging | Pass | Managed Displays Status recovered the device without re-pairing. |
| Persistent ADB agent bootstrap | Pass | Opt-in `WRITE_SECURE_SETTINGS` boot-restoration path recovered Wireless Debugging after reboot. |
| Display Agent install | Pass | APK installation and status/configuration were verified. |
| Kiosk display URL | Pass | Assigned RoomGoblin content loaded fullscreen. |
| Auto-launch after boot | Pass | Agent and assigned content returned after reboot in the earlier lifecycle test; current Agent v2 boot/self-heal acceptance remains tracked in the detailed hardware-validation document. |
| Fixed ADB port after reboot | Pass | Persistent ADB restored the managed endpoint on port 5555 after the temporary boot gap. |
| Device Administrator activation | Pass | Physically validated with `deviceAdminActive:true`; this grants the optional device-admin sleep/lock tier only. |
| Accessibility activation | Pass | Physically validated with `accessibilityEnabled:true`. |
| Native Agent v2 Home | Pass | `GLOBAL_ACTION_HOME` visibly returned the device to the Google TV home screen. |
| Native Agent v2 Back | Pass | `GLOBAL_ACTION_BACK` visibly returned to the prior Android Settings screen. |
| Native Agent v2 Recents | OEM-dependent | Android accepted the Accessibility global action, but no visible Recents UI appeared on the validated firmware. |
| Native Agent v2 arbitrary input | Not implemented | Accessibility global actions do not provide arbitrary D-pad/keycode, text, tap, swipe, or coordinate injection. |
| HDMI-CEC physical panel power | Not tested | Must be validated separately from Android sleep/wake. |

## Validation-layer rule

Do not combine ADB recovery-plane success with native Agent v2 capability claims. ADB shell/input controls are elevated recovery tools. Native Agent v2 capability reporting must describe only what its authenticated agent API actually implements and what has been physically validated on hardware.

Likewise, an Android API returning success is not always equivalent to visible OEM behavior. Recents on the current Onn Android 14 target is the explicit example: the Accessibility request was accepted, but the launcher exposed no visible Recents UI.

## Promotion criteria

Promote a hardware/build combination to **Supported** only after:

1. Enrollment succeeds from a clean or documented starting state.
2. Routine remote controls, screenshot and status pass.
3. Reboot and unattended recovery behavior are understood and documented.
4. Display Agent installs, configures, launches and returns after reboot.
5. Persistent ADB behavior is explicitly marked supported, unsupported, or not required.
6. Native Agent v2 capabilities are distinguished from ADB recovery-plane capabilities and OEM-dependent behavior is recorded explicitly.
7. HDMI-CEC behavior is recorded if physical panel power is advertised.
8. The exact firmware/build fingerprint is captured in the managed device inventory or test record.
