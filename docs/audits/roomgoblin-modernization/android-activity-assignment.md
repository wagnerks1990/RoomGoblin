# Android activity display assignments

[Finding classification and immutable source locations](finding-metadata.md#android-activity-assignment).

RG-LAB-038 reproduces three assignment failures in the actual MainActivity URL
and intent methods. Configuration saves the new display URL and launches an
existing activity, but its previous URL (or initial placeholder) prevents the
new assignment from loading. Explicit reload after reassignment also reloads the
old page. Four persistent-session and initial-load controls pass before repair.

The activity now remembers the configured assignment it last loaded. A changed
assignment loads once on resume or a new intent; an unchanged assignment leaves
the current WebView session in place, including any redirect. Explicit reload
still reloads an unchanged assignment. When an assignment changes alongside a
reload request, it loads the new assignment without first reloading the old page.
No device identity, enrollment, watchdog or autoplay policy changes.

All seven JVM cases pass with the actual fields, intent and URL methods and a
WebView substitute. The existing source-level resume/launch check is updated to
the new return value and reload guard. The same JVM fixture is included in the
existing Validate Android job; required workflow names remain unchanged.

Supported Linux qualification passes 2,399 tests with zero failures and two
root-only skips, all 23 Host Recovery cases, four socket and seven activity JVM
cases, plus syntax/controller/shell checks. Browser sources retain the
126-case-per-engine qualification. These checks do not install an APK, run an Android WebView
or dispatch a physical classroom command.
