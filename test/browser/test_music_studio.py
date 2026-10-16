"""Real music workspace with bounded fixture transports; no live audio commands."""
import unittest
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
