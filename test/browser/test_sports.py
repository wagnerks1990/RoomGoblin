"""Sports operator and receiver widget behavior using fictional, isolated data."""
import json
import subprocess
import unittest
import test_workspaces as workspaces


def data():
    script = "const m=require('./src/sports');const c=m.normalize({school:'Example Athletics',timezone:'America/New_York',teams:[{id:'t',name:'Girls soccer',sport:'Soccer',level:'varsity',season:'2026',roster:Array.from({length:12},(_,i)=>({id:'p'+i,name:'Example Athlete '+i,number:String(i+1),grade:'11'}))}],boards:[{id:'b',name:'School sports',teamIds:['t'],minimumSeconds:10,entryDelay:2,rosterSpeed:60}]});console.log(JSON.stringify({config:c,display:{ok:true,...m.project(c,'b')},scene:m.scene(c.boards[0])}));"
    return json.loads(subprocess.check_output(['node', '-e', script], cwd=workspaces.ROOT, text=True, encoding='utf-8'))


class SportsBrowserTests(unittest.TestCase):
    setUpClass = classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
    page = workspaces.WorkspaceBrowserTests.page
    evidence = workspaces.WorkspaceBrowserTests.evidence

    def sports(self, width=1440):
        d = data()
        commands = []
        def transport(route, target):
            if target == '/api/v1/sports/boards/b/scene':
                route.fulfill(json={'ok': True, 'scene': d['scene']})
                return True
            if target == '/api/v1/sports/boards/b/display':
                route.fulfill(json=d['display'])
                return True
            if target == '/api/v1/commands':
                commands.append(route.request.post_data_json)
                route.fulfill(json={'ok': True})
                return True
            if target == '/api/v1/sports' and route.request.method == 'PUT':
                d['config'] = route.request.post_data_json
                d['config']['revision'] += 1
                route.fulfill(json={'ok': True, 'config': d['config']})
                return True
            return False
        page, errors = self.page('/controller/', width, overrides={
            '/api/v1/sports': {'ok': True, 'config': d['config'], 'sources': {}},
            '/api/v1/devices': {'devices': {'tv1': {'name': 'Example display', 'enabled': True}}},
        }, transport=transport)
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        if width < 1000:
            page.locator('#workspaceMenu').click()
        page.get_by_role('button', name='Sports', exact=True).click()
        page.get_by_label('Board name', exact=True).wait_for()
        return page, errors, commands, d

    def test_operator_preview_targets_draft_and_responsive_layout(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                page, errors, commands, _ = self.sports(width)
                page.get_by_role('button', name='Preview board', exact=True).click()
                page.locator('.sportsPreviewCanvas .rg-sports-player').first.wait_for()
                self.assertEqual(page.locator('.sportsPreviewCanvas video[src]').count(), 0)
                page.get_by_role('button', name='Send to selected displays', exact=True).click()
                page.get_by_text('Select at least one display', exact=True).wait_for()
                self.assertFalse(commands)
                page.get_by_label('Example display', exact=True).check()
                page.get_by_role('button', name='Send to selected displays', exact=True).click()
                page.get_by_text('Sports sent to the selected displays.', exact=True).wait_for()
                self.assertEqual(commands[0]['target'], ['tv1'])
                page.get_by_label('Board name', exact=True).fill('Unsaved change')
                page.get_by_role('button', name='Preview board', exact=True).click()
                page.get_by_text('Save the board before previewing or scheduling it', exact=True).wait_for()
                self.evidence(page, errors, 'sports-operator-' + str(width))

    def test_receiver_bottom_entry_continuous_scroll_and_scene_cleanup(self):
        page, errors, _, d = self.sports()
        page.evaluate("""scene => {
            for(const link of document.querySelectorAll('link[rel=stylesheet]'))document.head.append(link);
            document.body.replaceChildren();
            const canvas=document.createElement('div');canvas.id='receiver';canvas.style.cssText='position:relative;width:1920px;height:1080px';document.body.append(canvas);
            RoomGoblinScene.render(canvas,scene,{previewSports:false});
        }""", d['scene'])
        page.locator('.rg-sports-player').first.wait_for()
        self.assertEqual(page.locator('.rg-sports').evaluate('(n)=>getComputedStyle(n).display'), 'grid')
        initial = page.locator('.rg-sports-roster-track').evaluate('(n)=>new DOMMatrix(getComputedStyle(n).transform).m42')
        self.assertGreater(initial, 200)
        page.wait_for_timeout(3500)
        later = page.locator('.rg-sports-roster-track').evaluate('(n)=>new DOMMatrix(getComputedStyle(n).transform).m42')
        self.assertLess(later, initial - 40)
        self.assertEqual(page.locator('.rg-sports-copy .rg-sports-player').count(), 12)
        self.assertEqual(page.locator('.rg-sports-player').count(), 24)
        page.evaluate("RoomGoblinScene.render(document.getElementById('receiver'),{layers:[]})")
        self.assertEqual(page.locator('.rg-sports').count(), 0)
        self.assertEqual(errors, [])
    def test_long_event_weather_and_title_fit_the_logical_board(self):
        page, errors, _, d = self.sports()
        p = d['display']['pages'][0]
        p['name'] = 'Example long team name ' * 6
        p['previous'] = {'opponent': 'Example long visiting school name ' * 4, 'score': 0, 'opponentScore': 3, 'status': 'final', 'startAt': '2026-10-14T20:00:00Z', 'recap': 'Verified contribution. ' * 30}
        p['next'] = {'opponent': 'Example long opposing school name ' * 4, 'status': 'scheduled', 'startAt': '2026-10-19T20:00:00Z', 'homeAway': 'away', 'venue': 'Example athletic facility and street address ' * 4}
        d['display']['weather'] = {'widgets': {'weather-temperature': '76°F', 'weather-condition': 'Thunderstorms', 'weather-sports-evening': 'Evening sports · 6–10 PM\n67–60°F · Feels 67–60°F\nHourly precip. up to 89%\nWind 14 mph · Gusts 24 mph'}, 'updatedAt': 1792188000000, 'source': 'Weather fixture'}
        page.get_by_role('button', name='Preview board', exact=True).click()
        page.locator('.rg-sports-weather').get_by_text('Thunderstorms', exact=False).wait_for()
        overflow = page.locator('.rg-sports').evaluate("""n => [...n.querySelectorAll('.rg-sports-heading,article,.rg-sports-weather,.rg-sports-recap')].filter(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2).map(x=>x.className||x.tagName)""")
        self.assertEqual(overflow, [])
        self.assertEqual(errors, [])
