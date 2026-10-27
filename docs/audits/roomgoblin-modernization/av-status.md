# Displays & AV backend status review

Baseline: `ed8135b9bd8fd9f340a6360611a7db2767da08e4`, alpha.85.
Status: implemented and locally qualified; checked PR and delivery pending.
This closes the backend follow-up to the operator workspace in PR #275.

## Scope and ownership

Fully inspected the Pluto serializer, transport/retries and AV routes at baseline
`src/server.js:4433-4537,5393-5419`. Targeted callers include integration probes
at `5333-5334,5357-5360`, connection updates at `6367-6384`, and scheduled CEC
dispatch. Reviewed the lifecycle/audit boundary and TV-power aggregate contract.
This is not a whole-server, scheduler, network-topology or hardware acceptance audit.

The serializer and existing direct-command boundary remain in the server. The
new `src/pluto-transport.js` owns bounded response parsing and the shared status
scan. It has no autonomous polling loop or detached writer. The HTTP handler
returns the scan promise, including after a caller disconnects. Existing audit
freeze behavior, application drain and ten-second shutdown deadline remain intact.

## RG-AV-010: Concurrent status scans duplicated unbounded retry chains

| Field | Assessment |
| --- | --- |
| Subsystem / category | Matrix status and named diagnostics / Reliability and Performance |
| Priority / confidence | P2 / Confirmed |
| Exact baseline locations | `src/server.js:4480-4523,5395-5401`; named callers `5333-5334,5357-5360` |
| Complexity / compatibility risk | Medium / Medium |
| Expected benefit | Predictable probe cost and response time during concurrent or stalled reads |
| State | Identified, validated, planned, implemented; local qualification passed; CI and delivery pending |

The status route performed six serial reads, each with an independent retry
allowance. The default four-second attempt timeout and five attempts permitted
up to 120 seconds of network waiting, plus retry delays, for one scan. Concurrent
callers duplicated the work. Named diagnostic/read-back calls had the same
per-attempt-only timeout. A browser abort did not stop the accepted backend scan.

Two regressions execute the actual baseline serializer, transport and status
handler. Three concurrent readers produced 18 adapter calls instead of six.
An adapter that stalls until aborted caused all six successive probes rather
than stopping the scan at one aggregate deadline. Both tests failed on the
baseline and pass after the correction.

Implementation: share one pending scan and retain its result for two seconds
using a monotonic expiry clock. All six queries share an eight-second total
budget, including fetch headers, body reads and retry delays. Named reads outside
that scan also have an eight-second total budget. Preserve the configured
per-attempt timeout and retry count inside the total budget. Partial responses
remain HTTP 207 with a per-query error and gain `observedAt`; current labels are
attached after cache lookup. Failed scans receive the same short cooldown.
An unconfigured optional matrix fails immediately without fetches or retry delays.

Command admission/completion and connection changes invalidate cached readings
and abort an older scan. The old scan remains owned until settlement and cannot
populate the new cache. Writes retain one attempt; rejected or uncertain writes
are not retried. Existing CEC output selection and announcement locks are unchanged.

Verification includes concurrent readers, monotonic expiry/current labels,
stalled fetch and real loopback HTTP body, stale-response backoff cancellation,
per-attempt retry, direct named-read budget, command/configuration invalidation,
rejected/stale/thrown writes, and returned handler ownership after disconnect.
No physical matrix is contacted.

## RG-AV-011: Hardware response buffering had no byte ceiling

| Field | Assessment |
| --- | --- |
| Subsystem / category | Matrix transport / Resource bounds and Privacy |
| Priority / confidence | P2 / Confirmed by source and executable parser coverage |
| Exact baseline locations | `src/server.js:4483-4487` |
| Complexity / compatibility risk | Small / Low |
| Expected benefit | Bound memory from a faulty upstream and avoid reproducing raw response text |
| State | Identified, validated, planned, implemented; local qualification passed; CI and delivery pending |

The transport buffered `response.text()` without a size limit and included a
raw response excerpt in JSON errors. The fixed eight-port status/ack protocol
does not need an unbounded body. The parser now allows at most 64 KiB, checks both
declared and streamed lengths, cancels an oversized/error response, and rejects
non-object or malformed JSON with a generic diagnostic. The fetch deadline stays
active through body consumption. Request serialization and acknowledgement
semantics remain unchanged.

Verification: declared and streamed over-limit cases cancel their readers;
malformed JSON, null and arrays fail; normal status and acknowledgement objects
pass through the real server transport tests. The status deadline is separately
tested against a real server that sends headers and never finishes its body.

## Qualification and delivery boundary

The focused native tests cover transport plus the existing TV-power sequence,
recovery and command-validation boundaries. Initial Windows execution exposed
an existing source-extraction test's LF-only delimiter in a CRLF checkout; the
edited server was normalized to LF without logic changes, then all 84 focused
tests passed. No assertion was weakened. The first full native snapshot passed
1,047 tests with two root-only ownership skips (1,049 total), plus 23 recovery
tests. After adding the standalone-read deadline and unconfigured fast failure,
the final snapshot passed 1,049 tests with two skips (1,051 total), plus 23 recovery
tests. Syntax checks passed. This final snapshot contains baseline `ed8135b` and
all backend logic/tests. PR #275 was then integrated as `d3c41b1`; the combined
current tree passed 16 transport/composition checks, controller validation for
17 scripts, and all 31 AV/Today browser cases in each engine. The frontend merge
had already passed its full 140-case suites in both engines and all CI gates.

Required CI still owns Docker/Compose, runtime image scans, browser suites and
native platform qualification. Merge, Wiki sync, exact image publication and the
normal backed-up appliance update remain pending. Neither physical AV commands
nor production fault injection are used as part of this review.
