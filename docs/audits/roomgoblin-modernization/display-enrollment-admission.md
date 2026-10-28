# Display enrollment admission

PR #341's CodeQL check identified two enrollment routes without rate limiting.
Three executable HTTP cases reproduce unlimited administrator creation/cancellation
while checking rejected-profile and legacy-token boundaries.

Creation and cancellation now share one appliance-wide 120-operation-per-minute
budget before administrator authorization. The limiter uses the same administrator
predicate as the guard, so rejected callers and maintenance-token-only requests
cannot consume that budget. Forwarded addresses and switching routes cannot reset
it. Successful enrollment still retains the exact configured receiver identity.

All three HTTP regressions pass, together with 15 real-runtime identity cases.
The combined development snapshot passes 2,544 Node cases, zero failures and two
root-only skips (2,546 total), all 23 Host Recovery and 55 Android JVM cases, and
Node/controller/Python/Bash checks. That snapshot also includes the separately
queued diagnostics, retention and publication changes; it is not a claim that
those changes are part of PR #341. Exact PR-head CI and updated required security
checks remain pending. No production enrollment code or receiver credential was
created or revoked.
