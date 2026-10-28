# Bounded publication retries

PR #335 and PR #338 exact-image publication encountered registry `unknown blob`
errors after their build, scan and smoke steps passed. Failed-job reruns eventually
succeeded; no release gate was bypassed. This review adds a bounded push retry to
avoid rebuilding solely for a transient registry response.

The publication helper accepts only exact commit tags. Both aliases must share
one local image ID and the expected revision label before any push, and each
attempt rechecks that identity. Each alias has at most three attempts, separated
by five and ten seconds. A changed identity, mismatched revision or exhausted
retry fails. The helper contains no build, pull, tag or gate-override operation.
Workflow names, dependencies, action pins, scans and promotion remain unchanged.

All six executable fake-registry cases pass: immediate success, transient success,
bounded exhaustion, incorrect revision, differing alias images and replacement
between attempts. Thirteen related policy checks passed in the initial mounted
Windows-checkout run; its existing shell identity fixture failed and is not native
qualification. The supported native snapshot passes all 2,537 Node cases with
zero failures and two root-only skips, all 23 Host Recovery and 55 Android JVM
cases, plus syntax/controller checks. This includes the unchanged image identity
and workflow-name checks. Required CI and checked delivery remain pending.
