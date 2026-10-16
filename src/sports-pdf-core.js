"use strict";
const {createHash}=require('node:crypto');
const key=s=>createHash('sha256').update(String(s)).digest('hex').slice(0,24);
async function parse(bytes){
 if(bytes.length>5242880||!Buffer.from(bytes).subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Choose a PDF under 5 MiB');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWasm:false,stopAtErrors:true});let doc;
 try{doc=await task.promise;if(doc.numPages>5)throw Error('Roster PDFs support at most five pages');const rows=[];let title='',level='',columns=null,totalItems=0,totalChars=0;
  for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),reader=page.streamTextContent().getReader(),content={items:[]};
   try{for(;;){const {value,done}=await reader.read();if(done)break;const items=value.items||[];totalItems+=items.length;for(const item of items)totalChars+=(item.str||'').length;if(totalItems>12000||totalChars>200000)throw Error('PDF decoded text exceeds limits');content.items.push(...items)}}finally{await reader.cancel().catch(()=>{})}const lines=[];
   for(const item of content.items.filter(i=>i.str?.trim())){const y=Math.round(item.transform[5]/3)*3;let line=lines.find(r=>Math.abs(r.y-y)<=3);if(!line){line={y,items:[]};lines.push(line)}line.items.push({x:item.transform[4],text:item.str.trim()})}
   for(const line of lines.sort((a,b)=>b.y-a.y)){const items=line.items.sort((a,b)=>a.x-b.x),full=items.map(i=>i.text).join(' ');title+=' '+full;
    if(!columns&&/roster/i.test(full)){if(/\bjv\b|junior varsity/i.test(full))level='jv';else if(/\bvarsity\b/i.test(full))level='varsity'}
    if(/^VARSITY$/i.test(full)){level='varsity';continue}if(/^JV$/i.test(full)){level='jv';continue}
    if(/(?:Number|No\.|#).*Name.*(?:Grade|Class|Year)/i.test(full)){if(items.length>8)throw Error('Roster header exceeds eight columns');columns=items.map(i=>({x:i.x,name:i.text.toLowerCase()}));continue}
    if(!columns||/^(Managers?:|Head Coach|Assistant Coach)/i.test(full))continue;
    const cells=columns.map(()=>[]);for(const i of items){let selected=0;let dist=Infinity;columns.forEach((c,j)=>{if(Math.abs(c.x-i.x)<dist){dist=Math.abs(c.x-i.x);selected=j}});cells[selected].push(i.text)}
    const obj=Object.fromEntries(columns.map((c,i)=>[c.name,cells[i].join(' ')]));const name=obj.name||[obj['first name'],obj['last name']].filter(Boolean).join(' '),grade=obj.grade||obj.year||obj.class;
    if(!name||!/^\d{1,2}$/.test(grade||''))continue;const number=obj.number||obj['no.']||obj['#']||'';rows.push({id:key([name,number,level].join('|')),name,number:number.toLowerCase()==='manager'?'':number,grade,position:obj.position||'',role:number.toLowerCase()==='manager'?'manager':'player',level});
   }page.cleanup();
  }
  if(!rows.length)throw Error('No roster table was recognized. Use the CSV template for scanned or unsupported PDFs.');if(rows.length>300)throw Error('Roster has too many entries');
  const season=title.match(/\b20\d{2}\b/)?.[0]||'';return {rows,season,warnings:['Review names, numbers and team levels before applying. Blank levels mean the PDF did not specify them.']};
 }finally{await task.destroy()}
}

module.exports={parse};
