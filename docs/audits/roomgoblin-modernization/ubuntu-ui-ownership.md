# Ubuntu inventory, commands and dialog ownership

RG-LAB-019 covers stale inventory replies, command admission lost during redraws,
late previews, and completed metadata/maintenance requests closing newer drafts.
The inventory fixture fails six old-source assertions and passes two controls.
The initial dialog fixture fails five assertions and passes three controls.
Two browser reproductions show a pending command becoming enabled after filtering
and a pending capture offering no open dialog to close.

One shared inventory promise now coalesces reads. Writes invalidate prior reads;
a fresh read follows once outstanding writes settle. Failure preserves the last
inventory and reports it as stale. Refreshes never retry a write. Assignment
editing consumes the fresh configuration instead of the clicked card's snapshot.

Per-computer pending state and feedback survive redraws. Duplicate card commands,
metadata saves and maintenance submissions are rejected while that computer's
request is pending. Completed submissions close only an unchanged dialog draft;
newer edits remain visible and unsaved. Closed-dialog failures remain visible on
their originating card. Capture dialogs open immediately with progress, and both
Close and Escape retire pending results, clear the image and restore useful focus.

All 18 focused Node cases and eight Ubuntu Chromium browser cases pass. Five
browser cases are new and include real PNG decoding, keyboard focus, refreshed
assignments, duplicate admission and newer draft retention. The combined backend
configuration and interface tree passes 2,197 supported Linux tests, zero failures
and two root-only skips, all 23 Host Recovery tests and syntax/controller/shell
checks. All 275 Chromium cases and 102 workspace plus nine Veyon Firefox cases
pass. Desktop assignment and mobile light-theme inventory images were inspected.
No real computer was commanded,
captured, enrolled or reconfigured. Required CI, checked merge, exact publication
and backed-up appliance verification precede delivery.

Wizard probe/input ownership, post-dispatch per-computer history persistence and
the Android managed-display review remain open within Group 10. Shared browser
request deadlines remain queued for the backend/API review; this change does not
claim to add a transport deadline or cancel an uncertain remote write.
