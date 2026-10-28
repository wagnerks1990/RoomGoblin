# Ubuntu repair admission and announcement priority

RG-LAB-024 reproduces seven failures with the real manager and a gated synthetic
transport: repair can overlap an existing owner, admit an announcement-locked
computer, configure after announcements start during installation, overlook new
or previous receiver targets, configure after Full Recovery admission closes,
and share its initial probe with another command. The failed-probe identity and
release control passes on the original source.

Repair now reserves an existing computer before probing and rejects an existing
owner without releasing that owner's reservation. Failure before installation
releases its own reservation. The union of previous and selected screens is
checked against announcement priority before installation and before final
configuration. Full Recovery/shutdown admission is checked again before that
configuration write. A job interrupted at this stage reports attention; no
accepted installer operation is retried or claimed to have been rolled back.

All eight cases pass, as do the related repair/configuration/manager tests. The
Windows focused run has one Linux-only native skip. Supported Linux qualification
passes 2,249 tests with two root-only skips and all 23 Host Recovery cases, plus
syntax/controller/shell checks. Browser code is unchanged from the wizard's 109
workspace passes per engine. No native helper package changed, no SSH connection
was made, and no
physical screen or active announcement was controlled during validation.
