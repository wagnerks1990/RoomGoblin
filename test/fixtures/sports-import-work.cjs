"use strict";
// Hold only the PDF-processing adapter; real multipart parsing, authorization,
// route registration and application lifecycle remain in use.
const fs=require("node:fs"),path=require("node:path"),{setTimeout:delay}=require("node:timers/promises");
const dir=process.env.DATA_DIR;
require("../../src/sports-import").rosterPDF=async()=>{
  fs.writeFileSync(path.join(dir,"pdf-import-entered"),"");
  while(!fs.existsSync(path.join(dir,"release-pdf-import")))await delay(10);
  fs.writeFileSync(path.join(dir,"pdf-import-finished"),"");
  if(fs.existsSync(path.join(dir,"reject-pdf-import")))throw Error("fixture PDF processing failure");
  return {rows:[],warnings:[]};
};
