# Security and release boundaries

This is a synthetic, single-operator pilot. Do not place real student information in it or call it production-ready.

## Improvements implemented

- The exposed legacy demo key is not read or embedded by v9.
- Independent administrator login with constant-time token comparison, login throttling, revocable in-memory sessions, HttpOnly/Secure/SameSite cookies, exact-origin CSRF protection, and no administrator CORS surface.
- A server-derived assignment and synthetic participant scope for each learner token, hashed storage, expiry, revocation, and denial of all teacher/display operations under a learner token.
- Separate read-only aggregate display capability. No names, writing, grades, or full roster in display responses.
- Parameterized SQL; strict body/field limits; safe text rendering; script-safe exported JSON; escaped XML; CSV formula neutralization; no dynamic remote code execution.
- Bounded HTTP workers and request timeouts. The service binds to a reviewed private/loopback address behind HTTPS, never directly to the public wildcard interface.
- Logs omit credentials, request bodies, query strings, and student writing. SQLite-safe root-private backups and restrictive service umask.

## Explicit residual risks

Exported learner tokens are extractable bearer capabilities. Anyone holding one can impersonate that **synthetic** participant until expiry/revocation. No Schoology ID is trusted for identity. CORS is a browser boundary, not enrollment authorization. One teacher administrator token is not a full multi-user access-control system.

The old v6 service remains separately deployed and retains its old shared-key access model. V9's improved permissions do not retroactively secure old `/api/` routes or old packages. Rotate/retire old credentials after legacy testing; do not expose old teacher controls to students.

The Python standard-library HTTP server is a deliberately constrained pilot, not a production-grade application server. Formal security assessment, authenticated student sessions, lifecycle/retention policy, operational monitoring, deployment hardening, and real-browser/LMS tests are outstanding.

Browser drafts/outboxes can be lost when storage is cleared or unavailable. Duplicate network retries are protected, but separate submission clicks intentionally create separate attempts. A process/power failure cannot be simulated by a UI outage switch; test it separately. HTTPS origin, CORS, path routing and UFW restrictions must stay exact.

Do not disable browser policy, use wildcard/`null` CORS allowances, put tokens in query strings, commit `.env` or SQLite data, or enable gradebook writes based on unverified preview IDs.
