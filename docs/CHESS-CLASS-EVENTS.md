# Optional class chess events

Teachers can create a small Swiss-style class challenge with one to seven rounds,
up to sixteen explicitly consenting entrants, and an existing chess clock preset.
This is classroom pairing, not a rated or officially certified tournament system.
There are no rating claims or official tie-break calculations. Equal points stay
tied; the displayed order within a tie follows registration order.

Teachers may optionally define two to four team labels when creating an event.
Entrants explicitly choose one of those labels when joining. Team labels and the
entrant's original team are immutable for that event, including withdrawal and
rejoining. This is a team **scoring overlay**, not a team-chess variant: players
still play ordinary individual chess, with the same pairing rules and access
controls. Team totals show game points and bye points separately, alongside the
number of entrants; unequal team sizes are visible and totals are not normalized.
No team enrollment, cross-class team directory, or additional roster is created.

Students join from their own original assignment identity and agree that the
teacher can start the event games and their displayed clocks. Teachers may also
join voluntarily. Only participants' privacy-safe chess nicknames and event
standings are visible to other learners in the same class; teachers retain their
existing class-authorized alias view. No user IDs, participant bearers, enrollment
capabilities, other-class rosters, or assignment IDs are exposed in the event
projection. Match links are returned only for the viewer's seat or class teacher.

Each next-round action rechecks all remaining participants' current membership,
enabled identity, private direct-participant scope/revocation, assignment access,
and game capacity. A paused/closed/unavailable entrant blocks the next round until
resolved or withdrawn; the service never silently substitutes another player.
Registration closes when the first round starts. Withdrawal affects future rounds
only. Ending the event also leaves every existing game playable and does not
forfeit, delete, pause, or change ordinary games. Completed event games use the
same server-authoritative legal moves, clocks, multiplayer history and standings
as other games. Event bye points are recorded separately and never create wins or
games in the ordinary chess leaderboard.

Round results are read from the underlying confirmed matches, never supplied by a
browser or cached as an invented win. A missing game is shown as unavailable and
blocks another round; a teacher can end the event safely. Administrative/abandoned
endings do not award event match points. Normal wins award one point, normal draws
half a point, and an event bye one point. The next round waits for all prior games
to finish. Closing the event does not freeze active game outcomes: subsequently
finished games still appear with their actual results.

The bounded exact pairing search minimizes repeated opponents first, then score
distance and color imbalance. A nonrepeating matching is chosen when feasible for
the available entrants. For an odd group, the lowest previous bye count takes
precedence; eligible bye choices are considered during matching, with lower score
favored. Up to sixteen entrants means at most 65,536 bitmask states for one search.
No unbounded solver, background engine analysis, remote service, or startup scan
is required.

## Implementation and integration

`src/learning-chess-events.js` exports `ChessEvents(learning,{chess,available})`.
`list(user,activityId,options)` returns `{events}`. `create`, `join`, `withdraw`,
`next`, and `end` return `{event}`. Teacher options are checked against fresh class
authority; a caller's boolean does not grant it. Mutations accept bounded request
UUIDs and current revisions and store exact request fingerprints for idempotency.
There are at most three unfinished events per class and 256 regular event changes,
plus one final teacher end operation. All changes and audits share the storage
transaction; game creation/join and pairing records either all commit or all roll
back. Nested storage transactions use savepoints. Event `skipQueue` is an internal
ChessMatches option and must never be forwarded from an HTTP request body.

`public/learn/chess/events.js` supplies `RGChessEvents(root)` with
`configure({key,request,writable,teacher,onMatch?})`, `load()`, and `destroy()`.
Requests use `/events` and `/events/:id/join|withdraw|next|end`. Context changes
invalidate pending responses, failed writes require refresh rather than automatic
replay, all names use text nodes, and joining requires a fresh explicit checkbox.
The parent surface continues to own current-game selection and SCORM reporting.

Focused tests exercise actual match creation/join/resignation, byes, nonrepeating
pairings, consent, class/direct identity boundaries, revocation, capacity and audit
rollback, stopping without forfeits, and participant/class deletion. The separate
browser UI check covers consent, escaped names, teacher controls, stale-context
responses, and disposal. Live Schoology acceptance is still a separate release
check; these local fixtures contain synthetic identities only.
