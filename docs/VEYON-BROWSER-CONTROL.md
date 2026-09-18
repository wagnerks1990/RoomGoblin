# Browser remote control pilot

Open one computer's **Live View**, then choose **Control**. The matching Veyon
4.11.2 RoomGoblin pilot provides continuous pointer input, broad keyboard input,
an All Screens or single-monitor viewport, and an explicit one-time clipboard
text read. There is no native-launcher fallback in the web GUI.

This is a bounded test adapter, not proof of endpoint execution. Every input is
reported as sent/unverified. The appliance must advertise
`RoomGoblinBrowserControl`; clipboard reads additionally require the matching
`RoomGoblinClipboardRead` plugin on the endpoint. Stock Veyon alone is not enough.

## Safety and privacy contract

- One selected computer and one authenticated connection per owner-bound session.
- `lab.control` and `lab.sensitive.read` are both rechecked during the session.
- Ten-minute native maximum, no persistence/replay, and a separate close budget.
- Veyon switches that connection to Live updates and restores its prior update
  mode on close or expiry.
- Pointer/keyboard input requires a 1.5-second lease issued after a decoded
  framebuffer capture and tied to exact dimensions, screen topology and the
  native update revision observed at issuance. Continuous incremental VNC
  updates do not make control permanently unavailable; topology changes do.
- Monotonic sequence numbers, at most 25 native events/second, VNC queue
  backpressure, at most 16 held keys, and a two-second key/button watchdog.
- Escape, close, page hide, window focus loss, expiry and disconnect release
  tracked keys/buttons. A lost close response still falls back to the watchdog.
- Monitor selection is a crop of Veyon's combined framebuffer. It does not switch
  endpoint output and does not reduce wire bandwidth.
- Clipboard text is requested only after its own confirmation, correlated by a
  random request ID, capped at 8192 UTF-8 bytes, shown transiently and cleared on
  close. Empty text is valid. No polling or content audit is retained.
- Native custom-route debug logs redact bodies, response maps and connection IDs.
  Hub audits contain actor/action/target metadata only.

## Acceptance

Use disposable matching teacher/student pilots. Verify mouse movement, left/right/
middle click, wheel, drag, Unicode typing, navigation/function keys, modifier
release, Escape exit, multiple and negative-origin monitor layouts, resize or
topology suspension, stale-frame refusal, queue pressure, focus loss and a
clipboard value containing multibyte text. Confirm keys/buttons release after
network loss. Denied control, disabled clipboard, missing endpoint plugin and
identity changes must fail closed.

Automated native compilation does not establish Windows or real desktop input.
Production deployment remains blocked on a managed Linux package with rollback
and a signed matching Windows installer plus live acceptance. Official Veyon
file distribution/collection remain native-only: stock 4.11.2 cannot provide a
safely bounded, acknowledged browser workflow.
