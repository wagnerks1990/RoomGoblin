# Lighting command transport ownership

Baseline: qualified lighting inventory commit `b321a52`.

## RG-LIGHTS-003: Native UDP error and completion ownership

Three actual-source failures reproduced unhandled socket errors, a missing send
deadline and a leaked socket after a synchronous send exception. Native H618G
temperature writes now capture their destination, contain socket errors and
settle once within five seconds. Every completion path closes the socket; late
callbacks/errors cannot settle again. The packet, port and temperature contract
remain unchanged. No uncertain write is retried.

## RG-LIGHTS-004: MQTT disconnect and offline command replay

Three actual-source failures reproduced an actual MQTT.js client retaining a
QoS-zero command when the runtime flag lagged its disconnected state, a lost
publish callback remaining pending after close, and absence of a deadline.

Admission checks the captured client's state as well as runtime availability.
The configured client disables QoS-zero offline queuing. Accepted publications
have a five-second deadline and a shared pending-owner set; connection events
settle that connection's owners without adding a listener per command. Explicit
replacement rejects old work before detaching the old client. Late callbacks and
events cannot alter the successor or trigger application retries. JSON/legacy
display bridge and Govee payloads retain their existing QoS/retain defaults.

Timeout and connection failure report unconfirmed delivery. Already buffered
network bytes cannot be recalled; this does not claim transactional hardware
delivery. WebSocket display persistence, announcement priority, scheduler
occurrence identity and unrelated integration health remain unchanged.

## Validation and remaining scope

All 29 new regressions pass: controlled transport faults, real MQTT.js offline
queue behavior, replacement ownership, 30 concurrent publishers, actual Govee
HTTP handler drain after disconnect and a real loopback UDP send/close. The first
loopback fixture incorrectly replaced a native method reused by Node's own bind
queue; a separate adapter corrected that fixture without weakening assertions.
The first full Linux run passed 1,918 tests with one failure and two root-only
skips. Its older shutdown MQTT double did not expose the actual client's
`connected` property, so the new admission check correctly rejected it before
publication. The fixture now changes that property with its simulated connect
event; its shutdown/audit assertions remain intact. Final supported Linux
qualification passes 1,919 tests, zero failures and two root-only skips (1,921
total), plus all 23 Host Recovery tests and Node/controller/Python/Bash checks.
All 85 focused transport/recovery/announcement/music cases pass. Frontend source
is unchanged from the inventory batch's 78 Chromium and 78 Firefox passes.
Required CI remains pending. No physical
lighting, classroom receiver or production fault-injection commands were used.

Lighting configuration-write ordering, device identity and ESPHome review remain
open. Inventory and transport are two focused commits in the next lighting PR;
checked delivery follows the presentation rebuild batch.
