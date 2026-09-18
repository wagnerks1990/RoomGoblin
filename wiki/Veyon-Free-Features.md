# Free Veyon features and community pilot

The [complete feature map, repository review, API boundaries, pilot build and recovery guide](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/VEYON-FREE-FEATURES.md) is authoritative.

RoomGoblin adds Wake, extended shutdown controls, student demonstrations, shared
lesson actions, browser clipboard/shortcut commands, bounded recording, and
one-target browser remote control with monitor view and explicit clipboard read.
RoomGoblin also provides bounded pilot-folder download and 2 MiB atomic Inbox
upload plus a Windows Internet Guard browser pilot. Official bulk transfer and
Configurator settings remain native-only. Paid add-ons are excluded.

Community chat and restricted file-browser sources live separately under `integrations/veyon-plugins` with GPL provenance and a pinned official native baseline. They are not installed by a Hub update. Do not copy these plugins into the different Veyon/Qt installation. Linux build checks do not prove Windows compatibility; use matching disposable teacher/student VMs and sample files for acceptance.

## Native pilot artifacts

The Validate native job builds the entire pinned Linux Veyon tree and publishes
matching binaries plus all corresponding source. See [native pilot binaries](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/VEYON-PILOT-BINARIES.md).
`tools/package-veyon-pilot.sh` uses DESTDIR staging and verifies both community
plugins with the installed CLI. No production install, service start, key export
or Windows compatibility claim is allowed. Preserve GPL source distribution and
require disposable matching Ubuntu desktop VMs for interactive acceptance.

Browser adapters for chat and restricted file browsing are described in
[Community web tools](Veyon-Community-Web.md). Remote input, monitor view and
clipboard read are described in [Browser control](Veyon-Browser-Control). They
require matching native pilot components.

The Windows-only [Internet Guard pilot](Veyon-Internet-Guard-Pilot.md) is a
separate disposable endpoint test with explicit firewall recovery.
