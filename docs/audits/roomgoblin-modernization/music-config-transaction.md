# Music Assistant configuration transaction

Baseline: `2c6f62a86920a3b0cdb8a7b51889072c918037e0`. Three actual-route,
real-SQLite reproductions fail before the change.

## RG-MUSIC-007: Failed connection saves left a partial identity

The administrator connection route wrote non-secret configuration before its
encrypted token without a transaction. A failed token write could leave a new
endpoint paired with the old token despite the rejected save. A failure after
either write could also leave committed partial state. This is P1.

The existing SQLite transaction now owns both writes. The connection is reset
and the success response projected only after commit. Validation, administrator
authorization, rate/freeze admission, omitted/blank-token retention, encrypted
storage and the token-free response remain unchanged. No schema or credential
migration is introduced.

## Qualification and delivery boundary

All 12 new cases and all 50 expanded configuration/socket checks pass. Actual
route handlers use isolated real SQLite databases and the production URL and
Sendspin validators. Coverage includes failure before/after secret storage,
after metadata storage and at commit; activation only after commit; token
retention; invalid input without writes; and successful retry.

The first focused run found an uninitialized transaction-depth assertion in
four validation-only fixtures. Initializing the fixture through the existing
empty transaction makes its baseline explicit; no production check was changed.
The supported Linux active-worktree suite passes 1,501 tests, zero failures and
two root-only ownership skips (1,503 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Required CI, checked integration, exact images
and backed-up appliance delivery are pending. No production connection settings,
tokens or classroom playback were changed for qualification.

Schedule-save ordering and coherent status/probe snapshots remain separate
review, as does the wider modernization roadmap.
