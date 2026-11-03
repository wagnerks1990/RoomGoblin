"use strict";
// Typed, teacher-approved effects only. Learner events never supply commands,
// destinations, media URLs, light IDs or generated AI content to this adapter.
function createEffectAdapter({catalog,execute,available}){
 return async(action,context)=>{
  const live=()=>available()&&context.admitted();if(!live())return {ok:false};
  const options=catalog(),targets=action.targets||[],known=action.kind==='lights'?options.lights:options.displays;
  if(!targets.length||targets.some(id=>!known.some(item=>item.id===id)))return {ok:false};
  let type,payload;
  if(action.kind==='arcade-board'){
   // An allowlisted projection, never a grade, response, user ID, or resume blob.
   const rows=context.board||[];
   type='display.text';payload={text:[context.title||'ARCADE CAMPAIGN','RANK  •  PLAYER / PERIOD  •  ARCADE SCORE  •  LEVEL  •  PROGRESS',...rows.map((r,i)=>`${(context.offset||0)+i+1}. ${r.firstName} / ${r.period}  ·  ${r.arcadeScore.toLocaleString('en-US')}  ·  L${r.level} / B${r.board}  ·  ${r.answered}/${r.total} questions`),rows.length?`${context.count} players · Arcade scores only · Assignment grades stay private`:'Complete a question checkpoint to join the campaign.'].join('\n'),color:'#f8fafc',background:'#102b38',align:'left',size:42,autoFit:true};
  }else if(action.kind==='leaderboard'){
   type='display.text';payload={text:['CLASSROOM PROGRESS',...context.board.slice(0,10).map((row,index)=>`${index+1}. ${row.firstName} — ${Number.isFinite(row.earned)?`${row.earned} / ${row.possible}`:`${row.current||0} / ${row.total||0} steps`}`),'Game points · '+context.board.length+' active entries'].join('\n'),color:'#ffffff',background:'#102b38',align:'center',size:48};
  }else if(action.kind==='lights'){type='lighting.color';payload={color:action.color};}
  else{
   const asset=options.assets.find(item=>item.id===action.assetId&&item.kind===action.kind);if(!asset)return {ok:false};
   type=action.kind==='image'?'display.image':'display.video';payload={url:asset.url,fit:'contain',autoplay:true,loop:false,muted:action.kind==='image'||action.volume===0,volume:action.volume||0,startAtSeconds:0,endAtSeconds:8};
  }
  // Individual light commands retain cancellation checks between transports.
  const groups=action.kind==='lights'?targets.map(id=>[id]):[targets];
  for(const group of groups){if(!live())return {ok:false};const result=await execute({type,target:action.kind==='lights'?group[0]:group,payload,source:'learning-effects'},{admission:live});if(result?.ok!==true||result.skipped)return {ok:false};}
  return {ok:true};
 };
}
module.exports={createEffectAdapter};
