import {node,field,choices,detail,dateText} from './ui.mjs';
const labels={initial:'Initial post',reply:'Reply',teacher:'Teacher response',ai:'Automatic response',critique:'Independent critique'};
const reviewLabels={approved:'Published',needs_review:'Teacher review needed',unavailable:'Automatic scoring unavailable',grading:'Scoring in progress',superseded:'Writing changed'};

export function createWork(ui,{submissions,written,discussions,filterHost}){
 let ctx=null,data=null,filter='',filtered=null,request=null;
 const reload=async(selected,options={force:true})=>{await ui.onSaved(selected);await refresh(options);};
 function render(next,selected,{force=false}={}){
  const changed=ctx!==selected;ctx=selected;data=next;if(changed){filter='';filtered=null;request=null;drawFilter(selected);}
  ui.draw(submissions,[selected.classId,next.submissions],()=>{
   submissions.replaceChildren();if(!next.submissions.length)submissions.append(node('p','No written SCORM responses have been submitted. Discussion reviews appear below.','muted'));
   for(const row of next.submissions){const d=detail(`${row.alias} · ${row.title} · ${row.score===null?'Needs review':row.score+' / '+row.points+' reviewed · '+(row.review_source||'Teacher')}`,'submission:'+row.id);
    if(row.ai_status)d.append(node('p','AI feedback: '+row.ai_status,'muted'));
    d.append(node('p',`${dateText(row.received_at)} · Provisional score: ${row.payload.earned} / ${row.points}`,'muted'));
    for(const [question,answer]of Object.entries(row.payload.answers||{}))d.append(node('h3',question),node('pre',answer));
    const f=node('form'),score=field(f,'Teacher score','number',row.score??row.ai?.total??row.payload.earned,{min:0,max:row.points,step:'any',required:true}),feedback=field(f,'Teacher feedback','textarea',row.feedback||row.ai?.summary||'',{maxLength:1000,rows:3});
    ui.save(f,'Save review',async()=>{const result=await ui.api('/teacher/submissions/'+row.id+'/review','PUT',{score:Number(score.value),feedback:feedback.value,revision:row.revision||0});Object.assign(row,result.review);},selected);d.append(f,node('p','Direct API packages return this private reviewed score to the participant and save it through the native SCORM attempt.','muted'));submissions.append(d);
   }
  },{force});
  ui.draw(written,[selected.classId,next.reviews],()=>{
   written.replaceChildren();if(!next.reviews.length)written.append(node('p','Discussion reviews appear after a learner submits written work.','muted'));
   for(const row of next.reviews){const d=detail(`${row.alias} · ${row.title} · ${reviewLabels[row.status]||row.status} · ${row.final?.total??row.ai?.total??'pending'} / 20`,'review:'+row.id);
    d.className='review-card';d.append(node('h3','Initial response'),node('pre',row.snapshot.initial),node('h3','Selected reply'),node('pre',row.snapshot.reply||'Not submitted'),node('h3','Peer or alternate context'),node('pre',row.snapshot.parent||'None'));
    if(['approved','needs_review','unavailable'].includes(row.status))d.append(ui.button('Review rubric',async()=>{
     const result=await ui.api('/activities/'+row.activityId);ui.assert(selected);if(!d.isConnected||d.querySelector('form'))return;
     const f=node('form'),grade=row.final||row.ai,criteria={};
     for(const [key,levels]of Object.entries(result.activity.case.scoreLevels)){
      const label=result.activity.case.criterionLabels?.[key]||key,points=field(f,label+' points','select','',{ariaLabel:key+' points'});choices(points,levels.map(n=>({id:String(n),label:String(n)})),String(grade?.criteria?.[key]?.points??0));
      const feedback=field(f,label+' feedback','textarea',grade?.criteria?.[key]?.feedback||'',{required:true,maxLength:1600,ariaLabel:key+' feedback'});criteria[key]={points,feedback};
     }
     const summary=field(f,'Teacher summary','textarea',grade?.summary||'',{required:true,maxLength:1600}),response=field(f,'Public teacher response · optional','textarea','',{maxLength:1800}),waive=field(f,'Waive late penalty','checkbox',false);
     ui.save(f,row.status==='approved'?'Publish correction':'Publish reviewed grade',()=>ui.api(`/activities/${row.activityId}/reviews/${row.id}/approve`,'POST',{criteria:Object.fromEntries(Object.entries(criteria).map(([k,v])=>[k,{points:Number(v.points.value),feedback:v.feedback.value}])),summary:summary.value,response:response.value,waiveLate:waive.checked}),selected);d.append(f);
    }));else if(row.status==='superseded')d.append(node('p','The writing or selected peer context changed. A fresh submission is needed before publishing another grade.','muted'));
    written.append(d);
   }
  },{force});
  drawThreads(selected,{force});
 }
 function drawFilter(selected){
  filterHost.replaceChildren();const select=field(filterHost,'Discussion assignment','select','',{id:'discussion-assignment'});
  choices(select,[{id:'',label:'All recent class discussions'},...data.activities.filter(a=>a.template_id!=='scorm-connector-v1').map(a=>({id:a.id,label:a.title}))]);
  select.value=filter;
  select.onchange=()=>{if([...ui.dirty].some(f=>discussions.contains(f))&&!confirm('Discard the unfinished discussion response?')){select.value=filter;return;}
   for(const f of discussions.querySelectorAll('form'))ui.dirty.delete(f);filter=select.value;filtered=null;refresh({force:true}).catch(e=>{if(!e.retired)ui.notice(e.message);});};
  const d=detail('Post a class update','class-update'),f=node('form'),assignment=field(f,'Update assignment','select','',{required:true});
  choices(assignment,[{id:'',label:'Choose an assignment'},...data.activities.filter(a=>a.template_id!=='scorm-connector-v1').map(a=>({id:a.id,label:a.title}))]);
  const body=field(f,'Class update','textarea','',{required:true,maxLength:3000});
  ui.save(f,'Post class update',async()=>{await ui.api('/activities/'+assignment.value+'/posts','POST',{body:body.value});body.value='';},selected);d.append(f);filterHost.append(d);
 }
 function posts(){return filter?(filtered||[]):data.discussions;}
 function drawThreads(selected,{force=false}={}){
  const rows=posts();ui.draw(discussions,[selected.classId,filter,rows],()=>{
   discussions.replaceChildren();if(!rows.length){discussions.append(node('p',filter?'No posts for this assignment yet.':'No discussion posts for this class yet.','muted'));return;}
   const byId=new Map(rows.map(p=>[p.id,p])),children=new Map();for(const p of rows){if(p.parent_id&&byId.has(p.parent_id)){if(!children.has(p.parent_id))children.set(p.parent_id,[]);children.get(p.parent_id).push(p);}}
   for(const list of children.values())list.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
   const roots=rows.filter(p=>!p.parent_id||!byId.has(p.parent_id)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)),seen=new Set();
   const renderRoot=root=>{
    const d=detail(root.alias+' · '+root.title+(root.hidden?' · Hidden thread':''),'thread:'+root.id),composer=node('div');
    d.className='thread';d.dataset.rootId=root.id;
    if(root.parent_id&&!byId.has(root.parent_id))d.append(node('p','Earlier context is outside the recent class list. Select this assignment above to load its full saved thread.','muted'));
    function post(p,depth=0,ancestorHidden=false){
     if(seen.has(p.id))return;seen.add(p.id);const article=node('article',undefined,'discussion-post'+(p.hidden||ancestorHidden?' hidden-post':''));
     article.dataset.postId=p.id;article.append(node('h3',p.alias+' · '+(labels[p.kind]||p.kind)),node('p',dateText(p.created_at)+(p.hidden?' · Hidden':''),'muted'),node('pre',p.body));
     const actions=node('div',undefined,'actions');
     if(!p.hidden&&!ancestorHidden)actions.append(ui.button('Reply',()=>{if([...ui.dirty].some(f=>composer.contains(f))&&!confirm('Discard the unfinished response?'))return;for(const f of composer.querySelectorAll('form'))ui.dirty.delete(f);composer.replaceChildren();const f=node('form'),body=field(f,'Reply to '+p.alias,'textarea','',{required:true,maxLength:3000,rows:3});ui.save(f,'Post teacher reply',async()=>{await ui.api(`/activities/${p.activity_id}/posts`,'POST',{parentId:p.id,body:body.value});body.value='';ui.dirty.delete(f);await reload(selected);},selected);composer.append(f);body.focus();}));
     actions.append(ui.button(p.hidden?'Show post':'Hide post',async()=>{await ui.api(`/activities/${p.activity_id}/posts/${p.id}/moderation`,'PUT',{hidden:!p.hidden});await reload(selected);}));
     if(['ai','teacher'].includes(p.kind))actions.append(ui.button('Edit teacher response',()=>{if([...ui.dirty].some(f=>composer.contains(f))&&!confirm('Discard the unfinished response?'))return;for(const f of composer.querySelectorAll('form'))ui.dirty.delete(f);composer.replaceChildren();const f=node('form'),body=field(f,'Teacher response','textarea',p.body,{required:true,maxLength:3000});ui.save(f,'Save teacher response',async()=>{await ui.api(`/activities/${p.activity_id}/posts/${p.id}/teacher-edit`,'PUT',{body:body.value,revision:p.revision});ui.dirty.delete(f);await reload(selected);},selected);composer.append(f);}));
     article.append(actions);const branch=node('div',undefined,depth?'thread-reply':'thread-root');branch.append(article);d.append(branch);
     for(const child of children.get(p.id)||[])post(child,Math.min(depth+1,12),ancestorHidden||!!p.hidden);
    }
    post(root);d.append(composer);discussions.append(d);
   };
   for(const root of roots)renderRoot(root);for(const p of rows)if(!seen.has(p.id))renderRoot(p);
  },{force});
 }
 async function refresh({force=false}={}){
  const selected=ctx;if(!selected||!filter){if(selected)drawThreads(selected,{force});return;}
  const activityId=filter,token={};request=token;
  const result=await ui.api('/activities/'+activityId);ui.assert(selected);if(request!==token||filter!==activityId)return;
  filtered=result.posts.map(p=>({id:p.id,activity_id:activityId,parent_id:p.parentId,body:p.body,kind:p.kind,hidden:p.hidden,created_at:p.createdAt,alias:p.alias,title:result.activity.title,revision:p.revision}));drawThreads(selected,{force});
 }
 return {render,refresh,async selectActivity(id){if(!data?.activities.some(a=>a.id===id&&a.template_id!=='scorm-connector-v1'))return;filter=id;filtered=null;filterHost.querySelector('select').value=id;await refresh({force:true});},reset(){ctx=null;data=null;filter='';filtered=null;request=null;for(const host of [submissions,written,discussions,filterHost])host.replaceChildren();}};
}
