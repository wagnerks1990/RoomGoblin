# Computer practice from either color

New computer games accept `humanColor: white | black`, defaulting to white.
Existing saved games retain white through an additive `human_color` column.
The compatibility fields `white_id` and `activity_id` remain the private practice
owner and original assignment; they are not migrated to a new account or a
fabricated computer user. Multiplayer seat semantics remain unchanged.

`ChessMatches.create` is synchronous for existing white, solo and multiplayer
paths. Black computer creation returns a promise. Routes must await it before
responding. The server obtains one legal White engine opening outside a database
transaction, then rechecks authorization, assignment availability, request
identity and capacity before atomically creating the game. Failed openings,
revocation, freeze or audit failure leave no partial game. Concurrent duplicates
with one request UUID share opening work. Engine admission remains shared with
other computer play and completed-game analysis.

The new Black game starts at revision zero with one server-owned engine move
and Black to play. Clocks begin when the active game is committed, not during
opening generation. That computer opening earns no human SCORM participation.
Only Black's own validated moves count for the human. Names, orientation,
computer labels, legal turns, hint ownership, draw claims, clock results,
practice standings, completed-game PGN and adaptive evidence use the actual
human color. The internal practice owner field must never be mistaken for the
human's board color when extending these features.

Adaptive material evaluation is signed relative to the human's color. Completed
practice outcome and opening-habit summaries likewise count that side's moves.
Between-game Adaptive Practice keeps its creation snapshot, including when the
computer opens as White. Ordinary competitive standings are unchanged.

Tests cover legal opening and response, independent human move credit,
per-color clock increments and timeouts, actual-turn draw claims, private hints,
duplicate creation, unavailable engine, revocation during search, existing White
save preservation, and Black-side practice/adaptive result attribution.
