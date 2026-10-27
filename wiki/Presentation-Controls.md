# Presentation controls

Interrupted conversions retain their original file and recover as rebuildable.
Startup reclaims bounded, recognized private `render-<UUIDv4>` staging before
new conversion work begins. It preserves published assets, unknown files and
linked/unsafe entries; a cleanup warning calls for inspection rather than a
blind directory deletion. See the repository application-lifecycle contract for
the cleanup limits. Existing presentation controls and receiver behavior remain.

Previous, Next, Go and thumbnails can preview a selected deck before Start.
Previewing sets the starting slide without changing classroom displays. Selecting
another deck while one is live permits previewing that deck independently.

Start clears existing text, titles, timers and media on its selected TVs before
showing the slide. Other TVs keep their content; slide navigation does not blank
between slides. Morning Announcements retain priority and silent slides leave
Background Music alone. Scheduled automation remains independent; pause it when
needed to prevent a scheduled content change during a presentation.

See [Presentation controls](../docs/PRESENTATION-CONTROLS.md) for implementation,
validation and deployment details.
