'use strict';
const MODEL_SHA256='06e0beb4adecd05a6d04f5dd9d42669dc3020fe6669f68302ac0ff85e1600b6c';
const SOURCE='https://github.com/vainmari/Veyon-detection/tree/db02a70439aad0c21e93de51d37761e082a9c393';
function validateResult(value){
  if(value?.ok!==true||value.modelSha256!==MODEL_SHA256||!Array.isArray(value.detections)||value.detections.length>100)throw Error('Unexpected local model response');
  for(const d of value.detections)if(typeof d.label!=='string'||d.label.length>100||!Number.isFinite(d.confidence)||d.confidence<0||d.confidence>1||!Array.isArray(d.box)||d.box.length!==4||!d.box.every(n=>Number.isFinite(n)&&n>=0&&n<=4096))throw Error('Invalid local detection');
  return {ok:true,detections:value.detections.map(d=>({label:d.label,confidence:d.confidence,box:d.box})),modelSha256:MODEL_SHA256,source:SOURCE,retained:false};
}
class VeyonAI{
  constructor({token,fetchImpl=fetch}){this.token=token;this.fetchImpl=fetchImpl;this.busy=false}
  async analyze(capture){
    if(!/^[\x21-\x7e]{32,256}$/.test(this.token||''))throw Error('Configure the separate local AI pilot before using screen analysis');
    if(this.busy)throw Error('A screen analysis is already running');
    this.busy=true;let timer;
    try{
      const frame=await capture();
      if(!Buffer.isBuffer(frame)||!frame.length||frame.length>4*1024*1024)throw Error('Screen capture exceeds the local AI limit');
      const controller=new AbortController();timer=setTimeout(()=>controller.abort(),20000);
      const response=await this.fetchImpl('http://127.0.0.1:3025/analyze',{method:'POST',redirect:'error',signal:controller.signal,headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/octet-stream'},body:frame});
      if(!response.ok)throw Error('Local AI service refused analysis');
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.byteLength;if(size>65536){controller.abort();throw Error('Local AI response exceeds limit')}chunks.push(Buffer.from(chunk))}
      return validateResult(JSON.parse(Buffer.concat(chunks).toString()));
    }catch{throw Error('Local AI analysis unavailable or failed. Check the separate pilot service and configuration.')}finally{clearTimeout(timer);this.busy=false}
  }
}
module.exports={VeyonAI,validateResult,MODEL_SHA256,SOURCE};
