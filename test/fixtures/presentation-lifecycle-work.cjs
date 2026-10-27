"use strict";
// Keep upload, conversion orchestration, asset promotion and SQLite persistence.
// Only the external rasterizer is simulated; this does not test rendering quality.
const fs=require("node:fs"),path=require("node:path"),{setTimeout:delay}=require("node:timers/promises");
const childProcess=require("node:child_process"),{promisify}=require("node:util");
const original=childProcess.execFile,originalAsync=promisify(original);
function execFile(...args){return original(...args)}
execFile[promisify.custom]=async(command,...args)=>{
  if(command!=="pdftoppm")return originalAsync(command,...args);
  console.log("fixture-presentation-conversion-started");
  while(!fs.existsSync(path.join(process.env.DATA_DIR,"release-presentation")))await delay(10);
  fs.writeFileSync(args[0].at(-1)+"-1.jpg","test-only-slide");
  return {stdout:"",stderr:""};
};
childProcess.execFile=execFile;
