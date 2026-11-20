'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const motion=import(pathToFileURL(path.resolve(__dirname,'../public/learn/chess/cinematic/animation.mjs')));
test('humanoid walking reaches the same planted legs from different sculpted rest stances',async()=>{
 const {createChoreography}=await motion,options={from:{x:0,z:0},to:{x:0,z:-2},kind:'p'};
 const a=createChoreography({...options,legRest:{hips:[0,0],knees:[0,0]}}),b=createChoreography({...options,legRest:{hips:[0.35,0.35],knees:[-0.65,-0.65]}});
 const first=a.sample(a.duration*0.47).attacker.action,second=b.sample(b.duration*0.47).attacker.action;
 assert.ok(first.footLevel>0.99);for(let i=0;i<2;i++){assert.ok(Math.abs(first.joints[i]-(second.joints[i]+0.35))<1e-9);assert.ok(Math.abs(first.lower[i]-(second.lower[i]-0.65))<1e-9);}
 assert.equal(a.sample(a.duration).attacker.action.footLevel,0);
});

test('all six cinematic forms stay finite and settle on the confirmed destination',async()=>{
 const {createChoreography}=await motion;let samples=0;
 for(const kind of 'pnbrqk')for(const defenderKind of 'pnbrqk')for(const capture of [false,true]){
  const scene=createChoreography({from:{x:-3.5,z:3.5},to:{x:2.5,z:-1.5},baseYaw:0,defenderYaw:Math.PI,kind,defenderKind,capture});
  for(let i=0;i<=200;i++){
   const frame=scene.sample(scene.duration*i/200);samples++;assert.ok(Math.hypot(frame.camera.x,frame.camera.y,frame.camera.z)<0.06);
   for(const actor of [frame.attacker,frame.defender].filter(Boolean)){
    for(const value of [...Object.values(actor.position),...Object.values(actor.rotation),...Object.values(actor.action).flat()])assert.equal(Number.isFinite(value),true);
    assert.ok(actor.scale>=0&&actor.scale<=1);
   }
   if(kind==='r')assert.ok(frame.attacker.action.joints.every(angle=>Math.abs(angle)<1e-9),'fortress must not use humanoid limb gait');
  }
  const final=scene.sample(scene.duration);assert.equal(final.finished,true);assert.deepEqual(final.attacker.position,{x:2.5,y:0,z:-1.5});
 }
 assert.equal(samples,14472);
});

test('planted-step IK solves reachable foot targets without changing bone lengths',async()=>{
 const {solveLegIK}=await motion;
 for(const forward of [-0.15,0,0.15])for(const height of [0.36,0.44,0.49]){
  const angles=solveLegIK(forward,height),z=-0.26*Math.sin(angles.hip)-0.26*Math.sin(angles.hip+angles.knee),y=0.26*Math.cos(angles.hip)+0.26*Math.cos(angles.hip+angles.knee);
  assert.ok(Math.abs(z+forward)<1e-8);assert.ok(Math.abs(y-height)<1e-8);
 }
});

test('horse, fast, reduced-motion and en-passant presentation retain their distinct contracts',async()=>{
 const {createChoreography}=await motion;
 const horse=createChoreography({from:{x:0,z:0},to:{x:1,z:0},capture:true,kind:'n'});assert.ok(horse.sample(horse.duration*0.72).attacker.action.lift>0.1);
 const fast=createChoreography({capture:true,fast:true});assert.ok(fast.duration<=1000);
 assert.equal(createChoreography({reduced:true}).sample(0).finished,true);
 const ep=createChoreography({from:{x:1,z:0},to:{x:0,z:-1},defenderFrom:{x:0,z:0},capture:true});
 assert.equal(ep.sample(0).defender.position.z,0);assert.deepEqual(ep.sample(ep.duration).attacker.position,{x:0,y:0,z:-1});
});

test('optional battle camera returns to overview and cleanup preserves rest poses',async()=>{
 const {advanceCinema}=await motion,vec=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});},copy(p){this.set(p.x,p.y,p.z);}}),joint=()=>({rotation:vec(),userData:{lower:{rotation:vec()}}});
 const mesh=token=>({position:vec(),rotation:vec(),scale:{setScalar(v){this.value=v;}},userData:{token,baseScale:1,baseYaw:0,restJoints:[0.1,0.2,0.3,0.4],restLower:[-0.1,-0.2,0.1,0.2],joints:Array.from({length:4},joint)}});
 const prior=global.requestAnimationFrame;global.requestAnimationFrame=()=>1;
 try{
  const camera=vec();camera.set(0,10.8,11.9);let baked=0,removed=0;
  const cinema={battleCamera:true,camera:{position:camera,lookAt(){}},animation:{start:0,moving:mesh('P'),captured:mesh('p'),from:{x:0,y:0,z:1},to:{x:0,y:0,z:0},baseYaw:0},pieces:{remove(){removed++;}},disposeGeometry(){},restFigure(m){assert.equal(m.userData.joints[0].rotation.x,0.1);assert.equal(m.userData.joints[3].userData.lower.rotation.x,0.2);},bakeFigure(){baked++;},render(){}};
  advanceCinema(cinema,0);const duration=cinema.animation.duration;advanceCinema(cinema,duration*0.5);assert.equal(cinema.cameraBusy,true);assert.ok(camera.y>3&&camera.y<6);
  advanceCinema(cinema,duration);assert.equal(cinema.animation,null);assert.equal(cinema.cameraBusy,false);assert.equal(camera.y,10.8);assert.equal(camera.z,11.9);assert.equal(baked,1);assert.equal(removed,1);
 }finally{if(prior===undefined)delete global.requestAnimationFrame;else global.requestAnimationFrame=prior;}
});
