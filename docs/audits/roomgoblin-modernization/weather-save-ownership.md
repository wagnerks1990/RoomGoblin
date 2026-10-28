# Weather settings save ownership

RG-WEATHER-002 reproduces three browser failures: a pending save leaves its button
available, completion replaces newer unsaved inputs, and a pre-save refresh can
restore the prior configuration after a successful save.

One pending save now owns the save button through its follow-up refresh. Inputs
remain editable; a draft revision distinguishes submitted values from newer edits.
Read generations retire responses predating a write, and the save waits for any
retired read before requesting current data. New scenes wait for the settings
write to finish. Failure releases the button and remains visible.

All ten Weather browser cases pass in Chromium and Firefox. The held-response
fixtures reproduce all three defects before repair; existing forecast invalidation,
preview isolation, mobile overlay, draft and target-preservation cases remain
passing. The supported Linux snapshot passes 2,428 tests with zero failures,
two expected root-only skips, all 23 Host Recovery cases and all 55 JVM cases,
plus syntax/controller/shell checks. No weather provider or
physical display command was exercised. Server authorization and source bounds
remain unchanged; broader Weather/Sports review continues.
