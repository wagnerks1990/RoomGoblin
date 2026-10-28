# Weather location search ownership

RG-WEATHER-004 reproduces six browser failures: delayed results replace a newer
search; changed input retains old choices; a retired error replaces a newer
selection notice; navigation or an authentication change accepts an earlier
response; and a refresh enables a duplicate pending search. A current-selection
control passes before and after repair.

Each search now captures its input and generation. Input edits, navigation and
authentication changes retire responses and clear choices. Pending searches
remain disabled across forecast refreshes; a changed query may start a new
search, and only its matching completion can release its control. Both response
and choice application recheck permission, active workspace and current input.
Current failures remain visible and allow retry. Choosing a location changes the
draft only; saving and display dispatch remain separate explicit actions.

All 20 Weather browser cases pass in Chromium and Firefox, including the seven
new cases. The supported Linux snapshot passes 2,445 tests with zero failures,
two expected root-only skips, all 23 Host Recovery cases and all 55 JVM cases,
plus syntax/controller/shell checks. Provider/network
bounds and existing shared preference identities remain unchanged. All searches
and failures use isolated fixtures; no production coordinates or physical
display commands are involved.
