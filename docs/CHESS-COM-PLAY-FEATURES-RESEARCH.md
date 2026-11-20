# Chess.com play and community feature research

Checked **20 November 2026** against Chess.com's official Help Center. This is a
public-documentation inventory, not a hands-on account audit, exhaustive parity
claim or a promise to reproduce every feature. Product availability changes.
The RoomGoblin proposals below are our assessment; they are not Chess.com advice
or claims about functionality already implemented here. Teaching, puzzles and
post-game coaching belong to the companion curriculum roadmap.

## Gameplay and player convenience

| Documented feature | RoomGoblin relevance and proposed boundary | Primary source |
| --- | --- | --- |
| Standard/custom time controls and rated/unrated custom challenges | Keep presets approachable; add teacher-selected custom controls only after server-clock regression coverage. Classroom standings are not a FIDE rating. | [Start a game](https://support.chess.com/en/articles/8609779-how-do-i-start-a-game-on-chess-com) |
| Matching by time control, skill range and color balance | Consider fair skill grouping and balanced colors without excluding beginners or exposing cross-class records. | [Matchmaking](https://support.chess.com/en/articles/8639319-how-does-matchmaking-work-in-live-chess) |
| Direct challenges and explicit color selection | Useful for assigned partners and rematches. Require acceptance; do not turn a public name into access to a private student record. | [Play a friend](https://support.chess.com/en/articles/8588467-how-do-i-play-a-friend), [Choose color](https://support.chess.com/en/articles/8613907-how-can-i-choose-my-color) |
| Premoves prepared during the opponent's turn, canceled if illegal | Current requested work. Begin with one visible, cancelable local intention; validate against the next server state and never bypass its revision/turn checks. | [Premoves](https://support.chess.com/en/articles/8562432-what-are-pre-moves-and-how-do-they-work) |
| Conditional Daily moves triggered by an anticipated reply | Defer. This is a branching response plan, distinct from an unconditional premove; it needs its own UI, persistence, cancellation and fairness design. | [Conditional moves](https://support.chess.com/en/articles/8583792-how-do-i-make-conditional-moves) |
| Multiple simultaneous games and automatic switching to urgent turns | RoomGoblin already saves multiple games. Consider an opt-in turn-needed list before automatic focus changes, especially for keyboard and screen-reader users. | [Live settings](https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings) |
| Confirmation for resignation/draw requests | Preserve RoomGoblin's explicit ending controls and improve visibility of pending offers; never infer resignation from disconnection. | [Live settings](https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings) |
| Separate bot play, adjustable strength, adaptive personalities and selectable color | Add black-side practice and clearer difficulty descriptions before claiming calibrated strength or adaptation. Practice remains separate from multiplayer standings. | [Play bots](https://support.chess.com/en/articles/8614091-how-can-i-play-against-the-chess-com-bots) |

The current premove Help Center article describes **up to five** queued premoves;
an older [Chess.com term page](https://www.chess.com/terms/premove-chess) describes
unlimited premoves. Use the current Help Center as the product reference rather
than assuming those pages agree. Chess.com's documented premove clock behavior
is not a specification for RoomGoblin: preserve our server clock contract and
document our own behavior explicitly.

## Presentation and accessibility-related controls

| Documented feature | RoomGoblin relevance and proposed boundary | Primary source |
| --- | --- | --- |
| Board/piece styles, backgrounds, movement effects and sounds | Offer a small set of original, high-contrast themes and explicit effects controls. Bundle assets locally; do not copy proprietary designs or audio. | [Board and pieces](https://support.chess.com/en/articles/8594320-how-do-i-change-my-background-board-and-pieces) |
| Coordinate placement and piece notation preferences | Add optional outside coordinates and readable algebraic notation without removing square/piece labels for assistive technology. | [Live settings](https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings) |
| Legal-move indicators and bottom-side preference | Preserve visible selection and legal targets; separate player orientation from free 3D camera rotation. | [Live settings](https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings) |
| Resizable board, focused board view, theatre layout and flipping | Expand teacher and SCO sizing controls; retain clocks, turn, return-to-2D and exit controls in every mode. | [Board size](https://support.chess.com/en/articles/8609533-how-do-i-change-my-board-size), [Focus mode](https://support.chess.com/en/articles/8588088-what-is-focus-mode-how-do-i-turn-it-on) |
| Keyboard shortcuts for flipping, focus and move-history navigation | Add discoverable shortcuts without conflicting with typing or semantic board navigation. | [Commands and shortcuts](https://support.chess.com/en/articles/8609263-what-chat-commands-can-i-use-in-game-chat) |
| Board arrows and colored square annotations | Valuable for teacher demonstrations and finished-game review; prevent coaching annotations from becoming an unauthorized channel in competitive games. | [Commands and shortcuts](https://support.chess.com/en/articles/8609263-what-chat-commands-can-i-use-in-game-chat) |

These controls are **not evidence of comprehensive accessibility conformance**.
No current first-party screen-reader/keyboard conformance statement was verified
in this pass. RoomGoblin must test its own semantic 2D board, focus order,
non-color cues, live announcements, reduced-motion preferences and touch targets.
3D must remain optional and must never be the sole way to play.

## Community, safety and organized play

| Documented feature | RoomGoblin relevance and proposed boundary | Primary source |
| --- | --- | --- |
| Friends and accepted Live/Daily invitations | Consider classroom-approved opponent invitations; avoid introducing a public social graph or unrelated messaging. | [Play a friend](https://support.chess.com/en/articles/8588467-how-do-i-play-a-friend) |
| Clubs with organizers, membership and group events | Existing teacher/class authorization should own any school chess group. A global lobby must not expand class enrollment or roster visibility. | [Clubs](https://support.chess.com/en/articles/8718710-how-do-chess-com-clubs-work) |
| Following and observing games | Extend teacher watch tools and safe spectator views only with explicit scope and no private grades/identity leakage. | [Commands](https://support.chess.com/en/articles/8609263-what-chat-commands-can-i-use-in-game-chat) |
| Configurable incoming challenges and game chat | Prefer preset sportsmanship phrases and teacher moderation before free-form cross-class chat. | [Live settings](https://support.chess.com/en/articles/8614003-how-do-i-manage-my-live-chess-settings) |
| Reporting and blocking unwanted interactions | Add private teacher-reviewed incident reports if social features expand. Never publish unverified cheating accusations. | [Report a member](https://support.chess.com/en/articles/8562517-how-do-i-report-someone), [Block a member](https://support.chess.com/en/articles/8609264-how-can-i-block-another-user) |
| Swiss tournaments with rounds and standings | Strong classroom fit after reliable pairing, byes, ties, withdrawals and saved-event recovery are designed. Keep results separate from participation grades. | [Create tournaments](https://support.chess.com/en/articles/8609296-how-can-i-create-a-live-blitz-bullet-rapid-tournament) |
| Time-bounded Arena events and ongoing game lists | Useful for an opt-in class session; define scoring and end-of-session handling before implementation. Do not terminate ordinary saved games. | [Live tournaments](https://support.chess.com/en/articles/8608949-how-do-live-tournaments-work-where-can-i-join-one) |
| Multi-club team standings and downloadable results | Potential inter-class events with teacher-approved class representation and privacy-safe TV standings. Teacher membership must remain the authority. | [Multi-club arenas](https://support.chess.com/en/articles/16952230-how-do-multi-club-arenas-work-on-chess-com) |
| Variant lobbies, variant standings and custom starting positions | Defer beyond standard chess. Chess960, team chess and custom rules require separate legal engines, notation, persistence and result categories. | [Variants](https://support.chess.com/en/articles/8583983-how-do-i-play-chess-variants), [Custom variants](https://support.chess.com/en/articles/8609332-how-can-i-make-my-own-chess-variant) |

## Archives, portability and integration

| Documented feature | RoomGoblin relevance and proposed boundary | Primary source |
| --- | --- | --- |
| Searchable game history, favorites and collections | Prioritize paginated saved/finished history with own-game access and class-scoped teacher views. Retention and deletion require explicit policy. | [Game history](https://support.chess.com/en/articles/8598090-how-do-i-view-my-own-games) |
| Single/bulk PGN downloads, optional timestamps and annotations | High-value next step for teacher feedback and independent review. Export only authorized games; default to privacy-safe labels and omit private bearer/configuration. | [PGN export](https://support.chess.com/en/articles/8705305-how-do-i-get-a-pgn-of-my-game) |
| Animated game GIF export | Later presentation feature, with original assets and safe labels; never upload student games to a third party automatically. | [GIF export](https://support.chess.com/en/articles/8705915-how-can-i-make-an-animated-gif-of-my-game) |
| Public player/game/club/tournament data API | Optional future import research only. It is read-only, excludes private chat and conditional moves, and cannot submit moves. Not a replacement for RoomGoblin's own backend. | [PubAPI](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it) |

## Fair play, exclusions and sequencing

Chess.com's [fair-play guidance](https://support.chess.com/en/articles/8568369-what-do-i-need-to-know-about-fair-play-on-chess-com)
separates live competitive play from computer practice and prohibits outside
assistance in live games. Apply the analogous RoomGoblin boundary: multiplayer
gets rules/reference help but not tactical suggestions; practice and finished-game
review may explain positions. Statistical similarity is not proof of cheating.
Keep human teacher review, evidence limitations and an appeal/correction path;
do not import automatic public accusations or punitive classroom scoring.

Recommended order (RoomGoblin assessment):

1. Finish the requested camera, animation and one-premove usability work; validate
   the exported Schoology package, keyboard flow and saved-game safety.
2. Add usable history/search, PGN export, black-side practice and accepted rematches.
3. Add teacher-run small Swiss/class events and scoped spectator/TV summaries.
4. Evaluate optional themes, review annotations and team events after accessibility,
   performance and privacy validation. Keep variants and public integrations separate.

Do not clone Chess.com's branding, piece art, board palettes, sounds, distinctive
interface or named proprietary products. Its [PubAPI guidance](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it)
also distinguishes public data access from permission to copy its product/IP.
This document proposes independently designed educational capabilities, not an
affiliation, a scraping plan, or authorization to send student data externally.
This inventory does not implement public chat, account linking, paid-content
extraction, third-party telemetry, production migrations or the proposed future features.
