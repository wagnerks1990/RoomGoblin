"""Live audio controls exercise the actual controller and receiver scripts."""
import copy
import unittest
import test_display as display
import test_sports as sports
import test_workspaces as workspaces


class AudioReceiverTests(unittest.TestCase):
    setUpClass = classmethod(display.DisplayBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(display.DisplayBrowserTests.tearDownClass.__func__)
    page = display.DisplayBrowserTests.page
    open_renderer = display.DisplayBrowserTests.open_renderer
    settle = display.DisplayBrowserTests.settle
    replay = display.DisplayBrowserTests.replay
    command = display.DisplayBrowserTests.command

    def test_volume_mute_and_replay_preserve_video_position_and_element(self):
        page = self.page()
        media = {'type': 'video', 'url': '/media/clip.mp4', 'sessionId': 'audio', 'autoplay': False, 'volume': .8}
        self.replay(page, {'media': media})
        page.evaluate("window.originalVideo=document.querySelector('#media video');originalVideo.currentTime=12")
        self.command(page, 'display.audio.control', {'volume': .3, 'muted': True})
        self.assertEqual(page.evaluate('[originalVideo.volume,originalVideo.muted,originalVideo.currentTime]'), [.3, True, 12])
        self.command(page, 'display.audio.control', {'muted': False})
        self.replay(page, {'media': {**media, 'volume': .3, 'muted': False}})
        self.assertTrue(page.evaluate("originalVideo===document.querySelector('#media video')"))
        self.assertEqual(page.evaluate('[originalVideo.volume,originalVideo.muted,originalVideo.currentTime]'), [.3, False, 12])
        self.assertFalse(self.errors)

    def test_sports_audio_survives_poll_and_next_clip_without_resetting_roster(self):
        page = self.page()
        d = sports.data()
        d['display']['pages'][0]['media'] = [{'asset': 'fixture.mp4', 'caption': 'Example', 'archive': False}]
        page.route('**/api/v1/sports/boards/b/display*', lambda route: route.fulfill(json=d['display']))
        page.evaluate("HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.load=function(){};Object.defineProperty(HTMLMediaElement.prototype,'error',{get:()=>null})")
        self.command(page, 'display.text', {'scene': d['scene']})
        page.locator('.rg-sports video[src]').wait_for()
        page.evaluate("window.originalBoard=document.querySelector('.rg-sports');window.originalVideo=originalBoard.querySelector('video');originalVideo.currentTime=7")
        self.command(page, 'display.audio.control', {'volume': .23, 'muted': True})
        updated = copy.deepcopy(d['scene'])
        updated['layers'][0].update(sportsVolume=.23, sportsAudio=False)
        self.replay(page, {'textOptions': {'scene': updated}})
        self.assertTrue(page.evaluate("originalBoard===document.querySelector('.rg-sports')"))
        self.assertEqual(page.evaluate('[originalVideo.volume,originalVideo.muted,originalVideo.currentTime]'), [.23, True, 7])
        self.command(page, 'display.audio.control', {'muted': False})
        self.assertEqual(page.evaluate('[originalVideo.volume,originalVideo.muted]'), [.23, False])
        page.clock.install()
        page.clock.run_for(18000)
        self.assertTrue(page.evaluate("originalBoard===document.querySelector('.rg-sports')"))
        self.assertEqual(page.evaluate('originalVideo.volume'), .23)
        self.assertFalse(self.errors)

    def test_website_audio_never_reloads_frame(self):
        page = self.page()
        page.route('https://example.test/player', lambda route: route.fulfill(content_type='text/html', body='<body>Player<script>window.messages=[];addEventListener("message",event=>messages.push(event.data));</script></body>'))
        self.command(page, 'display.web', {'url': 'https://example.test/player', 'forceAudio': True, 'volume': .8})
        page.evaluate("window.originalFrame=document.querySelector('#media iframe');window.originalSrc=originalFrame.src")
        page.frame_locator('#media iframe').get_by_text('Player', exact=True).wait_for()
        page.frame_locator('#media iframe').locator('body').evaluate('() => messages.length=0')
        self.command(page, 'display.audio.control', {'volume': .2, 'muted': True})
        self.command(page, 'display.audio.control', {'muted': False})
        self.assertTrue(page.evaluate("originalFrame===document.querySelector('#media iframe')&&originalFrame.src===originalSrc"))
        self.assertTrue(page.frame_locator('#media iframe').locator('body').evaluate('() => messages.length>0'))
        self.assertFalse(page.frame_locator('#media iframe').locator('body').evaluate("() => messages.some(m=>m.type==='play'||m.type==='unmute'||m.action==='unmute')"))
        self.assertFalse(self.errors)


class AudioOperatorTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    evidence = workspaces.WorkspaceBrowserTests.evidence
    studio_page = workspaces.WorkspaceBrowserTests.studio_page

    def test_saved_audio_round_trips_for_sports_video_and_website_actions(self):
        for kind in ('sports', 'video', 'web'):
            with self.subTest(kind=kind):
                page, errors, saved = self.studio_page()
                if kind == 'sports':
                    page.evaluate('(scene)=>startSportsAutomation(scene)', sports.data()['scene'])
                else:
                    page.evaluate("S.mediaFiles=[{storedName:'fixture.mp4',type:'video'}]")
                    page.get_by_role('button', name='+ Automation', exact=True).click()
                editor = page.locator('dialog.studioDialog[open]').last
                editor.get_by_label('Automation name', exact=True).fill('Audio example')
                editor.get_by_role('button', name='Actions', exact=True).click()
                editor.get_by_role('button', name='Edit action', exact=True).click()
                action = page.locator('dialog.studioDialog[open]').last
                if kind == 'video':
                    action.get_by_label('Action type', exact=True).select_option('display.media')
                    action.get_by_label('Uploaded media', exact=True).select_option('fixture.mp4')
                elif kind == 'web':
                    action.get_by_label('Action type', exact=True).select_option('display.url')
                    action.get_by_label('Website address', exact=True).fill('https://example.test/player')
                action.get_by_label('Volume (%)', exact=True).fill('37')
                action.get_by_label('Muted', exact=True).check()
                action.get_by_role('button', name='Use action', exact=True).click()
                editor.get_by_role('button', name='Targets & layers', exact=True).click()
                editor.get_by_role('checkbox', name='All displays', exact=True).check()
                editor.get_by_role('button', name='Preview & validate', exact=True).click()
                editor.get_by_role('button', name='Save automation', exact=True).click()
                page.wait_for_function("!document.querySelector('dialog.studioDialog[open]')")
                payload = saved[-1]['actionSequence'][0]['payload']
                if kind == 'sports':
                    self.assertEqual(payload['scene']['layers'][0]['sportsVolume'], .37)
                    self.assertFalse(payload['scene']['layers'][0]['sportsAudio'])
                else:
                    self.assertEqual(payload['volume'], .37)
                    self.assertTrue(payload['muted'])
                self.assertFalse(errors)

    def test_live_controls_targets_volume_mute_errors_and_priority_on_both_workspaces(self):
        for workspace in ('sports', 'schedules'):
            for width in (390, 1440):
                with self.subTest(workspace=workspace, width=width):
                    d = sports.data()
                    audio = {'id': 'tv1', 'name': 'Example display', 'available': True, 'kinds': ['sports'], 'boardIds': ['b'], 'volume': .6, 'muted': False, 'locked': False, 'online': True, 'contentKey': 'a'*64}
                    posts = []
                    reject = {'next': False}
                    def transport(route, target):
                        if target == '/api/v1/displays/audio':
                            route.fulfill(json={'ok': True, 'displays': [audio]})
                            return True
                        if target == '/api/v1/displays/tv1/audio':
                            posts.append(route.request.post_data_json)
                            if reject['next']:
                                reject['next'] = False
                                route.fulfill(status=400, json={'error': 'Displayed content changed. Refresh live audio controls.'})
                            else:
                                audio.update(route.request.post_data_json)
                                route.fulfill(json={'ok': True, 'audio': audio, 'result': {'warnings': []}})
                            return True
                        return False
                    page, errors = self.page('/controller/', width, transport=transport, overrides={
                        '/api/v1/sports': {'ok': True, 'config': d['config']},
                        '/api/v1/automations': {'events': []},
                        '/api/v1/planning': {'today': '2026-10-26'},
                        '/api/v1/planning/studio': {'config': {'overlays': []}},
                    })
                    page.wait_for_function("window.AUTH_STATUS?.user?.role==='admin'")
                    page.evaluate('(name)=>showPage(name)', workspace)
                    panel = page.locator('#'+workspace+' [data-live-audio]')
                    panel.get_by_label('Audio display').select_option('tv1')
                    panel.get_by_role('button', name='Volume down', exact=True).click()
                    page.wait_for_function("document.querySelector('[data-live-audio] input[type=range]').value==='50'")
                    panel.get_by_role('button', name='Mute', exact=True).click()
                    panel.get_by_text('Sports · Muted', exact=True).wait_for()
                    self.assertEqual(posts[-1]['muted'], True)
                    panel.get_by_role('button', name='Unmute', exact=True).click()
                    panel.get_by_text('Sports · Sound enabled', exact=True).wait_for()
                    self.assertEqual(audio['volume'], .5)
                    reject['next'] = True
                    panel.get_by_role('button', name='Volume up', exact=True).click()
                    panel.get_by_text('Displayed content changed. Refresh live audio controls.', exact=True).wait_for()
                    self.assertTrue(all(p['contentKey'] == 'a'*64 for p in posts))
                    audio['locked'] = True
                    panel.get_by_role('button', name='Refresh live audio', exact=True).click()
                    panel.get_by_text('Morning Announcements has priority', exact=False).wait_for()
                    self.assertTrue(panel.get_by_role('button', name='Mute', exact=True).is_disabled())
                    self.evidence(page, errors, f'live-audio-{workspace}-{width}')
