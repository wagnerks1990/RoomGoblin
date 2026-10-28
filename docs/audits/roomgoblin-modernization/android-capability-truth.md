# Native Android capability availability

RG-LAB-043 compares native capability advertisements with the implemented
AgentService action dispatcher. Nine planned or unimplemented operations could
be advertised as available solely because a platform API or grant existed.
Across ordinary and elevated permission scenarios, 13 assertions fail before
repair and nine controls pass.

Those native operation keys now remain present with available=false and an
explicit planned/not-implemented explanation. Existing launch, volume,
navigation, sleep, device-owner reboot, persistent-ADB recovery and gated root
controls retain their behavior. The reboot explanation now matches its actual
device-owner guard. Raw permission fields, Hub ADB launch and verified APK
installation remain unchanged; no new command or permission is introduced.

All 22 cases pass against the actual capability class with Android platform
objects substituted. The cases cover ordinary/elevated grants and both missing
halves of the root binary-plus-policy boundary. The fixture runs in the existing
Validate Android job. The supported Linux snapshot passes 2,428 tests with
zero failures and two expected root-only skips, all 23 Host Recovery cases and
all 55 socket/activity/process/PCM/Sendspin/capability JVM cases. Syntax,
controller and shell checks pass. Required CI image and APK checks remain mandatory.

Browser sources retain their 126-case-per-engine qualification. No hardware
permission, device-owner provisioning or physical command was exercised.
