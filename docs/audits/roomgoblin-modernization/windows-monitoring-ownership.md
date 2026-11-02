# Windows monitoring request ownership

[Finding classification and immutable source locations](finding-metadata.md#windows-monitoring-ownership).

Baseline: qualified Windows inventory repair `a225c26`.

RG-LAB-004 reproduced five actual-source failures: old browser history or its
error replacing another view, saved screenshots crossing computer identity,
late save completion labeling a different computer as saved, and an old image
remaining visible under a new computer while its capture was pending.

History/profile and screenshot-history reads now retain their computer, dialog
generation and request generation. Close/Escape clears sensitive content and
invalidates pending results; a queued native close event cannot clear a reopened
dialog. Screen changes clear the previous frame. Capture errors are contained,
delivery must identify the requested computer, and feedback distinguishes an
accepted request from confirmed image/save completion. Existing command routing,
permissions, retention and single-flight ordinary refresh remain unchanged.

All 20 new Node regressions and 39 focused cases pass. Three Chromium cases pass
for history ownership across Escape, clearing images during computer changes,
and undelivered captures without false saved feedback. Full Linux qualification
passes 2,122 tests, zero failures and two root-only skips (2,124 total), plus all
23 Host Recovery tests and syntax/controller checks. All 89 workspace and nine
Veyon command-page cases pass in both Chromium and Firefox.
The first Chromium run checked cleanup before the queued native close event;
the test now waits for the required cleanup. The first Firefox run exposed
collapsed-select inner-text differences; it now checks the same option content
through textContent. Neither adjustment removes an assertion.
Transports are fixtures; no student history, actual
capture, classroom command or live agent was used. Hidden-frame capture lifecycle,
other monitoring controls and managed-device review remain separate open work.

## PR #318 review follow-up

Both review findings were reproduced with failing actual-source tests. Saved
image View now explicitly unhides the image and refuses a closed screen view.
Same-computer profile discovery retains dialog ownership independently of row
filters, preserves a selected user, and cannot trigger a duplicate filtered
read. Cross-computer/closed-dialog replies remain rejected. The original profile
test incorrectly expected profile discovery to be discarded; it now verifies
both retained filtered rows and available user choices. Three additional Node
cases cover selected profiles, the rendered saved-image handler and closed views.
All 66 combined focused cases pass. Final qualification passes 2,149 Linux tests,
zero failures and two root-only skips (2,151 total), all 23 Host Recovery tests,
syntax/controller checks and all 94 workspace plus nine Veyon command-page cases
in Chromium and Firefox. Both new review-specific browser cases pass. Their
first focused run used the wrong Search button label; the selector was corrected
to the existing label. The selected-profile Node fixture likewise now uses the
existing `profile` query parameter. Required fresh CI and delivery remain pending.
