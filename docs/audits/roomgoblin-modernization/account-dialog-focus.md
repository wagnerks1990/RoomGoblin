# Account dialog initial focus

[Finding classification and immutable source locations](finding-metadata.md#account-dialog-focus).

PR #318 main validation failed the Chromium account-dialog keyboard containment
case, blocking exact image publication. Review reproduced its delayed opening
callback moving focus after the user selected another field: three actual-source
Node failures and one deterministic real-page browser failure.

RG-AUTH-FOCUS-001 establishes focus synchronously after opening the dialog and
making the surrounding shell inert. Four Node cases cover initial focus, later
navigation, close/password clearing and rapid reopen. The new browser case holds
opening timers to expose the race and retains keyboard containment and Escape
checks. Existing account/session authority and requests remain unchanged.

Qualification passes all four Node cases, 2,169 Linux tests with zero failures
and two root-only skips (2,171 total), all 23 Host Recovery tests, syntax/controller
checks, all 270 Chromium browser cases and all 97 workspace plus nine Veyon
command-page cases in Firefox. The original keyboard-containment assertion is
unchanged. Required CI and delivery follow.

The unchanged PR #318 main browser rerun passed and exact image publication then
passed. This follow-up repairs the reproduced race; a successful rerun alone
does not establish that repair.
