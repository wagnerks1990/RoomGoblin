const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const layoutPath = path.join(root, 'public', 'display', 'layout.mjs');
const indexPath = path.join(root, 'public', 'display', 'index.html');

test('display renderer uses dynamic content-object layout', async () => {
  const layout = await import(pathToFileURL(layoutPath).href + `?t=${Date.now()}`);
  assert.equal(layout.LAYOUT_REVISION, 'dynamic-fit-20260922-10');
  assert.deepEqual(layout.FONT_CAPS, { title: 220, subtitle: 140, body: 180, timer: 180 });

  const source = fs.readFileSync(layoutPath, 'utf8');
  assert.match(source, /function allocateHeights\(items, availableHeight\)/,
    'active objects must share the available stage dynamically');
  assert.match(source, /items\.map\(item => item\.name\)/,
    'diagnostics must expose dynamic object order');
  assert.match(source, /bodyIndex >= 0/,
    'body content should receive otherwise unused vertical space');
  assert.doesNotMatch(source, /titleTop = 30, bodyTop = 270, bodyEnd = 975/,
    'fixed title/body bands must not return');
  assert.match(source, /const HORIZONTAL_GUTTER = 18/);
  assert.match(source, /title\.style\.whiteSpace = 'nowrap'/,
    'title should stay on one line and shrink horizontally instead of wrapping');
  assert.match(source, /subtitle\.style\.whiteSpace = 'nowrap'/,
    'subtitle should use the same single-line edge-to-edge fitting');
  assert.match(source, /text\.style\.padding = '0'/,
    'body content should get the full dynamic object width');
  assert.match(source, /item\.el\.style\.fontSize = \`\$\{item\.cap\}px\`/,
    'every pass must reset active objects to canonical cap geometry before estimating heights');
  assert.match(source, /deterministicDesiredHeight\(item\.name, item\.configuredSize, item\.minHeight\)/,
    'region allocation must depend only on configured state, not prior DOM geometry');
  assert.match(source, /function hardFontCeiling\(el, box, requestedCap\)/,
    'every fitted element must receive a browser-independent mathematical ceiling');
  assert.match(source, /el\?\.id === 'title' \|\| el\?\.id === 'subtitle'/,
    'single-line headings must have an intrinsic-width ceiling');
  assert.match(source, /a\.height - \(border \* 2\)\) \/ 1\.98/,
    'timer must have a conservative two-line vertical ceiling');
});

test('auto-fit can grow to component caps while manual sizing remains a ceiling', () => {
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert.match(source, /autoFit === false \? configured : globalCap/,
    'automatic sizing must use the dynamic component cap');
  assert.match(source, /componentCap\(titleOpts\.size,92,FONT_CAPS\.title,titleOpts\.autoFit!==false\)/);
  assert.match(source, /componentCap\(textOpts\.size,64,FONT_CAPS\.body,textOpts\.autoFit!==false\)/);
});

test('configured font size can never override hard rendered containment', () => {
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert.match(source, /function naturalSize\(el, box, fontSize = null, unconstrainedWidth = false\)/,
    'fitter must independently measure unclipped natural wrapping geometry');
  assert.match(source, /unconstrainedWidth \? true|if \(unconstrainedWidth\)/,
    'single-line natural sizing must measure intrinsic width rather than current fitted width');
  assert.match(source, /padding:el\.style\.padding \|\| computed\.padding/,
    'relative timer padding must be measured from authored em units, not stale fitted pixels');
  assert.match(source, /function renderedContained\(el, box\)/);
  assert.match(source, /range\.getClientRects\(\)/,
    'fitter must validate actual painted text rectangles, not only scroll metrics');
  assert.match(source, /natural\.height > a\.height \+ 0\.5/,
    'natural wrapped height must participate in hard containment');
  assert.match(source, /while \(!fits\(el, box\) && fontSize > 1/,
    'fitter must continue shrinking when browser rounding still leaves overflow');
  assert.match(source, /while \(!renderedContained\(el, box\) && scale > 0\.05/,
    'pathological content must remain bounded after fallback scaling');
});

test('containment-critical styles are enforced by the layout owner', () => {
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert.match(source, /function establishStructuralStyles\(nodes\)/);
  assert.match(source, /el\.style\.maxHeight = 'none'/,
    'a stale stylesheet must not leave fitted children height-constrained');
  assert.match(source, /el\.style\.flex = '0 0 auto'/,
    'a stale stylesheet must not let flexbox compress overflowing text');
  assert.match(source, /timerOverlay\.style/,
    'timer geometry must also survive a missing companion stylesheet');
});

test('timer overlay remains a compact dynamic object', () => {
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert.match(source, /width:'max-content'/,
    'timer must wrap its content instead of stretching across the receiver');
  assert.doesNotMatch(source, /timerOverlay\.style\.width = '100%'/,
    'full-width timer chrome is the regression this test prevents');
});

test('receiver cache key and build identity are release-stamped at image build', () => {
  const source = fs.readFileSync(indexPath, 'utf8');
  const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  assert.match(source, /layout\.mjs\?v=dynamic-fit-20260922-10/);
  assert.match(source, /layout\.css\?v=dynamic-fit-20260922-10/);
  assert.match(source, /DISPLAY_BUILD='\d+\.\d+\.\d+-alpha\.\d+'/);
  assert.match(dockerfile,/RELEASE_VERSION="\$\(cat VERSION\)"/);
  assert.ok(dockerfile.includes('public/display/index.html'),
    'display receiver must be stamped from VERSION during the image build');
});


test("timer natural-size probe must clear inherited positional CSS",()=>{
  const source = fs.readFileSync(layoutPath, 'utf8');
  assert.match(source,/right:'auto', bottom:'auto'/);
  assert.match(source,/items\.length === 1 && items\[0\]\.name === 'timer'/);
  assert.match(source,/STAGE_HEIGHT - VERTICAL_MARGIN - height/);
  assert.match(source,/cap:bounded\(timer\.fontSize,64,1,FONT_CAPS\.timer\)/);
});
