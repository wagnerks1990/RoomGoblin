"""Browser layout regression tests against the real receiver HTML and scripts.

Only the WebSocket transport, branding API, and unrelated audio SDK are mocked.
No layout function, measurement, stylesheet or DOM component is mocked.
Run: python -m unittest discover -s test/browser -v
"""
import base64
import copy
import json
import os
from pathlib import Path
import re
import unittest
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'test-results' / 'display'
VERSION = re.search(r"DISPLAY_BUILD='([^']+)'", (ROOT/'public/display/index.html').read_text())[1]
NOW = 1788970000000
P7 = {
    'background': {'color': '#000000'},
    'title': 'Period 7 - Classroom Announcement',
    'titleOptions': {'size': 72, 'color': '#ffffff'},
    'subtitle': 'Remember to Behave and Place Cellphone in Locker before Bell',
    'subtitleOptions': {'size': 40, 'color': '#ffffff'},
    'text': 'Classroom Update\n\nUnit 1 - Course Models, Architecture, and Core Concepts\n\nSelect today\'s assignment(s) - 01/15/2030\n\nDO NOW - LESSON - LEARN - DISCUSSION - ASSIGNMENT - CHECK UNDERSTANDING',
    'textOptions': {'size': 54, 'color': '#ffffff', 'position': 'center'},
    'timer': {'visible': True, 'running': False, 'mode': 'countdown', 'remainingSeconds': 0,
              'durationSeconds': 3600, 'fontSize': 75, 'position': 'bottom',
              'label': 'Period 7 • Class Ends In', 'timerInstanceId': 'fixture-p7'},
}
P6 = copy.deepcopy(P7)
P6.update(title='Period 6 - Classroom Instructions', subtitle='Classroom Instructor',
          text='01/15/2030\n\nDO NOW - LEARN - MODULES - EXIT TICKET')
P6['timer'].update(label='Period 6 • Class Ends In', timerInstanceId='fixture-p6')
CLUB_SELECTION = {
    'background': {'color': '#000000'},
    'title': 'Please log in to Schoology during HOMEROOM\nand complete your Club Selection',
    'titleOptions': {'size': 72, 'color': '#ffffff'},
    'subtitle': '10th, 11th & 12th Grade Students',
    'subtitleOptions': {'size': 40, 'color': '#ffffff'},
    'text': ('Select a 1st Choice\nSelect a 2nd Choice\nSelect a 3rd Choice\n'
             'Make sure all three choices are different\n\n'
             'Choosing three different clubs gives you a better chance of\n'
             'being placed in a club you selected.'),
    'textOptions': {'size': 54, 'color': '#ffffff', 'position': 'center'},
    'timer': {'visible': True, 'running': False, 'mode': 'countdown',
              'remainingSeconds': 295, 'durationSeconds': 300, 'fontSize': 75,
              'position': 'bottom', 'label': 'B2 - P8 • Class Ends In',
              'timerInstanceId': 'fixture-club-selection'},
}

NOCTI_DYNAMIC = {
    'background': {'color': '#000000'},
    'title': 'B1 - P5 / IT IV - Workstation/Server OS - 9/21/2026',
    'titleOptions': {'size': 92, 'color': '#ffffff'},
    'subtitle': 'Classroom Instructor',
    'subtitleOptions': {'size': 44, 'color': '#ffffff'},
    'text': ('NOCTI Pre-Test Thursday 10/8/2026\n\n'
             '*On 10/8 Report to the Testing Center instead of class.\n\n'
             '*You also should have received email from Nocti with Study Guides.'),
    'textOptions': {'size': 64, 'color': '#ffffff', 'position': 'center'},
    'timer': {'visible': True, 'running': False, 'mode': 'countdown',
              'remainingSeconds': 2091, 'durationSeconds': 3600, 'fontSize': 64,
              'position': 'bottom', 'label': 'B1 - P5 • Class Ends In',
              'timerInstanceId': 'fixture-nocti-dynamic'},
}

TV8_LIVE_DYNAMIC = {
    'background': {'color': '#000000'},
    'title': 'CareerSafe Certificate of Completion',
    'titleOptions': {'size': 92, 'color': '#ffffff'},
    'subtitle': 'Classroom Instructor',
    'subtitleOptions': {'size': 44, 'color': '#ffffff'},
    'text': ('PD 2 - 5 of 7\n\n'
             'PD 3 - 10 of 18\n\n'
             'PD  4 - 5 of 10\n\n'
             'Completed and passed so far!'),
    'textOptions': {'size': 64, 'color': '#ffffff', 'position': 'center'},
    'timer': {'visible': True, 'running': False, 'mode': 'countdown',
              'remainingSeconds': 5063, 'durationSeconds': 5400, 'fontSize': 64,
              'position': 'bottom', 'label': 'P4 - IT I • Class Ends In',
              'timerInstanceId': 'fixture-tv8-live-dynamic'},
}

TRANSPORT = """(() => {
  window.__now = 1788970000000;
  Date.now = () => window.__now;
  window.__sent = [];
  window.WebSocket = class {
    constructor() { this.readyState=1; window.__receiverSocket=this; setTimeout(()=>this.onopen?.(),0); }
    send(data) { window.__sent.push(JSON.parse(data)); }
    close() { this.readyState=3; this.onclose?.(); }
  };
})()"""
MEASURE = """() => {
 const stage=document.getElementById('stage'), sr=stage.getBoundingClientRect();
 const scale=Number(stage.dataset.scale);
 const rect=el=>{const r=el.getBoundingClientRect();return {x:(r.x-sr.x)/scale,y:(r.y-sr.y)/scale,w:r.width/scale,h:r.height/scale}};
 const result={diagnostics:window.ClassroomDisplayDiagnostics(), stage:{x:sr.x,y:sr.y,w:sr.width,h:sr.height}, parts:{}, ranges:[]};
 for(const [name,child,parent] of [['title','title','titleRegion'],['subtitle','subtitle','subtitleRegion'],['body','text','textLayer'],['timer','timerOverlay','timerRegion']]) {
  const el=document.getElementById(child), box=document.getElementById(parent);
  if(!el.textContent.trim() || getComputedStyle(box).display==='none')continue;
  result.parts[name]={font:parseFloat(getComputedStyle(el).fontSize), child:rect(el), box:rect(box), logicalBox:{x:box.offsetLeft,y:box.offsetTop,w:box.clientWidth,h:box.clientHeight}, text:el.textContent, scrollW:el.scrollWidth,clientW:el.clientWidth};
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()) {
   if(!walker.currentNode.textContent.trim())continue;
   const range=document.createRange();range.selectNodeContents(walker.currentNode);
   for(const r of range.getClientRects())if(r.width>0)result.ranges.push({name,x:(r.x-sr.x)/scale,y:(r.y-sr.y)/scale,w:r.width/scale,h:r.height/scale});
  }
 }
 return result;
}"""

class DisplayBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUTPUT.mkdir(parents=True, exist_ok=True)
        cls.pw = sync_playwright().start()
        cls.engine = os.getenv('DISPLAY_TEST_BROWSER', 'chromium')
        launch = {'headless': True}
        if os.getenv('DISPLAY_TEST_EXECUTABLE'):
            launch['executable_path'] = os.environ['DISPLAY_TEST_EXECUTABLE']
        cls.browser = getattr(cls.pw, cls.engine).launch(**launch)
        cls.measurements = []

    @classmethod
    def tearDownClass(cls):
        (OUTPUT/f'{cls.engine}-measurements.json').write_text(json.dumps(cls.measurements, indent=2))
        cls.browser.close()
        cls.pw.stop()

    def page(self, width=1920, height=1080, dpr=1, layout_css=True):
        context = self.browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dpr)
        self.addCleanup(context.close)
        page = context.new_page()
        self.errors = []
        page.on('pageerror', lambda err: self.errors.append(str(err)))
        page.add_init_script(TRANSPORT)
        def route(req):
            path = urlparse(req.request.url).path
            if path == '/api/v1/branding':
                return req.fulfill(json={'branding': {}})
            if path == '/display/sendspin.bundle.js':
                return req.fulfill(content_type='text/javascript', body='export class SendspinPlayer {}')
            if path == '/display/layout.css' and not layout_css:
                return req.fulfill(content_type='text/css', body='')
            if path in ['/display/tv7', '/display/tv1', '/display/']:
                path = '/display/index.html'
            file = ROOT/'public'/path.lstrip('/')
            if not file.is_file():
                return req.fulfill(status=404, body='not found')
            mime = {'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf'}.get(file.suffix,'text/plain')
            return req.fulfill(content_type=mime, body=file.read_bytes())
        page.route('**/*', route)
        self.open_renderer(page)
        page.wait_for_function("window.__receiverSocket && window.ClassroomDisplayDiagnostics && document.getElementById('stage').dataset.fontStatus !== 'loading'")
        self.assertFalse(self.errors)
        return page

    def open_renderer(self, page):
        if not os.getenv('DISPLAY_TEST_INLINE'):
            page.goto('http://127.0.0.1:31337/display/tv7')
            return
        # Restricted local test environments may disallow all URL navigation.
        # Inline identical source/CSS/font bytes without changing browser policy.
        # CI always exercises the unmodified URL/asset-loading path above.
        page.evaluate(TRANSPORT)
        html=(ROOT/'public/display/index.html').read_text()
        css=(ROOT/'public/display/layout.css').read_text()
        for name in ['LiberationSans-Regular.ttf','LiberationSans-Bold.ttf']:
            encoded=base64.b64encode((ROOT/'public/display/fonts'/name).read_bytes()).decode()
            css=css.replace('/display/fonts/'+name,'data:font/ttf;base64,'+encoded)
        html=re.sub(r'<link rel="stylesheet" href="/display/layout.css[^"]*">',lambda _: '<style>'+css+'</style>',html)
        attribution=(ROOT/'public/shared/attribution.css').read_text()
        html=re.sub(r'<link rel="stylesheet" href="/shared/attribution.css[^"]*">',lambda _: '<style>'+attribution+'</style>',html)
        for name in ['scene.js', 'scene.css']:
            source=(ROOT/'public/shared'/name).read_text()
            tag=f'<script src="/shared/{name}"></script>' if name.endswith('.js') else f'<link rel="stylesheet" href="/shared/{name}">'
            html=html.replace(tag, '<script>'+source+'</script>' if name.endswith('.js') else '<style>'+source+'</style>')
        loc="{pathname:'/display/tv7',protocol:'http:',host:'127.0.0.1:31337',origin:'http://127.0.0.1:31337',search:'',hash:'',href:'http://127.0.0.1:31337/display/tv7'}"
        def shared(match):
            name=match[1]
            source=(ROOT/'public/shared'/name).read_text()
            return '<script>(function(location){'+source+'})('+loc+');</script>'
        html=re.sub(r'<script src="/shared/(branding.js|attribution.js)[^"]*" defer></script>',shared,html)
        module=(ROOT/'public/display/layout.mjs').read_text().replace('export ','')
        timer_module=(ROOT/'public/display/timer-effects.mjs').read_text().replace('export ','')
        html=html.replace('<script src="/shared/timer-effects.js"></script>','<script>'+(ROOT/'public/shared/timer-effects.js').read_text()+'</script>')
        html=html.replace('<link rel="stylesheet" href="/display/timer-effects.css">','<style>'+(ROOT/'public/display/timer-effects.css').read_text()+'</style>')
        common=(ROOT/'public/shared/common.js').read_text().replace('export ','')
        security=(ROOT/'public/display/security.mjs').read_text().replace('export ','')
        html=re.sub(r'^import .*?;?$', '', html, flags=re.M)
        html=html.replace('<script type="module">', '<script type="module">const location='+loc+';'+module+timer_module+common+security+';class SendspinPlayer {}')
        page.set_content(html,wait_until='load')

    def reload_renderer(self, page):
        if os.getenv('DISPLAY_TEST_INLINE'): self.open_renderer(page)
        else: page.reload()

    def settle(self, page):
        page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')

    def replay(self, page, state):
        page.evaluate('(m)=>window.__receiverSocket.onmessage({data:JSON.stringify(m)})',
                      {'type': 'hello.ack', 'version': VERSION, 'state': state})
        self.settle(page)

    def command(self, page, kind, payload):
        page.evaluate('(m)=>window.__receiverSocket.onmessage({data:JSON.stringify(m)})',
                      {'type': 'command', 'command': {'type': kind, 'payload': payload}})
        self.settle(page)

    def measure(self, page, label, expected_font_status='ready'):
        data = page.evaluate(MEASURE)
        self.measurements.append({'label':label, **data})
        page.screenshot(path=str(OUTPUT/f'{self.engine}-{label}.png'))
        self.assertEqual(data['diagnostics']['fontStatus'], expected_font_status)
        self.assertFalse(self.errors, self.errors)
        self.assertEqual(page.locator('script[data-controlhub-display-autofit]').count(), 0)
        for name, item in data['parts'].items():
            self.contained(item['child'], item['box'], name)
            self.assertLessEqual(item['scrollW'], item['clientW'] + 1, name)
        for item in data['ranges']:
            self.contained(item, data['parts'][item['name']]['box'], f"{item['name']} glyphs")
        parts = list(data['parts'].items())
        for i, (name, item) in enumerate(parts):
            for other, other_item in parts[i+1:]:
                a,b=item['box'],other_item['box']
                overlap = min(a['y']+a['h'],b['y']+b['h'])-max(a['y'],b['y'])
                self.assertLessEqual(overlap, 0.75, f'{name} overlaps {other}')
        return data

    def contained(self, child, box, label):
        for dimension, size in [('x','w'),('y','h')]:
            self.assertGreaterEqual(child[dimension], box[dimension]-1, label)
            self.assertLessEqual(child[dimension]+child[size], box[dimension]+box[size]+1, label)

    def signature(self, data):
        # Compare untransformed DOM geometry, not round-tripped paint coordinates.
        # Firefox quantizes transformed rects; containment still checks those rects.
        return {name:(round(p['font'],2),*[p['logicalBox'][d] for d in ['x','y','w','h']]) for name,p in data['parts'].items()}

    def test_manual_content_clear_removes_scene_timer_blackout_and_web_audio(self):
        page = self.page()
        scene = {'width': 1920, 'height': 1080, 'layers': [
            {'id': 'old', 'type': 'text', 'text': 'Old scene', 'fontSize': 60}]}
        state = copy.deepcopy(P7)
        state.update(textOptions={'scene': scene}, presentationBlack=True,
                     layers=[{'id': 'old-overlay', 'expiresAt': NOW + 60000, 'scene': scene}],
                     media={'type': 'web', 'url': '/document-viewer/', 'forceAudio': True})
        self.replay(page, state)
        page.evaluate("window.__oldFrame=document.querySelector('#media iframe')")
        self.command(page, 'display.identify', {'durationMs': 30000})
        # This is the legacy-compatible sequence emitted by both manual entry points.
        self.command(page, 'display.clear', {})
        self.command(page, 'display.image', {'url': '/test-images/tv1.svg'})
        result = page.evaluate("""() => ({
            oldFrameConnected:__oldFrame.isConnected, oldFrameUrl:__oldFrame.src,
            layers:document.querySelectorAll('#sceneBase > *, #sceneShared > *').length,
            text:['title','subtitle','text'].map(id=>document.getElementById(id).textContent),
            timer:getComputedStyle(document.getElementById('timerOverlay')).display,
            black:getComputedStyle(document.getElementById('presentationBlack')).display,
            identify:getComputedStyle(document.getElementById('identify')).display,
            media:[...document.getElementById('media').children].map(n=>n.tagName)
        })""")
        self.assertFalse(result['oldFrameConnected'])
        self.assertEqual(result['oldFrameUrl'], 'about:blank')
        self.assertEqual(result['layers'], 0)
        self.assertEqual(result['text'], ['', '', ''])
        for key in ['timer', 'black', 'identify']:
            self.assertEqual(result[key], 'none')
        self.assertEqual(result['media'], ['IMG'])
        self.assertFalse(self.errors)

    def test_retired_video_cannot_resume_audio_or_report_successor_ended(self):
        page = self.page()
        self.command(page, 'display.video', {'url': '/media/old.mp4', 'sessionId': 'old', 'autoplay': False})
        page.evaluate("""() => {
            const video=window.__oldVideo=document.querySelector('#media video');
            window.__lateCanPlay=video.oncanplay; window.__lateEnded=video.onended;
            window.__playCount=0;
            video.play=()=>{window.__playCount++;return new Promise(resolve=>window.__finishPlay=resolve)};
        }""")
        # Replay keeps the same session; its play promise is still pending on replacement.
        self.replay(page, {'media': {'type': 'video', 'url': '/media/old.mp4', 'sessionId': 'old', 'autoplay': True}})
        page.evaluate("window.__lateCanPlay()")
        self.command(page, 'display.clear', {})
        self.command(page, 'display.image', {'url': '/test-images/tv1.svg'})
        page.evaluate("""async () => {
            window.__sent=[];window.__badgeBefore=document.getElementById('badge').textContent;
            __finishPlay();await Promise.resolve();__lateCanPlay();__lateEnded();
            for(const name of ['error','loadedmetadata','playing'])__oldVideo.dispatchEvent(new Event(name));
        }""")
        page.wait_for_timeout(180)
        self.assertEqual(page.evaluate("__playCount"), 1)
        self.assertTrue(page.evaluate("__oldVideo.paused && __oldVideo.muted && !__oldVideo.hasAttribute('src') && !__oldVideo.isConnected"))
        self.assertEqual(page.evaluate("document.getElementById('badge').textContent"), page.evaluate("__badgeBefore"))
        self.assertFalse(page.evaluate("__sent.some(m=>m.type==='display.media.ended'||m.type==='display.media.status')"))
        self.assertEqual(page.locator('#media img').count(), 1)
        self.assertFalse(self.errors)

    def test_media_controls_and_same_session_replay_keep_video_element(self):
        page = self.page()
        media = {'type': 'video', 'url': '/media/clip.mp4', 'sessionId': 'live', 'autoplay': False, 'volume': .5}
        self.replay(page, {'media': media})
        page.evaluate("window.__video=document.querySelector('#media video')")
        self.command(page, 'display.media.control', {'action': 'volume', 'volume': .25})
        self.command(page, 'display.media.control', {'action': 'pause'})
        self.assertEqual(page.evaluate('__video.volume'), .25)
        self.replay(page, {'media': {**media, 'volume': .25}})
        self.assertTrue(page.evaluate("__video===document.querySelector('#media video')"))
        self.assertEqual(page.evaluate('__video.volume'), .25)
        self.assertFalse(self.errors)

    def test_01_p6_p7_cross_resolution_and_reload(self):
        baseline={}
        for w,h,dpr in [(1920,1080,1),(3840,2160,1),(1920,1080,2),(1280,720,1),(1082,1226,1)]:
            page=self.page(w,h,dpr)
            for name,state in [('p6',P6),('p7',P7)]:
                self.replay(page,state)
                data=self.measure(page,f'{name}-{w}x{h}-dpr{dpr}')
                self.assertGreater(data['parts']['body']['font'], 54 if name=='p6' else 30)
                if name in baseline:self.assertEqual(self.signature(data),baseline[name])
                else:baseline[name]=self.signature(data)
                self.reload_renderer(page);page.wait_for_function('window.__receiverSocket && window.ClassroomDisplayDiagnostics')
                self.replay(page,state)
                page.wait_for_function("document.getElementById('stage').dataset.fontStatus==='ready'")
                self.settle(page)
                self.assertEqual(self.signature(page.evaluate(MEASURE)),baseline[name])

    def test_02_live_commands_equal_replay_and_preserve_colors(self):
        page=self.page()
        state=copy.deepcopy(P7)
        state['titleOptions']['color']='#ffcc00';state['subtitleOptions']['color']='#00ddff'
        self.command(page,'display.clear',{})
        self.command(page,'display.title',{'text':state['title'],**state['titleOptions']})
        self.command(page,'display.subtitle',{'text':state['subtitle'],**state['subtitleOptions']})
        self.command(page,'display.text',{'text':state['text'],**state['textOptions']})
        self.command(page,'display.timer',state['timer'])
        live=self.measure(page,'live-commands')
        self.replay(page,state)
        self.assertEqual(self.signature(page.evaluate(MEASURE)),self.signature(live))
        self.assertEqual(page.locator('#title').evaluate('(el)=>getComputedStyle(el).color'),'rgb(255, 204, 0)')
        self.assertEqual(page.locator('#subtitle').evaluate('(el)=>getComputedStyle(el).color'),'rgb(0, 221, 255)')

    def test_03_timer_ticks_hour_boundary_expiry_no_global_layout(self):
        page=self.page()
        state=copy.deepcopy(P7)
        state['timer'].update(running=True,endAt=NOW+3601000)
        self.replay(page,state)
        before=self.measure(page,'timer-start')
        count=before['diagnostics']['passCount']
        for advance in [2000,3599000,3602000]:
            page.evaluate('(now)=>window.__now=now',NOW+advance)
            page.wait_for_timeout(1100)
            data=self.measure(page,f'timer-{advance}')
            self.assertEqual(self.signature(data),self.signature(before))
            self.assertEqual(data['diagnostics']['passCount'],count)
        self.assertEqual(page.locator('#timerValue').inner_text(),'00:00')
        page.evaluate("window.__receiverSocket.onmessage({data:JSON.stringify({type:'heartbeat.ack'})})")
        self.settle(page)
        self.assertEqual(page.evaluate('window.ClassroomDisplayDiagnostics().passCount'),count)

    def test_04_timer_positions_hide_show_and_label(self):
        page=self.page()
        for position in ['bottom','top','center']:
            state=copy.deepcopy(P7);state['timer']['position']=position
            state['timer']['label']='Class Ends In '+('long label '*25)
            state['timer']['borderWidth']=24
            self.replay(page,state)
            self.measure(page,'timer-position-'+position)
        self.command(page,'display.timer.hide',{})
        hidden=self.measure(page,'timer-hidden')
        self.assertNotIn('timer',hidden['parts'])
        self.command(page,'display.timer',P7['timer'])
        self.measure(page,'timer-reshown')

    def test_05_long_content_manual_size_and_empty(self):
        page=self.page()
        state=copy.deepcopy(P7)
        state['text']='\n'.join(['A long network troubleshooting instruction. '*4]*30)
        state['title']='Long heading '*30;state['subtitle']='Long subtitle '*35
        self.replay(page,state)
        data=self.measure(page,'long-content')
        self.assertLess(data['parts']['body']['font'],54)
        state=copy.deepcopy(P6);state['textOptions'].update(autoFit=False,size=54)
        self.replay(page,state)
        data=self.measure(page,'manual-54')
        self.assertEqual(data['parts']['body']['font'],54)
        self.command(page,'display.clear',{})
        data=self.measure(page,'empty')
        self.assertEqual(data['parts'],{})

    def test_06_resize_only_scales_and_reconnect(self):
        page=self.page()
        self.replay(page,P7)
        before=self.measure(page,'before-resize')
        for w,h in [(1082,1226),(3840,2160),(1920,1080)]:
            page.set_viewport_size({'width':w,'height':h});self.settle(page)
            data=self.measure(page,f'resized-{w}x{h}')
            self.assertEqual(self.signature(data),self.signature(before))
            self.assertEqual(data['diagnostics']['passCount'],before['diagnostics']['passCount'])
        page.evaluate('window.__receiverSocket.close()');page.wait_for_timeout(1600)
        self.replay(page,P7)
        self.assertEqual(self.signature(page.evaluate(MEASURE)),self.signature(before))

    def test_07_edge_to_edge_body_and_unbroken_words(self):
        page=self.page();self.replay(page,P7)
        padding=page.locator('#text').evaluate("el=>[getComputedStyle(el).paddingLeft,getComputedStyle(el).paddingRight]")
        self.assertEqual(padding,['0px','0px'])
        data=self.measure(page,'edge-to-edge-body')
        self.assertAlmostEqual(data['parts']['body']['box']['x'],18,delta=1)
        self.assertAlmostEqual(data['parts']['body']['box']['w'],1884,delta=2)
        state=copy.deepcopy(P7);state['text']='X'*1000
        self.replay(page,state);self.measure(page,'unbroken-word')

    def test_08_below_minimum_containment_and_timer_range(self):
        page=self.page();state=copy.deepcopy(P7)
        state['text']='\n'.join(['Dense content']*900)
        self.replay(page,state)
        data=self.measure(page,'below-readable-minimum')
        self.assertEqual(data['diagnostics']['components']['body']['status'],'below-readable-minimum')
        for total in [3600,3600000,9007199254740991]:
            state=copy.deepcopy(P6)
            state['timer'].update(remainingSeconds=total,durationSeconds=total,label='',autoFit=False,fontSize=400)
            self.replay(page,state);self.measure(page,'timer-wide-'+str(total))

    def test_09_timer_style_only_and_body_alignment(self):
        page=self.page();self.replay(page,P7)
        for position in ['top','bottom','center']:
            self.command(page,'display.text',{'text':P6['text'],'position':position,'size':54})
            self.measure(page,'body-alignment-'+position)
        self.command(page,'display.timer',{'fontSize':30,'autoFit':False})
        data=self.measure(page,'timer-style-only')
        self.assertEqual(data['parts']['timer']['font'],30)
        self.command(page,'display.timer',{'fontSize':75,'autoFit':True})
        self.measure(page,'timer-auto-restored')

    def test_10_club_selection_survives_missing_layout_stylesheet(self):
        page=self.page(layout_css=False)
        self.replay(page,CLUB_SELECTION)
        data=self.measure(page,'club-selection-no-layout-css')
        self.assertGreater(data['parts']['title']['font'],20)
        self.assertGreater(data['parts']['body']['font'],20)
        for name in ['title','subtitle','body']:
            self.assertAlmostEqual(data['parts'][name]['box']['x'],18,delta=1)
            self.assertAlmostEqual(data['parts'][name]['box']['w'],1884,delta=2)
        title_ranges=[r for r in data['ranges'] if r['name']=='title']
        subtitle_ranges=[r for r in data['ranges'] if r['name']=='subtitle']
        self.assertEqual(len(title_ranges),1,'title must shrink to one line instead of wrapping')
        self.assertEqual(len(subtitle_ranges),1,'subtitle must shrink to one line instead of wrapping')

    def test_11_media_url_policy_and_external_frame_isolation(self):
        page=self.page();self.replay(page,P6)
        before=page.evaluate(MEASURE)
        for value in ['javascript:window.__xss=1', 'data:text/html,<script>parent.__xss=1</script>',
                      'file:///etc/passwd', 'https://user:pass@signage.example/page',
                      '/document-viewer/?file=javascript%3Aalert(1)']:
            self.command(page,'display.web',{'url':value})
            self.assertEqual(page.locator('#media iframe').count(),0)
            self.assertIn('rejected invalid media URL',page.locator('#badge').inner_text())
        self.assertIsNone(page.evaluate('window.__xss'))
        page.route('https://signage.example/**',lambda route: route.fulfill(content_type='text/html',body='<h1>External signage fixture</h1>'))
        self.command(page,'display.web',{'url':'https://signage.example/page'})
        frame=page.locator('#media iframe')
        self.assertEqual(frame.get_attribute('src'),'https://signage.example/page')
        sandbox=frame.get_attribute('sandbox').split()
        self.assertIn('allow-scripts',sandbox)
        self.assertNotIn('allow-same-origin',sandbox)
        self.assertNotIn('allow-top-navigation',sandbox)
        self.command(page,'display.web',{'url':'javascript:alert(1)'})
        self.assertEqual(frame.get_attribute('src'),'https://signage.example/page')
        self.assertEqual(self.signature(page.evaluate(MEASURE)),self.signature(before))
        self.command(page,'display.clear',{})
        self.assertEqual(page.locator('#media iframe').count(),0)
        self.assertFalse(self.errors)

    def test_12_reject_audio_socket_destination_without_opening_socket(self):
        page=self.page();self.replay(page,P6)
        page.evaluate('window.__originalReceiver=window.__receiverSocket')
        for url in ['wss://attacker.example/music-assistant/sendspin-proxy?ticket='+'a'*32,
                    '/ws?ticket='+'a'*32, '/music-assistant/sendspin-proxy?ticket=invalid']:
            self.command(page,'music.assistant.attach',{'proxyUrl':url})
            self.assertTrue(page.evaluate('window.__receiverSocket===window.__originalReceiver'))
            self.assertEqual(page.evaluate('window.__sent.filter(x=>x.type==="music.assistant.status").at(-1).status.state'),'error')
        self.assertFalse(self.errors)

    def test_13_identify_timeout_is_bounded_and_replaced(self):
        page=self.page();self.replay(page,P6)
        page.evaluate("""() => {
          window.__delays=[];window.__cancelled=[];
          const set=window.setTimeout,clear=window.clearTimeout;
          window.setTimeout=(fn,delay,...args)=>{const id=set(fn,delay,...args);window.__delays.push({id,delay});return id};
          window.clearTimeout=id=>{window.__cancelled.push(id);return clear(id)};
        }""")
        self.command(page,'display.identify',{'durationMs':9007199254740991})
        first=page.evaluate('window.__delays.find(x=>x.delay===30000)')
        self.assertIsNotNone(first)
        self.command(page,'display.identify',{'durationMs':-1})
        self.assertIn(first['id'],page.evaluate('window.__cancelled'))
        self.assertEqual(page.locator('#identify').evaluate('el=>el.style.display'),'flex')
        page.wait_for_timeout(1150)
        self.assertEqual(page.locator('#identify').evaluate('el=>el.style.display'),'none')
        self.command(page,'display.identify',{'durationMs':30000})
        self.command(page,'display.clear',{})
        self.assertEqual(page.locator('#identify').evaluate('el=>el.style.display'),'none')
        self.assertFalse(self.errors)

    def test_14_dynamic_objects_use_safe_anchored_regions(self):
        page=self.page()
        self.replay(page,NOCTI_DYNAMIC)
        data=self.measure(page,'dynamic-nocti-scene')
        self.assertTrue(data['diagnostics']['dynamic'])
        self.assertEqual(data['diagnostics']['order'],['title','subtitle','body','timer'])
        title=data['parts']['title']['logicalBox']
        subtitle=data['parts']['subtitle']['logicalBox']
        body=data['parts']['body']['logicalBox']
        timer=data['parts']['timer']['logicalBox']
        self.assertAlmostEqual(title['y'],24,delta=1)
        self.assertAlmostEqual(title['h'],110,delta=1)
        self.assertAlmostEqual(subtitle['y'],138,delta=1)
        self.assertAlmostEqual(subtitle['h'],70,delta=1)
        self.assertAlmostEqual(body['y'],222,delta=1)
        self.assertAlmostEqual(timer['y'],900,delta=1)
        self.assertAlmostEqual(timer['h'],160,delta=1)
        self.assertGreaterEqual(timer['y']-(body['y']+body['h']),14)
        self.assertGreater(data['parts']['title']['font'],20)
        self.assertGreater(data['parts']['body']['font'],20)

    def test_15_live_browser_hard_font_ceilings(self):
        page=self.page(1548,1266,1)
        self.replay(page,NOCTI_DYNAMIC)
        data=self.measure(page,'live-hard-ceilings')
        title=data['parts']['title'];subtitle=data['parts']['subtitle'];timer=data['parts']['timer']
        self.assertLessEqual(title['font']*1.2,title['logicalBox']['h']+1)
        self.assertLessEqual(subtitle['font']*1.2,subtitle['logicalBox']['h']+1)
        self.assertLessEqual(timer['font']*1.98+8,timer['logicalBox']['h']+2)
        self.assertEqual(data['diagnostics']['revision'],'dynamic-fit-20261022-1')

    def test_16_timer_only_overlay_is_visible_and_positioned(self):
        page=self.page(1548,1266,1)
        state={
            'background': {'color':'#000000'},
            'title':'','subtitle':'','text':'',
            'titleOptions':{},'subtitleOptions':{},'textOptions':{},
            'media': {'type':'image','url':'/test-images/tv1.svg','fit':'contain'},
            'timer': {'visible':True,'running':False,'mode':'countdown',
                      'remainingSeconds':2944,'durationSeconds':3600,'fontSize':64,
                      'position':'bottom','label':'Period 1 • Class Ends In',
                      'timerInstanceId':'fixture-timer-only'}
        }
        self.replay(page,state)
        data=self.measure(page,'timer-only-overlay')
        timer=data['parts']['timer']
        self.assertGreaterEqual(timer['font'],24)
        self.assertGreater(timer['logicalBox']['y'],700)
        self.assertLess(timer['logicalBox']['h'],250)
        self.assertEqual(data['diagnostics']['revision'],'dynamic-fit-20261022-1')


    def test_17_live_tv8_text_does_not_false_collapse(self):
        page=self.page(1548,1273,1)
        self.replay(page,TV8_LIVE_DYNAMIC)
        data=self.measure(page,'live-tv8-false-containment-regression')
        self.assertEqual(data['diagnostics']['revision'],'dynamic-fit-20261022-1')
        for name in ['title','subtitle','body']:
            self.assertGreaterEqual(data['parts'][name]['font'],12, name)
            self.assertGreater(data['diagnostics']['components'][name]['scale'],0.95, name)
            self.assertEqual(data['diagnostics']['components'][name]['status'],'fit', name)
        self.assertGreaterEqual(data['parts']['timer']['font'],24)
        self.assertLessEqual(data['parts']['title']['font'],92*1.10+0.5)
        self.assertLessEqual(data['parts']['subtitle']['font'],44*1.10+0.5)
        self.assertLessEqual(data['parts']['body']['font'],64*1.10+0.5)
        self.assertLessEqual(data['parts']['timer']['font'],64*1.10+0.5)
        self.assertAlmostEqual(data['parts']['timer']['logicalBox']['h'],160,delta=1)
        self.assertNotEqual(data['diagnostics'].get('fitWarning'),'content-too-dense')


    def test_18_repeated_state_after_clear_restores_geometry(self):
        page=self.page(1548,1273,1)
        self.replay(page,TV8_LIVE_DYNAMIC)
        first=self.measure(page,'transition-recovery-first')
        self.command(page,'display.clear',{})
        self.replay(page,TV8_LIVE_DYNAMIC)
        second=self.measure(page,'transition-recovery-second')
        self.assertEqual(second['diagnostics']['revision'],'dynamic-fit-20261022-1')
        self.assertEqual(second['diagnostics']['components']['body']['status'],'fit')
        self.assertGreaterEqual(second['parts']['body']['font'],12)
        self.assertGreater(second['diagnostics']['components']['body']['scale'],0.95)
        self.assertAlmostEqual(second['parts']['body']['logicalBox']['y'],222,delta=1)
        self.assertAlmostEqual(second['parts']['body']['logicalBox']['h'],663,delta=1)
        self.assertAlmostEqual(second['parts']['timer']['logicalBox']['y'],900,delta=1)
        self.assertAlmostEqual(second['parts']['timer']['logicalBox']['h'],160,delta=1)
        self.assertEqual(self.signature(first),self.signature(second))


    def test_19_visible_glyph_overhang_must_fit_the_region_not_its_line_box(self):
        page=self.page(layout_css=False)
        result=page.evaluate("""async () => {
            const {fits}=await import('/display/layout.mjs');
            const box=document.createElement('div'), text=document.createElement('div');
            Object.assign(box.style,{position:'absolute',left:'0',top:'0',width:'600px',
                height:'200px',display:'flex',alignItems:'center',overflow:'hidden'});
            Object.assign(text.style,{font:'40px serif',lineHeight:'0.5',width:'100%',
                flex:'0 0 auto',overflow:'visible',whiteSpace:'nowrap'});
            text.textContent='Readable fallback glyphs';
            box.appendChild(text);document.getElementById('stage').appendChild(box);
            const overhang=text.scrollHeight>text.clientHeight+0.5;
            const visible=fits(text,box);
            text.style.overflow='hidden';
            const clipped=fits(text,box);
            text.style.overflow='visible';box.style.height='10px';
            const outsideRegion=fits(text,box);
            box.remove();return {overhang,visible,clipped,outsideRegion};
        }""")
        self.assertTrue(result['overhang'],'fixture must exercise real glyph overhang')
        self.assertTrue(result['visible'],'visible glyphs contained by the region must fit')
        self.assertFalse(result['clipped'],'a clipping child must still reject overflow')
        self.assertFalse(result['outsideRegion'],'glyphs must never escape the region')



    def test_20_scene_layers_fit_across_receiver_shapes_and_reload(self):
        scene = {'background': '#101d2c', 'layers': [
            {'id': 'heading', 'type': 'text', 'text': 'Special school schedule', 'x': 6, 'y': 8,
             'w': 88, 'h': 18, 'fontSize': 150, 'bold': True, 'glow': 12},
            {'id': 'message', 'type': 'text', 'text': 'A clear announcement that remains fully visible on every receiver. ' * 6,
             'x': 8, 'y': 30, 'w': 84, 'h': 40, 'fontSize': 140},
            {'id': 'timer', 'type': 'widget', 'widget': 'countdown', 'x': 65, 'y': 80,
             'w': 30, 'h': 14, 'fontSize': 96}],
            'data': {'className': 'Example class', 'startAt': 1788970000000,
                     'endAt': 1788970600000}}
        for width, height in [(1280,720),(1920,1080),(3840,2160),(1280,800),(1024,768),(2560,1080),(1080,1920)]:
            with self.subTest(width=width, height=height):
                page = self.page(width,height)
                self.replay(page, {'textOptions': {'scene': scene}, 'timer': {'visible': False}})
                data = page.evaluate("""() => {
                    const stage=document.getElementById('stage').getBoundingClientRect();
                    const layers=[...document.querySelectorAll('#sceneBase .rg-scene-layer')].map(el=>{
                        const r=el.getBoundingClientRect(),inner=el.firstChild,range=document.createRange();range.selectNodeContents(inner);
                        return {font:parseFloat(getComputedStyle(inner).fontSize),left:r.left,right:r.right,top:r.top,bottom:r.bottom,
                          clips:[...range.getClientRects()].some(q=>q.left<r.left-1||q.right>r.right+1||q.top<r.top-1||q.bottom>r.bottom+1),
                          overflowing:inner.scrollWidth>el.clientWidth+1||inner.scrollHeight>el.clientHeight+1};
                    });return {stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom},layers};
                }""")
                self.assertEqual(len(data['layers']),3)
                for layer in data['layers']:
                    self.assertFalse(layer['clips'],data)
                    self.assertFalse(layer['overflowing'],data)
                    self.assertGreaterEqual(layer['font'],12)
                    self.assertGreaterEqual(layer['left'],data['stage']['left']-1)
                    self.assertLessEqual(layer['right'],data['stage']['right']+1)
                page.screenshot(path=str(OUTPUT/f'{self.engine}-scene-{width}x{height}.png'))
                self.command(page,'display.clear',{})
                self.replay(page, {'textOptions': {'scene': scene}})
                self.assertEqual(page.locator('#sceneBase [data-layer-id]').count(),3)
                self.assertFalse(self.errors,self.errors)

    def test_21_shared_layers_preserve_media_node_and_expire(self):
        page = self.page()
        self.command(page,'display.video',{'url':'/media/fixture.webm','muted':True,'loop':True,'sessionId':'native-session'})
        page.evaluate("window.sceneMediaBefore=document.querySelector('#media video')")
        layer={'id':'global','expiresAt':1788970000100,'scene':{'transparent':True,'layers':[
            {'id':'notice','type':'text','text':'Shared notice','x':5,'y':80,'w':90,'h':10}]}}
        self.command(page,'display.layers',{'layers':[layer]})
        self.assertEqual(page.locator('#sceneShared [data-layer-id]').count(),1)
        self.assertTrue(page.evaluate("window.sceneMediaBefore === document.querySelector('#media video')"))
        page.evaluate('window.__now+=200')
        page.wait_for_timeout(150)
        self.assertEqual(page.locator('#sceneShared [data-layer-id]').count(),0)
        self.assertTrue(page.evaluate("window.sceneMediaBefore === document.querySelector('#media video')"))
        self.assertFalse(self.errors,self.errors)

    def test_22_weather_updates_shared_widgets_without_replacing_media(self):
        page = self.page()
        self.command(page, 'display.video', {'url': '/media/fixture.webm', 'muted': True, 'loop': True, 'sessionId': 'weather-native-session'})
        page.evaluate("window.weatherMediaBefore=document.querySelector('#media video')")
        page.route('**/api/v1/weather/display*', lambda route: route.fulfill(json={'ok': True, 'weather': {
            'text': 'Updated weather', 'widgets': {'weather-temperature': '80°F', 'weather-condition': 'Clear'},
            'updatedAt': NOW, 'source': 'Weather data: Open-Meteo · CC BY 4.0'}}))
        self.command(page, 'display.layers', {'layers': [{'id': 'weather', 'expiresAt': NOW + 3600000, 'scene': {
            'transparent': True, 'data': {'weather': 'Old weather', 'weatherUpdatedAt': NOW}, 'layers': [
                {'id': 'weather', 'type': 'widget', 'widget': 'weather', 'weatherFields': ['temperature', 'condition'],
                 'x': 55, 'y': 70, 'w': 44, 'h': 10, 'fontSize': 32}]}}]})
        page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_function("document.querySelector('#sceneShared [data-layer-id=weather]')?.textContent.includes('80°F')")
        self.assertNotIn('Open-Meteo', page.locator('#sceneShared [data-layer-id=weather]').inner_text())
        self.assertIn('Open-Meteo', page.locator('#sceneShared .rg-weather-credit').inner_text())
        self.assertTrue(page.evaluate("window.weatherMediaBefore === document.querySelector('#media video')"))
        self.assertFalse(self.errors, self.errors)


    def test_23_reduced_motion_scene_text_survives_action_changes(self):
        body = ('*Read the classroom instructions and place your materials in the designated storage area '
                'before starting the lesson or beginning the assigned activity.  \n\n'
                '*Check that all equipment is ready before starting the assigned activity.\n\n'
                '*Read the directions carefully and ask for help when necessary. ')
        scene = {'background': '#101d2c', 'layers': [
            {'id': 'title', 'type': 'text', 'text': 'Classroom reminders',
             'x': 5, 'y': 4, 'w': 90, 'h': 18, 'fontSize': 88, 'bold': True},
            {'id': 'body', 'type': 'text', 'text': body,
             'x': 6, 'y': 25, 'w': 88, 'h': 40, 'fontSize': 50},
            {'id': 'subtitle', 'type': 'text', 'text': 'Be ready to begin',
             'x': 6, 'y': 70, 'w': 88, 'h': 8, 'fontSize': 38}]}
        state = {'textOptions': {'scene': scene}, 'timer': copy.deepcopy(P7['timer'])}
        # This uses the real reduced-motion stylesheet and browser layout, not
        # mocked measurements. A nonzero global transition duration used to
        # animate font-size during the synchronous fit loop, collapsing Body.
        for width, height, dpr in [(1280,720,1), (1920,1080,1), (3840,2160,1), (800,1200,2)]:
            with self.subTest(width=width, height=height, dpr=dpr):
                page = self.page(width, height, dpr)
                def assert_scene():
                    data = page.evaluate("""() => [...document.querySelectorAll('#sceneBase .rg-scene-layer')].map(box=>{
                        const el=box.firstChild,r=box.getBoundingClientRect(),range=document.createRange();
                        range.selectNodeContents(el);const s=getComputedStyle(el);
                        return {id:box.dataset.layerId,text:el.textContent,font:parseFloat(s.fontSize),transform:s.transform,
                            clips:[...range.getClientRects()].some(q=>q.width>0&&q.height>0&&(q.left<r.left-.75||q.right>r.right+.75||q.top<r.top-.75||q.bottom>r.bottom+.75))};
                    })""")
                    self.assertEqual(len(data), 3)
                    self.assertEqual(data[1]['text'], body)
                    for layer in data:
                        self.assertGreaterEqual(layer['font'], 24, data)
                        self.assertEqual(layer['transform'], 'none', data)
                        self.assertFalse(layer['clips'], data)
                    self.assertFalse(self.errors, self.errors)
                    return [layer['font'] for layer in data]
                self.replay(page, state)
                normal_fonts = assert_scene()
                page.emulate_media(reduced_motion='reduce')
                # Actual action-to-action commands, with no reload between them.
                for _ in range(2):
                    self.command(page, 'display.text', {'scene': {'layers': [
                        {'id': 'body', 'type': 'text', 'text': 'First action', 'fontSize': 50}]}})
                    self.command(page, 'display.text', {'scene': scene})
                    self.assertEqual(assert_scene(), normal_fonts)
                self.command(page, 'display.clear', {})
                self.replay(page, state)
                self.assertEqual(assert_scene(), normal_fonts)
                page.set_viewport_size({'width': width + 17, 'height': height + 23})
                self.settle(page)
                assert_scene()
                self.reload_renderer(page)
                self.replay(page, state)
                assert_scene()
                page.screenshot(path=str(OUTPUT/f'{self.engine}-reduced-motion-scene-{width}x{height}.png'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
