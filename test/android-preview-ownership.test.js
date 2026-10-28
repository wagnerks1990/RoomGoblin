'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/managed-displays/app.js'),'utf8');
function fixture(){
 const nodes={},handlers={},calls=[],alerts=[],focus=[];let decode=async()=>{};
 const $=id=>nodes[id]??=({open:false,src:'',textContent:'',setAttribute(){},addEventListener(name,handler){handlers[id+':'+name]=handler},showModal(){this.open=true},close(){this.open=false},removeAttribute(name){if(name==='src')this.src=''}});
 const ctx=vm.createContext({$,shotVersion:0,shotDevice:null,deviceById:id=>({id,name:id}),restoreDeviceFocus:id=>focus.push(id),Image:class{decode(){return decode(this.src)}},state:{adbAvailable:true},scheduleRefresh(){},window:{alert:m=>alerts.push(m)},
 api(path,options){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});calls.push({path,options,resolve,reject});return promise}});
 vm.runInContext(source.slice(source.includes('function closeShot(')?source.indexOf('function closeShot('):source.indexOf('$("devices").addEventListener'),source.indexOf('$("runShell").onclick'))+source.slice(source.indexOf('$("closeShot").onclick'),source.indexOf(';document.addEventListener(\'visibilitychange\'')),ctx);
 return {ctx,$,calls,alerts,focus,setDecode:f=>{decode=f},cancel:()=>handlers['shot:cancel']({preventDefault(){}}),click(id){const button={dataset:{op:'screenshot'},disabled:false};return handlers['devices:click']({target:{closest:selector=>selector==='button'?button:{dataset:{id}}}})},close(){ $('closeShot').onclick() }};
}
test('Android screenshot preview opens with progress while capture is pending',async()=>{const h=fixture(),run=h.click('one');assert.equal(h.$('shot').open,true);h.calls[0].resolve({base64:'synthetic-one'});await run});
test('a late Android screenshot cannot reopen a closed preview',async()=>{const h=fixture(),run=h.click('one');h.close();h.calls[0].resolve({base64:'synthetic-one'});await run;assert.equal(h.$('shot').open,false);assert.equal(h.$('shotImage').src,'')});
test('an older Android capture cannot replace the newer requested image',async()=>{const h=fixture(),a=h.click('one'),b=h.click('two');h.calls[1].resolve({base64:'synthetic-two'});await b;h.calls[0].resolve({base64:'synthetic-one'});await a;assert.match(h.$('shotImage').src,/synthetic-two$/)});
test('normal Android capture opens a screenshot and close clears the image',async()=>{const h=fixture(),run=h.click('one');h.calls[0].resolve({base64:'synthetic-one'});await run;assert.equal(h.$('shot').open,true);h.close();assert.equal(h.$('shotImage').src,'')});
test('closing during Android image decoding retires the decoded result',async()=>{
 const h=fixture();let finish;h.setDecode(()=>new Promise(r=>finish=r));const run=h.click('one');h.calls[0].resolve({base64:'synthetic-one'});await new Promise(r=>setImmediate(r));assert.equal(typeof finish,'function');h.close();finish();await run;assert.equal(h.$('shot').open,false);assert.equal(h.$('shotImage').src,'');
});
test('invalid Android image replies remain visible without displaying an image',async()=>{
 const h=fixture(),run=h.click('one');h.calls[0].resolve({base64:null});await run;assert.equal(h.$('shot').open,true);assert.equal(h.$('shotImage').src,'');assert.match(h.$('shotStatus').textContent,/invalid/);assert.equal(h.alerts.length,0);
});
test('Android image decode failures report a fixed error inside the preview',async()=>{
 const h=fixture();h.setDecode(async()=>{throw Error('private decoder detail')});const run=h.click('one');h.calls[0].resolve({base64:'synthetic-one'});await run;assert.equal(h.$('shotImage').src,'');assert.match(h.$('shotStatus').textContent,/could not be decoded/);assert.doesNotMatch(h.$('shotStatus').textContent,/private decoder/);
});
test('late screenshot errors after Escape do not interrupt another workspace',async()=>{
 const h=fixture(),run=h.click('one');h.cancel();h.calls[0].reject(Error('Synthetic capture failure'));await run;assert.equal(h.$('shot').open,false);assert.equal(h.$('shotStatus').textContent,'');assert.equal(h.alerts.length,0);assert.deepEqual(h.focus,['one']);
});
test('a superseded Android decoder cannot replace the latest completed capture',async()=>{
 const h=fixture();let finish;h.setDecode(src=>src.endsWith('synthetic-one')?new Promise(r=>finish=r):Promise.resolve());const one=h.click('one');h.calls[0].resolve({base64:'synthetic-one'});await new Promise(r=>setImmediate(r));const two=h.click('two');h.calls[1].resolve({base64:'synthetic-two'});await two;finish();await one;assert.match(h.$('shotImage').src,/synthetic-two$/);assert.match(h.$('shotStatus').textContent,/two screenshot/);
});
test('oversized Android screenshots and unsupported image types never reach decoding',async()=>{
 for(const reply of [{base64:'x'.repeat(4*Math.ceil(16*1024*1024/3)+1)},{base64:'synthetic-one',contentType:'image/svg+xml'}]){const h=fixture();let decoded=0;h.setDecode(async()=>{decoded++});const run=h.click('one');h.calls[0].resolve(reply);await run;assert.equal(decoded,0);assert.equal(h.$('shotImage').src,'');assert.match(h.$('shotStatus').textContent,/invalid or too large/)}
});
