# Weather request allowance admission

RG-WEATHER-005 reproduces eight failures through the real extracted HTTP routes
and express-rate-limit middleware. Rejected operator, receiver and partial-capability
requests consumed the appliance-wide allowance. Exhaustion also changed the
expected authentication/permission denial into a rate-limit response.

The read quota now uses the same control or receiver-asset predicate as its
route guard. The settings quota requires both existing write capabilities before
charging the allowance. Middleware remains before authorization, quotas remain
240 reads and 20 writes per minute, and accepted callers still share each fixed
appliance-wide budget. No identity, credential or authorization rule changes.

All 36 targeted Weather/Planning cases pass, including all eight admission cases,
real HTTP projection/save checks and provider bounds. Browser source retains its
20-case-per-engine qualification. The supported Linux snapshot passes 2,453 tests
with zero failures, two expected root-only skips, all 23 Host Recovery cases and
all 55 JVM cases, plus syntax/controller/shell checks.
No live rate-limit exhaustion or production configuration write was performed.
