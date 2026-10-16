# Sports workspace: research and proposed design

Status: historical research/proposal, October 16, 2026. The school-board implementation
is documented in [Sports boards](SPORTS.md). The broader professional/college,
digest and provider proposals below are not a claim of shipped functionality.
Prepared for RoomGoblin by Kyle Wagner with development assistance.

## Product decision

Build one optional **Sports** workspace with three saved board presets:
Professional, College and School athletics. Keep a board's selections separate
from its sources and from the automation that displays it. A board can therefore
change today's games without recreating a scheduled occurrence or restarting
the display session. All providers must have a genuinely free ongoing option;
trials, premium live endpoints and automatic paid fallback are excluded.

Operator clarification: live statistics and live scoreboards are **not required**.
The hallway audience needs completed results on following school days, upcoming
games, team information and rosters. Prioritize free final-result and schedule
coverage over refresh speed. Do not build live clocks, play-by-play or minute-level
score polling for this scope.

Native cards require an authorized structured feed or
staff input. Provider widgets remain visibly provider-owned surfaces; availability
of an iframe is not permission to scrape its contents into native cards.

## Research findings and source decisions

These are provider-documented capabilities. Coverage for a particular selected
team still requires a successful trial. Public pages do not establish API access,
redistribution permission, ad-free operation or physical-display compatibility.

| Source | Verified capability | Proposed use and outstanding checks |
| --- | --- | --- |
| [ArbiterLive team following](https://arbitersportshelp.zendesk.com/hc/en-us/articles/19923810064909-How-do-I-Follow-Teams-on-ArbiterLive) | Public team schedules; team following includes emailing an iCal feed, with account/subscription steps | Preferred school schedule import. A school's actual feed, fields and refresh behavior must be tested; no feed has been obtained. No automated sign-up or email action. |
| [Arbiter school settings](https://arbitersportshelp.zendesk.com/hc/en-us/articles/19923859998093-School-Settings) | Schools can generate an iCal link for external calendars/websites | Another approved route for an administrator-supplied feed. No assumption that it includes scores or rosters. |
| [ScoreStream partner tools](https://scorestream.com/partners) and [widgets](https://api.scorestream.com/make-a-scoreboard-widget) | Free automatically updating widgets with team/style selection | Secondary candidate for reported completed results only if an appropriate history/final-only view is verified. Live capabilities are unnecessary. Verify coverage, branding, ads and framing. Free widgets do not establish a free raw-data API. |
| [ScoreStream FAQ](https://api.scorestream.com/faq) | Community reporting across school, college and professional sports; detailed statistics are not its focus | Treat scores as reported, with appropriate source labeling. Do not promise every league, sport or team will have timely coverage. |
| [Hudl profile setup](https://www.hudl.com/support/fan-engagement/guides/getting-started-with-your-profile) and [FAQ](https://www.hudl.com/solutions/fan/faq) | Coach-entered schedules/rosters appear on organization profiles; Fan profiles are included for existing Hudl customers | Public team-page links and a potential school-provided roster source. No supported free export/API or permission to reproduce portraits has been verified. An existing school's entitlement is not a generic free RoomGoblin service. |
| [TheSportsDB API guide](https://www.thesportsdb.com/docs_api_guide.php) and [terms](https://api.thesportsdb.com/docs_terms_of_use.php) | Free V1 has endpoint-specific limits; guide currently restricts team-name search to Arsenal; live scores and V2 require premium | Experimental metadata lookup only after endpoint/coverage/rights verification. Not the backbone for US team discovery, complete rosters, standings or live scores. API availability does not establish rights to every supplied image. |
| [football-data.org pricing](https://www.football-data.org/pricing) | Zero-cost tier lists 12 soccer competitions, delayed scores/schedules, fixtures, tables and 10 calls/minute | Optional soccer expansion. Verify competition coverage and terms before implementation; requires free account/key setup. Not an NFL or NCAA source, and not real-time on the free tier. |
| Staff entry / CSV / uploaded calendar | Locally controlled fallback; no provider dependency | Required first-phase capability. Review imported changes, preserve stable IDs and allow undo; no invented player or score data. |

### Carlisle discovery

The [official district athletics page](https://www.carlisleschools.org/athletics)
links Thundering Herd Schedules to ArbiterLive and links the school's Hudl profile.
The Arbiter team page could not be retrieved by the research browser, so the
specific team calendar contents and export remain unverified. Hudl's published
profile capability does not prove that each Carlisle team has a current roster.

School identity, provider team IDs, calendars, logos, colors and selected teams
must be saved as site configuration, never bundled as application defaults.
Carlisle is the initial operator use case, not a hardcoded public product identity.

ESPN's reachable scoreboard JSON is an exploratory lead, not a verified supported
public API contract. No free supported ESPN, NCAA-wide or MaxPreps integration
has been established in this research. Do not make undocumented endpoints or
website scraping the default reliability dependency. Rich player statistics and
universal statistics coverage remain outside the promised free baseline. Live
coverage is outside this scope.

## Operator workflow

Proposed navigation: **Room controls > Sports**. First use offers **School
athletics**, **College**, and **Professional** presets. Each opens the same editor:

1. **Choose teams:** search supported sources or add a team manually; filter by
   sport, league/conference, team category and competition level. Keep provider
   category labels; do not infer gender or varsity/JV from a name substring.
2. **Choose content:** Last school day's results, today, next seven days, team spotlight,
   roster, standings or supported statistics. Unsupported choices explain the
   missing source capability rather than displaying empty fake values.
3. **Design the board:** choose full screen, matchup, compact ticker or overlay;
   set visible fields, density, rotation interval, team emphasis and optional
   weather. Preview portrait/landscape/receiver shapes through the existing engine.
4. **Review and use:** save a board, send to explicitly selected receivers, or
   open the existing automation editor with the board reference. Preview has no
   live effect. Source setup and ordinary board editing are separate tasks.

The main workspace has **Boards**, **Teams & schedules**, and **Sources** tabs.
Opening a board shows its preview prominently and ordinary editing controls beside
it; advanced source rules remain collapsed. Saving never silently dispatches.
Polls update preview data without replacing a focused control or unsaved draft.

### Screen arrangement

```text
Sports                       [Saved board v] [Preview] [Schedule] [Send...]
[Boards] [Teams & schedules] [Sources]

Choose content                 Board preview
School / College / Pro         SCHOOL ATHLETICS             TODAY
Teams and sports               Featured matchup / next game
Today / Week / Results         Opponent | Home/Away | Time | Venue
Layout and visible fields      Up next: readable cards, paginated as needed
Optional weather               Source | Updated / Stale | Official link

Source status: schedule available; score coverage not yet connected
```

Use existing RoomGoblin workspace tokens, capability-hidden navigation, accessible
labels and keyboard focus. The physical display uses school theming when supplied;
operator chrome uses RoomGoblin branding. Avoid tiny grids, unsolicited animation,
odds/betting content, social feeds and audio. Keep Kyle Wagner attribution in the
operator surface according to the existing product contract.

## Board defaults and customization

| Preset | Initial content | Useful controls |
| --- | --- | --- |
| School athletics | Results since the previous school day's digest, today's contests, next seven days, optional team spotlight | School teams first; varsity/JV/middle-school filters where supplied; home/away/neutral, opponent, venue, time, postponed/cancelled labels; roster rotation opt-in |
| College | Selected schools and conferences; previous-day/weekend finals and upcoming fixtures | Sport and team-category filters, favorites, conference grouping; rankings/standings only with a verified eligible source |
| Professional | Selected leagues and favorites; previous-day/weekend finals followed by next games | NFL, NBA, WNBA, MLB, NHL and soccer as selectable candidates; each source must pass coverage checks before a league is marked supported |

Automatic sport selection means **prioritize enabled sports with actual fixtures**,
not a hardcoded month-to-sport mapping. Keep favorite teams visible; allow manual
pinning, off-season summaries and playoff emphasis only when the source supplies
that metadata. Show an explicit empty state if none of the selected teams plays.

Default native-card rotation is 20 seconds with manual preview navigation; no
scrolling by default. Limit cards per page and paginate long schedules/rosters
without clipping. Allow short fades and reduced-motion behavior. A provider frame
controls its own internal layout; do not claim native styling or filtering of it.

An editable overlay can show next school contest, a selected matchup, completed
result or schedule-change message. Choose fields and move/resize it in Scene
studio. Preserve underlying video/audio sessions and timer deadlines. A sports
overlay must not overwrite an announcement, class transition or countdown.

Weather is opt-in and informational: use the school's saved location for home
games; clearly label it as school weather for away games unless a verified venue
location is supplied. Never imply that weather automatically cancels an event.

## Teams, events, rosters and imports

Proposed normalized records:

- **Team:** internal ID, source mappings, organization, display name, sport,
  category, level, season, optional approved logo, official public page.
- **Event:** internal ID, source ID/UID, participating teams, start instant or
  date-only/TBD, source timezone, home/away/neutral, venue/address, status,
  optional final score, completion/report time, source provenance and freshness per field group.
- **Roster:** team/season, stable row key, approved public display name, jersey
  number, optional position and grade, public source and revision. No private
  contact, birth, eligibility, medical or student-information-system fields.
- **Board:** team/source selections, view/layout, field choices, rotation,
  freshness policy and optional fallback. Receiver targets belong to the
  explicitly reviewed command/automation, not an implicit global default.

No record should depend on matching human-readable names alone. An official
schedule may provide time/location while a reported-score source provides scores;
merge only after an explicit team/event mapping. Keep per-field provenance and
surface conflicts. Do not let an older community schedule overwrite an official
postponement. Staff corrections carry an expiry/reason and are not silently
overwritten by the next refresh. Expired corrections return to source state.

CSV/import review shows added, changed, conflicting and invalid rows before save.
Support column mapping and downloadable templates. Event columns include stable
key, team, opponent, date, time/TBD, timezone, venue, home/away/neutral and status;
rosters use stable key, team, season, display name, jersey and optional position.
Handle leading-zero jersey numbers as text, Unicode names, BOM, quoted commas,
duplicates and spreadsheet-formula export injection. Missing rows do not delete
records by default; roster replacement is a separate explicit reviewed action.

Calendar parsing must handle UID/RECURRENCE-ID, sequence changes, TZID, all-day
values, folded lines, escaped text, cancellation and bounded recurrence expansion.
Never assume a summary string always follows an opponent/home-away convention.
Unknown fields remain unclassified for staff review. Sports contests stay separate
from the school-day calendar: a weekend game must not advance Green/White rotation
or make a closed school day run classroom automations.

## Reliable data and display behavior

Maintain separate event state and feed state. Event state can be scheduled, TBD,
in-progress (excluded from result cards), final, postponed, cancelled or unknown. Feed state can be healthy,
delayed, stale, unavailable, unconfigured or unsupported. A successful fetch is
not evidence of a newly updated score. Prefer a provider update timestamp; otherwise
label the time as **Fetched**, not **Score updated**.

Never turn missing scores into 0-0, infer a final from elapsed wall time, count down
a fabricated game clock, or infer cancellation because an event disappears. An
unknown final score stays unknown. Preserve cancelled/postponed notices for the
applicable display window. An empty successful feed differs from a failed fetch.

### Next-school-day digest

Prepare the results digest before the configured school opening time, using the
site timezone. Monday includes weekend results; a school closure extends the
window back to the previous displayed school-day digest. Read the existing school
calendar without modifying it. Record a durable digest watermark only after a
successful digest is prepared; preview does not advance it. Paginate overflow so
busy weekends do not silently lose results. Outside school hours, retain the
latest digest and upcoming schedule; manual boards remain available.

Only explicitly final/completed results enter result cards. Unreported outcomes
appear as **Result pending** with the event date; never treat an in-progress score
as final. Late finals and corrections update the applicable digest without
restarting its display session. Corrections to earlier displayed results get a
dated correction card, avoiding silent disappearance. No result is described as
"yesterday" unless its event date actually matches yesterday at the site.

Proposed initial budgets (subject to provider terms and measured behavior): results
refresh on digest preparation and hourly during display hours; schedules every
30 minutes during display hours; metadata/rosters daily. All receivers share a
server-side cache and single-flight request; no per-TV upstream polling. Honor
Retry-After, add jitter and bounded backoff, stop idle polling and retain bounded
last-known-good data. Warn after three missed scheduled refreshes, preserving
completed results with their dates and source timestamps. An old final does not
become an invalid score merely because a source is offline; label the failed
refresh separately. Source-specific schedule/roster thresholds remain visible.
These native-cache rules cannot certify freshness inside a third-party iframe.

Use the existing scene/layout engine and safe regions. A native sports data refresh
patches widget data only. Morning Announcements remain highest priority; normal
visual sports boards must not pause Background Music. Ending an automation follows
the existing scheduler's winning-current-occurrence reconciliation, never a stale
screen snapshot. Sports must not become a dependency for health, updates or class
schedule recovery.

## Integration and security boundaries

Adapters declare capabilities: schedules, score reporting, finals, standings,
rosters, metadata and provider frame. The UI offers only supported capabilities.
Keep adapter enablement, configured coverage and observed health distinct.

Prefer fixed-origin connectors. Administrator-supplied calendar URLs require a
reviewed fetch boundary: HTTPS, approved provider hosts, bounded DNS resolution,
no loopback/private/link-local/metadata destinations, no arbitrary redirects, and
bounded response size/time/recurrence. Recheck connection destinations to prevent
DNS rebinding; do not accept arbitrary headers or proxy credentials. An uploaded
calendar is the fallback when a feed cannot meet that boundary. Treat secret-bearing
subscription URLs as secrets: encrypt at rest, redact logs and omit from receivers.

Provider frames need a separate evaluated allowlist/sandbox/CSP policy with a
clear online dependency, fallback and attribution. No provider scripts in the
controller document. Do not weaken the current URL-display policy or change asset
authorization to make a frame work. Test cookies, ads, navigation/popups and
framing restrictions; disable the optional source when it cannot fit the boundary.

Reuse existing classroom-control, schedule-management and automation-management
guards, with administrator-only source/secret configuration as appropriate. Add
recognized bounded rate limits before auth middleware. Receivers receive only a
bounded presentation projection, never source URLs with secrets, full raw feeds or
operator-only roster fields. All ordinary sports reads are side-effect free.

## Implementation sequence and acceptance gates

1. **Native foundation:** manual teams/events/rosters, reviewed CSV and uploaded
   calendar import, three board presets and scene previews. No remote provider is
   required to demonstrate a complete hallway workflow.
2. **School schedule connector:** verify an approved school feed, mapping and
   timezone/changes/cancellation handling; compare selected teams against the
   official published schedule. Do not mark Carlisle import ready before this.
3. **Completed-results sources:** qualify eligible free final-result feeds or
   staff imports for school, college and professional selections. Test next-day,
   weekend, late-final and correction coverage. A ScoreStream frame is optional
   only if its completed-results view suits this workflow; it is not a dependency.
4. **Native free-feed additions:** qualify individual metadata/soccer adapters and
   any subsequently documented authorized free feeds. No unsupported broad claim
   of NFL/NCAA statistics; no silent paid upgrade.

Required future regressions: permissions and receiver projection, source bounds
and URL abuse, cache single-flight/backoff, timezones/DST/TBD, duplicates and moved
events, missing/stale/conflicting finals, school-day digest watermarks, weekend
and holiday windows, late finals/corrections, import undo/replacement, draft/focus
preservation, long names/rosters, landscape/portrait sizing and reduced motion.
Receiver tests must verify weather/sports refresh retains the same media node,
countdown deadline, announcement priority and audio state. Provider-frame tests
must include offline/failure recovery and actual framing/ad behavior.

Before production: run the repository gates; publish exact merged images; use the
guarded updater's backup/rollback; test an explicitly selected receiver. Disable
new boards/overlays before downgrading to a renderer without sports support.
No production rollout is authorized by this design-only research task.
