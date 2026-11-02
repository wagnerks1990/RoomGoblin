'use strict';

// Browser shortcuts only: these URLs are never fetched by the appliance.
const PREFERENCE='learning.tools';
const fields=['aiChatUrl','mediaStudioUrl'];
function normalizeTools(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Enter the AI tool addresses.'),{status:400});
 const result={};
 for(const field of fields){
  const raw=input[field]??'';
  if(typeof raw!=='string'||raw.length>2048)throw Object.assign(Error('Use an HTTPS tool address of at most 2048 characters.'),{status:400});
  const value=raw.trim();result[field]='';if(!value)continue;
  try{
   const url=new URL(value);
   if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||/[\u0000-\u0020\u007f]/.test(value))throw Error();
   result[field]=url.href;
  }catch{throw Object.assign(Error('Use an HTTPS tool address without credentials, query parameters or a fragment.'),{status:400});}
 }
 return result;
}
function readTools(store){
 try{return normalizeTools(store.getPreference(PREFERENCE,{}));}
 catch{return normalizeTools({});}
}
module.exports={PREFERENCE,normalizeTools,readTools};
