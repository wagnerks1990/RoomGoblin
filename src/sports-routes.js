"use strict";
const model=require('./sports'),imports=require('./sports-import'),{createSportsService}=require('./sports-service');
function registerSportsRoutes(app,{store,readGuard,writeGuard,adminGuard,canManageSources,canRead,canWrite,canReadAssets,assetGuard,rateLimit,multer,ingestMedia,weather=()=>null,audit=()=>{},canRun=()=>true,track=task=>task}){
 const service=createSportsService({store,ingestMedia,canRun});
 const external=c=>JSON.stringify((c.teams||[]).filter(t=>t.sources?.length).map(t=>[t.id,t.sport,t.category,t.level,t.season,t.enabled,t.sources]).sort((a,b)=>a[0].localeCompare(b[0])));
 const readLimit=rateLimit({windowMs:60000,limit:240,keyGenerator:()=> 'sports-read',skip:req=>req.route?.path==='/api/v1/sports/boards/:id/display'?!canReadAssets(req):!canRead(req),standardHeaders:'draft-8',legacyHeaders:false});
 const writeLimit=rateLimit({windowMs:60000,limit:20,keyGenerator:()=> 'sports-write',skip:req=>req.route?.path==='/api/v1/sports/refresh'?!canManageSources(req):!canWrite(req),standardHeaders:'draft-8',legacyHeaders:false});
 const fail=(res,error)=>res.status(error.status||400).json({ok:false,error:error.message});
 app.get('/api/v1/sports',readLimit,readGuard,(_req,res)=>res.json({ok:true,config:service.read(),sources:service.status()}));
 app.put('/api/v1/sports',writeLimit,...writeGuard,(req,res)=>{try{const before=service.read(),after=model.normalize(req.body);if(!canManageSources(req)&&external(before)!==external(after))return res.status(403).json({ok:false,error:'Administrator permission is required to change external sources or their team mappings'});const config=service.save(after);audit({kind:'sports.save',revision:config.revision,teams:config.teams.length,boards:config.boards.length});res.json({ok:true,config,sources:service.status()})}catch(e){fail(res,e)}});
 app.post('/api/v1/sports/undo',writeLimit,...writeGuard,(req,res)=>{try{const previous=store.getPreference(model.KEY+'.previous',{});if(!canManageSources(req)&&external(previous)!==external(service.read()))return res.status(403).json({ok:false,error:'Administrator permission is required to restore external sources'});res.json({ok:true,config:service.undo(req.body?.revision),sources:service.status()})}catch(e){fail(res,e)}});
 app.post('/api/v1/sports/refresh',writeLimit,adminGuard,async(_req,res)=>{try{res.json({ok:true,...await service.refresh(true)})}catch(e){fail(res,e)}});
 app.get('/api/v1/sports/boards/:id/display',readLimit,assetGuard,(req,res)=>{try{res.json({ok:true,...model.project(service.read(),req.params.id,{weather:weather(),sourceStatus:service.status()})})}catch(e){res.status(404).json({ok:false,error:'Sports board unavailable'})}});
 app.post('/api/v1/sports/boards/:id/scene',readLimit,readGuard,(req,res)=>{const board=service.read().boards.find(b=>b.id===req.params.id);if(!board)return res.status(404).json({ok:false,error:'Sports board not found'});res.json({ok:true,scene:model.scene(board)})});
 app.post('/api/v1/sports/import/workspace',writeLimit,...writeGuard,(req,res)=>{try{res.json({ok:true,config:model.normalize(req.body)})}catch(e){fail(res,e)}});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5242880,files:1,fields:4}}).single('file');
 app.post('/api/v1/sports/import/roster',writeLimit,...writeGuard,
  (req,res,next)=>upload(req,res,error=>error?fail(res,Error('Upload a roster PDF under 5 MiB')):next()),
  async(req,res)=>{try{if(req.file)return res.json({ok:true,...await imports.rosterPDF(req.file.buffer)});res.json({ok:true,rows:imports.rosterCSV(req.body?.csv),warnings:['Review team level, spelling and jersey numbers before applying.']})}catch(e){fail(res,e)}});
 app.post('/api/v1/sports/import/events',writeLimit,...writeGuard,(req,res)=>{try{res.json({ok:true,events:req.body?.calendar?imports.calendar(req.body.calendar).events:imports.csv(req.body?.csv),warnings:['Review the team, time zone and final scores before applying.']})}catch(e){fail(res,e)}});
 const refresh=()=>{if(canRun())track(service.refresh()).catch(()=>{})};
 const timer=setInterval(refresh,300000);timer.unref?.();
 const initial=setTimeout(refresh,15000);initial.unref?.();
 return {service,close:()=>{clearInterval(timer);clearTimeout(initial)}};
}
module.exports={registerSportsRoutes};
