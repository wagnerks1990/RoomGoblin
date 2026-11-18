'use strict';
// Install the exact renderer outside the checkout; this never changes manifests.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const dependencies = process.argv[2];
if (!dependencies) throw Error('Usage: node tools/build-chess-cinematic.cjs /absolute/temporary/dependency-prefix');
const threeRoot = path.join(path.resolve(dependencies), 'node_modules', 'three');
if (JSON.parse(fs.readFileSync(path.join(threeRoot, 'package.json'), 'utf8')).version !== '0.187.0') throw Error('Expected exactly three@0.187.0');
const out = path.join(root, 'public/learn/chess/cinematic');
esbuild.buildSync({
  entryPoints: [path.join(out, 'source.mjs')], outfile: path.join(out, 'view.mjs'),
  bundle: true, format: 'esm', platform: 'browser', target: ['es2020'], minify: true,
  legalComments: 'inline', charset: 'utf8',
  alias: { 'three/addons/utils/BufferGeometryUtils.js': path.join(threeRoot,'examples/jsm/utils/BufferGeometryUtils.js'),three: path.join(threeRoot, 'build/three.module.js') },
  banner: { js: '/* RoomGoblin procedural cinematic prototype. Bundled Three.js 0.187.0, MIT; see THREE-LICENSE.txt and NOTICE.txt. */' }
});
fs.copyFileSync(path.join(threeRoot, 'LICENSE'), path.join(out, 'THREE-LICENSE.txt'));
// Normalize insignificant shader indentation retained inside bundled templates.
const bundle=path.join(out,'view.mjs');
fs.writeFileSync(bundle,fs.readFileSync(bundle,'utf8').replace(/[\t ]+$/gm,'').replace(/^ +(?=\t)/gm,''));
console.log('Built local cinematic/view.mjs with Three.js 0.187.0.');
