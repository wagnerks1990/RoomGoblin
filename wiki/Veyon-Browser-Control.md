# Browser remote control pilot

Open one computer's **Live View**, then choose **Control**. A matching Veyon
4.11.2 RoomGoblin pilot provides pointer input, broad keyboard input, an All
Screens or single-monitor viewport, and an explicit one-time clipboard text read.

This is sent/unverified test control. Sessions are one-computer, owner and native
connection bound, permission-rechecked and non-durable. Input requires a
short lease issued after a decoded frame and bound to its dimensions, topology
and observed native update revision; native rate and VNC queue bounds apply.
Continuous incremental updates do not permanently pause control. A two-second watchdog plus Escape, close, page hide, focus loss,
expiry and disconnect release tracked keys/buttons.

Monitor selection crops Veyon's combined framebuffer; it does not switch endpoint
output or reduce bandwidth. Clipboard reads are explicit, correlated, text-only,
capped at 8192 UTF-8 bytes, transient and never automatically polled. Custom
native HTTP logs redact bridge bodies, responses and connection identifiers.

Use disposable matching pilots for acceptance. Automated compilation does not
prove Windows or desktop injection behavior. Production still requires managed
Linux packaging, a signed matching Windows installer and live acceptance.
Official file distribution and collection remain documented native-only.
