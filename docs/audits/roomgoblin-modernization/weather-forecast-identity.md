# Weather forecast identity

RG-WEATHER-001 begins Group 11 with the Weather workspace, scene factory,
forecast/cache module, HTTP routes and their current tests. The broader Sports
source review remains open.

Three browser failures reproduced: unavailable weather retained the previous
readings; a changed location could send the old saved preview without generating
a current scene; and a late scene response restored a retired location.

The workspace now compares saved forecast settings and retires the preview when
that identity changes or weather becomes unavailable. Clearing uses the existing
scene renderer to remove its widget registration. Missing forecasts clear current,
daily, hourly, sports and alert content. Preview generation, drawing and scene-editor
completion retain the generation that owns their result. Ordinary refreshes of
the same location preserve custom previews, draft inputs and selected receivers.

All seven Weather browser cases pass in Chromium and Firefox, including the three
reproductions and the preservation control. The supported Linux snapshot passes
2,428 tests, zero failures, two root-only skips, all 23 Host Recovery cases and
all 55 JVM cases, plus syntax/controller/shell checks. No provider requests or
physical display commands were used by fixtures.
Separate save/read concurrency and remaining Weather/Sports review continue.
