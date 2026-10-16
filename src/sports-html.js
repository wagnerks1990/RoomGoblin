"use strict";
// A non-executing, forward-only extractor for the two elements Sports needs.
// This deliberately does not build a DOM or repeatedly search malformed suffixes.
const space=c=>c===' '||c==='\n'||c==='\r'||c==='\t'||c==='\f';
function endTag(html,start){
 let quote='';
 for(let i=start+1;i<html.length;i++){
  const c=html[i];
  if(quote){if(c===quote)quote='';}
  else if(c==='"'||c==="'")quote=c;
  else if(c==='>')return i;
 }
 return -1;
}
function attributes(raw){
 const values=Object.create(null);let i=0,count=0;
 while(i<raw.length){
  while(space(raw[i])||raw[i]==='/')i++;
  const start=i;while(i<raw.length&&!space(raw[i])&&raw[i]!=='='&&raw[i]!=='/')i++;
  if(i===start){i++;continue;}
  const name=raw.slice(start,i).toLowerCase();while(space(raw[i]))i++;
  let value='';
  if(raw[i]==='='){
   i++;while(space(raw[i]))i++;
   const quote=raw[i]==='"'||raw[i]==="'"?raw[i++]:'';const begin=i;
   if(quote){while(i<raw.length&&raw[i]!==quote)i++;value=raw.slice(begin,i);i++;}
   else{while(i<raw.length&&!space(raw[i]))i++;value=raw.slice(begin,i);}
  }
  if(++count>128)throw Error('Sports source has too many tag attributes');
  if((name==='href'||name==='type')&&values[name]===undefined)values[name]=value;
 }
 return values;
}
function closingTag(lower,name,start){
 const needle='</'+name;let at=start;
 while(at<lower.length){const found=lower.indexOf(needle,at);if(found<0)return -1;const next=lower[found+needle.length];if(next==='>'||next==='/'||space(next))return found;at=found+needle.length;}
 return -1;
}
function elements(html){
 if(typeof html!=='string'||html.length>2097152)throw Error('Sports source HTML exceeds the size limit');
 const lower=html.toLowerCase(),found=[];let at=0,tokens=0;
 while(at<html.length){
  const start=html.indexOf('<',at);if(start<0)break;
  if(++tokens>50000)throw Error('Sports source has too many HTML tags');
  if(html.startsWith('<!--',start)){const end=html.indexOf('-->',start+4);if(end<0)break;at=end+3;continue;}
  const end=endTag(html,start);if(end<0)break;
  let i=start+1;while(i<end&&!space(html[i])&&html[i]!=='/'&&html[i]!=='>')i++;
  const name=lower.slice(start+1,i);at=end+1;
  if(name!=='a'&&name!=='script')continue;
  const close=closingTag(lower,name,at);if(close<0)break;
  const closeEnd=endTag(html,close);if(closeEnd<0)break;
  found.push({name,attributes:attributes(html.slice(i,end)),content:html.slice(at,close)});
  at=closeEnd+1;
 }
 return found;
}
function strip(html){
 const pieces=[];let at=0;
 while(at<html.length){
  const start=html.indexOf('<',at);if(start<0){pieces.push(html.slice(at));break;}
  pieces.push(html.slice(at,start));const end=html.indexOf('>',start+1);
  if(end<0){pieces.push(html.slice(start));break;}
  pieces.push(' ');at=end+1;
 }
 return pieces.join('');
}
module.exports={elements,strip};
