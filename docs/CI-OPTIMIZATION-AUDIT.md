# GitHub Actions audit for Codex-assisted development

## October 16 implementation follow-up

The measurements and before/after matrix below describe the October 12 cache-only
snapshot, not the current workflow inventory. PR #236 implements the separately
requested consolidation: six workflows, one native Windows build with all former
artifact/version checks, removal of the obsolete branch patcher and its source
rewriters, and conservative Markdown-only PR selection with fail-closed tests.
Main pushes still perform complete platform/browser/image/security qualification;
publication retains its direct main trigger and exact-SHA three-workflow gate.
See `CI-WORKFLOWS.md` for the current scope policy. New time/resource savings are
not yet measured; do not treat the historical proposals or estimates below as
current execution results.

Audited 2026-10-12 against main `98c7044` (PR #224). Implementation branch:
`ci/preserve-gates-cache-audit`. This audit covers all eight workflow files,
AGENTS.md, SECURITY.md, Dependabot, image/update contracts, live rulesets and
recent Actions jobs/steps. Timing samples and run links are in
[CI-AUDIT-DATA.json](CI-AUDIT-DATA.json).

## Before-and-after workflow matrix

After means the limited cache changes in this PR, not the deferred proposals below.
All triggers, job IDs, tests, permissions, timeouts and publication dependencies
remain identical. Minutes are measured runner elapsed time, not billing claims. Hosted runner CPU/RAM
utilization, cache sizes and account billing were not exposed by the run/job API;
OS, parallel job count, artifacts and elapsed time are the available resource evidence.

| Workflow / jobs | Trigger and classification | Before: median job minutes / resource | After | Dependencies and output |
| --- | --- | --- | --- | --- |
| Validate / `validate` | Every PR and main push; required merge check, publication prerequisite | 6.59; Ubuntu; 40m timeout | Same validation; npm cache key includes both lockfiles | Node 22/npm, Python, Bash, Compose, Docker, .NET cross-build, Android release build, Trivy; two local test images |
| Validate / `windows-agent` | Same; required merge check and part of publication prerequisite | 1.16; Windows; 10m | Same build/parse/contracts; locked NuGet cache | .NET 8, PowerShell, four NuGet locks, VERSION and Dockerfile |
| Validate / `android-agent` | Same; publication qualification | 2.17; Ubuntu; 40m | Unchanged | Runner Java/SDK, Android 37.2/build-tools 36, checksum-verified Gradle 9.6; verified debug APK/checksum, 14-day artifact |
| Display browser regression / `display-browser (chromium)`, `display-browser (firefox)` | Every PR and main push; publication prerequisite, independent browser enforcement | 1.92 / 2.47; two Ubuntu jobs; 15m each | Unchanged | Node/npm, fonts, Python venv, pinned Playwright 1.57, browser/system packages; rendered evidence retained 14 days |
| Security gates / `secrets`, `dependency-review` | PR, main push, manual; dependency review is PR-only; publication prerequisite | 0.16 / 0.12; Ubuntu; 10m each | Unchanged | Full Git history, Gitleaks, GitHub dependency graph; reject new moderate-or-higher dependencies |
| Publish Main Images / `gate`, `build (hub)`, `build (maintenance)`, `promote` | Every main push; automatic image publication and alpha promotion | 6.93 / 3.62 / 4.25 / 0.32; Ubuntu; 45m each | Unchanged | Exact-SHA three-workflow gate → both independent builds/scans/smokes/pushes → serialized alpha promotion if still current main |
| Publish Containers / `preflight`, `release` | Push `v*` tag; release promotion/publication | No comparable current-design successful sample; historical Sept 8 run used four jobs, 4.67 total runner-minutes; current timeouts 45m each | Unchanged | Tag/VERSION/package agreement, main ancestry, three successful main-push workflows, exact published pair → release aliases → GitHub Release |
| Windows Native Agent / `build` | PR/main push filtered to `windows-agent/**`, VERSION, Dockerfile, own workflow; optional separate artifact qualification | 1.88; Windows; 30m; last successful sample Sept 23 | Same build/artifact/version verification; locked NuGet cache | Four native executables, service ProductVersion assertion, downloadable native package |
| Sync Wiki / `sync` | Relevant main paths (`wiki/**`, docs/WIKI-SYNC.md, script, own workflow), manual; documentation publication | 0.12; Ubuntu; 10m | Unchanged | Refresh stale main snapshot, authenticated wiki clone/mirror/push; serialized writes |
| Apply automation convergence hardening / `apply` | Push to `fix/automation-scheduler-reliability`, except recursion-marked commits; development source mutation | Latest Sept 14 failure ran 0.08m; no successful sample in latest 30; Ubuntu; 30m | Unchanged; retirement/manual conversion proposed only | Two Python patch tools, npm/check/focused+full tests, commits/pushes a fixed source branch; contents:write |

Jobs inside Validate and Security run independently; the browser matrix uses
`fail-fast: false`. Publication builds also use `fail-fast: false`. Nothing here
deploys to an appliance. Images nevertheless become available to existing opt-in
appliance update mechanisms; publishing is operationally consequential.

## Live protections and access limits

- Main ruleset 22549718, **Protect main**, is active on the default branch. It
  requires `validate` and `windows-agent` from GitHub Actions integration 15368,
  with strict/up-to-date checks. PRs and resolved review threads are required;
  approving review count is zero. Deletion and non-fast-forward pushes are blocked.
  Copilot review runs on pushes, including draft PRs.
- Repository settings enable merge, squash and rebase, but this ruleset permits
  only squash. This conflicts with AGENTS.md. No settings were changed; any
  correction requires separate explicit authorization.
- Tag ruleset 22559396, **Protect release tags**, protects `refs/tags/v*` against
  deletion, non-fast-forward updates and updates. Listed repository-role/user
  bypass actors remain unchanged; no bypass is used by this PR.
- The effective main rules endpoint confirms the two required check names. The
  classic branch-protection and Actions permissions/default-permissions endpoints
  returned HTTP 403 (`Resource not accessible by integration`). Classic protection,
  repository Actions allowlists/defaults and inaccessible security settings cannot
  be certified from this connection. This is not evidence that they are absent.
- `Display browser regression` and `Security gates` are mandatory publication
  prerequisites by source contract, but are not listed as required merge checks in
  the readable main ruleset. Validate's Android job also contributes to workflow
  success without being individually listed as a required merge context.
- All three full workflows must succeed for the exact main-push SHA before main
  publication. Preserve both workflow `name:` values and merge job/check names.
  No migration or required-check rename is made.

## Exact validation coverage retained

The executable workflow diff adds only cache inputs on existing pinned actions.
No step is removed, reordered, conditionalized or substituted. Nothing that was
tested before becomes untested after this PR.

| Coverage | Before and after |
| --- | --- |
| Canonical source/policy | Required source/docs present; forbidden legacy Veyon/plugin/archive/Caddy surfaces absent |
| Dependency security | Locked root and maintenance `npm ci --ignore-scripts`; both production audits at moderate; PR dependency review moderate; full-history Gitleaks; both Validate runtime images and both exact publication candidates scanned for high/critical fixable vulnerabilities |
| JavaScript/authorization | Complete existing `npm run check`, additional maintenance syntax, full serial `test/*.test.js` suite, including capability/authentication, recovery, signing, installer and publication contracts |
| Python/installer/network | Host compile and full-recovery unittest; all tracked shell files parsed; Compose JSON/network-policy validator |
| Hub packaging | Archive of exact Git HEAD with 0700 directories/0600 files; Docker build; native ESPHome worker tests in runtime image; locked Windows cross-build; built Sendspin bundle; normalization verified as UID:GID 10001:10001 with no network, read-only root, no capabilities/new privileges |
| Appliance behavior | Integration bridge smoke; host-network smoke; release/version stamping; direct-HTTP Compose startup with Host Agent fixture, setup/admin login, completion, restart and normalized user persistence |
| Windows compatibility | Native Windows PowerShell parser over lab-agent scripts; .NET locked native builds; action/stamping contract; separate path-selected workflow verifies nonempty executable set and service ProductVersion and uploads artifacts |
| Android compatibility | Debug build plus package/version/checksum/artifact checks; maintenance Dockerfile separately builds release unsigned APK with bounded dependency retries, package/version checks and metadata checksum; signing trust enforced by existing regression contracts |
| Browser behavior | Both Chromium and Firefox; complete Python browser discovery, receivers, document/PDF behavior and responsive operator workspace regressions; retained rendered evidence |
| Publication/release | Exact-SHA workflow gate; scanned/smoked publication candidates pushed without rebuild; OCI revision checks; complete pair before alpha promotion; current-main stale guard; tag/version/package agreement and main ancestry; verify existing published pair before release aliases/release |

Codex Local, WSL2 and Cloud can run these checks earlier and use failures for
feedback. They do not establish an independently authenticated GitHub check on
the merge/main SHA, scan changing advisory databases at publication time, or
prove native Windows behavior. Independent enforcement stays in GitHub. Physical
AV, real Android devices, interactive Windows sessions, school LAN integrations
and production recovery were not added or claimed as CI coverage.

## Duplicate work versus deliberate independent qualification

1. Both Windows jobs invoke the same four-project build script. The separate
   workflow adds ProductVersion verification and a downloadable artifact; required
   `windows-agent` adds PowerShell/action/stamping checks. The Hub Dockerfile also
   cross-builds the native binaries on Linux. The latter is packaging/platform
   qualification, not equivalent to native Windows validation.
2. Validate and main publication build both Dockerfiles and scan both images.
   Validate deliberately changes source permissions; publication builds a new
   exact labeled candidate. Its scan/smoke is essential because the published
   object is different. Do not simply remove the second scan or push an unscanned
   rebuild. Base images, apt and advisories can change between builds.
3. Android debug and embedded release builds use shared sources but different
   variants/artifact contracts. Keeping both prevents a release-only/debug-only
   failure being hidden.
4. Browser dependencies install twice for isolated engines; tests provide distinct
   engine coverage. Root npm dependencies also install in Validate and Docker
   stages; clean packaging is intentional.
5. `npm run check` already parses maintenance server/extensions before the explicit
   maintenance syntax step; that step additionally parses the APK artifact module.
   The branch-specific patch workflow runs focused scheduler tests and then the
   full suite, which contains those files. These are small/optional duplication
   candidates, not changes implemented here.
6. PR validation and main validation intentionally test different merge results.
   Main-push runs cannot be replaced with a Codex transcript or a green PR run.

## Implemented caching and retained execution policy

- Pinned setup-node v7 already enables npm caching through packageManager metadata.
  Validate now explicitly includes root **and maintenance** lockfiles in its key.
  This is cache correctness/coverage, not a new root-cache speedup. Browser jobs
  retain their existing automatic root npm cache. `node_modules` is never restored;
  every locked install and online audit still runs.
- Both pinned setup-dotnet jobs now cache global NuGet packages using all four
  `windows-agent/**/packages.lock.json` files. Build-Native-Agent.ps1 still calls
  `dotnet restore --locked-mode` and publishes all four binaries. No build outputs,
  executable artifacts, production data, signing keys or tokens enter these caches.
  Source inspection of the exact setup-dotnet SHA verified multi-file glob hashing
  and global-package caching.
- Cache misses and lockfile changes retain normal installs. GitHub's cache scope
  isolates PR-created caches from base-branch consumption. No privilege or secret
  is added; caches are an optimization, never a success signal or signing authority.
  Measure restore/save overhead, storage/eviction and first-run misses before
  claiming a benefit. Rollback is removal of the eight added YAML lines.
- PR-number concurrency already cancels obsolete PR runs for validation, browsers,
  security and optional Windows qualification. Main SHA groups and publishers are
  never cancelled for a newer commit; every merged commit needs its exact pair.
  Wiki and alpha writes remain serialized, with existing stale-main guards.

## Deferred optimization design and proposed removals

These are review proposals only. No workflow is deleted or made optional by this PR.

| Proposal | Safe design / prerequisite | Coverage or behavior that would change if approved |
| --- | --- | --- |
| Remove duplicate optional Windows compilation | First copy ProductVersion/nonempty executable assertions and artifact upload into existing required `windows-agent`; keep its check name, PowerShell parse, build and contracts; validate artifacts on VERSION/native/build-script/workflow changes | Standalone workflow/check would disappear; Windows compilation/assertions stay in required job. Removing it without migration loses explicit ProductVersion/artifact qualification. Deletion requires approval |
| Manual-only legacy patch runner | Retire or dispatch-only `apply-automation-convergence.yml`, still restricted to its intended branch and explicit source mutation | Automatic branch patching/focused tests cease; full independent PR validation remains. Contents-write automation and recursive commits leave the routine development loop. Requires approval for retirement/removal |
| Safe path-based PR selection | Keep required workflows and check-emitting jobs always triggered. An in-job scope decision may select expensive steps only after auditing their complete input graph; all unknown paths, failures/truncation, workflow/tool/test/lockfile/VERSION/Dockerfile/config changes fall back to full coverage. Always full on main/release | Any selection intentionally stops rerunning unaffected platform checks on some PRs. Do not implement until changed-file/delete/rename/fork cases and indirect contracts are tested. Do not classify docs as globally irrelevant: Node contract tests read AGENTS/docs/wiki |
| Browser cache | Cache only Playwright browser downloads by OS/architecture, engine and pinned requirements hash; reinstall OS dependencies/fonts/venv and run all tests; review/pin any added action | No test loss; download avoidance only. Current preparation already takes just 22–26s per engine; caching may cost more than it saves |
| Android dependency/distribution cache | Exact toolchain/OS/lock inputs, checksum revalidation, no signing data/output APK cache, no skipping assemble/verification | No variant loss. SDK/Gradle distribution setup is already small; benchmark dependency caching against the 113.5s debug build |
| Docker dependency-layer cache | Separate scopes for each Dockerfile and restrictive/normal contexts, pull current bases, fresh vulnerability scans, preserve private-context rebuild/permission verification and all runtime smokes | Must show caching cannot bypass the restrictive-mode regression or in-image native-worker tests. Do not add broad layer reuse merely to shorten builds |
| Eliminate publisher's occupied polling runner | A coordinated completion-triggered design must verify all three latest successful **main push** runs for exact SHA, trusted repository/source, main ancestry, explicit exact checkout, terminal reruns, forks, stale SHA and both pair/promote stages; adapt identity-contract tests. Do not elevate PR/workflow_run artifacts blindly | Publication trigger/orchestration changes, not validation coverage. Requires a separately reviewed implementation; current direct trigger was introduced to prevent missing publication |
| Scheduled/manual optional development checks | Move hardware acceptance, diagnostic patch/review jobs or extended exploratory suites to manual/scheduled runs; inventory older branch-only workflows before any retirement | Optional evidence cadence changes. Never schedule-only any existing mandatory browser, security, platform or exact-release gate |

Required-workflow `paths:`/`paths-ignore:` filters can leave required contexts
pending and can starve publication. Job-level skips can turn a full-workflow gate
green without performing qualification. Neither is added. Existing optional
Windows paths and wiki paths are preserved. GitHub's workflow registry also lists
historical branch-only patch/review workflows absent from current main; they are
not silently deleted or counted as current main coverage. Repository-managed
dynamic NuGet submission, Copilot review and AI findings appear in recent history
but are not editable workflow files; they are retained and excluded from the
cache savings estimate.

## Measured usage and expected benefit

Sample: latest ten successful runs per workflow where available, with individual
job/step timestamps from the jobs API (158 run-job responses were inspected, also
including recent failures/cancellations). See the JSON for run IDs, SHAs, attempts,
date range, min/max and step medians. A sum of job medians is not a median run sum.
Current job identities dominate recent Validate/browser/security samples; older
Windows/release observations are explicitly historical.

- Validate median run sum: **9.83 raw runner-minutes**; core job 5.98–7.52m.
  Windows build step median 52.5s, debug APK build 113.5s, private Hub build 73s,
  maintenance build 163.5s, Node regressions 44s, image scans 33s and 38s.
- Browser median sum: **4.35m**. Preparation medians 26s/22s; test medians
  74.5s/115.5s. Security median sum **0.27m**. Wiki **0.12m**.
- Main publisher median sum: **15.25m**, including median **6.93m** occupied gate
  runner (413s polling step). Build medians 3.62m/4.25m and promotion 0.32m.
- Typical PR uses about **14.5 raw runner-minutes** across the three mandatory
  workflows; an eligible standalone Windows run adds ~1.88m. Typical main push
  uses about **29.7m** with publisher/wiki. These are sums of workflow medians,
  not a paired-cohort measurement, and exclude optional/dynamic checks.
- Latest-100 overall run sample (Oct 8–12) contains 14 Validate runs: 4 success,
  6 cancelled, 3 failure, 1 in progress at snapshot; browser 8 success/4 cancelled/
  2 failure; security 12 success/2 failure. Cancellation is already materially
  active. Empty-job failures cannot be diagnosed as test failures from job data;
  one Validate failure explicitly occurred in Node regressions. Preserve enforcement.
- Implemented caches: a planning band of **0–20s saved per Windows build** on warm
  caches (unmeasured), at most ~0.33 raw runner-minute per routine PR/main run,
  plus the same on a separately triggered Windows job. That is roughly **0–2.3%**
  of the typical PR subtotal, potentially zero/negative on cold caches. npm
  maintenance installs already take ~1s, root ~2s; no substantial Linux critical
  path improvement is expected. Per 100 routine events, plan for **0–33 raw
  runner-minutes**, not a guaranteed billing reduction. Public repository visibility
  and unavailable billing settings preclude a dollar-savings claim.
- Deferred duplicate Windows migration could save ~1.88m per eligible event
  minus moved artifact/assertion overhead. Deferred runner-free publisher gating
  could save ~6.93m per main push, about 23% of the estimated main subtotal.
  Neither saving belongs to this PR. Browser/Android/Docker caches require actual
  warm/cold measurements; execution time is dominated by retained builds/tests.

## Security and publishing findings retained for review

All third-party actions are SHA-pinned. Validation/security/browser/Windows tokens
are contents-read; dependency review cannot write PR source. The branch patcher
and wiki intentionally have contents-write. Main publisher has contents/actions/
checks-read and packages-write; release creation has contents-write. No new token,
untrusted privileged trigger, environment approval or deployment branch is added.
Gitleaks keeps full checkout and no persisted credentials; dependency review keeps
moderate severity. Audits remain online even with package caches.

Main automatically publishes canonical and legacy SHA images and updates `alpha`
only for current main. Tag pushes promote canonical/legacy release aliases and
create a GitHub release after preflight; wiki changes publish documentation.
The legacy branch patcher pushes source to its fixed development branch. None
contains an appliance deployment command. Pair promotion uses sequential registry
operations, so partial registry failure can leave some aliases updated; existing
installers' exact pair/revision validation remains essential.

Existing docs claim SBOM/provenance publication, but the current build step uses
`load: true`, then `docker push`, without explicit `sbom`/`provenance` configuration.
Explicit attestation production/preservation is not established by these files.
The release trigger matches `v*`, while preflight checks equality with VERSION
rather than an explicit semver parser. These are retained review findings, not
removed release protections or newly claimed guarantees. No images were published,
tags created, protections changed, workflows deleted, or deployment performed.
The tracked wiki mirror is updated for review; live Wiki synchronization is deferred
to avoid publishing unmerged documentation. Its existing main-triggered sync remains.

## Validation evidence

Local results: actionlint 1.7.12 and all eight YAML parses pass; 39 focused
publication/security/browser contracts pass; all 747 Node tests pass with umask
0022; 19 Host Agent recovery tests, Python compilation, npm syntax/controller
checks, all tracked Bash syntax and Compose network validation pass. The first
Node run under inherited cloud umask 0077 had two file-mode fixture failures;
these are recorded rather than hidden. Unmodified Hub and maintenance Docker
build attempts failed on proxy certificate trust (pip and curl, respectively),
so local image builds/smokes are not certified. No TLS verification was disabled.
Native Windows, Android and image qualification remain enforced by unchanged
GitHub workflows.

Structural
comparison removes only the cache inputs and then requires parsed workflow equality
against baseline; that checks exact steps, triggers, job IDs, permissions and needs.
YAML parsing, actionlint, lockfile paths, required check identities and both
publication dependency graphs are checked. Existing publication/security contract
regressions run independently. Hosted Windows/cache execution remains a separate
GitHub check; local Linux validation cannot certify it.
