# Matrix restoration validation checklist

- No room topology editor, script loader, target override or ordering observer.
- Matrix retains eight Pluto ports even with fewer content receivers.
- Original receiver count and stable IDs are visible in Setup.
- Mapped TV renames preserve receiver IDs, fields, groups and credentials.
- Unmapped output renames persist labels without inventing receivers.
- Source names/endpoint IDs survive reload; failures remain visible and retryable.
- An unchanged refresh preserves routing button identity and open drawer drafts.
- Normal configuration GETs do not write or expose archived topology.
- Old topology saves return 409 without altering configuration, including mixed payloads.
- Archived topology is preserved byte-for-byte for backup/recovery.
- Morning Announcements, scheduler recovery, Background Music, Android identity
  and ADB trust remain unchanged.
- Test actual hardware routing/audio separately; browser fixtures are not proof
  of live integration health.
