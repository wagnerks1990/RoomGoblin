# Media conversion, deletion and upload cleanup ownership

Baseline: `c338c4de005128141b41ba24ccad1ed9c6e568a1`.

## RG-MEDIA-007: A deleted document could publish a late PDF

The actual convert/delete handlers reproduced a generated PDF appearing after
the original document was deleted. Registration, manual conversion, deletion
and upload replay now share per-file operation ownership. A queued delete
removes the conversion's actual PDF; other files continue independently.

Library changes merge into the latest snapshot, with persistence before cache
publication. Converter failure preserves the prior PDF and reports its error.
A failed final save stays visible without publishing an uncommitted ready state.
Deletion followed by database failure can leave missing bytes and old metadata;
the error remains visible and an explicit deletion retry can reconcile it.

Before deleting upload-linked media, save a private deletion marker bound to
session, filename and digest. Marker persistence failure prevents deletion.
This synchronous step does not wait for the session lock while holding the
file owner. Completion rechecks retirement at admission, after replay waits,
before file publication and before receipt completion, including the window
between library commitment and receipt publication.

Retirement also reclaims retry chunks after saving the marker. A local legacy
assembly reproduction succeeded when those chunks remained; removing them
prevents an older runtime from assembling deleted content after rollback.
Quota is released only after that reclamation is recorded. A cleanup failure
remains visible and prevents the library's source/PDF deletion from proceeding.

A local injection removing only the final publication guard reproduced a stale
metadata overwrite during reassembly (HTTP 200 instead of 410). The guarded case
passes. No repository source or production state was modified by that injection.

Assembly discards an unregistered output inside the session owner, before a
queued retry can assemble. Cleanup also takes the file owner and preserves
committed media after conversion, receipt or persistence failures. Legacy
multipart cleanup follows the same preservation rule.

Conversion/deletion share a 30-per-minute accepted-caller budget. Legacy
multipart upload shares the existing 12-per-minute completion budget before
file parsing. Rejected callers cannot consume those budgets. Chunk/status/cancel
paths stay separate. Returned handler promises retain queued operations through
shutdown and Full Recovery writer draining.

## Validation

Thirty new cases cover conversion/deletion ordering, unrelated progress,
prior PDF preservation, persistence failures, retirement failure windows,
cleanup/retry ownership, multipart preservation and real HTTP quotas.
Inherited upload and content-permission assertions remain in place. The final
supported Linux snapshot passes 1,771 tests, zero failures and two root-only
skips (1,773 total), plus all 23 Host Recovery tests and Node/controller,
Python and Bash checks. This run includes the final retirement guard and
rollback chunk cleanup. Checked GitHub delivery remains pending.

Temporary files and controlled converters establish operation ownership, not
LibreOffice rendering quality or physical playback. Cancellation outcome wording,
document-card dispatch and the broader presentation review remain open.
