# Music queue response ownership

Baseline: `ace11e5c5d2b0c886d00f3cca640acb9b3854c86`. Three real Chromium
reproductions fail against its unchanged Music queue implementation.

## RG-MUSIC-002: Obsolete queue responses replaced the current result

`loadQueue` (`public/controller/music-studio.js:78-86`) checked only the selected
player ID. Two requests for the same output could finish in reverse order; an
older success or error then replaced the newer queue. Changing from A to B and
back to A also made the first A request appear current again. This is P2.

Each refresh now owns a generation as well as its selected output. Only that
current pair may update queue data, rows or errors. Clearing the output also
retires pending reads. Current failures remain visible and an explicit refresh
can recover them. Transport, queue commands, permissions, layout and Music
Assistant API behavior are unchanged.

## Qualification and delivery boundary

All six new cases and all ten existing Music Studio cases pass in Chromium and
Firefox. The new cases cover reversed successes, obsolete errors, returning to
the same output, current error/retry, clearing an output and dispatching the
current item to the selected queue. Fixtures use the real controller with
deterministic transports; no physical music or receiver commands were issued.

The supported native active-worktree suite passes 1,409 tests, zero failures and
two root-only ownership skips (1,411 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Checked integration, required CI, exact images
and backed-up appliance delivery remain pending. Background Music runtime
ownership and the wider modernization roadmap remain separate review.
