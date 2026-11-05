"""Offline Chromium UI checks using an in-memory fetch stub, not live HTTP/LMS."""
from pathlib import Path
import json,os,sys
from playwright.sync_api import sync_playwright,expect
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from portal import seed_definition
ROOT=Path(__file__).resolve().parents[1]

def run():
 d=seed_definition();assignment={'id':'storage-plans','course_id':'demo-class','revision':1,'definition':d,'locked':False}
 overview={'version':'9.0.0-pilot.1','counts':{'courses':1,'assignments':1,'submissions':1,'posts':0,'reviewed':0},'courses':[{'id':'demo-class','name':'IT I — Essentials','period':'Teacher test'}],'assignments':[assignment],'grants':[],'progress':[],'origins':['https://content.example.test'],'public_origin':'https://portal.example.test'}
 submission={'id':'synthetic:one','label':'Synthetic A','assignment_id':'storage-plans','created':1,'late':False,'answers':{c['id']:'A complete synthetic response for '+c['label'] for c in d['criteria']},'rubric':d['criteria'],'review':None,'review_revision':0}
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  teacher=b.new_page(viewport={'width':1440,'height':1000});errors=[];teacher.on('pageerror',lambda e:errors.append(str(e)))
  teacher.set_content((ROOT/'static/index.html').read_text())
  teacher.add_style_tag(content=(ROOT/'static/style.css').read_text())
  teacher.evaluate('window.MOCK='+json.dumps({'overview':overview,'submissions':[submission]})+';')
  teacher.evaluate('''() => {window.logged=false;window.calls=[];window.fetch=async (url,options={})=>{let path=String(url).split('?')[0].replace('/portal/api/v9','');let data=options.body?JSON.parse(options.body):{};window.calls.push({path,data});let status=200,answer={};if(path==='/session'){status=logged?200:401;answer=logged?{csrf:'synthetic-csrf'}:{error:'Sign in'};}else if(path==='/login'){logged=true;answer={csrf:'synthetic-csrf'};}else if(path==='/overview')answer=MOCK.overview;else if(path==='/courses'){MOCK.overview.courses.push({id:'new-course',name:data.name,period:data.period});answer={id:'new-course'};}else if(path==='/submissions')answer={submissions:MOCK.submissions};else if(path==='/review'){let r=MOCK.submissions[0];r.review={...data,awarded:Object.values(data.scores).reduce((a,b)=>a+b,0),possible:20};r.review_revision++;answer={review:r.review,revision:r.review_revision};}else if(path==='/posts')answer={posts:[]};else if(path==='/command'){answer=options.method==='POST'?{revision:data.revision+1}:{revision:0,paused:false,stage:1,hint:'',discussion_open:true};}else if(path==='/audit')answer={audit:[]};else if(path==='/legacy')answer={available:false,message:'No fixture legacy data.'};else if(path==='/assignments'){answer={id:'new-assignment'};}return new Response(JSON.stringify(answer),{status,headers:{'Content-Type':'application/json'}});};}''')
  teacher.add_script_tag(content=(ROOT/'static/app.js').read_text())
  teacher.locator('#token').fill('synthetic-local-token');teacher.locator('#loginForm button').click();expect(teacher.locator('#shell')).to_be_visible()
  expect(teacher.locator('#status')).to_contain_text('Connected')
  teacher.locator('[data-tab="classes"]').click();teacher.locator('#courseName').fill('IT II');teacher.locator('#period').fill('Period 7');teacher.locator('#classForm button').click();expect(teacher.locator('table')).to_contain_text('IT II')
  teacher.locator('[data-tab="assignments"]').click();teacher.locator('#newAssignment').click();teacher.locator('#assignmentTitle').fill('New assignment');teacher.locator('#instructions').fill('Synthetic instructions');teacher.locator('#addCriterion').click();expect(teacher.locator('#criteria .criterion')).to_have_count(2)
  teacher.locator('#criteria .criterion').last.locator('[data-remove]').click();expect(teacher.locator('#criteria .criterion')).to_have_count(1)
  teacher.locator('#assignmentForm button.primary').click();expect(teacher.locator('#status')).to_contain_text('Assignment saved')
  teacher.locator('[data-tab="reviews"]').click();review=teacher.locator('form.review');expect(review).to_have_count(1)
  review.locator('[data-feedback]').fill('Feedback draft must survive automatic refresh.');teacher.evaluate('refresh()');expect(review.locator('[data-feedback]')).to_have_value('Feedback draft must survive automatic refresh.')
  for c in d['criteria']:review.locator('[data-score="'+c['id']+'"]').fill(str(c['points']))
  review.locator('[data-publish]').check();review.locator('button.primary').click();expect(review.locator('.reviewResult')).to_contain_text('Saved 20/20')
  teacher.locator('[data-tab="controls"]').click();teacher.locator('#paused').check();teacher.locator('#hint').fill('Scoped hint');teacher.locator('#stage').fill('3');teacher.locator('#commandForm button').click();expect(teacher.locator('#cmdResult')).to_contain_text('revision 1')
  sent=teacher.evaluate('window.calls.filter(c=>c.path==="/command" && c.data.assignment_id).pop()');assert sent['data']['assignment_id']=='storage-plans'
  teacher.locator('[data-tab="overview"]').click();teacher.screenshot(path='/mnt/data/v9_work/portal-desktop.png',full_page=True)
  for w in [320,390,768,1440]:
   teacher.set_viewport_size({'width':w,'height':900});assert teacher.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),w
  teacher.set_viewport_size({'width':390,'height':844});teacher.screenshot(path='/mnt/data/v9_work/portal-mobile.png',full_page=True)
  # Local learner UI: true outbox logic with a fake transport and fake LMS runtime.
  config={'apiOrigin':'https://portal.example.test','token':'synthetic-scoped-test-token','assignment':assignment,'participant':{'id':'grant-a','label':'Synthetic A'},'synthetic':True,'version':'9.0.0-pilot.1'}
  learner=b.new_page(viewport={'width':390,'height':844});learner.on('pageerror',lambda e:errors.append(str(e)))
  learner.set_content((ROOT/'scorm/index.html').read_text());learner.add_style_tag(content=(ROOT/'scorm/style.css').read_text())
  learner.evaluate('window.CLASSROOM_CONFIG='+json.dumps(config)+';')
  learner.evaluate('''() => {window.saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=v}});window.scormCalls=[];window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>k==='cmi.core.lesson_mode'?'browse':k==='cmi.core.credit'?'no-credit':'',LMSSetValue:(k,v)=>{scormCalls.push([k,v]);return 'true'},LMSCommit:()=> 'true',LMSFinish:()=> 'true',LMSGetLastError:()=> '0'};window.netFail=false;window.accepted=[];window.command={revision:0,paused:false,pause_remaining:0,stage:1,hint:'',discussion_open:true};window.fetch=async (url,opts={})=>{if(netFail)throw Error('Injected offline transport');let d=String(url).endsWith('/state')?{command,posts:[],submissions:[]}:null;if(!d){const events=JSON.parse(opts.body).events;accepted.push(...events);d={ok:true,accepted_ids:events.map(e=>e.id)};}return new Response(JSON.stringify(d),{status:200});};}''')
  learner.add_script_tag(content=(ROOT/'scorm/learner.js').read_text());expect(learner.locator('#connection')).to_contain_text('API connected')
  learner.locator('#outage').click()
  for i,c in enumerate(d['criteria']):learner.locator('#answer-'+str(i)).fill('Synthetic answer for '+c['label'])
  learner.locator('#submit').click();expect(learner.locator('#queueStatus')).to_contain_text('1');assert learner.evaluate('Object.values(saved).some(x=>x.includes("submission"))')
  learner.locator('#restore').click();expect(learner.locator('#queueStatus')).to_contain_text('0');assert learner.evaluate('accepted.some(e=>e.kind==="submission")')
  learner.evaluate('command={revision:1,paused:true,pause_remaining:120,stage:3,hint:"Scoped hint",discussion_open:true}')
  learner.locator('#restore').click();expect(learner.locator('#submit')).to_be_disabled()
  learner.locator('#outage').click();expect(learner.locator('#submit')).to_be_enabled();expect(learner.locator('#answer-0')).to_be_enabled()
  learner.locator('#save').click();assert learner.evaluate('scormCalls.every(c=>!c[0].includes("score"))')
  for w in [320,390,768,1440]:
   learner.set_viewport_size({'width':w,'height':900});assert learner.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),w
  learner.set_viewport_size({'width':390,'height':844});learner.screenshot(path='/mnt/data/v9_work/learner-mobile.png',full_page=True)
  assert not errors,errors
  b.close()
 print('PASS: offline Chromium DOM checks: sign-in, class creation, rubric editor, draft preservation, criterion review, scoped command payload, learner queue/retry, fail-open simulated pause, no score writes in preview, responsive 320/390/768/1440, no JS exceptions. Fetch/LMS mocked; no live LMS/network assertion.')
if __name__=='__main__':run()
