"""Optional Playwright/Chromium synthetic end-to-end checks. No real LMS accessed."""
from pathlib import Path
import io,json,os,sys,tempfile,threading,time,zipfile
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from portal import App,LimitedServer
from playwright.sync_api import sync_playwright,expect
TOKEN='browser-synthetic-only-'+'q'*32

def run():
 with tempfile.TemporaryDirectory() as td:
  root=Path(td);app=App(root/'portal.sqlite3',TOKEN,'http://127.0.0.1:1',test=True)
  server=LimitedServer(('127.0.0.1',0),app);app.public_origin=f'http://127.0.0.1:{server.server_port}'
  st=threading.Thread(target=lambda:server.serve_forever(poll_interval=.02),daemon=True);st.start()
  class Static(SimpleHTTPRequestHandler):
   def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(root),**kwargs)
   def log_message(self,*args):pass
  static=ThreadingHTTPServer(('127.0.0.1',0),Static);ct=threading.Thread(target=lambda:static.serve_forever(poll_interval=.02),daemon=True);ct.start()
  client_origin=f'http://127.0.0.1:{static.server_port}';app.allowed.add(client_origin)
  try:
   with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    teacher=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
    teacher.on('pageerror',lambda e:errors.append(str(e)))
    teacher.goto(app.public_origin+'/portal/');teacher.locator('#token').fill(TOKEN);teacher.locator('#loginForm button').click()
    expect(teacher.locator('#shell')).to_be_visible();expect(teacher.locator('#status')).to_contain_text('Connected')
    teacher.locator('[data-tab="classes"]').click();teacher.locator('#courseName').fill('IT II test');teacher.locator('#period').fill('Period 7');teacher.locator('#classForm button').click()
    expect(teacher.locator('table')).to_contain_text('IT II test')
    teacher.locator('[data-tab="assignments"]').click();teacher.locator('[data-package="storage-plans"]').click()
    with teacher.expect_download() as download:
     teacher.locator('#packageForm button').click()
    download.value.save_as(root/'package.zip')
    with zipfile.ZipFile(root/'package.zip') as z:z.extractall(root/'learner-a');conf=json.loads(z.read('config.js').decode().split('=',1)[1].rstrip(';\n'))
    with zipfile.ZipFile(io.BytesIO(app.export('storage-plans','Synthetic B'))) as z:z.extractall(root/'learner-b')
    learner=browser.new_page(viewport={'width':390,'height':844});learner.on('pageerror',lambda e:errors.append(str(e)))
    learner.add_init_script("window.scormCalls=[];window.API={LMSInitialize:()=> 'true',LMSGetValue:(k)=>k==='cmi.core.lesson_mode'?'browse':k==='cmi.core.credit'?'no-credit':'',LMSSetValue:(k,v)=>{scormCalls.push([k,v]);return 'true'},LMSCommit:()=> 'true',LMSFinish:()=> 'true',LMSGetLastError:()=> '0'};")
    learner.goto(client_origin+'/learner-a/index.html');expect(learner.locator('#connection')).to_contain_text('API connected',timeout=10000)
    answers=['200 GB Windows and 250 GB data, NTFS, compared with the teacher example.','More Windows capacity but less data capacity than the example.','Keep the disk read-only and verify a recoverable backup before changes.','Inspect the existing partition and volume sizes using read-only evidence.']
    for i,ans in enumerate(answers):learner.locator(f'#answer-{i}').fill(ans)
    # Actual HTTP failures, reload, and retry: no reliance on the simulated-outage button.
    learner.route('**/portal/api/v9/learner/**',lambda route:route.abort())
    learner.locator('#submit').click();expect(learner.locator('#queueStatus')).to_contain_text('1')
    learner.reload();expect(learner.locator('#answer-0')).to_have_value(answers[0]);expect(learner.locator('#queueStatus')).to_contain_text('1')
    learner.unroute('**/portal/api/v9/learner/**');learner.locator('#restore').click();expect(learner.locator('#queueStatus')).to_contain_text('0',timeout=10000)
    with app.connect() as db:assert db.execute('SELECT COUNT(*) FROM submissions WHERE grant_id=?',(conf['participant']['id'],)).fetchone()[0]==1
    teacher.locator('[data-tab="reviews"]').click();expect(teacher.locator('form.review')).to_have_count(1)
    review=teacher.locator('form.review');review.locator('[data-feedback]').fill('Draft survives refresh. Good safety rationale.')
    # A manual refresh is explicitly cancellable; automatic refresh never destroys a draft.
    teacher.on('dialog',lambda dialog:dialog.dismiss());teacher.locator('#refresh').click()
    expect(review.locator('[data-feedback]')).to_have_value('Draft survives refresh. Good safety rationale.')
    for cid,score in [('alloc',5),('strength',5),('backup',6),('improve',4)]:review.locator('[data-score="'+cid+'"]').fill(str(score))
    review.locator('[data-publish]').check();review.locator('button.primary').click();expect(review.locator('.reviewResult')).to_contain_text('Saved 20/20')
    learner.locator('#restore').click();expect(learner.locator('#reviews')).to_contain_text('Teacher-reviewed: 20/20',timeout=10000)
    assert all('score' not in c[0] for c in learner.evaluate('window.scormCalls'))
    learner.locator('#postBody').fill('Synthetic original discussion.');learner.locator('#post').click()
    expect(learner.locator('#posts')).to_contain_text('Synthetic original discussion.',timeout=12000)
    second=browser.new_page();second.goto(client_origin+'/learner-b/index.html');expect(second.locator('#posts')).to_contain_text('Synthetic original discussion.',timeout=10000)
    second.locator('#parent').select_option(index=1);second.locator('#postBody').fill('Synthetic B reply.');second.locator('#post').click()
    expect(second.locator('#posts')).to_contain_text('Synthetic B reply.',timeout=12000)
    teacher.locator('[data-tab="discussions"]').click();expect(teacher.locator('.post')).to_have_count(2)
    teacher.locator('[data-hide]').first.click();learner.locator('#restore').click();expect(learner.locator('#posts')).not_to_contain_text('Synthetic original discussion.',timeout=10000)
    teacher.locator('[data-tab="controls"]').click();teacher.locator('#paused').check();teacher.locator('#stage').fill('3');teacher.locator('#hint').fill('Scoped browser test hint');teacher.locator('#commandForm button').click()
    expect(teacher.locator('#cmdResult')).to_contain_text('saved');expect(learner.locator('#submit')).to_be_disabled(timeout=10000)
    learner.locator('#outage').click();expect(learner.locator('#submit')).to_be_enabled();expect(learner.locator('#answer-0')).to_be_enabled()
    teacher.locator('#paused').uncheck();teacher.locator('#commandForm button').click();expect(teacher.locator('#cmdResult')).to_contain_text('saved')
    learner.locator('#restore').click();expect(learner.locator('#hint')).to_contain_text('Scoped browser test hint',timeout=10000)
    teacher.locator('#displayLink').click();expect(teacher.locator('#displayResult a')).to_be_visible();board=browser.new_page();board.goto(teacher.locator('#displayResult a').get_attribute('href'));expect(board.locator('#submitted')).to_have_text('1')
    assert 'Synthetic B' not in board.locator('body').inner_text()
    teacher.locator('[data-tab="overview"]').click();teacher.locator('#refresh').click();expect(teacher.locator('#status')).to_contain_text('Connected')
    screenshots=Path('/mnt/data/v9_work');screenshots.mkdir(exist_ok=True)
    teacher.screenshot(path=str(screenshots/'portal-desktop.png'),full_page=True)
    for width in [320,390,768,1440]:
     teacher.set_viewport_size({'width':width,'height':900});teacher.wait_for_timeout(60)
     assert teacher.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),f'portal horizontal overflow at {width}'
     learner.set_viewport_size({'width':width,'height':900});learner.wait_for_timeout(60)
     assert learner.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),f'learner horizontal overflow at {width}'
    teacher.set_viewport_size({'width':390,'height':844});teacher.screenshot(path=str(screenshots/'portal-mobile.png'),full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: teacher login, classes, SCORM export, offline network failure + reload recovery, idempotent submission, rubric publication, peer replies, moderation, scoped commands, fail-open pause, aggregate display, 4 responsive widths, no browser exceptions.')
  finally:server.shutdown();server.server_close();static.shutdown();static.server_close();st.join();ct.join()
if __name__=='__main__':run()
