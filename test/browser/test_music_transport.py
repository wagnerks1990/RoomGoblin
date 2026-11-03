"""Exercise real transport handlers without sending commands to live players."""
import unittest

import test_music_studio as studio


class MusicTransportBrowserTests(unittest.TestCase):
    setUpClass = classmethod(studio.MusicStudioBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(studio.MusicStudioBrowserTests.tearDownClass.__func__)
    page = studio.MusicStudioBrowserTests.page
    wait_request = studio.MusicStudioBrowserTests.wait_request

    def test_play_resumes_selected_queue_instead_of_saved_favorite(self):
        for other_paused in (False, True):
            with self.subTest(other_paused=other_paused):
                page, errors, requests = studio.music_page(self)
                page.wait_for_function('!window.musicStudioLoading')
                background = page.evaluate("api('/api/v1/music-assistant/background')")
                background['runtime']['paused'] = other_paused
                page.route('**/api/v1/music-assistant/background', lambda route: route.fulfill(json=background))
                page.evaluate('loadMusicAssistant()')
                page.get_by_label('Listening output', exact=True).select_option('classroom-hub-tv1')
                page.get_by_role('button', name='Play', exact=True).click()
                self.wait_request(page, requests)
                page.wait_for_function('!window.musicStudioLoading')
                self.assertEqual(requests, [{'action': 'resume', 'playerId': 'classroom-hub-tv1'}])
                self.assertEqual(page.get_by_label('Listening volume', exact=True).input_value(), '10')
                self.assertEqual(errors, [])
                page.close()

    def test_owned_play_and_resume_preserve_managed_session(self):
        for paused in (False, True):
            with self.subTest(paused=paused):
                page, errors, requests = studio.music_page(self)
                page.wait_for_function('!window.musicStudioLoading')
                background = page.evaluate("api('/api/v1/music-assistant/background')")
                background['runtime']['paused'] = paused
                page.route('**/api/v1/music-assistant/background', lambda route: route.fulfill(json=background))
                page.evaluate('loadMusicAssistant()')
                page.get_by_role('button', name='Resume' if paused else 'Play', exact=True).click()
                self.wait_request(page, requests)
                self.assertEqual(requests, [{'action': 'resume', 'playerId': 'speaker'}])
                self.assertEqual(errors, [])
                page.close()

    def test_play_without_selected_output_does_not_dispatch(self):
        page, errors, requests = studio.music_page(self)
        page.get_by_label('Listening output', exact=True).select_option('')
        page.get_by_role('button', name='Play', exact=True).click()
        self.assertIn('Choose a listening output', page.locator('.musicNotice').inner_text())
        self.assertEqual(requests, [])
        self.assertEqual(errors, [])

    def test_pending_command_disables_live_inputs_and_new_queue_buttons(self):
        for failed in (False, True):
            with self.subTest(failed=failed):
                page, errors, requests = studio.music_page(self)
                page.wait_for_function('!window.musicStudioLoading')
                held = []
                page.route('**/api/v1/music-assistant/command', lambda route: held.append(route))
                volume = page.get_by_label('Listening volume', exact=True)
                volume.fill('6')
                self.wait_request(page, held)
                self.assertEqual(held[0].request.post_data_json, {'command': 'players/cmd/volume_set', 'args': {'player_id': 'speaker', 'volume_level': 6}})
                # The Now playing tab remains usable and refreshes the queue during the write.
                page.get_by_role('button', name='Now playing', exact=True).click()
                page.locator('.musicQueue').get_by_role('button', name='Play current', exact=True).wait_for()
                for label in ('Listening output', 'Listening volume', 'Sleep timer', 'Repeat', 'Track position'):
                    self.assertTrue(page.get_by_label(label, exact=True).is_disabled(), label)
                self.assertTrue(page.locator('.musicQueue').get_by_role('button', name='Play current', exact=True).is_disabled())
                self.assertEqual(len(held), 1)
                held[0].fulfill(status=502 if failed else 200, json={'error': 'Fixture volume rejected'} if failed else {'ok': True})
                page.wait_for_function("!document.querySelector('[aria-label=\"Listening volume\"]').disabled")
                self.assertEqual(volume.input_value(), '25')  # authoritative fixture readback
                self.assertTrue(page.get_by_label('Listening output', exact=True).is_enabled())
                if failed:
                    self.assertIn('Fixture volume rejected', page.locator('.musicNotice').inner_text())
                self.assertEqual(errors, [])
                page.close()

    def test_explicit_favorite_still_starts_selected_source(self):
        page, errors, requests = studio.music_page(self)
        page.locator('.musicQuick').get_by_role('button', name='Station', exact=True).click()
        self.wait_request(page, requests)
        self.assertEqual(requests, [{'action': 'play', 'playerId': 'speaker', 'uri': 'demo://radio/1', 'name': 'Station', 'mediaType': 'radio'}])
        self.assertEqual(errors, [])


if __name__ == '__main__':
    unittest.main()
