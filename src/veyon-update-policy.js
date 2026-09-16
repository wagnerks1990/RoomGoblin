"use strict";

function parseVersion(value){
  const m=String(value||"").trim().match(/v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return m?{text:`${m[1]}.${m[2]}.${m[3]}`,parts:m.slice(1,4).map(Number)}:null;
}
function compareVersions(a,b){
  const av=parseVersion(a),bv=parseVersion(b);if(!av||!bv)return null;
  for(let i=0;i<3;i++){if(av.parts[i]!==bv.parts[i])return av.parts[i]-bv.parts[i]}
  return 0;
}
function parseAptVeyon(packages){
  const rows=(Array.isArray(packages)?packages:[]).filter(row=>/^veyon(?:-|$)/i.test(String(row?.name||"")));
  let installed="",candidate="";
  for(const row of rows){
    const raw=String(row.raw||"");
    const candidateMatch=raw.match(/^[^\s]+\s+([^\s]+)/);
    const installedMatch=raw.match(/\[upgradable from:\s*([^\]]+)\]/i);
    if(!candidate&&candidateMatch)candidate=candidateMatch[1];
    if(!installed&&installedMatch)installed=installedMatch[1];
  }
  return {packages:rows,installedVersion:parseVersion(installed)?.text||installed,candidateVersion:parseVersion(candidate)?.text||candidate};
}

function installedVeyonVersion(packages){
  const versions=[...new Set((Array.isArray(packages)?packages:[])
    .filter(row=>/^veyon(?:-[a-z0-9+-]+)?(?::[a-z0-9]+)?$/.test(String(row?.name||"")))
    .map(row=>parseVersion(row.version)?.text).filter(Boolean))];
  return {installedVersion:versions.length===1?versions[0]:null,mixedInstalledVersions:versions.length>1,installedVersions:versions};
}
module.exports={parseVersion,compareVersions,parseAptVeyon,installedVeyonVersion};
