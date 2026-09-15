"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizeTopology,deriveTopologyFromLegacy,resolveTargets,legacyProjection}=require("../src/room-topology");

test("legacy three-display inventory derives eight physical TVs and eight sources",()=>{
  const topology=deriveTopologyFromLegacy({
    devices:{
      tv1:{name:"BLC TV 1",enabled:true,avOutput:1},
      tv2:{name:"BLC TV 2",enabled:true,avOutput:2},
      tv3:{name:"TV 3",enabled:true,avOutput:3}
    },
    displayGroups:{all:["tv1","tv2","tv3"]},
    avLabels:{outputs:["BLC TV 1","BLC TV 2","TV 3","TV 4","Hallway TV 5","TV 6","Projector 7","Center TV 8"],inputs:["HUB TV 1","HUB TV 6","HUB TV 4","HUB TV 3","HUB TV 5","HUB TV 2","Content Source 7","Content Source 8"]}
  });
  assert.equal(Object.keys(topology.displays).length,3);
  assert.equal(Object.keys(topology.tvs).length,8);
  assert.equal(Object.keys(topology.sources).length,8);
  assert.equal(topology.displays.tv1.physicalTvId,"tv1");
  assert.equal(topology.tvs.tv8.name,"Center TV 8");
});

test("TV, display, and source all selectors remain separate domains",()=>{
  const topology=normalizeTopology({
    tvs:Array.from({length:8},(_,i)=>({id:`tv${i+1}`,name:`TV ${i+1}`,transport:{adapter:"pluto",output:i+1}})),
    displays:[{id:"screen1",name:"Front content",physicalTvId:"tv1"},{id:"screen2",name:"Rear content",physicalTvId:"tv2"},{id:"screen3",name:"Hall content",physicalTvId:"tv3"}],
    sources:[{id:"src1",name:"Teacher PC",endpointId:"source1",transport:{adapter:"pluto",input:1}},{id:"src2",name:"Announcements",endpointId:"source2",transport:{adapter:"pluto",input:2}}]
  });
  assert.equal(resolveTargets(["all"],{topology,domain:"tv"}).length,8);
  assert.equal(resolveTargets(["all"],{topology,domain:"display"}).length,3);
  assert.equal(resolveTargets(["all"],{topology,domain:"source"}).length,2);
});

test("typed groups cannot cross target domains",()=>{
  const topology=normalizeTopology({
    tvs:[{id:"tv1",name:"TV 1",transport:{output:1}},{id:"tv2",name:"TV 2",transport:{output:2}}],
    displays:[{id:"display1",name:"Display 1",physicalTvId:"tv1"}],
    sources:[{id:"source1",name:"Source 1",transport:{input:1}}],
    groups:[{id:"front-tvs",type:"tv",members:["tv1","tv2"]},{id:"front-displays",type:"display",members:["display1"]}]
  });
  assert.deepEqual(resolveTargets(["front-tvs"],{topology,domain:"tv"}).map(x=>x.id),["tv1","tv2"]);
  assert.deepEqual(resolveTargets(["front-tvs"],{topology,domain:"display"}),[]);
  assert.deepEqual(resolveTargets(["front-displays"],{topology,domain:"display"}).map(x=>x.id),["display1"]);
});

test("legacy projection preserves dynamic topology for compatibility surfaces",()=>{
  const topology=normalizeTopology({
    tvs:[{id:"front-tv",name:"Front TV",transport:{adapter:"pluto",connection:"hdbt",output:1}},{id:"hall-tv",name:"Hall TV",transport:{adapter:"pluto",connection:"hdbt",output:5}}],
    displays:[{id:"front-display",name:"Front Content",physicalTvId:"front-tv"}],
    sources:[{id:"teacher-pc",name:"Teacher PC",endpointId:"teacher",transport:{adapter:"pluto",input:3}}],
    groups:[{id:"teaching",name:"Teaching",type:"display",members:["front-display"]}]
  });
  const legacy=legacyProjection(topology);
  assert.equal(legacy.devices["front-display"].avOutput,1);
  assert.deepEqual(legacy.displayGroups.teaching,["front-display"]);
  assert.equal(legacy.avLabels.outputs[4],"Hall TV");
  assert.equal(legacy.avLabels.inputs[2],"Teacher PC");
  assert.equal(legacy.avLabels.sourceEndpoints[2],"teacher");
});
