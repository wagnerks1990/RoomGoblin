# Experimental Veyon community sources

These native sources are **GPL-2.0-or-later**, not the MIT license of the
RoomGoblin web application. See COPYING and the original per-file notices.
They are kept in a separate source tree, not linked into or shipped inside the
Hub application. Redistributed pilot binaries must include their corresponding
source (including these changes), notices and GPL terms.

| Component | Upstream | Pinned source |
| --- | --- | --- |
| Two-way classroom chat | https://github.com/mravariya/Veyon | faec6bca623e5425ed3d36597b5b2dd2311c376a, plugins/classroomchat |
| Remote file browser | https://github.com/0mattsmith/VeyonFork | 233c1b0b04c2a95b9e688246468dd510b71f4cde, plugins/remotefilebrowser |
| Native build baseline | https://github.com/veyon/veyon | afecfd6cbf78efa34da80acb7ea449001574e8cc (v4.11.2) |

RoomGoblin modifications, September 2026:

- Linux native baseline: materialize `desktopFile` as QString in
  `LinuxServerProcess.cpp`; an auto-deduced QStringBuilder retains references
  to temporary operands. The preparer checks the exact pinned patch anchor.
  Keep file-policy assertions enabled in Release test builds.
- Bundled x11vnc: initialize the input-loop frame counter before calling
  `fb_update_sent`, which can leave it unset in no-framebuffer mode. The fixed
  submodule revision remains b32d00e81a6cc5bd5c5be5882e0db56bb7537da8.

- Chat: repair enum argument reads that did not compile; reject no-op headless
  execution; bind responses to a selected endpoint/session and requests to their
  authenticated teacher; one active teacher conversation per student; limit
  selection to 32 endpoints, messages to 2000 characters and logs to 500 blocks;
  stop old sessions before changing targets; clear student text between sessions;
  do not terminate the shared Veyon session worker when chat ends.
- File browser: restrict ordinary file reads/listings to the logged-in user's
  `RoomGoblin-Pilot` folder, reject canonical paths outside it and symbolic-link
  entries; cap directory results at 1000, files at 50 MiB and chunk size at
  128 KiB; pace chunks; pin replies to the selected endpoint and first teacher
  connection; use QSaveFile for atomic saves, verify byte counts and write results,
  and discard incomplete transfers after 60 seconds.

The file browser intentionally keeps the first teacher connection pinned for the
endpoint service lifetime. Restart the **pilot endpoint's** Veyon service before
using a replacement teacher connection. This fails closed instead of routing
old worker replies to a new controller. Chat also requires the teacher to close
its dialog before opening another session. Neither plugin is a WebAPI feature.

The test folder is a pilot restriction, not a hardened filesystem sandbox against
an adversarial local user changing filesystem links concurrently. Test with
non-sensitive sample files in disposable VMs. Veyon's existing authentication,
access rules and user-session permissions remain mandatory. No upload, deletion,
remote shell, firewall manipulation or student monitoring evasion is added.

Build and runtime compatibility are separate: compiler/Qt/Veyon versions must
match across the entire native build. Never copy these DLLs into the existing
4.9.7 installation. See docs/VEYON-FREE-FEATURES.md in RoomGoblin for pilot steps
and the complete reviewed repository disposition.

## RoomGoblinWebBridge

Original RoomGoblin contributor code, GPL-2.0-or-later, September 2026. Compiled
against the pinned official 4.11.2 source above. Clipboard sending uses official
RemoteAccessFeaturePlugin ClipboardExchange UID and ClipboardText argument index
1. No community code is copied into this plugin. It respects appliance disabled
features/clipboard policy and leaves endpoint authorization to native Veyon.
The Hub remains separate; matching binary artifacts include this source.

Keyboard shortcuts use official VncConnection keyEvent with fixed X11/RFB
keysyms and complete reverse-order release. No endpoint plugin or held-key
session is added. Native remote-control disabled-feature policy applies.
