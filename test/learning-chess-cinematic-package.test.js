'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const AdmZip=require('adm-zip');
const {createChessPackage}=require('../src/learning-chess-package');
test('exported cinematic bundle retains model licenses and every asset in its manifest',()=>{
 const zip=new AdmZip(createChessPackage({id:'synthetic-cinema',title:'Chess & learning'},{origin:'https://synthetic.example',enrollmentKey:'synthetic-only'},path.join(__dirname,'../public/learn')));
 const manifest=zip.readAsText('imsmanifest.xml');
 for(const entry of zip.getEntries())if(!entry.isDirectory&&entry.entryName!=='imsmanifest.xml')assert.ok(manifest.includes('<file href="'+entry.entryName+'"/>'),entry.entryName);
 assert.match(zip.readAsText('cinematic/NOTICE.txt'),/MakeHuman/);
 assert.match(zip.readAsText('cinematic/assets/MAKEHUMAN-NOTICE.txt'),/8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c/);
 assert.match(zip.readAsText('cinematic/assets/MAKEHUMAN-CC0.txt'),/CC0/);
 assert.ok(zip.getEntry('cinematic/view.mjs'));
 assert.ok(zip.getEntry('coach.js'));
 assert.ok(!zip.getEntry('cinematic/assets/stone-head.mjs'),'source model data is already bundled, not separately requested');
 assert.match(manifest,/identifier="RG-CHESS-synthetic-cinema"/);
});
