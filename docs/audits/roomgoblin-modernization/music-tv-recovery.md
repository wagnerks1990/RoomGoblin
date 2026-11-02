# TV audio recovery and named receiver identity

Baseline: `a2deea8f4f7214119a12ac1a5b37f260c0c8476f`.
Review reproduced one configured-name mapping failure, one automatic retry of
an uncertain TV audio write and three HTTP failures that lost uncertainty.

## RG-MUSIC-014: Named receivers lost saved audio identity

The player-to-receiver mapper recognized only legacy tvN names, although bridge
tickets use every configured stable receiver ID. Volume/mute commands for named
receivers therefore failed to persist their audio settings. This is P2.

Match the unchanged classroom-hub- player prefix against exact configured,
enabled receiver IDs. Preserve case-insensitive legacy matching, dots,
underscores, hyphens and the full supported ID length. Unconfigured, disabled,
unrelated and inherited object keys cannot create saved receiver audio state.
No receiver ID, persisted store or deployment identifier is renamed.

## RG-MUSIC-015: Uncertain writes could be replayed during audio recovery

A lost HTTP response/body or invalid response did not retain mayHaveExecuted,
and the fallback error wrapper discarded that marker. The TV restore loop also
retried uncertain errors as ordinary registration failures. This is P1.

Serialize payloads before dispatch; classify transport/body/parse failures and
unexplained HTTP errors as uncertain. Preserve that evidence through fallback.
Explicit upstream API rejection stays a known failure, and successful direct
or wrapped results remain compatible.

TV restoration stops after an uncertain volume or mute write. Subsequent status
messages cannot automatically resend it. Matching numeric volume and boolean
mute telemetry from the current, protocol-active receiver can confirm the state
without another command; an explicit reconnect or a new receiver connection permits a fresh
restore. The operator sees unconfirmed audio in Outputs & connection until
confirmation. Selection and focus survive status refresh.

Each deferred restore owns an operation identity. Reconnect retires old timers
and completions, which cannot clear a successor's pending state or record its
errors. Keep the 250 ms admission delay, eight bounded retries for known
registration failures, tracked writer drain and shutdown/recovery guards.

## Qualification and delivery boundary

All 46 new Node cases (12 HTTP, 15 identity, 19 restore ownership) and all 79
expanded music recovery checks pass. The transport tests include an actual
accepted HTTP request whose response socket closes: one request, uncertainty
preserved, no replay. All 17 Music Studio and 70 workspace browser cases pass
in each of Chromium and Firefox. The initial UI fixture checked a collapsed
disclosure, then used an ambiguous selector; it now opens the exact connection
disclosure with unchanged visibility and focus assertions. The final supported
Linux active-worktree run includes the inactive-bridge guard and passes 1,613
tests, zero failures and two root-only ownership skips, plus all 23 Host Recovery
tests and Node/controller/Python/Bash checks. Required gates, exact images and
backed-up delivery passed in PR #303; see the [receipt](music-tv-delivery.md).

No physical audio commands, receiver reloads, production connection changes or
fault injection were performed. This closes the demonstrated TV recovery cases;
it does not establish physical audio acceptance or completion of the roadmap.
