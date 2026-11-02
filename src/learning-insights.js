'use strict';
const {modelJSON}=require('./learning-grader');
const schema={type:'object',additionalProperties:false,required:['observation','nextStep','limitation'],properties:Object.fromEntries(['observation','nextStep','limitation'].map(key=>[key,{type:'string'}]))};
function createInsights(platform,{generate=modelJSON}={}){
 let busy=false,last=0;
 return async(user,classId)=>{
  const aggregate=platform.summary(user,classId),cfg=platform.store.getPreference('learning.ai',{});
  if(!platform.settings().insightsEnabled||cfg.provider!=='ollama')throw Object.assign(Error('Enable local teacher insights after configuring Ollama.'),{status:409});
  if(busy||Date.now()-last<60000)throw Object.assign(Error('Wait one minute between classroom summaries.'),{status:429});
  busy=true;last=Date.now();
  try{
   const result=await generate({provider:'ollama',baseURL:cfg.baseURL,model:cfg.model},{model:cfg.model,store:false,max_output_tokens:600,instructions:'Summarize only these aggregate SCORM progress counts for a teacher. These are self-reported game scores, not verified mastery. No student names or writing are supplied. Do not infer identity, attendance, ability, effort, misconduct, or reasons for missing work. Give one modest instructional next step and an explicit evidence limitation. You cannot change grades, send messages, or operate classroom devices. Return three short plain-text strings, each at most 500 characters.',input:JSON.stringify(aggregate),text:{format:{type:'json_schema',name:'classroom_summary',strict:true,schema}}});
   if(!result||Object.keys(result).sort().join()!=='limitation,nextStep,observation'||Object.values(result).some(v=>typeof v!=='string'||!v.trim()||v.length>500))throw Error('The local summary did not match the expected format.');
   return {aggregate,suggestion:result,generatedAt:new Date().toISOString(),model:cfg.model};
  }finally{busy=false;}
 };
}
module.exports={createInsights};
