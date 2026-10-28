# Music Assistant connection ownership

Baseline: `d6f6db1efe42b2127e2845017fec0713d5f3913a`. Eight deterministic
actual-function WebSocket reproductions fail on the unchanged implementation.

## RG-MUSIC-003: Retired socket events could destroy the successor connection

`ensureMusicAssistantApi` (`src/server.js:6674`) used global connection and
pending-request state from every socket's close, error, message, authentication
and timeout callbacks. An old close could disconnect an authenticated successor
and reject its commands. An old completion could clear the successor's connection
promise, admitting duplicate connections. Old messages could update metadata or
settle successor requests. This is P1.

Each handshake and pending command now belongs to its socket. Retirement settles
an unfinished handshake immediately, clears its timers and rejects only its own
pending commands. Obsolete callbacks cannot mutate the successor. Connection
promise cleanup compares the exact promise; duplicate hello messages cannot
create duplicate authentication requests. Current errors still fail visibly and
permit a new connection. Authentication send errors are contained.

## RG-MUSIC-004: Awaiting authentication could send through a replacement socket

`musicAssistantApiRawCommand` (`src/server.js:6658-6671`) awaited a connection but
then used the global socket without checking its identity or authenticated state.
A configuration reset between those steps could send the old request through a
new, unauthenticated connection. HTTP fallback could also retarget an operation
across an explicit configuration reset. This is P1.

Dispatch uses the returned socket only after rechecking identity, authentication
and open state. Explicit reset/shutdown changes a generation, preventing fallback
across that boundary. Normal current transport failure retains existing HTTP
compatibility for unsent operations and allowed reads. Uncertain mutations still
must not replay. Command deadlines remain 15 seconds, or 60 seconds for supported
media loading; hello and authentication deadlines remain 10 seconds. Credentials
stay server-side and existing provider, Sendspin and managed-service contracts
are unchanged.

## Qualification and delivery boundary

All 24 new cases and all 51 expanded Music/Background Music checks pass. Coverage
includes late close/error/hello/authentication/messages/timeouts, successor pending
requests and single-flight, reset before close, dispatch retirement, duplicate
hello, current failures/retry, constructor/send failures, credentials, partial
results, HTTP compatibility and no uncertain mutation replay. The existing raw
command fixture now returns its authenticated socket, matching the production
contract; its assertions remain intact. One initial test used too few Promise
microtasks to observe settlement and now waits one event-loop turn without a
timer delay. The corrected baseline still fails all eight original cases.

The supported native active-worktree suite passes 1,445 tests, zero failures and
two root-only ownership skips (1,447 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required CI, checked integration, exact images
and backed-up appliance delivery remain pending. Tests use deterministic transports;
no production Music Assistant commands or failure injection were used. Background
Music session reconciliation and continuing-announcement audio retries remain
separate review.
