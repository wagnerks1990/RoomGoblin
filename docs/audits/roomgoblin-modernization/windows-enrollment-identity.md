# Native Windows enrollment identity preservation

[Finding classification and immutable source locations](finding-metadata.md#windows-enrollment-identity).

RG-LAB-017 reproduces fresh-enrollment arguments replacing an enrolled computer's
configuration and deleting it after failed native health acceptance. The final
ten-case fixture fails five assertions against the original source: existing,
one-use-file and empty-file admission, direct overwrite and a destination created
during preparation. The five unchanged fresh-enrollment/ACL controls pass.

Fresh enrollment now rejects existing configuration before manifest/enrollment
file handling or runtime changes. A new configuration is atomically published
without overwrite, so a destination created after admission is preserved. Normal
install/repair without enrollment arguments continues to use the saved identity.
No compatibility path, service name, token policy, DPAPI or ACL rule changed.

All ten actual-source cases pass locally on .NET 10 with zero warnings/errors.
They execute the real Install body and configuration writer with temporary files;
DPAPI and icacls are substituted. Effective Windows ACLs, cryptographic behavior
and workstation installation are separate acceptance boundaries. All 36 lifecycle
and 24 task-state cases pass with this repair, and the locked bootstrap build has
zero warnings/errors. Supported Linux validation passes 2,169 tests with zero
failures and two root-only skips, all 23 Host Recovery cases and syntax/controller/
shell checks. Browser sources are unchanged from qualified `32416c9` (270 Chromium
and 106 workspace/Veyon Firefox cases). Required .NET 8 CI, checked merge,
exact publication and backed-up appliance verification precede delivery.

PR #323's first Linux CI run failed a pre-existing recovery setup assertion with
HTTP 405 instead of 201. The lifecycle fixture released its first ephemeral port
before allocating the second and accepted any successful health response. The
media listener returns that 405 for POST requests. Two deterministic old-source
assertions reproduce duplicate allocation and false control readiness; three
controls pass. Both reservations now stay open until selection completes and
readiness checks the expected service identity. All five focused cases pass.
The repair changes test setup only. The full supported Linux run passes 2,173
tests, zero failures and two root-only skips, all 23 Host Recovery cases and
syntax/controller/shell checks. Fresh required CI must pass before merge.
The native Windows CI job, including all ten enrollment
cases on .NET 8, passed on the initial head.
