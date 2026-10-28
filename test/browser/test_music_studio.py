"""Real music workspace with bounded fixture transports; no live audio commands."""
import unittest
import time
import test_workspaces as workspaces


def music_page(self, width=1440):
    requests = []
    schedule = {'enabled': True, 'playerId': 'speaker', 'favoriteId': 'station', 'volume': 25,
                'startTime': '07:00', 'endTime': '15:00', 'days': [1, 2, 3, 4, 5],
                'schoolDaysOnly': True, 'pauseForPriorityAudio': True, 'autoRecover': True, 'stallSeconds': 120}
    background = {'schedule': schedule, 'favorites': [{'id': 'station', 'uri': 'demo://radio/1', 'name': 'Station', 'mediaType': 'radio'}],
                  'runtime': {'playing': True, 'activePlayerId': 'speaker', 'activeMedia': {'name': 'Station'},
                              'recovery': {'state': 'playing', 'reason': 'Playback progress confirmed'}}}
    players = [{'player_id': 'speaker', 'display_name': 'Classroom speaker', 'provider': 'sendspin', 'state': 'playing',
                'available': True, 'volume_level': 25, 'current_media': {'title': 'Current song', 'artist': 'Artist'}},
               {'player_id': 'classroom-hub-tv1', 'display_name': 'TV 1', 'state': 'idle', 'available': True, 'volume_level': 10}]

    def transport(route, target):
        request = route.request
        if target == '/api/v1/music-assistant/command':
            body = request.post_data_json
            requests.append(body)
            result = {'tracks': [{'name': 'New song', 'uri': 'demo://track/2', 'media_type': 'track', 'artists': [{'name': 'Artist'}]}]} if body['command'] == 'music/search' else None
            route.fulfill(json={'ok': True, 'result': result})
            return True
        if target == '/api/v1/music-assistant/background/control':
            requests.append(request.post_data_json)
            route.fulfill(json={'ok': True})
            return True
        if target == '/api/v1/music-assistant/background/schedule' and request.method == 'PUT':
            requests.append(request.post_data_json)
            schedule.update(request.post_data_json)
            route.fulfill(json={'ok': True})
            return True
        return False

    page, errors = self.page('/controller/', width, overrides={
        '/api/v1/music-assistant/status': {'online': True, 'players': players, 'attachedTargets': [], 'bridgeStatus': {}, 'url': 'http://127.0.0.1:8095'},
        '/api/v1/music-assistant/background': background,
        '/api/v1/music-assistant/background/queue': {'queue': {'id': 'speaker', 'shuffle': False, 'repeat': 'off', 'currentIndex': 0},
                                                  'items': [{'id': 'q1', 'name': 'Current song'}, {'id': 'q2', 'name': 'Next song'}]},
    }, transport=transport)
    page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
    page.evaluate("showPage('music')")
    page.get_by_role('heading', name='Current song', exact=True).wait_for()
    return page, errors, requests


class MusicStudioBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    evidence = workspaces.WorkspaceBrowserTests.evidence



    def test_music_search_play_tracks_identity_and_sleep(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Find music', exact=True).click()
        page.get_by_label('Search for', exact=True).select_option('track')
        page.get_by_label('Search Music Assistant', exact=True).fill('New song')
        page.get_by_label('Search Music Assistant', exact=True).press('Enter')
        page.locator('#maSearchResults').get_by_role('button', name='Play', exact=True).click()
        page.wait_for_function("!window.musicStudioLoading")
        play = next(row for row in requests if row.get('action') == 'play')
        self.assertEqual(play['uri'], 'demo://track/2')
        self.assertEqual(play['mediaType'], 'track')
        self.assertEqual(play['playerId'], 'speaker')
        page.get_by_role('button', name='Now playing', exact=True).click()
        page.get_by_label('Sleep timer', exact=True).select_option('30')
        page.wait_for_function("!window.musicStudioLoading")
        self.assertTrue(any(row.get('action') == 'sleep' and row.get('minutes') == 30 for row in requests))
        self.evidence(page, errors, 'music-studio-desktop')


    def test_music_mobile_schedule_draft_and_focused_player_volume_survive_refresh(self):
        page, errors, requests = music_page(self, 390)
        page.get_by_role('button', name='Schedule', exact=True).click()
        page.locator('#bgmStart').fill('08:15')
        page.evaluate('loadMusicAssistant()')
        self.assertEqual(page.locator('#bgmStart').input_value(), '08:15')
        page.get_by_role('button', name='Outputs & connection', exact=True).click()
        level = page.get_by_label('Volume for Classroom speaker', exact=True)
        level.fill('37')
        page.evaluate('loadMusicAssistant()')
        self.assertEqual(level.input_value(), '37')
        self.assertTrue(level.evaluate('(e)=>e===document.activeElement'))
        page.get_by_role('button', name='Now playing', exact=True).click()
        self.evidence(page, errors, 'music-studio-mobile')



    def test_music_favorite_cards_and_invalid_stream_keep_working_after_poll(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Favorites', exact=True).click()
        page.evaluate('loadMusicAssistant()')
        page.locator('#bgmFavorites').get_by_role('button', name='Use in schedule', exact=True).wait_for()
        page.get_by_role('button', name='Find music', exact=True).click()
        page.get_by_text('Add a radio stream URL', exact=True).click()
        page.get_by_label('Station name', exact=True).fill('Station')
        page.get_by_label('Radio stream URL', exact=True).fill('invalid')
        page.get_by_role('button', name='Save station', exact=True).click()
        self.assertIn('HTTP(S)', page.locator('.musicNotice').inner_text())
        self.assertFalse(errors, errors)

    def wait_request(self, page, held):
        deadline=time.monotonic()+5
        while not held and time.monotonic()<deadline: page.wait_for_timeout(10)
        self.assertTrue(held, 'save request was not captured')
    def test_schedule_save_preserves_newer_favorite(self):
        page, errors, requests=music_page(self)
        page.get_by_role('button',name='Schedule',exact=True).click()
        held=[]
        page.route('**/api/v1/music-assistant/background/schedule',lambda route: held.append(route))
        page.locator('#bgmStart').fill('08:00')
        page.evaluate('()=>{window.__save=saveBackgroundMusicSchedule()}')
        self.wait_request(page,held)
        page.locator('#bgmStart').fill('08:30')
        page.locator('#bgmFavorite').select_option('')
        held[0].fulfill(json={'ok':True})
        page.evaluate('window.__save')
        self.assertEqual(page.locator('#bgmFavorite').input_value(),'')
        self.assertEqual(page.locator('#bgmStart').input_value(),'08:30')
        self.assertFalse(errors,errors)
    def test_schedule_has_one_pending_write(self):
        page, errors, requests=music_page(self)
        held=[]
        page.route('**/api/v1/music-assistant/background/schedule',lambda route: held.append(route))
        page.evaluate('()=>{window.__first=saveBackgroundMusicSchedule()}')
        self.wait_request(page,held)
        page.evaluate('()=>{window.__second=saveBackgroundMusicSchedule()}')
        page.wait_for_timeout(100)
        count=len(held)
        for route in held:route.fulfill(json={'ok':True})
        page.evaluate('Promise.all([window.__first,window.__second])')
        self.assertEqual(count,1)
    def test_connection_save_keeps_newer_token_and_url(self):
        page, errors, requests=music_page(self)
        page.get_by_role('button',name='Outputs & connection',exact=True).click()
        page.locator('#maUrl').evaluate("el=>{el.closest('details').open=true}")
        page.locator('#maUrl').fill('http://127.0.0.1:8096')
        page.locator('#maToken').fill('first-fixture-token')
        held=[]
        page.route('**/api/v1/music-assistant/config',lambda route: held.append(route))
        page.evaluate('()=>{window.__save=saveMusicAssistantConfig()}')
        self.wait_request(page,held)
        page.locator('#maUrl').fill('http://127.0.0.1:8097')
        page.locator('#maToken').fill('newer-fixture-token')
        held[0].fulfill(json={'ok':True})
        page.evaluate('window.__save')
        self.assertEqual(page.locator('#maToken').input_value(),'newer-fixture-token')
        self.assertEqual(page.locator('#maUrl').input_value(),'http://127.0.0.1:8097')
        self.assertFalse(errors,errors)

    def test_failed_schedule_save_keeps_draft_and_allows_retry(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Schedule', exact=True).click()
        page.locator('#bgmStart').fill('08:45')
        page.locator('#bgmFavorite').select_option('')
        held = []
        page.route('**/api/v1/music-assistant/background/schedule', lambda route: held.append(route))
        page.evaluate('()=>{window.__save=saveBackgroundMusicSchedule()}')
        self.wait_request(page, held)
        self.assertTrue(page.get_by_role('button', name='Save Background Music', exact=True).is_disabled())
        self.assertTrue(page.get_by_role('button', name='Reload saved schedule', exact=True).is_disabled())
        self.assertTrue(page.locator('#bgmStart').is_enabled())
        held.pop().fulfill(status=500, json={'error': 'fixture save failed'})
        page.evaluate('window.__save')
        self.assertEqual(page.locator('#bgmStart').input_value(), '08:45')
        self.assertEqual(page.locator('#bgmFavorite').input_value(), '')
        self.assertIn('fixture save failed', page.locator('#bgmSaveMsg').inner_text())
        self.assertTrue(page.get_by_role('button', name='Save Background Music', exact=True).is_enabled())
        page.evaluate('()=>{window.__save=saveBackgroundMusicSchedule()}')
        self.wait_request(page, held)
        self.assertEqual(held[0].request.post_data_json['startTime'], '08:45')
        held[0].fulfill(json={'ok': True})
        page.evaluate('window.__save')
        self.assertFalse(errors, errors)

    def test_connection_save_has_one_write_and_clears_only_submitted_token(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Outputs & connection', exact=True).click()
        page.locator('#maUrl').evaluate("el=>{el.closest('details').open=true}")
        page.locator('#maToken').fill('fixture-submitted-token')
        held = []
        page.route('**/api/v1/music-assistant/config', lambda route: held.append(route))
        page.evaluate('()=>{window.__first=saveMusicAssistantConfig()}')
        self.wait_request(page, held)
        self.assertTrue(page.get_by_role('button', name='Save & Test', exact=True).is_disabled())
        self.assertTrue(page.locator('#maToken').is_enabled())
        page.evaluate('()=>{window.__second=saveMusicAssistantConfig()}')
        page.wait_for_timeout(100)
        count = len(held)
        for route in held:
            route.fulfill(status=500, json={'error': 'fixture connection failed'})
        page.evaluate('Promise.all([window.__first,window.__second])')
        self.assertEqual(count, 1)
        self.assertEqual(page.locator('#maToken').input_value(), '')
        self.assertTrue(page.get_by_role('button', name='Save & Test', exact=True).is_enabled())
        self.assertIn('fixture connection failed', page.locator('.musicNotice').inner_text())
        self.assertFalse(errors, errors)

    def test_reload_response_preserves_edits_made_while_loading(self):
        page, errors, requests = music_page(self)
        page.wait_for_function('!window.musicStudioLoading')
        page.get_by_role('button', name='Schedule', exact=True).click()
        held = []
        page.route('**/api/v1/music-assistant/background', lambda route: held.append(route))
        page.get_by_role('button', name='Reload saved schedule', exact=True).click()
        self.wait_request(page, held)
        page.locator('#bgmStart').fill('09:15')
        page.locator('#bgmFavorite').select_option('')
        held[0].fallback()
        page.wait_for_function('!window.musicStudioLoading')
        self.assertEqual(page.locator('#bgmStart').input_value(), '09:15')
        self.assertEqual(page.locator('#bgmFavorite').input_value(), '')
        self.assertIn('Unsaved', page.locator('#bgmSaveMsg').inner_text())
        self.assertFalse(errors, errors)

    def test_poll_started_before_save_cannot_restore_old_favorite(self):
        page, errors, requests = music_page(self)
        page.wait_for_function('!window.musicStudioLoading')
        page.get_by_role('button', name='Schedule', exact=True).click()
        held = []
        def hold_first(route):
            if not held:
                held.append(route)
            else:
                route.fallback()
        page.route('**/api/v1/music-assistant/background', hold_first)
        page.evaluate('()=>{window.__poll=loadMusicAssistant()}')
        self.wait_request(page, held)
        page.locator('#bgmStart').fill('08:10')
        page.locator('#bgmFavorite').select_option('')
        page.evaluate('()=>{window.__save=saveBackgroundMusicSchedule()}')
        deadline = time.monotonic() + 5
        while not requests and time.monotonic() < deadline:
            page.wait_for_timeout(10)
        self.assertTrue(requests)
        held[0].fulfill(json={'schedule': {'startTime': '07:00', 'playerId': 'speaker', 'favoriteId': 'station'},
                             'favorites': [{'id': 'station', 'name': 'Station', 'uri': 'demo://radio/1'}], 'runtime': {}})
        page.evaluate('Promise.all([window.__poll,window.__save])')
        self.assertEqual(page.locator('#bgmFavorite').input_value(), '')
        self.assertEqual(page.locator('#bgmStart').input_value(), '08:10')
        self.assertFalse(errors, errors)

    def test_repeated_identical_search_keeps_result_cards(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Find music', exact=True).click()
        page.locator('#maSearch').fill('same song')
        for _ in range(3):
            page.evaluate('searchMusicAssistant()')
            self.assertEqual(page.locator('#maSearchResults .musicItem').count(), 1)
            self.assertEqual(page.locator('#maSearchResults h3').inner_text(), 'New song')
        self.assertEqual(errors, [])

    def test_short_search_retires_pending_success_and_failure(self):
        for failed in (False, True):
            with self.subTest(failed=failed):
                page, errors, requests = music_page(self)
                page.get_by_role('button', name='Find music', exact=True).click()
                held = []
                page.route('**/api/v1/music-assistant/command', lambda route: held.append(route))
                page.locator('#maSearch').fill('old song')
                page.evaluate('void searchMusicAssistant()')
                deadline = time.monotonic() + 5
                while not held and time.monotonic() < deadline:
                    page.wait_for_timeout(20)
                self.assertEqual(len(held), 1)
                page.locator('#maSearch').fill('a')
                page.evaluate('searchMusicAssistant()')
                with page.expect_request_finished(lambda req: '/music-assistant/command' in req.url):
                    if failed:
                        held[0].fulfill(status=502, json={'ok': False, 'error': 'Obsolete failure'})
                    else:
                        held[0].fulfill(json={'ok': True, 'result': {'tracks': [{'name': 'Obsolete song', 'uri': 'demo://obsolete', 'media_type': 'track'}]}})
                page.wait_for_timeout(50)
                self.assertEqual(page.locator('#maSearchResults').inner_text(), '')
                self.assertIn('at least two characters', page.locator('.musicNotice').inner_text())
                self.assertEqual(errors, [])
                page.close()

    def test_repeated_empty_search_retains_no_results_message(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Find music', exact=True).click()
        page.route('**/api/v1/music-assistant/command', lambda route: route.fulfill(json={'ok': True, 'result': {'tracks': []}}))
        page.locator('#maSearch').fill('no result')
        for _ in range(2):
            page.evaluate('searchMusicAssistant()')
            self.assertIn('No results.', page.locator('#maSearchResults').inner_text())
        self.assertEqual(errors, [])

    def test_same_results_return_after_visible_search_failure(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Find music', exact=True).click()
        page.locator('#maSearch').fill('same song')
        page.evaluate('searchMusicAssistant()')
        page.route('**/api/v1/music-assistant/command', lambda route: route.fulfill(status=502, json={'ok': False, 'error': 'Provider unavailable'}))
        page.evaluate('searchMusicAssistant()')
        self.assertIn('Provider unavailable', page.locator('#maSearchResults').inner_text())
        page.unroute('**/api/v1/music-assistant/command')
        page.evaluate('searchMusicAssistant()')
        self.assertEqual(page.locator('#maSearchResults .musicItem').count(), 1)
        self.assertEqual(errors, [])

    def test_latest_valid_search_keeps_results_after_obsolete_success(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Find music', exact=True).click()
        held = []
        page.route('**/api/v1/music-assistant/command', lambda route: held.append(route))
        for index in range(2):
            page.locator('#maSearch').fill('query ' + str(index))
            page.evaluate('void searchMusicAssistant()')
            deadline = time.monotonic() + 5
            while len(held) <= index and time.monotonic() < deadline:
                page.wait_for_timeout(20)
            self.assertEqual(len(held), index + 1)
        for index, name in ((1, 'Current song'), (0, 'Obsolete song')):
            with page.expect_request_finished(lambda req: '/music-assistant/command' in req.url):
                held[index].fulfill(json={'ok': True, 'result': {'tracks': [{'name': name, 'uri': 'demo://song/' + str(index), 'media_type': 'track'}]}})
            page.wait_for_timeout(50)
        self.assertEqual(page.locator('#maSearchResults h3').inner_text(), 'Current song')
        self.assertEqual(errors, [])

    def test_short_search_clears_previous_result_without_another_request(self):
        page, errors, requests = music_page(self)
        page.get_by_role('button', name='Find music', exact=True).click()
        page.locator('#maSearch').fill('same song')
        page.evaluate('searchMusicAssistant()')
        count = len(requests)
        page.locator('#maSearch').fill('')
        page.evaluate('searchMusicAssistant()')
        self.assertEqual(page.locator('#maSearchResults').inner_text(), '')
        self.assertEqual(len(requests), count)
        page.locator('#maSearch').fill('same song')
        page.evaluate('searchMusicAssistant()')
        self.assertEqual(page.locator('#maSearchResults .musicItem').count(), 1)
        self.assertEqual(errors, [])
