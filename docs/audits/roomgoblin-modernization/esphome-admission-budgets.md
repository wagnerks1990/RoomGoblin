# ESPHome authorized admission budgets

Baseline: qualified lighting identity repair `e123147`, with PR #313 delivery
evidence in `7faf08d`.

RG-ESP-001 reproduced four real HTTP failures: denied callers exhausted the
inventory, discovery, management and command budgets, blocking the next accepted
caller. A fifth actual-source case showed the ESPHome administrator predicate
returning true without the legacy control token, unlike its route guard.

Rate middleware remains before guards, with unchanged appliance-wide limits.
Shared capability and administrator predicates skip rejected callers. Production
wiring now uses the same administrator predicate as its guard, and registration
requires explicit read/control/admin predicates. No worker or hardware operation
is admitted for denied or rate-limited requests.

All nine new regressions and the existing aggregate/separate-budget test pass.
Coverage includes complete accepted budgets after denied floods, permission
responses after exhaustion, role/capability combinations, legacy token/setup
behavior and real guarded HTTP discovery. The earlier quota test now verifies
60 accepted management requests instead of charging 30 accepted plus 30 rejected;
all original limits, header checks and worker-count assertions remain covered.
The supported Linux snapshot passed 2,023 tests with zero failures and two
root-only skips (2,025 total), plus all 23 Host Recovery tests and syntax/controller
checks. Required CI remains pending; frontend source is unchanged.

No physical ESPHome discovery, enrollment or control was performed. Controller
inventory/management races remain the next repair.
