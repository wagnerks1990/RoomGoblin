# Music Assistant connection-status ownership

Baseline: `eaa48d67b642de088df684d5ddc47b73f44f57d2`. Two actual-route
reproductions fail: replaced settings/players are returned as current, and a
retired status failure retries its lookup against the replacement connection.

## RG-MUSIC-011: A status read crossed connection identities

The general Music Assistant status route captured configuration before awaiting
players, then returned it with later transport metadata. A settings change could
also make its legacy lookup retry run against a different endpoint/token.
This is P1.

Capture and recheck the explicit connection generation before fallback, after
success and on failure. A retired read returns HTTP 409 with a refresh message;
it cannot claim current availability or publish the obsolete players/settings.
Current success, same-connection compatibility fallback, visible failures,
unconfigured state, bridge registration and backend-only credentials remain.
Read quotas and authorization are unchanged.

## Qualification and delivery boundary

All eight new actual-route cases and all 86 expanded music checks pass. Cases
cover replacement before primary success/failure, replacement during fallback
success/failure, current fallback/registration, current errors, no-token status,
protocol players, transport metadata and credential-free responses.

The supported Linux active-worktree validation passes 1,545 tests with zero
failures and two root-only ownership skips; all 23 Host Recovery tests and
Node/controller/Python/Bash checks pass. Required CI, exact images and backed-up
delivery passed in PR #302; see [the receipt](music-observation-delivery.md). Tests use deterministic transports and did
not change production connection settings or dispatch physical commands.
The broader modernization remains active.
