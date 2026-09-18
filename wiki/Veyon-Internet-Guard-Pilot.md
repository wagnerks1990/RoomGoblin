# Windows Internet Guard browser pilot

The authoritative behavior, acceptance, safety and recovery guide is
[Windows Internet Guard browser pilot](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/VEYON-INTERNET-GUARD-PILOT.md).

This GPL Windows-only pilot is built against the exact Veyon 4.11.2 source. The
controller exposes selected-PC block/allow only when the exact plugin identity is
advertised. It blocks common Internet ports for at most 15 minutes while the
plugin process remains alive; it is not complete tunnel prevention and a crash
can leave named firewall rules. Use a disposable PC and keep the documented
PowerShell cleanup command ready.
