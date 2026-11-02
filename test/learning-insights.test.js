'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createInsights}=require('../src/learning-insights');
test('teacher insights supply aggregate data only and cannot accept an action or grade payload',async()=>{
 const aggregate={attempts:3,completed:1,scored:2,meanReportedPercent:80},p={summary:()=>aggregate,settings:()=>({insightsEnabled:true}),store:{getPreference:()=>({provider:'ollama',baseURL:'http://127.0.0.1:11434/api',model:'synthetic'})}};
 let supplied;const insight=createInsights(p,{generate:async(options,request)=>{supplied={options,request};return {observation:'One completion is saved.',nextStep:'Ask for a worked subnet example.',limitation:'Scores do not prove mastery.'};}});const r=await insight({},'synthetic');assert.equal(r.aggregate,aggregate);assert.deepEqual(JSON.parse(supplied.request.input),aggregate);await assert.rejects(()=>insight({},'synthetic'),{status:429});
 const malformed=createInsights(p,{generate:async()=>({observation:'',nextStep:'',limitation:'',command:'lighting.color'})});await assert.rejects(()=>malformed({},'synthetic'),/format/);
 p.settings=()=>({insightsEnabled:false});await assert.rejects(()=>createInsights(p)({},'synthetic'),{status:409});
});
