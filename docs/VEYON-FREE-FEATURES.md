# Free Veyon features and community pilot

RoomGoblin exposes the free Veyon classroom controls that its WebAPI can execute
and provides native launchers for desktop-only tools. **This does not make every
Veyon feature a browser API.** Native configuration and interactive file transfer
still belong in Veyon Configurator/Master. Paid add-ons, subscriptions and
commercial trials are excluded.

The appliance baseline is Veyon 4.9.7. Its service and WebAPI remain host-managed;
this change never installs, upgrades or restarts either service. Existing keys,
multi-key authentication, DHCP inventory, command recovery, displays, Morning
Announcements and Background Music remain on their established paths.

## Operator controls

Open **Veyon → Free features and experimental tools**. Select targets first,
including offline targets when using Wake or broadcast cleanup. Hidden selected
targets remain selected; check the existing selection count before confirming.

| Free capability | How to test | Limits / expected result |
| --- | --- | --- |
| Monitoring, screenshots, remote view | Existing previews, Live View, screenshot download | Requires `lab.sensitive.read`; an image proves capture, TCP alone does not |
| Remote keyboard/mouse control | Native control launcher | Run downloaded PowerShell on the teacher Windows PC with official Veyon configured |
| Clipboard exchange, monitor selection | Native Veyon remote-access window | Teacher-side settings and authentication apply; not implemented through 4.9.7 WebAPI |
| Teacher/student demonstration, fullscreen/window | Existing teacher controls or new student demonstration controls | Select source and audience; source must have a signed-in user; source excluded from recipients |
| Stop selected demonstrations | Select source and all recipients, then stop | Queues all three mode cleanups atomically; offline owned modes retain existing recovery behavior |
| Screen/input locks | Existing lock/unlock controls | Read-back confirmation, per-host order and restart cleanup retained |
| Text messages, open websites, launch applications | Existing buttons or saved lesson actions | Presets require explicit Run and target confirmation; no automatic execution |
| File distribution | Native Veyon Master | 4.9.7 WebAPI cannot initialize its interactive transfer controller |
| File collection | Newer native Veyon with collection support | Not present in the supplied 4.9.7 inventory; do not send an invented WebAPI command |
| Wake-on-LAN | Save MAC for one computer, select targets, Wake | Fixed local broadcast UDP/9; BIOS/NIC/network must support it; packet acceptance does not prove startup |
| Reboot, shutdown | Existing controls | One-shot request; never automatically retry uncertain delivery |
| Immediate, confirmed, delayed, updates-then-shutdown | New power options | Destructive confirmation; delay 30–3600 seconds; no cancellation after dispatch; OS behavior varies |
| Login/logoff, user/session details | Existing login/logoff and new details button | Login fields remain transient; no passwords in presets or launchers |
| Tray icon, desktop access confirmation, authorization, authentication, built-in/LDAP directory | Veyon Configurator | Configuration components, not student actions; existing access rules stay in effect |
| Version and active-feature queries | Native diagnostics / existing mode state | Internal commands are not presented as arbitrary executable browser actions |
| Screen recording | Experimental recording controls | Silent WebM contact sheet, 1–4 screens, five-minute deadline, 32 MiB memory/output cap |

The catalog labels appliance plugin advertisement separately from endpoint
verification. Missing advertised shutdown plugins prevent dispatch; presence
still does not prove a Windows endpoint supports or completed the action.
`PowerDownConfirmed` can shut down immediately with no signed-in user. The
updates option depends on the endpoint OS and pending updates. Test those last
on a spare endpoint with no unsaved work.

### Wake and DHCP

A saved MAC is associated with the inventory hostname at save time. A different
hostname on that IP invalidates Wake until the operator saves the MAC again.
MAC addresses are not silently reassigned by hostname discovery. After a lease
move, verify/save the MAC on the reconciled record. Broadcast goes out using the
host's routing table; routed VLANs and multihomed hosts may require native Veyon
Wake from the appropriate network. No arbitrary broadcast destination or relay
is exposed by the API.

### Saved lesson actions

Up to 40 uniquely named website, app and message actions live in SQLite preference
`veyon.lesson-actions` and therefore follow existing database backup/restore.
Names are limited to 80 characters; content to 2000. Website URLs must use
HTTP(S) without embedded credentials. Do not store secrets, sensitive messages
or private token-bearing URLs. Anyone with `lab.control` can read/edit these
shared presets. Concurrent editors use last-save-wins behavior.

### Recording lifecycle

Recording uses the existing authorized framebuffer endpoint, browser canvas and
MediaRecorder. Sampling waits at least one second after each contact-sheet
capture; slow endpoints reduce frame rate. No microphone/audio, server archive,
FFmpeg, background task, cloud upload or recording daemon is added. Capture is
visible and operator-started.

Hiding the workspace/tab, stopping, capture failure or the independent five-minute
deadline stops the recorder and its tracks. Download or discard before navigating
away. Browser navigation warnings are best-effort; closing/crashing the browser
can lose unsaved recordings. If an encoder chunk would exceed 32 MiB, the recording
is discarded rather than saving an incomplete oversized file. The normal preview
pool continues to enforce its existing pressure/authorization limits. Use a small
pilot and pause normal previews if needed.

## Community sources actually incorporated

Native plugin source is isolated under `integrations/veyon-plugins`, with its own
GPL-2.0-or-later COPYING and pinned provenance. It is **not included in the Hub
runtime** and is not automatically installed on classroom computers.

- **mravariya/Veyon classroom chat:** teacher-to-selected-students text and
  individual student replies. Replies are visible to the teacher, not relayed to
  all students. Up to 32 selected endpoints, 2000-character messages, 500-block
  logs and one teacher conversation per endpoint. Stop/close the teacher dialog
  before starting another conversation. No chat persistence.
- **0mattsmith/VeyonFork file browser:** browse/retrieve ordinary sample files
  from the signed-in user's `RoomGoblin-Pilot` folder. No upload/delete feature.
  Up to 1000 directory entries, 50 MiB per file, 128 KiB chunks and a 60-second
  transfer deadline. Local destination files change only after a complete,
  successful atomic save. Replies are bound to the selected endpoint and the
  endpoint service's first teacher connection; reconnecting/replacing that
  teacher requires a restart of the disposable endpoint's Veyon service.

These restrictions are intentionally narrower than the original forks. The file
folder check is not a race-resistant security sandbox against a hostile local
user swapping links during a read. Use disposable VMs and non-sensitive sample
files. Native Veyon authentication and access rules remain mandatory.

### Download a complete Linux pilot

See [Native pilot binaries](VEYON-PILOT-BINARIES.md) for the complete Linux
CI artifact, matching source, checksums, installation in disposable VMs and
acceptance tests. Windows packages remain separate work.

### Prepare and build the native pilot

Use a **new disposable build directory** and the official Veyon build dependencies
for your platform. The Python preparer works on Linux or Windows with Python/Git:

```bash
python3 tools/prepare-veyon-pilot.py /tmp/roomgoblin-veyon-pilot
cmake -S /tmp/roomgoblin-veyon-pilot -B /tmp/roomgoblin-veyon-build \
  -DCMAKE_BUILD_TYPE=Debug -DWITH_TRANSLATIONS=OFF -DWITH_LTO=OFF
cmake --build /tmp/roomgoblin-veyon-build \
  --target classroomchat remotefilebrowser roomgoblin-pilot-policy-test --parallel 2
/tmp/roomgoblin-veyon-build/plugins/remotefilebrowser/roomgoblin-pilot-policy-test
```

The preparer clones official Veyon **v4.11.2 at a fixed commit**, checks that
identity, initializes pinned submodules and adds only the two reviewed plugin
directories. It refuses an existing destination. It does not install anything,
copy authentication keys or invoke a service manager. Dependencies and the native
build are separate from RoomGoblin's npm dependencies.

For an operational native pilot, use the official [Veyon source/build
instructions](https://github.com/veyon/veyon) to build/package the **entire matching
native version** in disposable teacher and student VMs. Compiler, Qt and Veyon
versions must match; Windows DLLs cannot come from the Linux build. Do not copy
these plugins into the current 4.9.7 installation. Linux compilation is a CI gate;
Windows packaging and real Windows endpoint interoperability remain acceptance
work, not a claimed result. These sources are not a ready-made Windows installer.

Create `RoomGoblin-Pilot` under the test student's home/profile and populate only
sample files. Start with one teacher and one student. Validate both plugin names
in native `veyon-cli plugin list`, open them from Master, verify student replies,
transfer checksums, refusal of outside-folder paths, interrupted-transfer
preservation of an existing destination and second-teacher rejection. Then test
multiple students for chat. Keep matching corresponding source/licenses with any
pilot binary you distribute.

### All supplied repositories: disposition

| Repository | Decision |
| --- | --- |
| [veyon/veyon](https://github.com/veyon/veyon) | Official baseline; 4.9.7 WebAPI semantics, separately pinned 4.11.2 native pilot |
| [veyon/addons](https://github.com/veyon/addons) | No licensed commercial add-on or trial activated; repository availability alone is not a free license |
| [veyon/docs](https://github.com/veyon/docs) | Reference for native configuration, features and builds |
| [veyon/libvncserver](https://github.com/veyon/libvncserver) | Native upstream dependency; use upstream's pinned submodule, no production replacement |
| [veyon/ultravnc](https://github.com/veyon/ultravnc) | Windows upstream dependency; no separate server replacement |
| [vainmari/Veyon-detection](https://github.com/vainmari/Veyon-detection) | Local AI detection candidate, not installed: requires model/resource/retention validation and separate AGPL service review |
| [jorgetargz/veyon-advisor](https://github.com/jorgetargz/veyon-advisor) | Excluded: monitoring detection/blocking is contrary to classroom management |
| [Korckyjals-CODE/VeyonScripts](https://github.com/Korckyjals-CODE/VeyonScripts) | Lesson-script ideas inform bounded saved actions; no unreviewed privileged script runner copied |
| [JackStar6677-1/VeyonScripts](https://github.com/JackStar6677-1/VeyonScripts) | MAC/Wake workflow ideas; independent RoomGoblin implementation, no WinRM credential runner |
| [nmserain/VeyonScripts](https://github.com/nmserain/VeyonScripts) | Legacy deployment reference; no second installer over the managed setup |
| [OliverAshford-development/VeyonProxyPlugin](https://github.com/OliverAshford-development/VeyonProxyPlugin) | Excluded: old baseline and incompatible proxy assumptions; preserve current authenticated WebAPI |
| [lliurex/veyon-noble](https://github.com/lliurex/veyon-noble) | Distribution packaging reference; no demonstrated need to replace Ubuntu packages |
| [Rarder44/VeyonRecorder](https://github.com/Rarder44/VeyonRecorder) | Source not copied because README/license versions disagree; independent browser recorder added |
| [0mattsmith/VeyonFork](https://github.com/0mattsmith/VeyonFork) | File-browser source incorporated with pilot restrictions and GPL provenance |
| [Railsimulatornet/VeyonAutoupdateforWindows](https://github.com/Railsimulatornet/VeyonAutoupdateforWindows) | Upgrade reference only; automatic endpoint version drift is inappropriate for this matching-version pilot |
| [mravariya/Veyon](https://github.com/mravariya/Veyon) | Chat source incorporated and corrected; unrelated remote execution/restriction features not imported |
| [claudio-cavalcante/veyon](https://github.com/claudio-cavalcante/veyon) | Unrelated Godot project; excluded |

This review covers the supplied repository set, not a claim that all possible
GitHub extensions are compatible or have been installed.

## API and authorization

All paths below begin `/api/v1/veyon` and retain normal same-origin session/CSRF
and recovery-writer boundaries. New tool reads share a 60/minute appliance-wide
budget; Wake, launcher and preset writes share 30/minute. Selected broadcast
cleanup has an independent 60/minute budget so other writes cannot consume its
quota. Excess requests return HTTP 429 and Retry-After. Forwarding headers do not
create additional budgets. Existing polling, DHCP metadata and preview limits are
unchanged:

| Route | Capability | Contract |
| --- | --- | --- |
| `GET /computers/:id/catalog` | `lab.read` | Feature map; no keys/connection UIDs |
| `PUT /computers/:id` with `mac` | `lab.control` | Validated unicast MAC; blank removes it; hostname association |
| `POST /wake` | `lab.control` | 1–64 saved targets, four concurrent UDP sends, no startup claim |
| `POST /desktop-launcher` | `lab.control` | 1–16 saved IPv4 targets; view/control/master only; downloadable script without keys |
| `GET/PUT /lesson-actions` | `lab.control` | Shared bounded presets |
| `POST /demo/stop-selected` | `lab.control` | 1–64 saved targets; all-mode cleanup capacity reserved before enqueue |
| `POST /feature` | `lab.control` | Existing queue, plus four allowlisted shutdown variants |

Recording uses the existing `lab.sensitive.read` framebuffer route; downloading
a launcher never exports authentication material. The teacher's local Veyon
installation must already have appropriate keys and authorization.

## Verification and recovery

Automated coverage includes packet bytes, rejected MAC/launcher inputs, bounded
arguments/presets, protected route contracts, stale MAC identity, atomic cleanup
queue admission, real-browser recording/download/error handling, shutdown
confirmation/cancellation and existing Veyon regressions. CI additionally builds
the isolated C++ plugins and runs the filesystem policy fixture on Linux.
These checks do not establish BIOS Wake support, OS shutdown semantics, Windows
plugin ABI compatibility or real classroom operation.

After exact main-image publication, use the existing backed-up RoomGoblin updater:

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh
curl -fsS http://127.0.0.1:3000/health
git -C /opt/classroom-hub rev-parse --short HEAD
systemctl is-active veyon.service veyon-webapi.service
```

Reload the controller. Test reversible controls and one small recording first.
Use a spare endpoint for login/logoff/shutdown tests. Verify physical screens
rather than interpreting Accepted as completion. Native test VMs can be reverted
to their snapshots; production 4.9.7 was never replaced. Stop recording and discard
its browser buffer, remove unused saved actions or clear MACs to disable the new
workflows. For a Hub regression, restore the matching pre-upgrade recovery backup
through the established updater/recovery procedure, preserving database/key
identity together; do not reset native keys or blindly check out older code over
new runtime data.
