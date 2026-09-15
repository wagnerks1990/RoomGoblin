# Room topology documentation sync

This note records the documentation-only synchronization that followed the dynamic room-topology merge.

Updated documentation now consistently states that:

- physical TVs, content displays, content sources, and lighting are separate target domains;
- Setup and Displays & AV edit the same SQLite-backed canonical topology;
- classes and display actions remain content-display scoped;
- TV power uses physical-TV inventory;
- stale removed/disabled target IDs fail closed until remapped;
- Pluto's current 8×8 matrix is adapter-specific rather than the application-wide device count;
- production updates use the validated published update path rather than an unconditional `main` pull;
- focused AI context and Wiki navigation include the room-topology contract.

This file contains no site-specific deployment data.
