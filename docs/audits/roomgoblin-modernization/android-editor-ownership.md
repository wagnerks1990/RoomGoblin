# Android editor submission and draft ownership

RG-LAB-025 reproduces four failures: old save completion closes another display's
editor, closes a newer draft for the same display, overwrites a newer editor's
feedback on failure, and admits a duplicate submission. The unchanged successful
save is a passing control on old source.

Pending saves now belong to their display ID and survive closing/reopening. The
captured form and editor lifetime determine whether completion can close the
dialog. Newer drafts remain unsaved and visible. Outcomes stay on the original
display card, including closed-editor failures. An accepted save survives a
failed follow-up read; no write is replayed. Closing returns focus to the current
Edit button or inventory search. Enrollment behavior remains compatible.

All nine source cases and the ten enrollment cases pass. Two new real-browser
cases cover newer same/other-display drafts, pending redraw/reopening, rejection,
explicit retry and keyboard focus. Mobile layout was inspected. Synthetic
devices and API replies were used; no Android metadata or physical receiver was
changed. Full qualification passes 2,258 Linux tests with two root-only skips,
all 23 Host Recovery cases and all 111 workspace cases in each browser.
