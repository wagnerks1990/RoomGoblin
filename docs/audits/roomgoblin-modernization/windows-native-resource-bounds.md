# Native Windows command and transfer bounds

Baseline: PR #319 head `32416c9`. RG-LAB-009 reproduces three actual-source
failures: output buffering retained 67,472,752 bytes while receiving 32 MiB,
and inherited output pipes outlived both the process deadline and caller
cancellation. The helper now retains at most 64 Ki characters per stream while
draining under the shared process token. All nine isolated process cases pass;
the fixed retained-memory measurement was 336,824 bytes.

The first memory fixture measured cumulative allocations, which vary with async
I/O scheduling and failed once against bounded code (27,647,512 bytes). It was
replaced with a live-memory measurement while a fixture deliberately keeps both
pipes open. The revised assertion fails against the unchanged baseline and
passes the repair. It measures retained buffers, not cumulative allocation churn.

RG-LAB-010 reproduces a native binary response remaining pending beyond the
existing 45-second HttpClient timeout after headers arrive. A linked per-file
transfer deadline now spans headers, body reads, writes and flush. Caller
cancellation preserves its token; deadlines report timeout. Both clear partial
staging. The actual client passes ten loopback cases: complete/fallback packages,
pre-cancelled admission, caller cancellation, the real 45-second deadline,
declared/excess/truncated lengths, bad hashes and duplicate manifest entries.

Local process/transfer qualification used .NET 10 with zero build warnings or
errors. Full supported Linux validation passes 2,169 tests with zero failures
and two root-only skips (2,171 total), all 23 Host Recovery tests and syntax/
controller checks; all 15 focused native/legacy source contracts pass. Browser
sources are unchanged from qualified `32416c9` (270 Chromium cases and 106
workspace/Veyon cases in Firefox). Required Windows CI uses .NET 8; CI and delivery
are pending. The transfer fixture replaces configuration paths and Windows trust
dispatch; actual size and SHA-256 verification run unchanged. No native service,
real enrollment, remote workstation or classroom command was used. Connection
handshake deadlines and bootstrap/updater subprocess waits remain under review.

The implementation follows the documented [HttpCompletionOption timeout
boundary](https://learn.microsoft.com/en-us/dotnet/api/system.net.http.httpcompletionoption?view=netcore-2.2)
and cancellable [StreamReader reads](https://learn.microsoft.com/en-us/dotnet/api/system.io.streamreader.readasync).
