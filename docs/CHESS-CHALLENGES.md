# Invitations and consent-based rematches

Challenges never expose a student roster or accept caller-supplied recipient IDs.
A rematch starts from an owned finished multiplayer game. The server resolves
the two original participants and their original assignments, then offers the
other player a ten-minute invitation. Only that recipient may accept or decline;
only the sender may cancel. Colors alternate from the original game. Until
acceptance, no new game, grade, leaderboard result or enrollment is created.

General invitations return a 192-bit random code for the user to share privately.
Only its SHA-256 digest is stored; codes never enter audit details or list output.
Codes expire after thirty minutes. Whoever is authorized and possesses the code
may accept it once. The same accepter in the same assignment can safely retry and
receive the same game. Another accepter, a revoked sender or expired/cancelled
code cannot use it. The sender cannot accept their own invitation. These are
private share codes, not public global discovery or automatic messages.

The code is shown only in the successful creation response. A repeated creation
request returns the original invitation with `code: null`; if the first response
was lost, cancel that invitation and create another. The server deliberately
does not persist recoverable code text. Do not put codes into analytics or URLs.

Acceptance rechecks both fresh accounts, assignment availability, original scopes
and game capacity. It atomically creates an isolated queue and joins the agreed
opponent inside one transaction, using the server-only `skipQueue` path. It cannot
consume an unrelated universal queue, leave an exposed half-created game, or
silently join a match without consent. Audit failure rolls back the operation.
Normal chess server rules own every later move, clock, result and SCORM credit.

Lists contain only an actor's incoming/outgoing offers in the requested assignment,
privacy-safe opponent names and necessary game/offer identifiers. They do not
expose another account's ID or original assignment. Membership never expands
across classes. A teacher participates under their own seat, not blanket authority
to answer a student's invitation. Direct learner scope/revocation stays enforced.

Rematches and code invitations each have at most 200 live pending offers globally.
An actor has at most five pending offers in each category; rematch recipients are
also capped. Invitation operations are rate limited. Expiration is enforced at
read and accept time without turning an offer into a game result. Expired offer
records remain for audit; source/activity/account deletion cascades scoped data.

Focused tests cover explicit consent, color alternation, real cross-class original
scopes, atomic rollback, request replay/conflicts, hashed-only codes, expiration,
cancellation, enabled-account checks and direct-participant revocation.
