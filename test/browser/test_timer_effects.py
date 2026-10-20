"""Real receiver/GUI coverage for staged timer effects; transports stay local."""
import copy
import unittest
import test_display as receiver
import test_workspaces as workspace


def effects(style='glass'):
    return {'enabled': True, 'style': style, 'progress': True, 'stages': [
        {'id': 'five', 'seconds': 300, 'color': '#ffd56a', 'effect': 'glow', 'label': 'Five minutes'},
        {'id': 'two', 'seconds': 120, 'color': '#ffd56a', 'scale': 2.5, 'effect': 'pop',
         'label': 'Two minutes', 'message': 'Finish your work & save'}],
        'finish': {'behavior': 'message', 'message': 'Time to finish', 'label': 'Follow teacher directions'}}


class TimerEffectsReceiverTests(receiver.DisplayBrowserTests):
    # Inherit the harness helpers without rerunning its independent suite here.
    def test_timer_effects_cross_threshold_once_and_restore_silently(self):
        page = self.page()
        timer = {'visible': True, 'running': True, 'mode': 'countdown', 'endAt': receiver.NOW+600000,
                 'effectsEndAt': receiver.NOW+600000, 'durationSeconds': 600, 'fontSize': 64,
                 'timerInstanceId': 'stable', 'automationOccurrence': 'class-date', 'effects': effects()}
        self.command(page, 'display.timer', timer)
        self.assertEqual(page.locator('#timerOverlay').get_attribute('data-timer-phase'), 'normal')
        page.evaluate('window.__now += 300000')
        self.command(page, 'display.timer', timer)
        self.assertEqual(page.locator('#timerOverlay').get_attribute('data-timer-phase'), 'five')
        self.assertIn('timer-cue', page.locator('#timerOverlay').get_attribute('class'))
        page.evaluate('window.__now += 180000')
        self.command(page, 'display.timer', timer)
        self.assertEqual(page.locator('#timerOverlay').get_attribute('data-timer-phase'), 'two')
        self.assertEqual(page.locator('#timerMessage').inner_text(), 'Finish your work & save')
        page.wait_for_timeout(800)
        self.assertGreater(page.locator('#timerRegion').evaluate('(n)=>n.clientWidth'), 1000)
        self.assertGreater(page.locator('#timerValue').evaluate('(n)=>parseFloat(getComputedStyle(n).fontSize)'),100)
        page.screenshot(path=str(receiver.OUTPUT/'timer-effects-two-minutes.png'))
        self.reload_renderer(page)
        page.evaluate('window.__now += 480000')
        self.replay(page, {'timer': {**timer, 'timerInstanceId': 'resync'}})
        self.assertEqual(page.locator('#timerOverlay').get_attribute('data-timer-phase'), 'two')
        self.assertNotIn('timer-cue', page.locator('#timerOverlay').get_attribute('class'))
        self.assertFalse(self.errors, self.errors)

    def test_timer_effects_all_styles_and_positions_fit_without_replacing_content(self):
        for style in ['badge', 'glass', 'broadcast', 'ring', 'minimal', 'segments']:
            with self.subTest(style=style):
                page = self.page(1024, 768)
                self.command(page, 'display.text', {'scene': {'layers': [
                    {'id': 'content', 'type': 'text', 'text': 'Underlying full-screen content',
                     'x': 5, 'y': 5, 'w': 90, 'h': 15}]}})
                page.evaluate('window.originalContent = document.querySelector("#sceneBase [data-layer-id]")')
                fx = effects(style)
                fx.update(anchor='bottom-right', digitEffect=True)
                timer = {'visible': True, 'running': False, 'mode': 'countdown', 'remainingSeconds': 120,
                         'fontSize': 75, 'label': 'Class ends', 'effects': fx}
                self.command(page, 'display.timer', timer)
                page.wait_for_timeout(800)
                self.assertTrue(page.evaluate('window.originalContent === document.querySelector("#sceneBase [data-layer-id]")'))
                measured = page.evaluate('''()=>{const r=document.querySelector('#timerRegion').getBoundingClientRect(),s=document.querySelector('#stage').getBoundingClientRect();
                    return {contained:r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1,
                    text:[...document.querySelectorAll('#timerLabel,#timerValue,#timerMessage')].filter(n=>!n.hidden).map(n=>{const a=n.getBoundingClientRect();return {text:n.textContent,ok:a.left>=r.left-1&&a.right<=r.right+1&&a.top>=r.top-1&&a.bottom<=r.bottom+1}})}}''')
                self.assertTrue(measured['contained'], measured)
                self.assertTrue(all(n['ok'] for n in measured['text']), measured)
                self.assertFalse(self.errors, self.errors)
                page.screenshot(path=str(receiver.OUTPUT/f'timer-effects-{style}.png'))
                page.context.close()

    def test_timer_effects_finish_hide_message_and_fade(self):
        page = self.page()
        for behavior in ['hold', 'message', 'hide', 'fade']:
            fx = effects();fx['finish'].update(behavior=behavior, seconds=.1)
            timer = {'visible': True, 'running': True, 'mode': 'countdown', 'endAt': receiver.NOW+1000,
                     'timerInstanceId': behavior, 'effects': fx}
            self.command(page, 'display.timer', timer)
            page.evaluate('window.__now += 2000')
            page.wait_for_timeout(1800)
            if behavior in ['hide', 'fade']:
                self.assertTrue(page.locator('#timerRegion').is_hidden(), behavior)
            else:
                self.assertEqual(page.locator('#timerValue').inner_text(), '00:00' if behavior=='hold' else 'Time to finish')
            page.evaluate(f'window.__now = {receiver.NOW}')
        self.assertFalse(self.errors, self.errors)

    def test_timer_effects_reduced_motion_and_invalid_input_keep_countdown(self):
        page = self.page()
        page.emulate_media(reduced_motion='reduce')
        timer = {'visible': True, 'running': True, 'mode': 'countdown', 'endAt': receiver.NOW+301000,
                 'timerInstanceId': 'reduced', 'effects': effects()}
        self.command(page, 'display.timer', timer)
        page.evaluate('window.__now += 1000')
        self.command(page, 'display.timer', timer)
        self.assertEqual(page.locator('#timerOverlay').evaluate('(n)=>getComputedStyle(n).animationName'), 'none')
        self.command(page, 'display.timer', {**timer,'effects':{'enabled':True,'volume':99}})
        self.assertEqual(page.locator('#timerValue').inner_text(), '05:00')
        self.assertFalse(self.errors, self.errors)

    def test_timer_effects_sounds_skip_replays_and_priority_video(self):
        page = self.page()
        page.evaluate('''()=>{window.cueStarts=0;window.AudioContext=class{constructor(){window.cueStarts++;this.currentTime=0;this.destination={}}resume(){return Promise.resolve()}close(){return Promise.resolve()}createOscillator(){return {frequency:{},connect(){},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}}''')
        fx = effects();fx['stages'][0]['sound']='chime';fx['stages'][1]['sound']='bell'
        timer = {'visible': True,'running': True,'mode':'countdown','endAt':receiver.NOW+301000,'timerInstanceId':'audio','effects':fx}
        self.command(page, 'display.timer', timer)
        self.assertEqual(page.evaluate('window.cueStarts'),0)
        page.evaluate('window.__now += 1000');self.command(page,'display.timer',timer)
        self.assertEqual(page.evaluate('window.cueStarts'),1)
        self.command(page,'display.timer',timer)
        self.assertEqual(page.evaluate('window.cueStarts'),1)
        self.command(page,'display.video',{'url':'https://media.example.test/clip.mp4','muted':False})
        page.evaluate('window.videoBefore=document.querySelector("#media video");window.__now += 180000')
        self.command(page,'display.timer',timer)
        self.assertEqual(page.evaluate('window.cueStarts'),1)
        self.assertTrue(page.evaluate('window.videoBefore===document.querySelector("#media video")'))
        self.assertFalse(self.errors,self.errors)


# Do not collect inherited test_* methods a second time.
for _name in list(vars(receiver.DisplayBrowserTests)):
    if _name.startswith('test_'):
        setattr(TimerEffectsReceiverTests, _name, None)


class TimerEffectsEditorTests(unittest.TestCase):
    setUpClass = classmethod(workspace.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspace.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspace.WorkspaceBrowserTests.page
    evidence = workspace.WorkspaceBrowserTests.evidence

    def editor(self,width=1440):
        writes=[]
        event={'id':'fixture','name':'Example timer','revision':3,'enabled':True,'time':'10:00','days':[1],
               'targets':['tv1'],'action':'display.text','payload':{'text':'Keep this content'},
               'timerOverlay':{'enabled':True,'source':'end-time','endTime':'11:28','label':'Lunch ends'}}
        def transport(route,path):
            if path=='/display/tv1':
                route.fulfill(content_type='text/html',body=(receiver.ROOT/'public/display/index.html').read_text());return True
            if path=='/display/sendspin.bundle.js':
                route.fulfill(content_type='text/javascript',body='export class SendspinPlayer {}');return True
            if route.request.method in ['POST','PUT'] and path.startswith('/api/'):
                body=route.request.post_data_json;writes.append((path,body))
                route.fulfill(json={'ok':True,'previewHash':'reviewed','matches':[],'resolved':{'targets':['tv1']},'config':body.get('config',{})});return True
            return False
        page,errors=self.page('/controller/',width,overrides={
            '/api/v1/automations':{'events':[event]},'/api/v1/automations/calendar':{'calendar':{},'scheduleProfile':{}},
            '/api/v1/devices':{'devices':{'tv1':{'name':'Example display','enabled':True}}},
            '/api/v1/planning/studio':{'config':{'overlays':[],'timerPresets':[]}}},transport=transport)
        page.wait_for_function("window.AUTH_STATUS?.user?.role==='admin'")
        if width<1000:page.locator('#workspaceMenu').click()
        page.locator('#workspaceSidebar').get_by_text('Planning',exact=True).click()
        page.get_by_role('button',name='Automation',exact=True).click()
        page.locator('.studioCard').filter(has_text='Example timer').get_by_role('button',name='Edit',exact=True).click()
        draft=page.get_by_role('dialog',name='Edit Example timer',exact=True)
        draft.get_by_role('button',name='Timer & advanced',exact=True).click()
        return page,errors,writes,draft

    def test_timer_effects_editor_preview_and_save_preserve_deadline(self):
        page,errors,writes,draft=self.editor(390)
        draft.get_by_label('Enable staged timer effects',exact=True).check()
        draft.get_by_role('button',name='Apply timer preset',exact=True).click()
        draft.get_by_role('button',name='Preview timer effects',exact=True).click()
        frame=draft.frame_locator('iframe')
        frame.locator('#timerOverlay').wait_for(state='visible')
        draft.get_by_role('button',name='Move timer on preview',exact=True).press('ArrowLeft')
        self.assertEqual(draft.get_by_label('Timer anchor',exact=True).input_value(),'custom')
        draft.get_by_role('button',name='Preview 2 minutes',exact=True).click()
        frame.locator('#timerOverlay[data-timer-phase="two-minutes"]').wait_for()
        self.assertFalse(writes,writes)
        self.evidence(page,errors,'timer-effects-draft-mobile')
        draft.get_by_role('button',name='Preview & validate',exact=True).click()
        draft.get_by_text('Ready to save',exact=False).wait_for()
        draft.get_by_role('button',name='Save automation',exact=True).click()
        draft.wait_for(state='hidden')
        saved=next(body for path,body in writes if path=='/api/v1/automations/fixture')
        self.assertEqual(saved['timerOverlay']['endTime'],'11:28')
        self.assertEqual(saved['timerOverlay']['effects']['stages'][1]['scale'],2.5)
        self.assertEqual(saved['timerOverlay']['effects']['anchor'],'custom')
        self.assertEqual(saved['payload']['text'],'Keep this content')
        self.assertFalse(any(path=='/api/v1/commands' for path,_ in writes))
        self.evidence(page,errors,'timer-effects-editor-mobile')

    def test_timer_effects_saved_preset_uses_reviewed_config_and_cancel_does_not_save_event(self):
        page,errors,writes,draft=self.editor()
        draft.get_by_label('Enable staged timer effects',exact=True).check()
        draft.get_by_label('Save timer preset as',exact=True).fill('Example preset')
        draft.get_by_role('button',name='Save timer preset',exact=True).click()
        draft.get_by_text('Timer preset saved.',exact=False).wait_for()
        config=next(body['config'] for path,body in writes if path=='/api/v1/planning/studio')
        self.assertEqual(config['timerPresets'][0]['name'],'Example preset')
        self.assertEqual(draft.get_by_label('Timer effect preset',exact=True).locator('option').filter(has_text='Example preset').count(),1)
        draft.get_by_role('button',name='Close',exact=True).click()
        self.assertFalse(any(path.startswith('/api/v1/automations/') for path,_ in writes))
        self.assertEqual(errors,[])
