'use strict';
const fs=require('node:fs'),path=require('node:path'),AdmZip=require('adm-zip');
const escape=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function createChessPackage(activity,connection,publicDir){
 const zip=new AdmZip();
 const files=[['index.html','chess/sco/index.html'],['app.js','chess/sco/app.js'],['style.css','chess/sco/style.css'],['roomgoblin-scorm.js','sdk/roomgoblin-scorm.js'],['board.js','chess/board.js'],['board.css','chess/board.css'],['coach.js','chess/coach.js'],['coach.css','chess/coach.css'],['vision.js','chess/vision.js'],['vision.css','chess/vision.css'],['training.js','chess/training.js'],['cinematic/view.js','chess/cinematic/view.mjs'],['cinematic/NOTICE.txt','chess/cinematic/NOTICE.txt'],['cinematic/THREE-LICENSE.txt','chess/cinematic/THREE-LICENSE.txt'],['cinematic/assets/MAKEHUMAN-NOTICE.txt','chess/cinematic/assets/MAKEHUMAN-NOTICE.txt'],['cinematic/assets/MAKEHUMAN-CC0.txt','chess/cinematic/assets/MAKEHUMAN-CC0.txt']];
 // LMS file servers commonly recognize .js but not .mjs. Module imports still
 // require a JavaScript MIME type; use the portable extension inside the ZIP.
 for(const [dest,src]of files){
  let bytes=fs.readFileSync(path.join(publicDir,src));
  if(dest==='board.js')bytes=Buffer.from(bytes.toString('utf8').replace("'cinematic/view.mjs'","'cinematic/view.js'"));
  zip.addFile(dest,bytes);
 }
 const config={...connection,activityId:activity.id,title:activity.title,transport:'direct',connectionUi:'embedded',written:false};
 zip.addFile('config.js',Buffer.from('window.ROOMGOBLIN_SCORM='+JSON.stringify(config).replace(/</g,'\\u003c')+';'));
 zip.addFile('imsmanifest.xml',Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="RG-CHESS-${activity.id}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
<metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
<organizations default="ORG"><organization identifier="ORG"><title>${escape(activity.title)}</title><item identifier="ITEM" identifierref="SCO"><title>${escape(activity.title)}</title></item></organization></organizations>
<resources><resource identifier="SCO" type="webcontent" adlcp:scormtype="sco" href="index.html">${[...files.map(([dest])=>dest),'config.js'].map(f=>'<file href="'+f+'"/>').join('')}</resource></resources></manifest>`));
 return zip.toBuffer();
}
module.exports={createChessPackage};
