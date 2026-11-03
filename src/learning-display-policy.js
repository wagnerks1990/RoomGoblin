'use strict';
// An explicit teacher reservation affects content, not receiver identity or power.
// The trusted campaign ID is supplied by the internal adapter, never an API body.
const maintenance=new Set(['display.identify','display.reload','display.setup','music.assistant.detach']);
function contentCommand(type){return /^(display\.|voice\.|sfx\.|music\.assistant\.)/.test(type)||type==='legacy.raw';}
function allowedTargets(command,targets,reservations,trustedCampaignId=null){
 if(!contentCommand(command.type)||maintenance.has(command.type))return targets;
 return targets.filter(id=>!reservations.has(id)||(trustedCampaignId&&reservations.get(id)===trustedCampaignId&&command.type==='display.text'&&command.payload?.arcade?.version===1));
}
function waitingState(){return {background:{color:'#080e1a'},title:'ARCADE LEADERBOARD',titleOptions:{color:'#a1f5d7',size:74},text:'Waiting for a fresh leaderboard update…',textOptions:{color:'#d9edf3',size:44},subtitle:'RoomGoblin',timer:{visible:false,running:false},media:null,layers:[]};}
module.exports={contentCommand,allowedTargets,waitingState};
