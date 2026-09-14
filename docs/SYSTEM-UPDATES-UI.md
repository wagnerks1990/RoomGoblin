# System updates workspace

RoomGoblin presents its existing semantic-release updater with the same deployment-first operator hierarchy used by LabGoblin while retaining RoomGoblin's appliance-specific update contract.

## Operator layout

The **Update RoomGoblin** disclosure is enhanced at runtime by `public/controller/workspace.js` into a **System updates** workspace with:

1. **Deployment** — trusted repository, current version, available release, rollback-point availability, and the existing Check GitHub / Install Available Release / Revert Last Upgrade controls.
2. **Update status** — the existing raw updater status output, retained in a collapsible diagnostic section.
3. **Automatic update settings** — the existing repository/channel/token/check-interval/maintenance-window settings and automatic-install opt-in, with Save Settings and Clear Stored Token preserved.
4. **Latest operation & history** — the existing updater history table.

The workspace summary parses only already-rendered updater status text. If a version cannot be safely derived from that text, the summary says **See update status** rather than inventing state.

## Behavioral boundary

This redesign is presentation-only. It must not change:

- semantic-version GitHub release selection;
- trusted repository restrictions;
- release-channel approval logic;
- optional GitHub read-token handling;
- automatic-update opt-in or maintenance windows;
- operational backup creation;
- health-gated deployment;
- automatic source/database rollback;
- manual **Revert Last Upgrade** behavior;
- updater service ownership or Host Agent serialization.

Existing controller element IDs and inline handlers remain intact and are moved, not replaced. `public/controller/app.js` and the updater service remain authoritative for state and mutations.

## Compatibility and accessibility

The enhancement uses existing native `details`/`summary` controls for status, settings, and history. It is scoped to the operator workspace stylesheet and does not load into physical display rendering.

At phone widths, deployment details and settings collapse to one column and action buttons wrap. Destructive rollback remains visually separated and continues to use its existing confirmation behavior.

If the update controls are absent, renamed, or unauthorized, the enhancement returns without altering the page. This fail-soft behavior preserves the legacy updater UI rather than breaking administration access.

## Verification

Before merging changes to this workspace:

```bash
npm run check
npm test
```

Also verify in a browser that:

- current and available versions follow the updater output;
- Install remains disabled when no approved release is available;
- Revert remains disabled when no rollback point exists;
- changing automatic-update settings still saves through the existing handler;
- clearing a stored token still uses the existing handler;
- history redraws after updater polling do not destroy the new layout;
- desktop and phone layouts remain usable;
- Morning Announcements, scheduler recovery, Background Music reconciliation, display rendering, and managed-device behavior are untouched.
