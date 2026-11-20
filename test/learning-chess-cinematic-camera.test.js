'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const camera=import(pathToFileURL(path.resolve(__dirname,'../public/learn/chess/cinematic/camera.mjs')));

test('camera presets and partial controls retain finite bounded settings',async()=>{
 const {cameraView}=await camera;
 const custom=cameraView(cameraView(),{orbit:45,tilt:65,zoom:1.2});
 assert.deepEqual(cameraView(custom,{zoom:1.4}),{preset:'angled',orbit:45,tilt:65,zoom:1.4});
 assert.deepEqual(cameraView(custom,{preset:'overhead'}),{preset:'overhead',orbit:0,tilt:88,zoom:1});
 assert.deepEqual(cameraView(custom,{preset:'player'}),{preset:'player',orbit:0,tilt:38,zoom:1});
 assert.deepEqual(cameraView(custom,{preset:'unknown',orbit:Infinity,tilt:NaN,zoom:'1'}),custom);
 assert.deepEqual(cameraView({}, {orbit:999,tilt:-10,zoom:12}),{preset:'angled',orbit:180,tilt:25,zoom:1.6});
});

test('camera orientation mirrors the players without changing zoom or tilt',async()=>{
 const {cameraView,cameraPose}=await camera;
 const view=cameraView({}, {orbit:35,tilt:62,zoom:1.1}),white=cameraPose(view,'white'),black=cameraPose(view,'black');
 assert.ok(Math.abs(white.position.x+black.position.x)<1e-10);
 assert.ok(Math.abs(white.position.z+black.position.z)<1e-10);
 assert.ok(Math.abs(white.position.y-black.position.y)<1e-10);
 assert.deepEqual(white.target,black.target);
});

test('default fit contains board and tall pieces at every preset, orbit and supported aspect',async()=>{
 const {cameraView,cameraPose}=await camera;
 for(const preset of ['angled','overhead','player'])for(const orbit of [-180,-90,-35,0,65,180])for(const aspect of [0.3,0.6,1,1.8,4]){
  const view=cameraView({}, {preset,orbit}),pose=cameraPose(view,'white',aspect),yaw=orbit*Math.PI/180,elevation=view.tilt*Math.PI/180;
  const distance=Math.hypot(pose.position.x,pose.position.y-0.15,pose.position.z),v=Math.tan(39*Math.PI/360),h=v*aspect;
  for(const x of [-4.4,4.4])for(const y of [-0.45,2.15])for(const z of [-4.4,4.4]){
   const up=-x*Math.sin(elevation)*Math.sin(yaw)+(y-0.15)*Math.cos(elevation)-z*Math.sin(elevation)*Math.cos(yaw);
   const right=x*Math.cos(yaw)-z*Math.sin(yaw),depth=distance-(x*Math.sin(yaw)*Math.cos(elevation)+(y-0.15)*Math.sin(elevation)+z*Math.cos(yaw)*Math.cos(elevation));
   assert.ok(Math.abs(up/depth/v)<1);assert.ok(Math.abs(right/depth/h)<1);
  }
 }
});
