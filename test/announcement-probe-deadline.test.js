const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),http=require('node:http');
const source=fs.readFileSync(require.resolve('../src/server'),'utf8');const a=source.indexOf('async function fetchWithDeadline('),b=source.indexOf('function localMinutesNow(',a);assert.ok(a>0&&b>a);
async function probe(t,kind){const server=http.createServer((_q,r)=>{if(kind==='stalled'){r.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl'});r.flushHeaders();r.write('#EXTM3U\n');return}r.writeHead(kind==='offline'?404:kind==='unknown'?500:200);r.end('#EXTM3U\n#EXTINF:3,\nsegment.ts\n')});server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin='http://127.0.0.1:'+server.address().port,ctx=vm.createContext({Date,URL,AbortController,fetch,Buffer,Response,setTimeout:(fn,delay)=>setTimeout(fn,Math.min(delay,200)),clearTimeout,validateDisplayGatewayTarget:url=>url,MORNING_ANNOUNCEMENTS_ALLOWED_HOSTS:new Set(),announcementsCoordinates:()=>({origin}),announcementHlsProbeUrl:(_c,suffix)=>origin+'/'+(suffix||'primary'),publicAnnouncementProbeUrl:url=>url});vm.runInContext(source.slice(a,b),ctx);const pending=ctx.probeMorningAnnouncementsLive();let timer;try{return await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve({deadlineExceeded:true}),1500)})])}finally{clearTimeout(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pending}}
test('announcement probe deadline covers a body stalled after headers',async t=>{const result=await probe(t,'stalled');assert.equal(result.deadlineExceeded,undefined);assert.equal(result.live,null);assert.equal(result.status,'unavailable')});
for(const [kind,live]of [['live',true],['offline',false],['unknown',null]])test('normal announcement probe evidence '+kind,async t=>{const result=await probe(t,kind);assert.equal(result.deadlineExceeded,undefined);assert.equal(result.live,live)});

function transport(fetchImpl,validate=url=>url){
 const ctx=vm.createContext({Date,URL,AbortController,fetch:fetchImpl,Buffer,Response,setTimeout,clearTimeout,validateDisplayGatewayTarget:validate,MORNING_ANNOUNCEMENTS_ALLOWED_HOSTS:new Set()});
 vm.runInContext(source.slice(a,b),ctx);return ctx;
}
for(const declared of [true,false])test('playlist size is bounded for '+(declared?'declared':'streamed')+' bytes',async()=>{
 let signal;const h=transport(async(_url,options)=>{signal=options.signal;return new Response(declared?'small':Buffer.alloc(512*1024+1),{headers:declared?{'content-length':String(512*1024+1)}:{}})});
 await assert.rejects(h.fetchWithDeadline('https://media.example.test/live',{},500),/playlist exceeds size limit/);assert.equal(signal.aborted,true);
});
test('a playlist at the exact byte limit remains readable after transport cleanup',async()=>{
 let signal;const body=Buffer.alloc(512*1024,32),h=transport(async(_url,options)=>{signal=options.signal;return new Response(body)});
 const response=await h.fetchWithDeadline('https://media.example.test/live',{},500);assert.equal((await response.arrayBuffer()).byteLength,body.length);assert.equal(signal.aborted,true);
});
test('redirect bodies are cancelled and each new target passes the allowlist',async()=>{
 const first=new Response('redirect-body',{status:302,headers:{location:'/next'}}),seen=[];let calls=0;
 const h=transport(async()=>calls++?new Response('#EXTM3U'):first,url=>{seen.push(String(url));return url});
 assert.equal(await (await h.fetchWithDeadline('https://media.example.test/start',{},500)).text(),'#EXTM3U');
 assert.deepEqual(seen,['https://media.example.test/start','https://media.example.test/next']);assert.equal(first.bodyUsed,true);
});
test('non-success bodies are discarded without weakening primary offline evidence',async()=>{
 let cancelled=0;const body=new ReadableStream({cancel(){cancelled++}}),h=transport(async()=>new Response(body,{status:404}));
 const response=await h.fetchWithDeadline('https://media.example.test/live',{},500);assert.equal(response.status,404);assert.equal(cancelled,1);assert.equal(await response.text(),'');
});
test('empty success responses remain invalid playlists without a response-construction error',async()=>{
 const h=transport(async()=>new Response(null,{status:204}));const response=await h.fetchWithDeadline('https://media.example.test/live',{},500);assert.equal(response.status,204);assert.equal(await response.text(),'');
});
test('a rejected redirect is never fetched and its connection is released',async()=>{
 let calls=0,signal;const h=transport(async(_url,options)=>{calls++;signal=options.signal;return new Response('redirect',{status:302,headers:{location:'https://blocked.example.test/'}})},url=>{if(String(url).includes('blocked'))throw Error('fixture allowlist rejection');return url});
 await assert.rejects(h.fetchWithDeadline('https://media.example.test/live',{},500),/allowlist rejection/);assert.equal(calls,1);assert.equal(signal.aborted,true);
});
