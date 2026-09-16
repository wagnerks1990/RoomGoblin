# Browser clipboard sending

Select one saved computer under Veyon, then **Send clipboard text**. Enter text
and press **Send to selected computer**. The target is captured when the dialog
opens. Sending replaces its clipboard; it does not paste text or execute it.
The form clears on submit/close. RoomGoblin never reads the browser clipboard.

This requires the free **RoomGoblinWebBridge** plugin in the native appliance
WebAPI process. The matching Linux build includes it; see
[Native pilot builds](../docs/VEYON-PILOT-BINARIES.md). Stock Veyon 4.11.2 advertises
ClipboardExchange but does not forward clipboard text from WebAPI arguments.
Updating the Hub alone therefore does not enable the native bridge. Missing
bridge support is shown explicitly and commands are rejected before dispatch.
Do not copy this plugin into a different Veyon/Qt build or replace production
packages with pilot binaries. Native rollout still needs a matching package and
one teacher/student acceptance test; no installation is performed by this change.

The bridge translates a bounded command to the existing Veyon 4.11.2 clipboard
protocol, so no new Windows plugin is intended for clipboard sending. Windows
interoperability is not established by Linux compilation. The endpoint must have
a signed-in user and permit clipboard exchange through its existing Veyon rules.
Appliance clipboard synchronization and disabled-feature settings are respected.
No clipboard read-back, image transfer, automatic synchronization or empty-text
clearing is implemented.

## Limits and delivery

- `lab.control` authorization; one saved target, never All.
- 1–8192 UTF-8 bytes; NUL characters rejected; whitespace preserved.
- Shared 30/minute Veyon action budget, bounded queue, per-host ordering,
  dispatch-time permission/identity checks and recovery-export pause/drain.
- Content stays in pending command memory, is cleared on completion/cancel/expiry,
  and is excluded from Hub job responses, audit records and the durable journal.
  Native Veyon debug logging is separate and can include protocol message content;
  keep debug logging off when testing sensitive clipboard data.
- No automatic retry after uncertain delivery. Inspect the endpoint before
  deliberately sending again. Closing the browser does not cancel an accepted job.
- **Accepted** means the proxy accepted the request, not that the endpoint
  clipboard changed. Veyon WebAPI does not return the plugin's dispatch result.

## Acceptance and rollback

On a disposable matching build, confirm `RoomGoblinWebBridge` in `veyon-cli plugin
list` and `RoomGoblinClipboardWrite` in `veyon-cli feature list`. Configure existing
Veyon authentication/access rules; never export private keys to the browser.
Send non-sensitive Unicode/multiline sample text to one test endpoint and paste
there manually to verify exact contents. Test no user, disabled clipboard, denied
access, disconnected endpoint, unavailable bridge and lost response. None may be
presented as verified delivery. Test changing selection while the dialog is open:
the named original target must remain the recipient.

Restore the disposable VM snapshot to remove native pilot changes. Hub rollback
removes the new browser operation without changing keys or endpoint configuration.
Keyboard/mouse control, clipboard reading, browser file transfer/collection and
two-way chat remain separate unfinished adapters.
