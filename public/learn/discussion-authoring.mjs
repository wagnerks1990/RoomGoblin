import {node,field,choices,detail} from './ui.mjs';

// The server remains authoritative. These checks keep an incomplete form from
// making an uncertain create request and preserve the teacher's draft on errors.
export function discussionDefinition(draft){
 const required=(value,label,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Enter '+label+' (up to '+max+' characters).');return value.trim();};
 if(!Array.isArray(draft.criteria)||draft.criteria.length<2||draft.criteria.length>8)throw Error('Use 2–8 criteria, including one peer or independent response criterion.');
 if(draft.criteria.filter(c=>c.source==='reply').length!==1)throw Error('Choose exactly one criterion for the peer or independent response.');
 const ids=new Set();
 const criteria=draft.criteria.map(c=>{
  const id=c.source==='reply'?'reply':c.id;
  if(!/^[a-z][a-z0-9_]{0,31}$/.test(id)||['__proto__','prototype','constructor'].includes(id)||ids.has(id))throw Error('Each rubric criterion needs a unique identifier.');ids.add(id);
  const points=Number(c.points);if(!Number.isInteger(points)||points<1||points>1000)throw Error('Set 1–1000 whole points for each criterion.');
  const parts=String(c.levels||'').split(',').map(v=>v.trim());
  const levels=parts.map(Number);
  if(parts.some(v=>!/^\d+$/.test(v))||levels.length<2||levels.length>8||levels[0]!==0||levels.at(-1)!==points||levels.some((n,i)=>!Number.isInteger(n)||n<0||n>points||i>0&&n<=levels[i-1]))throw Error('Score levels must increase from 0 to that criterion’s points, for example 0, 4, 8.');
  return {id,label:required(c.label,'a criterion name',100),description:required(c.description,'the evidence required for each criterion',800),points,levels};
 });
 const points=Number(draft.points);
 if(!Number.isInteger(points)||points<1||points>1000||criteria.reduce((sum,c)=>sum+c.points,0)!==points)throw Error('Rubric points must equal the assignment’s possible points.');
 const optional=(value,label,max)=>value?.trim()?required(value,label,max):'';
 return {schemaVersion:1,kind:'discussion',title:required(draft.title,'the assignment title',120),points,
  courseLabel:optional(draft.courseLabel,'the course and lesson label',120),prompt:required(draft.prompt,'the scenario or discussion question',3000),
  initialDirections:required(draft.initialDirections,'initial post directions',2000),replyDirections:required(draft.replyDirections,'reply directions',1000),
  alternate:required(draft.alternate,'an independent response case',1000),alternateLabel:'Independent case response',
  responseLabel:required(draft.responseLabel,'the instructor response name',40),clipboardPolicy:'blocked',
  latePolicy:optional(draft.latePolicy,'the late policy',500),gradingInstructions:required(draft.gradingInstructions,'the private grading reference',5000),criteria};
}

export function createDiscussionAuthoring(form,ui){
 const host=node('fieldset',undefined,'discussion-authoring');host.hidden=true;
 host.append(node('legend','Custom discussion'));
 host.append(node('p','Students post an initial response and reply to a classmate or the supplied independent case. Automatic comments and rubric grades use the configured grading service; teacher review and corrections remain available.','muted'));
 const courseLabel=field(host,'Course and lesson label · optional','text','',{maxLength:120});
 const prompt=field(host,'Scenario or discussion question','textarea','',{maxLength:3000,rows:5,required:true});
 const initialDirections=field(host,'Initial post directions','textarea','',{maxLength:2000,rows:3,required:true});
 const replyDirections=field(host,'Peer reply directions','textarea','',{maxLength:1000,rows:3,required:true});
 const alternate=field(host,'Independent response case','textarea','',{maxLength:1000,rows:3,required:true});
 const responseLabel=field(host,'Instructor response name','text','Teacher',{maxLength:40,required:true});
 host.append(node('p','This name appears on automatic instructor comments. Internal automation history and private grading records are retained.','muted'));
 const latePolicy=field(host,'Student-facing late policy · optional','textarea','',{maxLength:500,rows:2});
 host.append(node('p','Enter actual due times under availability after creation. Policy text does not set a due time or close submissions.','muted'));
 const gradingInstructions=field(host,'Private grading reference','textarea','',{maxLength:5000,rows:5,required:true});
 host.append(node('p','State the correct concepts, acceptable alternatives and important mistakes. This reference stays server-side and is not included in the student package.','muted'));
 const rows=node('div'),editors=[];let serial=0;
 const total=node('p','','rubric-total');total.setAttribute('aria-live','polite');
 const updateTotal=()=>{total.textContent='Rubric total: '+editors.reduce((n,c)=>n+(Number(c.points.value)||0),0)+' points. Match the assignment’s possible points.';};
 function add(seed={}){
  const id='initial_'+(++serial),row=node('fieldset',undefined,'discussion-criterion');row.append(node('legend','Rubric criterion'));
  const label=field(row,'Criterion name','text',seed.label||'',{maxLength:100,required:true});
  const source=field(row,'Grade this criterion from','select');choices(source,[{id:'initial',label:'Own posts and follow-ups'},{id:'reply',label:'Peer or independent response'}],seed.source||'initial');
  const points=field(row,'Criterion possible points','number',seed.points||1,{min:1,max:1000,required:true});
  const levels=field(row,'Allowed scores · comma separated','text',seed.levels||'0, 1',{maxLength:80,required:true});
  const description=field(row,'Evidence and scoring expectations','textarea','',{maxLength:800,rows:3,required:true});
  const entry={id,row,label,source,points,levels,description};editors.push(entry);
  row.append(ui.button('Remove criterion',()=>{editors.splice(editors.indexOf(entry),1);row.remove();ui.dirty.add(form);updateTotal();}));
  points.addEventListener('input',updateTotal);rows.append(row);updateTotal();
 }
 host.append(node('h3','Rubric'),node('p','Use at least one own-contribution criterion and exactly one peer or independent response criterion. For example, an 8-point criterion can use allowed scores 0, 4, 8.','muted'),rows);
 add({label:'Technical explanation',points:8,levels:'0, 4, 8'});add({label:'Evidence and verification',points:8,levels:'0, 4, 8'});add({label:'Peer or independent response',source:'reply',points:4,levels:'0, 2, 4'});
 host.append(ui.button('Add discussion criterion',()=>{if(editors.length>=8)throw Error('Use up to eight rubric criteria.');add();ui.dirty.add(form);}),total);
 const preview=detail('Review student directions');preview.className='discussion-preview';host.append(ui.button('Preview discussion',()=>{
  const d=read(form.querySelector('[name="title"]').value,form.querySelector('[name="points"]').value);
  preview.replaceChildren(node('summary','Review student directions'),node('h3',d.title),node('p',d.courseLabel),node('p',d.prompt),node('h4','Initial post'),node('p',d.initialDirections),node('h4','Reply or independent response'),node('p',d.replyDirections),node('p',d.alternate));
  for(const c of d.criteria)preview.append(node('p',c.label+' · '+c.points+' points · '+c.description));
  if(d.latePolicy)preview.append(node('p',d.latePolicy));preview.open=true;
 }),preview);
 form.append(host);
 function read(title,points){return discussionDefinition({title,points,courseLabel:courseLabel.value,prompt:prompt.value,initialDirections:initialDirections.value,replyDirections:replyDirections.value,alternate:alternate.value,responseLabel:responseLabel.value,latePolicy:latePolicy.value,gradingInstructions:gradingInstructions.value,criteria:editors.map(c=>({id:c.id,label:c.label.value,source:c.source.value,points:c.points.value,levels:c.levels.value,description:c.description.value}))});}
 function setEnabled(enabled){host.hidden=!enabled;for(const input of host.querySelectorAll('input,select,textarea,button'))input.disabled=!enabled;}
 setEnabled(false);
 return {read,setEnabled};
}
