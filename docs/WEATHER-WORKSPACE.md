# Weather workspace and display layouts

Weather is an optional classroom feature using the existing
`school.planning.studio.v1.weather` preference. Upgrades preserve shared rules,
calendars, classes, automation IDs and targets. No credentials, database tables,
services or dependencies are added.

## Defaults and customization

Full-screen weather defaults to current conditions, a seven-day forecast, and
integrated after-school (3–6 PM) and evening (6–10 PM) summaries. Summaries show
temperature/feels-like ranges, maximum hourly precipitation chance, wind/gusts,
UV and minimum visibility. Sunrise/sunset appears in the current detail area.
Partial windows are labeled. Missing fields show a dash, never a fabricated zero.

Overlays default to temperature, conditions and today's maximum hourly
precipitation probability. Select fields as needed: location, temperature,
conditions, feels-like, wind/gusts, humidity/clouds, current-hour or today's
precipitation chance, sunrise/sunset, pressure, forecast UV/visibility, alerts,
and afternoon/evening summaries. Selections remain editable in Scene studio
under **Weather overlay details**. Position, size, typography, background and
motion use the existing scene controls.

Other full-screen presets include today in detail, twelve hourly cards, or
1–16 days starting on a selected forecast day. A range cannot extend beyond the
16-day horizon. Current detail checkboxes control the selected metrics.
Model-derived weather is labeled with its fetch time, not a station observation
timestamp. Missing alerts must not be shown as all clear.

Preview and Scene studio send no commands. **Send full-screen weather** requires
explicit targets and uses the existing display.text scene path with announcement
priority. **Schedule this screen** opens the normal automation editor. **Create
shared weather overlay** opens the shared-rule editor: select automations/dates/
times and preview before saving. An overlay preserves underlying media sessions.

## Sources, refresh and privacy

The Hub uses fixed-origin Open-Meteo forecasts (16 daily and 48 hourly entries),
optional NWS US alerts, and bounded Open-Meteo location search. Coordinates go only
to enabled providers. Browsers/receivers never call them directly. Arbitrary
upstream URLs and redirects are not accepted. Forecast reads have a four-second
timeout and 128 KiB stream limit; optional alerts have a separate four-second
timeout and 256 KiB bound. Location search returns at most ten results / 64 KiB.
A shared 15-minute cache and single-flight requests bound upstream traffic.

Open-Meteo precipitation probabilities cover the hour preceding their timestamps.
Selection respects the location timezone and the corresponding sports hours.
Today's value is a maximum hourly probability, not a probability for the entire
day. Precipitation includes rain, showers and snow; it is not humidity. See the
[provider definitions](https://open-meteo.com/en/docs).

Provider credit moves out of the main readout into a small display footer and
workspace source area, preserving [attribution](https://open-meteo.com/en/terms).
Optional NWS alerts require a valid successful response; failures are explicitly
unavailable. These cached alerts are informational, not an emergency notification
or automatic sports cancellation system. An official NWS radar link is provided;
RoomGoblin does not scrape or embed an unreviewed radar service.

Active weather widgets poll the authorized same-Hub projection each minute and
update only widget data. Images, videos and timer deadlines are not reissued.
Data older than one hour is marked stale. Inactive scenes cause no weather polling.
Existing receiver asset authorization gates the projection, which omits
coordinates and raw upstream data. Operator reads require classroom control;
location/unit saves require schedule and automation management. Separate fixed
read/write quotas precede authorization. Draft edits survive polling.
A saved location/unit/source change retires the previous preview and any pending
preview response. When no forecast is available, previous readings and alert
content clear. Same-location refreshes preserve custom previews and selected
receivers; sending after a change must obtain a valid current scene.

## Validation, upgrade and rollback

Tests cover real HTTP authorization/projection/save routes, bounds, missing
probabilities, timezone/hour selection, alert failures, sports windows, overlay
fields, scene limits, browser drafts/targets and media preservation during updates.
Fixture screenshots are not physical TV or live-alert acceptance. Firefox and
image builds/scans remain required CI gates.

Deploy only exact merged/published images through the guarded updater with its
operational backup and rollback. Reload receivers to load the updated renderer.
Before downgrading, disable new weather scenes/shared layers or restore matching
configuration: older renderers cannot interpret the new widgets. Never commit
runtime school coordinates or provider data.
