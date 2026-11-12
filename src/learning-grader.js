"use strict";

const RUBRIC = Object.freeze({claim:[0,3,6],evidence:[0,3,6],reasoning:[0,2,5],reply:[0,1,3]});
const CASE = Object.freeze({
  id:"it2-u03-c02-ipv4-v1", title:"Subnet Case Files: Local or Remote?", points:20,
  prompt:"A technician says ‘192.168.20.65 and 192.168.20.129 must be local because their first three octets match.’ Both use /26. Evaluate the claim using the two subnet boundaries and explain the next-hop consequence.",
  initialDirections:"Write 4–6 sentences: judge the claim, show both subnet boundaries, explain the next hop, and state a limit of this evidence.",
  replyDirections:"Reply in 2–3 sentences with a justified correction, evidence, a test, or a limitation. Agreement alone is insufficient.",
  alternate:"Independent critique: ‘Any address ending in .1 can be my gateway, even when it falls outside my interface subnet.’",
  rubric:{claim:"Technical claim: 6 accurate judgment; 3 relevant judgment with omission; 0 missing/unrelated/incorrect/invented evidence.",evidence:"Evidence/example: 6 accurate specific calculation; 3 relevant incomplete calculation; 0 absent/incorrect/invented.",reasoning:"Reasoning and limit: 5 explains connection and an appropriate limit; 2 partially sound but incomplete; 0 absent/incorrect/invented.",reply:"Peer reply or independent critique: 3 justified correction/test/extension; 1 relevant response without support; 0 absent/unrelated/incorrect/agreement only."}
});
const {INITIAL_SCHEMA:SCHEMA,REPLY_SCHEMA,initialRequest,assessWriting}=require('./learning-evidence');
const osCase=require('./learning-os-case');
const CASES=Object.freeze({[CASE.id]:CASE,[osCase.CASE.id]:osCase.CASE});
function caseFor(id=CASE.id){const item=Object.prototype.hasOwnProperty.call(CASES,id)&&CASES[id];if(!item)throw Error('Unknown discussion template');return item;}
function rubricFor(id=CASE.id){return id===CASE.id?RUBRIC:caseFor(id).scoreLevels;}
function validateGrade(value,templateId=CASE.id,definition){
  const rubric=definition?Object.fromEntries(definition.criteria.map(c=>[c.id,c.levels])):rubricFor(templateId);
  if(!value||Object.keys(value).sort().join()!=="criteria,summary"||typeof value.summary!=="string"||!value.summary.trim()||value.summary.length>2000)throw Error("Invalid grading response");
  if(!value.criteria||Object.keys(value.criteria).sort().join()!==Object.keys(rubric).sort().join())throw Error("Invalid grading criteria");
  let total=0;
  for(const [key,allowed] of Object.entries(rubric)){
    const v=value.criteria[key];
    if(!v||Object.keys(v).sort().join()!=="feedback,points"||!allowed.includes(v.points)||typeof v.feedback!=="string"||!v.feedback.trim()||v.feedback.length>1600)throw Error("Invalid rubric score");
    total+=v.points;
  }
  return {...value,total};
}
function gradingRequest({model,initial}){return initialRequest(model,initial);}
function localBaseURL(value,provider='local'){
  const pathname=provider==='ollama'?'/api':'/v1';
  try{const u=new URL(value);if(!['127.0.0.1','[::1]'].includes(u.hostname)||u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.pathname!==pathname||!u.port||Number(u.port)<1024)throw Error();return u.origin+pathname;}catch{throw Error(`Local model URL must be loopback HTTP with a port and ${pathname}, for example http://127.0.0.1:11434${pathname}.`);}
}
async function modelJSON({apiKey,provider='openai',baseURL,fetchImpl=fetch},request){
  if(!['openai','local','ollama'].includes(provider))throw Error('Unknown grading provider');
  const local=provider!=='openai',ollama=provider==='ollama',model=request.model,schema=request.text.format.schema;
  // A conservative byte bound leaves space for schema, output and chat framing.
  // Overlong writing stays saved for teacher review instead of silently truncating it.
  if(ollama&&Buffer.byteLength(request.instructions+request.input+JSON.stringify(schema),'utf8')+3012>16384)throw Error('Writing exceeds the local grading context budget');
  const messages=[{role:'system',content:request.instructions},{role:'user',content:request.input}];
  const payload=ollama?{model,messages,stream:false,think:false,format:schema,keep_alive:'5m',options:{num_ctx:16384,num_predict:2500,temperature:0}}:local?{model,stream:false,max_tokens:2500,temperature:0,messages,response_format:{type:'json_schema',json_schema:{name:request.text.format.name,strict:true,schema}}}:request;
  const url=local?localBaseURL(baseURL,provider)+(ollama?'/chat':'/chat/completions'):"https://api.openai.com/v1/responses";
  const headers={"Content-Type":"application/json"};if(apiKey)headers.Authorization=`Bearer ${apiKey}`;
  let response;
  try{response=await fetchImpl(url,{method:"POST",redirect:"error",signal:AbortSignal.timeout(local?60000:45000),headers,body:JSON.stringify(payload)});}
  catch{const error=Error('AI service temporarily unavailable');error.retryable=true;throw error;}
  if(!response.ok){await response.body?.cancel();const error=Error("AI service unavailable");error.retryable=response.status===429||response.status>=500;throw error;}
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>100000)throw Error("AI response too large");chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const data=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  let output;
  if(ollama){if(data.done!==true||data.done_reason!=='stop'||typeof data.message?.content!=='string'||data.message?.tool_calls?.length)throw Error('Ollama response incomplete');output=data.message.content;}
  else if(local){const choice=data.choices?.[0];if(choice?.finish_reason!=='stop'||choice.message?.refusal||typeof choice.message?.content!=='string')throw Error('Local model response incomplete');output=choice.message.content;}
  else{if(data.status!=="completed")throw Error("AI response incomplete");const parts=(data.output||[]).flatMap(x=>x.type==="message"?x.content||[]:[]);if(parts.some(x=>x.type==="refusal"))throw Error("AI response requires teacher review");output=parts.filter(x=>x.type==="output_text").map(x=>x.text).join("");}
  return JSON.parse(output);
}
async function gradeWriting(options){if(options.definition)return require('./learning-assignment-definition').assessWriting(options,modelJSON);const selected=caseFor(options.templateId);return (selected.id===CASE.id?assessWriting:require('./learning-os-evidence').assessWriting)(options,modelJSON);}
module.exports={CASE,CASES,caseFor,rubricFor,RUBRIC,SCHEMA,REPLY_SCHEMA,validateGrade,gradingRequest,gradeWriting,localBaseURL,modelJSON};
