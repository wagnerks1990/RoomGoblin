"use strict";

const assert=require("node:assert/strict");
const path=require("node:path");

// The bridge is intentionally loaded before server.js in production and patches
// Express route registration. Its exported normalization helpers are pure and
// keep this regression independent of a live Music Assistant instance.
const bridge=require(path.join(__dirname,"..","src","maintenance-route-bridge"));

const protocol={
  player_id:"44:B1:76:DA:3E:FF",
  provider:"sendspin",
  name:"Apollo CAST-1 da3efc",
  available:true,
  output_protocols:[]
};
const universal={
  player_id:"up44b176da3eff",
  provider:"universal_player",
  name:"Apollo CAST-1 da3efc",
  available:true,
  output_protocols:[
    {output_protocol_id:"44:B1:76:DA:3E:FF",name:"Sendspin",protocol_domain:"sendspin",available:true},
  ]
};
const tv={
  player_id:"classroom-hub-tv1",
  provider:"sendspin",
  name:"RoomGoblin - TV1",
  available:true,
  output_protocols:[]
};

const normalized=bridge.musicAssistantNormalizePlayers([tv,protocol,universal]);
assert.deepEqual(normalized.players.map(p=>p.player_id),["classroom-hub-tv1","up44b176da3eff"]);
assert.deepEqual(normalized.protocolPlayers.map(p=>p.player_id),["44:B1:76:DA:3E:FF"]);
assert.equal(normalized.aliases["44:B1:76:DA:3E:FF"],"up44b176da3eff");
assert.equal(bridge.musicAssistantCanonicalPlayerId("44:B1:76:DA:3E:FF"),"up44b176da3eff");
assert.equal(bridge.musicAssistantCanonicalPlayerId("up44b176da3eff"),"up44b176da3eff");
assert.equal(bridge.musicAssistantCanonicalPlayerId("classroom-hub-tv1"),"classroom-hub-tv1");

// Native output markers and unknown protocol ids must not hide unrelated players.
const nativeOnly={player_id:"native-one",provider:"demo",output_protocols:[{output_protocol_id:"native",is_native:true}]};
const unknownLink={player_id:"parent-two",provider:"universal_player",output_protocols:[{output_protocol_id:"missing-child",protocol_domain:"sendspin"}]};
const second=bridge.musicAssistantNormalizePlayers([nativeOnly,unknownLink]);
assert.deepEqual(second.players.map(p=>p.player_id),["native-one","parent-two"]);
assert.deepEqual(second.protocolPlayers,[]);

console.log("Music Assistant Universal Player normalization regression checks OK");
