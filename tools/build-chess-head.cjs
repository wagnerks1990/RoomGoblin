'use strict';
// Offline geometry derivation only. Never executes the input or fetches a URL.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const expected='8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c';
if(!process.argv[2])throw Error('Usage: node tools/build-chess-head.cjs /absolute/path/to/verified-MakeHuman-base.obj');
const bytes=fs.readFileSync(process.argv[2]);
if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('The model does not match the reviewed CC0 source.');
const source=bytes.toString('utf8');if(!source.slice(0,1500).includes('explicitly released as CC0'))throw Error('CC0 source header missing.');
const vertices=[],triangles=[];let group='';
for(const line of source.split(/\r?\n/)){
 if(line.startsWith('v '))vertices.push(line.slice(2).trim().split(/\s+/).map(Number));
 else if(line.startsWith('g '))group=line.slice(2).trim();
 else if(group==='body'&&line.startsWith('f ')){
  const face=line.slice(2).trim().split(/\s+/).map(token=>Number(token.split('/')[0])-1);
  if(face.every(i=>vertices[i][1]>5.85))for(let j=1;j<face.length-1;j++)triangles.push([face[0],face[j+1],face[j]]);
 }
}
const ids=[...new Set(triangles.flat())],indices=new Map(ids.map((id,i)=>[id,i]));
const positions=ids.flatMap(id=>[vertices[id][0]*0.12,(vertices[id][1]-5.85)*0.12,-(vertices[id][2]-0.5)*0.12].map(n=>Math.round(n*100000)/100000));
if(ids.length!==4286||triangles.length!==8524)throw Error('Unexpected head geometry.');
const output=path.resolve(__dirname,'../public/learn/chess/cinematic/assets/stone-head.mjs');
fs.writeFileSync(output,'// CC0 MakeHuman hm08 head/neck derivative; see MAKEHUMAN-NOTICE.txt.\nexport const HEAD_POSITIONS = new Float32Array('+JSON.stringify(positions)+');\nexport const HEAD_INDICES = new Uint16Array('+JSON.stringify(triangles.flatMap(triangle=>triangle.map(i=>indices.get(i))))+');\n');
console.log('Derived reviewed CC0 head/neck only: 4286 vertices, 8524 triangles.');
