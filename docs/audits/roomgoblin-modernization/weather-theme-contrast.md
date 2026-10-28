# Weather workspace theme contrast

RG-WEATHER-003 reproduces unreadable light/system-light cards: normal metric text
measured about 1.03:1 against its dark hardcoded background, with similarly low
sports/day text and pale notices on the light page. Dark mode was the passing
control.

The operator-only Weather stylesheet now uses the existing shared workspace
surface, text, muted-text and border variables. It preserves responsive layout
and uses the established primary accent. The display scene and preview artwork
keep their own colors.

All 13 Weather browser cases pass in Chromium and Firefox. Measured card headings,
body text, temperatures, notices and source text meet the 4.5:1 test threshold in
light, dark and system-light modes. Mobile light and desktop dark screenshots were
inspected. The supported Linux snapshot passes 2,428 tests, zero failures, two
root-only skips, all 23 Host Recovery cases and all 55 JVM cases, plus
syntax/controller/shell checks. Fixture evidence does
not claim physical receiver acceptance or live provider coverage.
