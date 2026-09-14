# Android TV hardware validation

RoomGoblin's managed-display capability model is generic. This page records the current physical validation result for the Onn Android 14 test device without turning those observations into device-specific backend logic.

## Validated

On `onn 4K Streaming Device` / `wayne`, Android 14, Agent `0.3.0-agent-v2`:

- Device Administrator approval: **validated**.
- Accessibility approval: **validated**.
- Home through Accessibility: **validated**.
- Back through Accessibility: **validated**.
- Sleep capability becomes available after Device Administrator activation.

## OEM-dependent

Recents through Accessibility returned an accepted Android global-action request but showed no visible Recents interface on the tested firmware. Treat Recents as OEM-dependent.

## Not arbitrary input

Accessibility Home/Back/Recents do not mean RoomGoblin has arbitrary input injection. Agent v2 does not currently implement arbitrary D-pad/keycode, text, tap, swipe, or coordinate input through its native API. ADB shell controls are a separate recovery path.

Managed Displays reports arbitrary input as unavailable, separates Home/Back/Recents capabilities, disables actions until prerequisites are granted, and shows current Device Administrator and Accessibility state.

## Still to validate

Full reboot recovery, sleep/wake recovery, deliberate kiosk-exit recovery, network interruption recovery, current package migration on the deployed unit, native Sendspin playback/reconnect/reboot behavior, and any future Device Owner/lock-task provisioning remain separate acceptance tests.
