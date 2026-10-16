# Sports boards

RoomGoblin's optional Sports workspace presents one page per configured team and
competition level, with the previous reported final, next scheduled game, media,
a continuous roster, a clock and optional school weather. Prepared by Kyle Wagner.

## Set up a board

1. Open **Room controls > Sports > Teams & rosters**. Create a separate team for
   each sport, category, season and level. Varsity and JV events never share scores.
2. Enter a roster or import a text-based PDF/CSV, review the rows, then apply and
   save. Documents without explicit levels create a shared program roster; link
   that roster to the appropriate teams without claiming game-day membership.
   Jersey numbers remain text, including leading zeroes and dual numbers.
3. Add previous results and upcoming events under **Results & schedules**. Dates
   require an explicit ISO timezone offset. A final needs both scores; missing
   scores stay unknown. Add verified contributions in the recap or player stats.
4. Upload approved photos/clips through Media library and assign their filenames
   under **Photos & video**. Assignments belong to the exact team level. Date older
   media and mark it Archive; boards exclude archives unless explicitly enabled.
5. Create a board, choose teams, colors, roster heading, speed, entry delay, minimum
   page time, weather and audio. Save before previewing or scheduling. Preview
   never dispatches and never starts another video decoder. Sending requires
   explicitly checked displays. Schedule opens the existing automation editor.

The display uses the existing 1920x1080 scene/layout engine and contains images
and video without cropping. Roster rows enter from below after a two-second pause,
scroll continuously and loop. Page duration grows to allow the complete roster
through once; videos play alongside it, with a two-minute per-clip ceiling and
bounded stall recovery. Video starts muted before requested sound is applied;
blocked audible autoplay falls back to muted playback. An audible board reserves
Background Music priority until replacement. Silent boards retain Background Music. Audio/volume are captured in the scene when
sending or scheduling; resend or update the scheduled scene after changing sound.
Morning Announcements retain priority and remove the Sports renderer/media.

Weather uses the site's saved Weather coordinates and Fahrenheit/Celsius choice,
with current conditions, today's precipitation probability and evening details.
It is school-location weather, including on away-game pages. The clock updates
locally in the configured Sports timezone. Weather keeps its provider attribution
and stale indicator; weather does not cancel games.

Saved workspace JSON can be loaded under **Sources > Import a Sports workspace**.
It is validated into a draft for review; Save Sports remains a separate action.

## Automatic sources

An administrator configures a source for a specific team and approves it. There
are no bundled school identifiers, accounts, private keys, rosters or paid feeds.
Supported source types:

- **Public school website**: reads explicitly sport/category/level-labeled event
  links containing `localStartDate`; follows a same-origin roster PDF whose link
  identifies the sport and configured season. Recognizes labeled JSON-LD
  ImageObject/VideoObject entries with a dated direct `contentUrl`.
- **Direct roster PDF**: text table with number/name/grade or class columns,
  optional position, explicit title/section level. Scans need CSV transcription.
- **Team-specific iCalendar**: expanded UTC VEVENTs, UID, escaped text and
  cancellation. Recurrences, TZID and date-only events are rejected for review;
  use CSV with explicit instants instead of silently guessing their timezone.
- **Structured Sports JSON**: public JSON with `season`, `roster`, `events` and
  `media` arrays. See the example below. The source is already mapped to one team.

This is not a universal Hudl, Instagram or MaxPreps scraper. Dynamic/login-only
pages and sources without supported data can report **No data** or **Unavailable**.
A source approval is not evidence of complete coverage. No credentials are stored
in Sports; credential-bearing subscription links are not supported here. Free
public feeds or staff imports remain the fallback when a provider has no eligible
export. Conflicting player statistics must be withheld until staff verify them.

The Hub checks enabled approved sources every 30 minutes, sharing a single refresh
across receivers. Sources run by priority (lower first); staff can lock roster and
event edits. Schedule-only updates cannot erase an existing final. Network failures
retain saved results/rosters/media; status is separate from event state. Source
refresh does not delete missing events or infer cancellation from disappearance.
Source changes are administrator-only. Ordinary edits require schedule and
 automation management permissions; reads use classroom control authorization.

Media discovery additionally requires school reuse permission and approved media
origins. Metadata must match sport and level and include a valid date. More than
45 days old is archive content and requires an explicit archive flag. At most twelve sources are attempted per pass and four
new assets are downloaded per refresh, 25 MiB each, with 200 assets/512 MiB total
cache capacity. Remove unused cached assets in Media library when full. Direct
files are signature-checked, hashed, stored in the existing media library and
served through the authorized media plane, never a provider URL on each TV.

Fetches are HTTPS-only, public IPv4 DNS pinned per connection, with no redirects,
authentication headers, custom ports or private-network destinations. DNS/body
and response-size deadlines are bounded. IPv6-only sources are unsupported.

## JSON example (fictional)

```json
{
  "season": "2026",
  "roster": [{"id":"p1","name":"Example Athlete","number":"01","grade":"11","position":"Forward","level":"varsity"}],
  "events": [{"id":"game-1","opponent":"Example Visitors","startAt":"2026-10-14T19:00:00-04:00","status":"final","score":1,"opponentScore":0,"recap":"Verified player contribution."}],
  "media": [{"url":"https://media.example.org/team-photo.jpg","sport":"Soccer","level":"varsity","date":"2026-10-14T19:00:00-04:00","caption":"Team photo"}]
}
```

Stats are optional, staff/source supplied text; RoomGoblin does not infer scorer
identities by fuzzy name matching. Rich statistics, photos and scores depend on
source availability. College/pro presets, standings and the earlier proposed
school-day digest are not shipped by this school-board implementation.

## API and storage

`GET/PUT /api/v1/sports` reads/saves configuration. Saves require the current
`revision` and return 409 for stale drafts. `POST /undo` swaps the preceding staff
save; `POST /refresh` refreshes approved sources. `POST /import/roster` accepts a
5 MiB PDF or CSV; `POST /import/events` accepts CSV or expanded UTC iCalendar.
Imports return review data and do not save or dispatch. `POST /boards/:id/scene`
returns a normal shared scene; `GET /boards/:id/display` requires existing asset
access and strips source URLs/operator settings from receiver content.

SQLite preferences `sports.workspace.v1` and `.previous` hold saved configuration
and the prior staff save. Existing operational backups include these preferences;
media follows the existing replaceable-media backup policy. Background refresh
participates in Full Recovery Export writer draining. A stale in-flight refresh
cannot overwrite a later staff edit. Displays poll only the Hub once per minute,
apply revisions at page boundaries, and retain the current media node on unchanged
polls. Network failure keeps current content and shows a saved-content notice.

## Upgrade and rollback

Use the normal guarded updater only after required CI and the exact merged Hub
and maintenance image pair publish. Its operational backup and previous-deployment
rollback protect SQLite/source identity. Do not seed school data into Git. Reload
controllers/receivers to load the renderer after upgrading. Before downgrading to
a version without Sports, replace active Sports screens and disable automations
that refer to Sports boards; the old renderer cannot interpret this widget.
