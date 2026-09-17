# Free Veyon features and community pilot

The [complete feature map, repository review, API boundaries, pilot build and recovery guide](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/VEYON-FREE-FEATURES.md) is authoritative.

RoomGoblin adds Wake, extended shutdown controls, student demonstrations, shared lesson actions, browser clipboard/shortcut commands and bounded browser recording. Native-only tools and Configurator settings are documentation-only and omitted from the web GUI. Paid add-ons are excluded.

Community chat and restricted file-browser sources live separately under `integrations/veyon-plugins` with GPL provenance and a pinned official native baseline. They are not installed by a Hub update. Do not copy these plugins into the different Veyon/Qt installation. Linux build checks do not prove Windows compatibility; use matching disposable teacher/student VMs and sample files for acceptance.

## Native pilot artifacts

The Validate native job builds the entire pinned Linux Veyon tree and publishes
matching binaries plus all corresponding source. See [native pilot binaries](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/VEYON-PILOT-BINARIES.md).
`tools/package-veyon-pilot.sh` uses DESTDIR staging and verifies both community
plugins with the installed CLI. No production install, service start, key export
or Windows compatibility claim is allowed. Preserve GPL source distribution and
require disposable matching Ubuntu desktop VMs for interactive acceptance.

Browser adapters for the incorporated chat and restricted file browser are described in [Community web tools](Veyon-Community-Web.md). They require matching native pilot components.
