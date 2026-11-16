'use strict';
// Opt-in, synthetic-only provider calibration. No database, LMS or classroom writes.
const fs=require('node:fs'),crypto=require('node:crypto');
const {normalize}=require('../src/learning-assignment-definition');
const {gradeWriting,localBaseURL}=require('../src/learning-grader');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function validateCases(definition,cases){
 if(!Array.isArray(cases)||!cases.length||cases.length>12)throw Error('Use 1-12 synthetic calibration cases.');
 const ids=definition.criteria.map(c=>c.id).sort();
 for(const c of cases){
  if(!c||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||typeof c.initial!=='string'||c.initial.length>50000||typeof c.reply!=='string'||c.reply.length>15000||c.parent!==undefined&&typeof c.parent!=='string')throw Error('Invalid synthetic calibration case.');
  if(!c.expected?.criteria||Object.keys(c.expected.criteria).sort().join()!==ids.join()||!['related','unrelated','uncertain'].includes(c.expected.relevance)||definition.criteria.some(k=>!k.levels.includes(c.expected.criteria[k.id])))throw Error('Specify every expected criterion and relevance result.');
 }
}
async function runCalibration({definition,cases,provider='ollama',baseURL,model,syntheticOnly=false,callBudget=100,grade=gradeWriting,onResult=()=>{}}){
 if(syntheticOnly!==true)throw Error('Explicit synthetic-only acknowledgement is required.');
 if(provider!=='ollama'||typeof model!=='string'||!model.trim())throw Error('Use an explicitly selected local Ollama model.');
 localBaseURL(baseURL,'ollama');definition=normalize(definition);validateCases(definition,cases);
 if(!Number.isInteger(callBudget)||callBudget<1||callBudget>256)throw Error('Use a calibration call budget from 1 to 256.');
 let calls=0;const results=[];
 for(const c of cases){let caseCalls=0;const start=Date.now();try{
  const result=await grade({definition,initial:c.initial,reply:c.reply,parent:c.parent||definition.alternate,feedbackPosts:[{id:'calibration-main',body:c.initial}],provider,baseURL,model,consumeModelBudget:()=>{if(calls>=callBudget)throw Object.assign(Error('Calibration budget exhausted.'),{code:'LEARNING_MODEL_BUDGET'});calls++;caseCalls++;}});
  const actual=Object.fromEntries(definition.criteria.map(k=>[k.id,result.criteria?.[k.id]?.points])),relevance=result.commentDecisions?.['calibration-main'];
  const matches=definition.criteria.every(k=>actual[k.id]===c.expected.criteria[k.id])&&relevance===c.expected.relevance;
  results.push({name:c.name,passed:matches,expected:c.expected,actual:{criteria:actual,relevance,total:result.total,reviewRequired:result.reviewRequired===true},calls:caseCalls,elapsedMs:Date.now()-start});
 }catch(error){results.push({name:c.name,passed:false,status:'unavailable',code:error.code==='LEARNING_MODEL_BUDGET'?'budget_exhausted':'assessment_error',calls:caseCalls,elapsedMs:Date.now()-start});}onResult(results[results.length-1]);}
 return {syntheticOnly:true,provider,model,definitionHash:digest(definition),casesHash:digest(cases),providerCalls:calls,passed:results.filter(c=>c.passed).length,failed:results.filter(c=>!c.passed).length,productionModified:false,results};
}
if(require.main===module){(async()=>{const options={};for(let i=2;i<process.argv.length;i++){const flag=process.argv[i];if(flag==='--synthetic-only'){options.syntheticOnly=true;continue;}if(!['--definition','--cases','--model','--base-url','--report','--call-budget'].includes(flag)||!process.argv[i+1])throw Error('Use --definition, --cases, --model, --base-url, --synthetic-only and optional --report/--call-budget.');options[flag.slice(2)]=process.argv[++i];}
 const report=await runCalibration({definition:JSON.parse(fs.readFileSync(options.definition,'utf8')),cases:JSON.parse(fs.readFileSync(options.cases,'utf8')),baseURL:options['base-url'],model:options.model,syntheticOnly:options.syntheticOnly,callBudget:options['call-budget']?Number(options['call-budget']):100});const text=JSON.stringify(report,null,2);if(options.report)fs.writeFileSync(options.report,text+'\n',{mode:0o600});console.log(text);process.exitCode=report.failed?1:0;
 })().catch(()=>{console.error('Calibration could not start. Check explicit synthetic inputs, local provider options and file paths.');process.exitCode=1;});}
module.exports={runCalibration,validateCases};
