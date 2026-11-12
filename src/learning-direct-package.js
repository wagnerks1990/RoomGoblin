"use strict";
const fs=require('node:fs'),path=require('node:path'),{CASES,caseFor,rubricFor}=require('./learning-grader');
const escape=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function createPackage(activity,connection,publicDir,definition=null){
 const zip=new(require('adm-zip'))(),written=definition?.kind==='discussion'||!!CASES[activity.template_id];
 // Authored assignments load instruction/rubric data from the API, never grading references.
 const config={...connection,prompt:definition?'':connection.prompt,activityId:activity.id,title:activity.title,transport:'direct',connectionUi:'embedded',written,apiDefinition:!!definition,case:written&&!definition?{...caseFor(activity.template_id),scoreLevels:rubricFor(activity.template_id)}:null};
 for(const [dest,src]of [['index.html','direct/index.html'],['app.js','direct/app.js'],['style.css','direct/style.css'],['roomgoblin-scorm.js','sdk/roomgoblin-scorm.js']])zip.addFile(dest,fs.readFileSync(path.join(publicDir,src)));
 zip.addFile('config.js',Buffer.from('window.ROOMGOBLIN_SCORM='+JSON.stringify(config).replace(/</g,'\\u003c')+';'));
 zip.addFile('imsmanifest.xml',Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><manifest identifier="RG-${activity.id}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="ORG"><organization identifier="ORG"><title>${escape(activity.title)}</title><item identifier="ITEM" identifierref="SCO"><title>${escape(activity.title)}</title></item></organization></organizations><resources><resource identifier="SCO" type="webcontent" adlcp:scormtype="sco" href="index.html">${['index.html','app.js','style.css','config.js','roomgoblin-scorm.js'].map(n=>`<file href="${n}"/>`).join('')}</resource></resources></manifest>`));
 return zip.toBuffer();
}
module.exports={createPackage};
