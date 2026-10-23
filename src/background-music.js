"use strict";

// Playback acknowledgement is not playback confirmation. This monitor never
// dispatches commands; the owner checks priority and session identity first.
class PlaybackRecovery {
  constructor({now=Date.now}={}){this.now=now;this.reset()}
  reset(){this.attempts=0;this.retryAt=0;this.awaitingUntil=0;this.lastProgressAt=0;this.lastPositionAt=0;this.lastElapsed=null;this.lastReportedElapsed=null;this.lastDuration=0;this.mediaKey="";this.idleSince=0;this.healthySince=0;this.state="idle";this.reason=""}
  requested(){const now=this.now();this.attempts++;this.awaitingUntil=now+20000;this.retryAt=now+Math.min(300000,15000*2**Math.min(this.attempts-1,5));this.state="starting";this.reason="Waiting for the player to confirm playback"}
  failed(uncertain=false){this.awaitingUntil=uncertain?this.now()+30000:0;this.state="retrying";this.reason=uncertain?"Command response lost; checking the player before retrying":"Playback failed; retry scheduled"}
  observe(actual,{stallSeconds=120,finiteTrack=false}={}){
    const now=this.now();
    if(!actual){this.state="unknown";this.reason="Player status is unavailable";return {action:"wait"}}
    if(!actual.found||actual.available===false){this.state="waiting";this.reason=actual.found?"Player is temporarily unavailable":"Waiting for player registration";this.healthySince=0;return {action:"wait"}}
    const p=actual.player||{},media=p.current_media||{},elapsed=p.elapsed_time==null?NaN:Number(p.elapsed_time),key=String(media.uri||media.media_id||media.title||"");
    if(actual.playing){
      this.idleSince=0;
      this.lastDuration=Number(media.duration)||0;
      // Music Assistant can retain an unchanged position/timestamp anchor during
      // steady playback. Match its corrected_elapsed_time contract while playing;
      // repeatedly reading the same anchor is not evidence of a stalled stream.
      const anchor=p.elapsed_time_last_updated;
      const estimated=typeof anchor==="number"&&Number.isFinite(anchor)&&anchor>0;
      const position=estimated?elapsed+Math.max(0,now/1000-anchor):elapsed;
      const progress=Number.isFinite(elapsed)&&(this.lastReportedElapsed===null||elapsed!==this.lastReportedElapsed||key!==this.mediaKey);
      if(progress)this.lastProgressAt=now;
      if(Number.isFinite(position)){
        if(this.lastElapsed===null||position!==this.lastElapsed||key!==this.mediaKey)this.lastPositionAt=now;
        this.lastElapsed=position;this.lastReportedElapsed=elapsed;this.mediaKey=key;
      }
      // No telemetry means unknown audible progress, not proof of a stall.
      const stalled=Number.isFinite(position)&&this.lastPositionAt>0&&now-this.lastPositionAt>=stallSeconds*1000;
      if(!stalled){
        this.state="playing";this.reason=progress?"Playback progress confirmed":estimated&&Number.isFinite(position)?"Player reports playing; position is estimated":"Player reports playing";
        if(!this.healthySince)this.healthySince=now;
        if(now-this.healthySince>=30000){this.attempts=0;this.retryAt=0}
        this.awaitingUntil=0;return {action:"none"};
      }
      this.healthySince=0;this.state="stalled";this.reason="Player reports playing, but progress has stopped";
    }else{
      this.healthySince=0;
      const duration=Number(media.duration)||this.lastDuration;
      if(finiteTrack&&this.lastElapsed!==null&&duration>0&&Math.max(Number.isFinite(elapsed)?elapsed:0,this.lastElapsed)>=duration-2){this.state="finished";this.reason="Track finished";return {action:"complete"}}
      if(!this.idleSince)this.idleSince=now;
      this.state=now<this.awaitingUntil?"starting":"retrying";this.reason=now<this.awaitingUntil?"Waiting for playback confirmation":"Player stopped; recovery pending";
      if(now-this.idleSince<8000&&!this.attempts)return {action:"wait"};
    }
    if(now<this.awaitingUntil||now<this.retryAt)return {action:"wait"};
    return {action:this.attempts===0?"resume":"reload"};
  }
  snapshot(){return {state:this.state,reason:this.reason,attempts:this.attempts,retryAt:this.retryAt||null,confirmBy:this.awaitingUntil||null,lastProgressAt:this.lastProgressAt||null}}
}

function mediaSelection(input){
  const uri=String(input.uri||"").trim();
  if(uri.length>2000||!/^([a-z][a-z0-9+.-]*):\/\//i.test(uri)||/^(javascript|data|file|about):/i.test(uri))throw Error("Choose a valid Music Assistant media item or HTTP(S) radio URL");
  if(/^https?:/i.test(uri)){const parsed=new URL(uri);if(parsed.username||parsed.password)throw Error("Media URLs cannot contain credentials")}
  const inferred=uri.match(/:\/\/(track|radio|album|playlist|artist)\//)?.[1]||"unknown";
  return {uri,name:String(input.name||"Selected music").slice(0,200),mediaType:["track","radio","album","playlist","artist"].includes(input.mediaType)?input.mediaType:inferred};
}
function sleepDeadline(minutes,now=Date.now()){
  const n=Number(minutes);if(!Number.isInteger(n)||n<0||n>240)throw Error("Sleep timer must be 0–240 whole minutes");return n?now+n*60000:null;
}
module.exports={PlaybackRecovery,mediaSelection,sleepDeadline};
