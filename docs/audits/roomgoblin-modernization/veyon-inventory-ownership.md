# Veyon inventory and metadata ownership

Baseline: integrated ESPHome qualification `a881bdb`.

RG-LAB-001 reproduces four actual-source failures: old inventory restored a
previous role after save, rename skipped its post-save refresh while another read
was pending, an old read error replaced successful metadata state, and overlapping
role writes reached the server together.

Role, name and discovery writes now share an ordered controller queue with at
most 16 accepted operations. Inputs are captured when accepted. A failed write
releases the next operation without retry. Inventory revisions reject responses
from before a metadata change; reads coalesce during writes and run again after
the last accepted change. Only current successful inventory may prune selections
or release previews. Existing filters, hidden-selection counts, confirmation
dialogs, preview transport and classroom feature-command paths remain intact.

All 14 new regressions and 25 focused Node cases pass. Three browser regressions
cover role state/hidden selections, bulk role ordering and post-rename refresh.
Full qualification passes 2,078 Linux tests, zero failures and two root-only
skips (2,080 total), plus all 23 Host Recovery tests and syntax/controller checks.
All 83 workspace and seven Veyon command-page cases pass in each of Chromium and
Firefox. Required CI and delivery remain pending. The browser fixture's first
run passed two cases and timed out opening a role control inside its collapsed
maintenance disclosure; it now opens that disclosure through the normal UI.
No physical discovery or classroom commands were performed. Information-dialog
ownership is a separate reproduced follow-up, and broader Group 10 review remains
active.
