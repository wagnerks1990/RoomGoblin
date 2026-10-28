# Android configuration operation ownership

RG-LAB-034 reproduces two failures: concurrent Agent v2 configuration dispatches
two credential broadcasts, and a metadata save changes display assignment beneath
pending configuration. An ordinary name edit is a passing baseline control.

The maintenance service now admits one configuration operation per display across
Agent v2, legacy assignment, persistent-ADB bootstrap/disable and verified APK
installation. A conflicting request fails with HTTP 409 before device work.
Metadata updates normalize the proposed record and reject changes to connection,
assignment or agent settings while this owner is active. Other metadata and
independent displays remain available. Failure releases admission for an explicit
later attempt; no requests are queued or replayed.

APK installation retains its owner through restoration. Only its private owner
object permits the nested Agent v2 configuration; foreign, other-device and
expired owners fail. Restoration reads current enrollment metadata and retains
existing package replacement, signing and Device Admin confirmation boundaries.
The owner does not cancel accepted device commands or persist across restart.

All 18 configuration cases and 20 record-completion cases pass. Fixtures execute
the actual handlers/helper with temporary inventory and simulated ADB responses;
no physical device command, credential rotation or APK installation was performed.
Supported Linux qualification passes 2,386 tests with zero failures and two
root-only skips, all 23 Host Recovery cases and syntax/controller/shell checks.
Public sources are unchanged from the 125-case Chromium/Firefox qualification,
including the held-response repair. Required CI, checked merge, exact images and
the normal backed-up update remain delivery gates.

Packaging review found that the maintenance Dockerfile's explicit file list
omitted the new shared helper. A dependency-closure regression reproduced the
omission before deployment. The image now copies the helper, and the regression
checks relative dependencies of every copied Android module. Final qualification
passes 2,387 Linux tests, zero failures, two root-only skips and all 23 Host
Recovery cases. Required image builds and smoke checks run again on the corrected
PR head; the incomplete package was never deployed.
