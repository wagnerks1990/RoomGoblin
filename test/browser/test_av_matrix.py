"""Original matrix workflow, with deterministic AV transport and persisted saves."""
import copy
import unittest
import test_workspaces as harness


class MatrixBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    evidence = harness.WorkspaceBrowserTests.evidence

    def matrix(self, width=1440, fail_labels=False, recovery=False):
        config = {'devices': {'receiver-a': {'name': 'Front TV', 'enabled': True, 'avOutput': 1,
                   'tags': ['existing'], 'lightingAlias': 'front'}}, 'displayGroups': {'all': ['receiver-a']}}
        labels = {'outputs': ['Front TV'] + [f'TV {n}' for n in range(2, 9)],
                  'inputs': [f'Source {n}' for n in range(1, 9)],
                  'sourceEndpoints': [f'source{n}' for n in range(1, 9)]}
        if recovery:
            config['devices']['receiver-a']['avOutput'] = 5
            config['devices']['receiver-a']['avConnection'] = 'hdbt'
            config['devices']['receiver-b'] = {'name': 'Independent screen', 'enabled': True, 'avOutput': 5}
            config['displayGroups'] = {'all': ['receiver-a', 'receiver-b'],
                'display-all': ['receiver-a'], 'display-display-front': [],
                'display-display-rear': ['receiver-b'], 'empty-custom': []}
        routes = [1] * 8
        writes = []
        def transport(route, target):
            req = route.request
            body = req.post_data_json if req.post_data else None
            if req.method in ('PUT', 'POST'):
                writes.append((target, copy.deepcopy(body)))
            if target == '/api/v1/admin/config':
                route.fulfill(json={'ok': True, 'site': {}, 'devices': config, 'hardware': {}})
            elif target == '/api/v1/config':
                route.fulfill(json=config)
            elif target == '/api/v1/devices':
                route.fulfill(json={'devices': config['devices'], 'groups': config['displayGroups'], 'status': {}})
            elif target == '/api/v1/pluto/status':
                route.fulfill(json={'ok': True, 'labels': labels, 'videoStatus': {'allsource': routes}})
            elif target == '/api/v1/admin/displays':
                config.update(body)
                route.fulfill(json={'ok': True, **config})
            elif target == '/api/v1/pluto/labels':
                if req.method == 'PUT' and fail_labels:
                    route.fulfill(status=503, json={'error': 'Label store unavailable'})
                else:
                    if body:
                        labels.update(body)
                    route.fulfill(json={'ok': True, 'labels': labels})
            elif target == '/api/v1/pluto':
                if body['action'] == 'route':
                    routes[body['output'] - 1] = body['input']
                route.fulfill(json={'ok': True, 'data': {'allsource': routes}})
            else:
                return False
            return True
        page, errors = self.page('/controller/', width, transport=transport)
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.evaluate("showPage('av')")
        page.wait_for_selector('#matrix .route')
        return page, errors, config, labels, writes

    def test_matrix_only_and_refresh_does_not_route_or_replace_controls(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                page, errors, _, _, writes = self.matrix(width)
                self.assertEqual(page.locator('#matrix .route').count(), 64)
                self.assertEqual(page.locator('[data-room-topology-editor], [data-room-topology-config]').count(), 0)
                self.assertFalse(page.evaluate("Boolean(window.RoomGoblinTopology)"))
                page.evaluate("window.fixtureRouteButton=document.querySelector('#matrix .route')")
                for _ in range(3):
                    page.evaluate('refreshPluto()')
                self.assertTrue(page.evaluate("fixtureRouteButton===document.querySelector('#matrix .route')"))
                self.assertEqual(writes, [])
                page.locator('#matrix .av40SourceHead').first.click()
                page.locator('#avSourceDrawerName').fill('Draft source')
                page.evaluate('refreshPluto()')
                self.assertEqual(page.locator('#avSourceDrawerName').input_value(), 'Draft source')
                self.evidence(page, errors, f'matrix-source-draft-{width}')

    def test_names_and_endpoint_persist_after_reload_without_topology_writes(self):
        page, errors, config, labels, writes = self.matrix()
        page.locator('#matrix .av40TvName').first.click()
        page.locator('#avDrawerTvName').fill('Updated front')
        page.locator('#avTvDrawer button', has_text='Save Name').click()
        page.wait_for_function("document.querySelector('#hubToast').textContent==='TV name saved.'")
        self.assertEqual(config['devices']['receiver-a']['name'], 'Updated front')
        self.assertEqual(config['devices']['receiver-a']['tags'], ['existing'])
        self.assertEqual(config['devices']['receiver-a']['lightingAlias'], 'front')
        page.evaluate('closeAvTvDrawer()')
        page.locator('#matrix .av40TvName').nth(7).click()
        page.locator('#avDrawerTvName').fill('Independent output')
        before = len(writes)
        page.evaluate('saveDrawerTvName()')
        self.assertEqual([target for target, _ in writes[before:]], ['/api/v1/pluto/labels'])
        self.assertEqual(list(config['devices']), ['receiver-a'])
        self.assertEqual(labels['outputs'][7], 'Independent output')
        page.evaluate('closeAvTvDrawer()')
        page.locator('#matrix .av40SourceHead').nth(1).click()
        page.locator('#avSourceDrawerName').fill('Document camera')
        page.locator('#avSourceDrawerEndpoint').fill('document-camera')
        page.evaluate('saveSourceDrawer()')
        self.assertEqual(labels['inputs'][1], 'Document camera')
        self.assertEqual(labels['sourceEndpoints'][1], 'document-camera')
        page.reload()
        page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
        page.evaluate("showPage('av')")
        page.wait_for_selector('#matrix .route')
        self.assertEqual(page.locator('#matrix .av40TvName b').first.inner_text(), 'Updated front')
        self.assertEqual(page.locator('#matrix .av40TvName b').nth(7).inner_text(), 'Independent output')
        self.assertEqual(page.locator('#matrix .av40SourceHead').nth(1).inner_text(), 'Document camera')
        self.assertFalse(any('topology' in (body or {}) for _, body in writes))
        self.assertFalse(any(target == '/api/v1/pluto' for target, _ in writes))
        self.assertFalse(errors, errors)

    def test_source_and_partial_tv_save_errors_are_visible(self):
        page, errors, _, labels, _ = self.matrix(fail_labels=True)
        page.evaluate('openAvSourceDrawer(1)')
        page.locator('#avSourceDrawerName').fill('Unsaved name')
        page.evaluate('saveSourceDrawer()')
        self.assertIn('Source was not saved', page.locator('#hubToast').inner_text())
        self.assertEqual(labels['inputs'][0], 'Source 1')
        self.assertEqual(page.locator('#avSourceDrawerName').input_value(), 'Unsaved name')
        page.evaluate('closeAvSourceDrawer();openAvTvDrawer(1)')
        page.locator('#avDrawerTvName').fill('Partial name')
        page.evaluate('saveDrawerTvName()')
        self.assertIn('Receiver name saved, but the matrix label was not saved', page.locator('#hubToast').inner_text())
        self.assertFalse(errors, errors)

    def test_only_explicit_route_action_changes_the_matrix(self):
        page, errors, _, _, writes = self.matrix()
        page.locator('#matrix button[onclick="route(1,2)"]').click()
        page.wait_for_function("document.querySelector('#avMsg').textContent.startsWith('Verified:')")
        route_writes = [body for target, body in writes if target == '/api/v1/pluto' and body.get('action') == 'route']
        self.assertEqual(route_writes, [{'action': 'route', 'output': 1, 'input': 2}])
        page.evaluate('refreshPluto()')
        self.assertIn('active', page.locator('#matrix button[onclick="route(1,2)"]').get_attribute('class'))
        self.assertFalse(errors, errors)

    def test_setup_restores_receiver_count_and_ids(self):
        page, errors = self.page('/setup/')
        self.assertTrue(page.locator('#displayCount').is_visible())
        self.assertTrue(page.locator('#receiverIds').is_visible())
        self.assertEqual(page.locator('[data-room-topology-editor]').count(), 0)
        self.assertFalse(errors, errors)

    def test_receiver_recovery_preserves_drafts_fields_and_group_memberships(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                page, errors, config, labels, writes = self.matrix(width, recovery=True)
                page.evaluate('openReceiverSettings()')
                page.wait_for_selector('[data-display-id="receiver-a"]')
                self.assertIn('Output 5: receiver-a, receiver-b', page.locator('#cfgMappingWarnings').inner_text())
                row = page.locator('[data-display-id="receiver-a"]')
                row.locator('[data-f="name"]').fill('Renamed screen')
                row.locator('[data-f="avOutput"]').fill('2')
                page.evaluate('refreshPluto()')
                self.assertEqual(row.locator('[data-f="name"]').input_value(), 'Renamed screen')
                self.assertEqual(row.locator('[data-f="avOutput"]').input_value(), '2')
                page.on('dialog', lambda dialog: dialog.accept())
                page.evaluate('removeEmptyLegacyDisplayGroups()')
                self.assertEqual(row.locator('[data-f="name"]').input_value(), 'Renamed screen')
                self.assertIn('display-display-front', config['displayGroups'])
                page.evaluate('saveAdminDisplaysStructured()')
                self.assertEqual(page.locator('#cfgDisplaysMsg').inner_text(), 'Receivers and groups saved.')
                self.assertEqual(config['devices']['receiver-a']['avOutput'], 2)
                self.assertEqual(config['devices']['receiver-a']['name'], 'Renamed screen')
                self.assertEqual(config['devices']['receiver-a']['avConnection'], 'hdbt')
                self.assertEqual(config['devices']['receiver-a']['tags'], ['existing'])
                self.assertEqual(config['devices']['receiver-a']['lightingAlias'], 'front')
                self.assertEqual(config['devices']['receiver-b']['avOutput'], 5)
                self.assertEqual(config['displayGroups'], {'all': ['receiver-a', 'receiver-b'],
                    'display-all': ['receiver-a'], 'display-display-rear': ['receiver-b'], 'empty-custom': []})
                self.assertIn('Renamed screen', page.locator('#classDefaultTargets').inner_text())
                self.assertTrue(all(target == '/api/v1/admin/displays' for target, _ in writes))
                page.reload()
                page.wait_for_function("window.AUTH_STATUS?.user?.role === 'admin'")
                page.evaluate("showPage('av');openReceiverSettings()")
                page.wait_for_selector('[data-display-id="receiver-a"]')
                self.assertEqual(page.locator('[data-display-id="receiver-a"] [data-f="avOutput"]').input_value(), '2')
                self.evidence(page, errors, f'receiver-recovery-{width}')

    def test_unmapped_and_shared_outputs_do_not_guess_command_targets(self):
        page, errors, config, labels, writes = self.matrix(recovery=True)
        # Even an online receiver whose ID matches the port must not be guessed.
        page.evaluate("S.avConfig.devices.tv2={name:'Different screen',avOutput:7};S.avDeviceStatus={tv2:{online:true},'receiver-a':{online:true},'receiver-b':{online:true}}")
        for output in (2, 5):
            page.evaluate(f'openAvTvDrawer({output})')
            self.assertEqual(page.locator('[data-drawer-tv-group]').count(), 0)
            page.evaluate('drawerTestImage()')
            page.evaluate('drawerClearDisplay()')
            page.evaluate('drawerReloadDisplay()')
            page.evaluate('saveDrawerTvGroups()')
            self.assertIn('No unique receiver', page.locator('#hubToast').inner_text())
        self.assertEqual(writes, [])
        page.locator('#avDrawerTvName').fill('Shared physical TV')
        page.evaluate('saveDrawerTvName()')
        self.assertEqual(config['devices']['receiver-a']['name'], 'Front TV')
        self.assertEqual(config['devices']['receiver-b']['name'], 'Independent screen')
        self.assertEqual(labels['outputs'][4], 'Shared physical TV')
        self.assertEqual([target for target, _ in writes], ['/api/v1/pluto/labels'])
        self.assertFalse(errors, errors)

    def test_receiver_save_failure_keeps_draft_and_non_admin_cannot_save(self):
        page, errors, config, _, writes = self.matrix(recovery=True)
        page.evaluate('openReceiverSettings()')
        page.wait_for_selector('[data-display-id="receiver-a"]')
        name = page.locator('[data-display-id="receiver-a"] [data-f="name"]')
        name.fill('Retained draft')
        page.route('**/api/v1/admin/displays', lambda route: route.fulfill(status=503, json={'error':'Save unavailable'}))
        page.evaluate('saveAdminDisplaysStructured()')
        self.assertIn('Not saved: Save unavailable', page.locator('#cfgDisplaysMsg').inner_text())
        self.assertEqual(name.input_value(), 'Retained draft')
        self.assertEqual(config['devices']['receiver-a']['name'], 'Front TV')
        page.evaluate("applyAuthUi({user:{role:'teacher',capabilities:['integrations.control']}})")
        self.assertTrue(page.locator('button[onclick="saveAdminDisplaysStructured()"]').is_disabled())
        self.assertTrue(page.locator('button[onclick="removeEmptyLegacyDisplayGroups()"]').is_disabled())
        self.assertFalse(errors, errors)
