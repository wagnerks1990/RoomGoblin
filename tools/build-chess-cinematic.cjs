'use strict';
// Install the exact renderer outside the checkout; this never changes manifests.
const fs = require('node:fs');
const path = require('node:path');
function patchThreeUUID(source) {
  const pattern = /function generateUUID\(\) \{[\s\S]*?\n\}/g;
  const functions = source.match(pattern);
  if (functions?.length !== 1) throw Error('Expected one reviewed Three.js generateUUID function');
  const entropy = /\tconst d0 = Math\.random\(\) \* 0xffffffff \| 0;\r?\n\tconst d1 = Math\.random\(\) \* 0xffffffff \| 0;\r?\n\tconst d2 = Math\.random\(\) \* 0xffffffff \| 0;\r?\n\tconst d3 = Math\.random\(\) \* 0xffffffff \| 0;/;
  if (!entropy.test(functions[0])) throw Error('Three.js UUID implementation changed; review the entropy patch');
  const patched = functions[0].replace(entropy, '\tconst random = globalThis.crypto.getRandomValues(new Uint32Array(4));\n\tconst d0 = random[0], d1 = random[1], d2 = random[2], d3 = random[3];');
  return source.replace(functions[0], patched);
}
async function build() {
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const dependencies = process.argv[2];
if (!dependencies) throw Error('Usage: node tools/build-chess-cinematic.cjs /absolute/temporary/dependency-prefix');
const threeRoot = path.join(path.resolve(dependencies), 'node_modules', 'three');
if (JSON.parse(fs.readFileSync(path.join(threeRoot, 'package.json'), 'utf8')).version !== '0.187.0') throw Error('Expected exactly three@0.187.0');
const out = path.join(root, 'public/learn/chess/cinematic');
await esbuild.build({
  entryPoints: [path.join(out, 'source.mjs')], outfile: path.join(out, 'view.mjs'),
  bundle: true, format: 'esm', platform: 'browser', target: ['es2020'], minify: true,
  legalComments: 'inline', charset: 'utf8',
  // Patch in memory only: retain pinned upstream files and all UUID formatting.
  plugins: [{ name: 'three-secure-uuid', setup(build) {
    build.onLoad({ filter: /[\\/]three\.core\.js$/ }, args => {
      if (path.resolve(args.path) !== path.join(threeRoot, 'build/three.core.js')) throw Error('Unexpected Three.js core input');
      return { contents: patchThreeUUID(fs.readFileSync(args.path, 'utf8')), loader: 'js' };
    });
  } }],
  alias: { 'three/addons/utils/BufferGeometryUtils.js': path.join(threeRoot,'examples/jsm/utils/BufferGeometryUtils.js'),three: path.join(threeRoot, 'build/three.module.js') },
  banner: { js: '/* RoomGoblin procedural cinematic prototype. Bundled Three.js 0.187.0, MIT; see THREE-LICENSE.txt and NOTICE.txt. */' }
});
fs.copyFileSync(path.join(threeRoot, 'LICENSE'), path.join(out, 'THREE-LICENSE.txt'));
// Normalize insignificant shader indentation retained inside bundled templates.
const bundle=path.join(out,'view.mjs');
fs.writeFileSync(bundle,fs.readFileSync(bundle,'utf8').replace(/[\t ]+$/gm,'').replace(/^ +(?=\t)/gm,''));
console.log('Built local cinematic/view.mjs with Three.js 0.187.0.');
}
module.exports = { patchThreeUUID };
if (require.main === module) build().catch(error => { console.error(error.message); process.exitCode = 1; });
