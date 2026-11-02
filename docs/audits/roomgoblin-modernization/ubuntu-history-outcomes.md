# Ubuntu accepted outcomes survive secondary history failures

RG-LAB-020 reproduces one remotely accepted command being reported as failed
after its computer-history write throws. The final actual-module fixture fails
six old-source assertions covering commands, maintenance job identity, metadata,
new schedules, cancellations and scheduled dispatch state; five controls pass.

The event helper now separates secondary history from the completed primary
operation. A history error returns a fixed warning while the original accepted
result and remote job identity remain intact. The shared audit owner receives
the original event with computerHistorySaved:false. Its existing bounded queue
and Full Recovery freeze rules remain unchanged. No raw storage error or secret
is exposed. Lost per-computer history is not claimed as saved or reconstructed.

Primary metadata/schedule persistence and pre-dispatch claims still fail closed.
Transport errors remain uncertain failures, busy ownership is released, and no
command is retried. A scheduled job retains its dispatched claim after remote
acceptance even if history fails. Screenshots remain read-only.

The browser retains warnings on the originating card across refreshes and in
newer open drafts. All 11 backend cases, two new dialog warning cases and nine
Ubuntu Chromium browser cases pass. The new browser case checks command,
metadata, maintenance and cancellation warnings without duplicate writes.
Full supported Linux validation passes 2,210 tests, zero failures and two
root-only skips, all 23 Host Recovery cases and syntax/controller/shell checks.
All 103 workspace cases pass in each of Chromium and Firefox. The preceding
full Chromium suite passed 275 cases; unrelated browser sources are unchanged.
No real computer was commanded or modified. Required CI, checked merge, exact
publication and backed-up appliance acceptance still precede delivery.
