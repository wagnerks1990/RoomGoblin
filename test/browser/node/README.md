# Chess browser test runtime

This private package pins test-only Playwright to the same version as
`../requirements.txt`. It is not an application dependency or an exported SCORM
asset. Commit both manifests when deliberately updating that reviewed pin.

From the repository root, install application dependencies and this isolated
runtime with `npm ci --ignore-scripts` and
`npm ci --prefix test/browser/node --ignore-scripts`. Install the bundled Chromium
using `node test/browser/node/node_modules/playwright/cli.js install chromium`
(`--with-deps` on a supported Linux runner).

Set `CHESS_TEST_BROWSER=chromium` and `NODE_PATH` to the absolute
`test/browser/node/node_modules` directory before running the ten scripts listed
in `.github/workflows/display-browser.yml`. The workflow runs them sequentially
so multiple synthetic 3D scenes do not compete for software-renderer resources.
The 3D fixtures explicitly use SwiftShader; production rendering and security
policies are unchanged.

The `chess-browser` job belongs to the existing **Display browser regression**
workflow, whose successful completion is already required by image publication.
A browser test failure therefore prevents that workflow from succeeding.
