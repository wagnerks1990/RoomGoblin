"use strict";
// Synthetic writing only. Running this command sends no classroom records.
const {gradeWriting,CASE,localBaseURL}=require('../src/learning-grader');
const caseArg=process.argv.indexOf('--case'),templateId=caseArg<0?CASE.id:process.argv[caseArg+1];
const osCase=require('../src/learning-os-case').CASE.id;
if(![CASE.id,osCase].includes(templateId))throw Error('Choose a supported discussion case');
const samples=require(templateId===osCase?'../test/fixtures/learning-os-calibration.json':'../test/fixtures/learning-calibration.json');
async function main(){
  if(process.argv.includes('--check-fixtures')){if(samples.length!==(templateId===osCase?7:13)||samples.some(s=>!s.id||!s.initial||s.expected.length!==4))throw Error('Invalid fixture');console.log(samples.length+' synthetic calibration fixtures valid; no model contacted.');return;}
  const arg=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1];};
  const model=arg('--model','qwen3.5:9b'),baseURL=arg('--base-url','http://127.0.0.1:11434/api');
  if(process.argv.includes('--warmup')){
    const response=await fetch(localBaseURL(baseURL,'ollama')+'/chat',{method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages:[],stream:false,keep_alive:'5m',options:{num_ctx:16384}})});
    if(!response.ok)throw Error('Warmup failed');await response.arrayBuffer();console.log(JSON.stringify({warmup:true,model}));
  }
  let failures=0;const results=[];
  for(const sample of samples){const started=Date.now();try{const result=await gradeWriting({...sample,templateId,model,baseURL,provider:'ollama'});const actual=['claim','evidence','reasoning','reply'].map(k=>result.criteria[k].points),match=JSON.stringify(actual)===JSON.stringify(sample.expected);if(!match)failures++;results.push({sample:sample.id,match,expected:sample.expected,actual,elapsedMs:Date.now()-started,feedback:result.coachResponse});}catch{failures++;results.push({sample:sample.id,match:false,error:'Unavailable, invalid, truncated, or outside context budget',elapsedMs:Date.now()-started});}console.log(JSON.stringify(results.at(-1)));if(sample!==samples.at(-1))await new Promise(resolve=>setTimeout(resolve,60000));}
  console.log(JSON.stringify({model,passed:samples.length-failures,failed:failures,scope:'Synthetic calibration only. Teacher must review response accuracy, tone, and rubric judgments; no live student or LMS qualification.'}));if(failures)process.exitCode=1;
}
main().catch(()=>{console.error('Calibration failed. Verify local Ollama settings; no provider details logged.');process.exitCode=1;});
