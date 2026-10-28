"""Weather workspace and real generated scenes with isolated provider fixtures."""
import json
import subprocess
import unittest
import test_workspaces as workspaces


def forecast():
    script = """
const {forecastSnapshot}=require('./src/planning-weather');
const at=Date.now(),start=Math.floor(at/86400000)*86400;
const hours=Array.from({length:48},(_,i)=>start+i*3600),days=Array.from({length:16},(_,i)=>start+43200+i*86400);
const w=forecastSnapshot({timezone:'America/New_York',current:{temperature_2m:76,weather_code:3,apparent_temperature:78,relative_humidity_2m:60,wind_speed_10m:8,wind_gusts_10m:14,cloud_cover:50,pressure_msl:1013},hourly:{time:hours,temperature_2m:hours.map(()=>75),apparent_temperature:hours.map(()=>77),precipitation_probability:hours.map(()=>20),wind_speed_10m:hours.map(()=>8),wind_gusts_10m:hours.map(()=>14),uv_index:hours.map(()=>4),visibility:hours.map(()=>16000)},daily:{time:days,temperature_2m_max:days.map(()=>78),temperature_2m_min:days.map(()=>55),weather_code:days.map(()=>3),precipitation_probability_max:days.map(()=>25),wind_speed_10m_max:days.map(()=>12),uv_index_max:days.map(()=>5),sunrise:days.map(t=>t-3600),sunset:days.map(t=>t+36000)}},{unit:'fahrenheit',label:'Example School'},at);
w.alertsStatus='unavailable';w.widgets['weather-alerts']='Weather alerts unavailable';console.log(JSON.stringify(w));
"""
    return json.loads(subprocess.check_output(['node', '-e', script], cwd=workspaces.ROOT, text=True, encoding='utf-8'))


def weather_page(self, width=1440):
    weather = forecast()
    requests = []

    def transport(route, target):
        if target == '/api/v1/weather/scene':
            body = route.request.post_data_json
            requests.append(body)
            script = "const {weatherScene}=require('./src/weather-scene');console.log(JSON.stringify(weatherScene(JSON.parse(process.argv[1]),JSON.parse(process.argv[2]))));"
            scene = json.loads(subprocess.check_output(['node', '-e', script, json.dumps(weather), json.dumps(body)], cwd=workspaces.ROOT, text=True, encoding='utf-8'))
            route.fulfill(json={'ok': True, 'scene': scene})
            return True
        if target == '/api/v1/commands':
            requests.append(route.request.post_data_json)
            route.fulfill(json={'ok': True})
            return True
        return False

    page, errors = self.page('/controller/', width, overrides={
        '/api/v1/weather': {'ok': True, 'config': {'enabled': True, 'latitude': 40, 'longitude': -77, 'unit': 'fahrenheit', 'label': 'Example School'}, 'weather': weather, 'status': {}, 'stale': False},
        '/api/v1/devices': {'devices': {'tv1': {'name': 'Example display', 'enabled': True}}},
    }, transport=transport)
    page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
    if width < 1000:
        page.locator('#workspaceMenu').click()
    page.get_by_role('button', name='Weather', exact=True).click()
    page.get_by_role('heading', name='Example School', exact=True).wait_for()
    return page, errors, requests


class WeatherWorkspaceBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    evidence = workspaces.WorkspaceBrowserTests.evidence

    def test_weather_week_sports_preview_and_explicit_targets(self):
        page, errors, requests = weather_page(self)
        self.assertEqual(page.get_by_label('Forecast layout', exact=True).input_value(), 'week')
        self.assertEqual(page.locator('.weatherDay').count(), 7)
        page.get_by_role('button', name='Preview weather layout', exact=True).click()
        page.locator('.weatherPreviewCanvas .rg-scene-layer').first.wait_for()
        self.assertEqual(page.locator('.weatherPreviewCanvas [data-layer-id^="day-"]:not([data-layer-id^="day-background-"])').count(), 7)
        self.assertIn('Evening', page.locator('.weatherPreviewCanvas').inner_text())
        self.assertIn('unavailable', page.locator('#weather').inner_text())
        page.get_by_role('button', name='Send full-screen weather', exact=True).click()
        self.assertIn('Select one or more', page.locator('.weatherNotice').inner_text())
        self.assertFalse(any('target' in r for r in requests))
        page.get_by_label('Example display', exact=True).check()
        page.get_by_role('button', name='Send full-screen weather', exact=True).click()
        page.get_by_text('Weather sent to 1 selected display(s).', exact=True).wait_for()
        self.assertEqual(requests[-1]['target'], ['tv1'])
        self.evidence(page, errors, 'weather-workspace-desktop')
        self.assertEqual(errors, [])

    def test_weather_mobile_overlay_fields_and_scene_editor(self):
        page, errors, requests = weather_page(self, 390)
        page.get_by_label('Weather display type', exact=True).select_option('overlay')
        group = page.locator('fieldset').filter(has=page.get_by_text('Overlay details · add or remove what students need', exact=True))
        group.get_by_label('Temperature', exact=True).uncheck()
        group.get_by_label('Wind & gusts', exact=True).check()
        page.get_by_role('button', name='Preview weather layout', exact=True).click()
        page.locator('.weatherPreviewCanvas .rg-weather-credit').wait_for()
        self.assertNotIn('temperature', requests[-1]['overlayFields'])
        self.assertIn('wind', requests[-1]['overlayFields'])
        self.assertTrue(page.get_by_role('button', name='Send full-screen weather', exact=True).is_hidden())
        page.get_by_role('button', name='Customize in scene editor', exact=True).click()
        dialog = page.get_by_role('dialog', name='Scene studio', exact=True)
        dialog.get_by_role('button', name='weather-now', exact=True).click()
        self.assertTrue(dialog.get_by_label('Weather detail: wind', exact=True).is_checked())
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        self.evidence(page, errors, 'weather-workspace-mobile')
        self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), 392)
        self.assertEqual(errors, [])

    def test_weather_refresh_preserves_location_draft_and_overlay_choices(self):
        page, errors, _ = weather_page(self)
        page.get_by_text('Location, units & weather sources', exact=True).click()
        page.get_by_label('Weather location label', exact=True).fill('Unsaved location')
        page.get_by_label('Weather display type', exact=True).select_option('overlay')
        page.get_by_role('button', name='Refresh weather', exact=True).click()
        self.assertEqual(page.get_by_label('Weather location label', exact=True).input_value(), 'Unsaved location')
        self.assertTrue(page.get_by_role('button', name='Send full-screen weather', exact=True).is_hidden())
        self.assertTrue(page.get_by_role('button', name='Create shared weather overlay', exact=True).is_visible())
        self.assertEqual(errors, [])

    def test_unavailable_forecast_clears_previous_readings_and_preview(self):
        page, errors, requests = weather_page(self)
        page.get_by_role('button', name='Preview weather layout', exact=True).click()
        page.locator('.weatherPreviewCanvas .rg-scene-layer').first.wait_for()
        response = {'ok': True, 'config': {'enabled': False, 'label': 'New location'},
                    'weather': None, 'status': {}, 'stale': False}
        page.route('**/api/v1/weather', lambda route: route.fulfill(json=response))
        page.get_by_role('button', name='Refresh weather', exact=True).click()
        page.get_by_text('Enable weather and set a location to load current conditions and forecasts.', exact=True).wait_for()
        self.assertEqual(page.locator('.weatherTemperature').inner_text(), '—')
        self.assertEqual(page.locator('.weatherDay').count(), 0)
        self.assertEqual(page.locator('.weatherSportsCard').count(), 0)
        self.assertEqual(page.locator('.weatherTable table').count(), 0)
        self.assertEqual(page.locator('.weatherPreviewCanvas .rg-scene-layer').count(), 0)
        self.assertNotIn('Example School', page.locator('#weather').inner_text())
        self.assertFalse(any('target' in r for r in requests))
        self.assertEqual(errors, [])

    def test_changed_location_retires_preview_before_send(self):
        page, errors, requests = weather_page(self)
        page.get_by_role('button', name='Preview weather layout', exact=True).click()
        page.locator('.weatherPreviewCanvas .rg-scene-layer').first.wait_for()
        weather = forecast()
        weather['label'] = 'New location'
        response = {'ok': True, 'config': {'enabled': True, 'latitude': 41,
                    'longitude': -77, 'unit': 'fahrenheit', 'label': 'New location'},
                    'weather': weather, 'status': {}, 'stale': False}
        page.route('**/api/v1/weather', lambda route: route.fulfill(json=response))
        page.get_by_role('button', name='Refresh weather', exact=True).click()
        page.get_by_role('heading', name='New location', exact=True).wait_for()
        # If the old scene survives, Send bypasses scene generation and dispatches it.
        page.route('**/api/v1/weather/scene', lambda route: route.fulfill(
            status=400, json={'ok': False, 'error': 'New forecast not ready'}))
        page.get_by_label('Example display', exact=True).check()
        page.get_by_role('button', name='Send full-screen weather', exact=True).click()
        page.wait_for_function("/New forecast not ready|Weather sent/.test(document.querySelector('.weatherNotice').textContent)")
        self.assertFalse(any('target' in r for r in requests))
        self.assertIn('New forecast not ready', page.locator('.weatherNotice').inner_text())
        self.assertEqual(page.locator('.weatherPreviewCanvas .rg-scene-layer').count(), 0)
        self.assertEqual(errors, [])

    def test_same_location_refresh_preserves_preview_and_selected_targets(self):
        page, errors, _ = weather_page(self)
        page.get_by_role('button', name='Preview weather layout', exact=True).click()
        page.locator('.weatherPreviewCanvas .rg-scene-layer').first.wait_for()
        page.get_by_label('Example display', exact=True).check()
        before = page.locator('.weatherPreviewCanvas .rg-scene-layer').first.element_handle()
        with page.expect_response(lambda response: response.url.endswith('/api/v1/weather')):
            page.get_by_role('button', name='Refresh weather', exact=True).click()
        self.assertTrue(before.evaluate('(node) => node.isConnected'))
        self.assertTrue(page.get_by_label('Example display', exact=True).is_checked())
        self.assertEqual(errors, [])

    def test_late_preview_cannot_restore_a_retired_location(self):
        page, errors, requests = weather_page(self)
        held = []
        page.route('**/api/v1/weather/scene', lambda route: held.append(route))
        page.get_by_role('button', name='Preview weather layout', exact=True).click()
        pending = workspaces.WorkspaceBrowserTests.held_route(self, page, held)
        page.route('**/api/v1/weather', lambda route: route.fulfill(json={
            'ok': True, 'config': {'enabled': False, 'label': 'New location'},
            'weather': None, 'status': {}, 'stale': False}))
        page.get_by_role('button', name='Refresh weather', exact=True).click()
        page.get_by_text('Enable weather and set a location to load current conditions and forecasts.', exact=True).wait_for()
        pending.fulfill(json={'ok': True, 'scene': {'layers': [
            {'type': 'text', 'text': 'Retired forecast'}]}})
        page.wait_for_function("/Layout changed|Preview ready/.test(document.querySelector('.weatherNotice').textContent)")
        self.assertEqual(page.locator('.weatherPreviewCanvas .rg-scene-layer').count(), 0)
        self.assertIn('Layout changed', page.locator('.weatherNotice').inner_text())
        self.assertFalse(any('target' in r for r in requests))
        self.assertEqual(errors, [])
