'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{webcrypto}=require('node:crypto');
const {patchThreeUUID}=require('../tools/build-chess-cinematic.cjs');
const fixture=`const _lut = Array.from({length:256},(_,i)=>i.toString(16).padStart(2,'0'));
function generateUUID() {
\tconst d0 = Math.random() * 0xffffffff | 0;
\tconst d1 = Math.random() * 0xffffffff | 0;
\tconst d2 = Math.random() * 0xffffffff | 0;
\tconst d3 = Math.random() * 0xffffffff | 0;
 const uuid = _lut[d0&255]+_lut[d0>>8&255]+_lut[d0>>16&255]+_lut[d0>>24&255]+'-'+_lut[d1&255]+_lut[d1>>8&255]+'-'+_lut[d1>>16&15|64]+_lut[d1>>24&255]+'-'+_lut[d2&63|128]+_lut[d2>>8&255]+'-'+_lut[d2>>16&255]+_lut[d2>>24&255]+_lut[d3&255]+_lut[d3>>8&255]+_lut[d3>>16&255]+_lut[d3>>24&255];
 return uuid.toLowerCase();
}`;
test('reviewed UUID entropy patch preserves formatting and requires Web Crypto',()=>{
 const patched=patchThreeUUID(fixture);assert.doesNotMatch(patched,/Math.random/);assert.equal(patched.slice(patched.indexOf(' const uuid')),fixture.slice(fixture.indexOf(' const uuid')));
 const context=vm.createContext({crypto:webcrypto});vm.runInContext(patched,context);const ids=new Set();for(let i=0;i<1000;i++){const id=vm.runInContext('generateUUID()',context);assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);ids.add(id);}assert.equal(ids.size,1000);
 assert.throws(()=>vm.runInNewContext(patched+';generateUUID()',{}));
});
test('UUID build patch fails closed on upstream drift or duplicate definitions',()=>{
 assert.throws(()=>patchThreeUUID(fixture.replace('0xffffffff','0xfffffffe')),/changed/);assert.throws(()=>patchThreeUUID(fixture+fixture),/one reviewed/);assert.throws(()=>patchThreeUUID(''),/one reviewed/);
});
test('committed renderer includes secure UUID entropy and derivative notice',()=>{
 const root=path.join(__dirname,'../public/learn/chess/cinematic');assert.match(fs.readFileSync(path.join(root,'view.mjs'),'utf8'),/getRandomValues\(new Uint32Array\(4\)\)/);assert.match(fs.readFileSync(path.join(root,'NOTICE.txt'),'utf8'),/internal generateUUID entropy/);assert.match(fs.readFileSync(path.join(root,'THREE-LICENSE.txt'),'utf8'),/Permission is hereby granted/);
});
