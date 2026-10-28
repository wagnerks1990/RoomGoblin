# Native Android Sendspin configuration

[Finding classification and immutable source locations](finding-metadata.md#android-sendspin-configuration).

RG-LAB-042 reproduces four failures in the actual native manager: a changed name
does not reach the active client, a partial configuration cannot retain its saved
URL, a failed connection loses its cleanup reference, and CONNECTING/HANDSHAKING
are reported as connected. Eight initial configuration, identity, rejection,
disable, reconnect and fallback-name controls pass before repair.

Connection reuse now compares both URL and effective player name. Explicit name
changes reconnect with the same persistent client ID; unchanged settings retain
the active client. Partial configuration validates the saved URL when omitted,
while explicit invalid input still fails before persistence. Failed connection
attempts call the existing stop/cleanup path. Status snapshots the protocol state
once and reports readiness only for CLOCK_SYNCING or STREAMING.

The [pinned client implementation](https://github.com/Sendspin/sendspin-jvm/blob/v0.3.4/sendspin-protocol/src/main/kotlin/com/sendspin/protocol/SendSpinClient.kt)
was inspected to verify connection lifecycle and state names. WebSocket opening
starts HANDSHAKING; accepted server hello starts CLOCK_SYNCING. This does not
change or upgrade the Sendspin library.

All 12 Kotlin cases pass against the full native manager, with Android preferences,
HTTP builders and protocol clients substituted. They use the compiler already
bundled in the existing checksum-pinned Gradle distribution and now run in the
existing Android CI job. Supported Linux qualification passes 2,428 tests with
zero failures and two root-only skips, all 23 Host Recovery cases, all 33 JVM
cases and syntax/controller/shell checks. A separate export-freeze fixture setup
repair passes 20 consecutive cases; its required CI follows.

Browser sources retain their 126-case-per-engine qualification. No actual
Sendspin network connection, Android preference persistence or physical audio
was tested; hardware acceptance remains separate in the native-audio guide.
