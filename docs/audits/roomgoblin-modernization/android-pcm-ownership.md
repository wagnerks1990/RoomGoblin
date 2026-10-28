# Android PCM worker ownership

[Finding classification and immutable source locations](finding-metadata.md#android-pcm-ownership).

RG-LAB-041 reproduces two native player failures. A stopped worker blocked in a
write can observe the shared running flag become true for a replacement session,
consume its queued frame and write through the new global AudioTrack. A failed
AudioTrack.play also leaves running true, preventing a corrected explicit start.
Three playback/volume, unsupported-format and stop/release controls pass.

Workers now capture their own track. Both loop and write admission require that
track to remain current. Buffer polling and the ownership check share the same
monitor as configuration/start/stop, preventing a retired worker from consuming
the replacement's queued frame. Running becomes true only after play succeeds.
Existing PCM format, gain, buffer timing and release behavior remain unchanged.

The [pinned Sendspin AudioBuffer source](https://github.com/Sendspin/sendspin-jvm/blob/v0.3.4/sendspin-protocol/src/main/kotlin/com/sendspin/protocol/AudioBuffer.kt)
was reviewed before coordinating its ready-chunk polling with player transitions.
No library change or dependency upgrade is introduced.

All five cases pass against the actual Kotlin player, compiled using the compiler
already bundled with CI's checksum-pinned Gradle 9.6.0 distribution. Android
AudioTrack and protocol objects are substituted. A deliberately delayed old
write verifies both retirement and preservation of the replacement's queued
frame. The fixture is added to the existing Android job before APK building.

Supported Linux qualification passes 2,428 tests with zero failures and two
root-only skips, all 23 Host Recovery cases, all 21 socket/activity/process/PCM
JVM cases and syntax/controller/shell checks. Browser sources retain their
126-case-per-engine qualification. No physical audio, Android framework timing
or live Sendspin transport was tested, and physical native-audio validation
remains open as documented in the feature guide.
