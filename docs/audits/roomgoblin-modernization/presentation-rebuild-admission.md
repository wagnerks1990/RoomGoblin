# Presentation rebuild admission

Baseline: PR #310 head `da4309b3634820338d6722b29969b4a53cf2ed00`.

RG-PRESENTATION-007 reproduced two actual rebuild handlers sharing one failed
conversion. Each captured/restored its own prior status; the later handler left
the previously ready deck marked `converting` after the render had already failed.

The route now checks the existing per-deck build owner before changing metadata
and returns HTTP 409 when rendering is already in progress. This applies to an
upload render too. The accepted operation retains its status and output ownership,
later retries remain available, and different decks can still render independently.

Five actual-route/build-owner regressions pass, along with the 51 existing
presentation checks. The baseline failed its ready-status assertion as expected.
The supported Linux snapshot passes 1,871 tests, zero failures and two root-only
skips (1,873 total), plus all 23 Host Recovery tests and Node/controller/Python/
Bash checks. Checked delivery remains pending, after PR #310's security-gate
repair and verified delivery. No physical display
commands or production fault injection were used.

Integration with repaired PR #310 head `0ea9ee9` passes all 60 focused checks and
the supported full Linux snapshot: 1,875 passes, zero failures and two root-only
skips (1,877 total), plus all 23 Host Recovery tests and syntax/controller checks.
The only cherry-pick conflict was audit status text; current delivery and
security-gate evidence were preserved. Checked delivery still follows PR #310.

Integration on merged main `906e0ec` produced `0555993`, whose complete tree
matches qualified `83a4b15` byte for byte before this evidence note. All 60
focused presentation checks pass again. Required PR checks, exact image
publication and this follow-up's backed-up appliance update remain pending.
