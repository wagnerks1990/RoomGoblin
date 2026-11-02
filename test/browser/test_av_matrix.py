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
            elif target == '/api/v1/commands':
                route.fulfill(json={'ok': True})
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

    def test_unmapped_duplicate_and_disabled_receivers_fail_closed(self):
        page, errors, config, _, writes = self.matrix()
        # A real online receiver called tv8 belongs to another output. Never infer
        # its target from the unmapped HDBT 8 port number.
        config['devices']['tv8'] = {'name': 'Other receiver', 'avOutput': 2, 'enabled': True}
        page.evaluate("refreshPluto()")
        page.evaluate("S.avDeviceStatus={tv8:{online:true},'receiver-a':{online:true}};openAvTvDrawer(8)")
        self.assertIn('No unique receiver mapping', page.locator('#avDrawerSubtitle').inner_text())
        self.assertEqual(page.locator('#avDrawerGroups input').count(), 0)
        for action in ('drawerTestImage()', 'drawerClearDisplay()', 'drawerReloadDisplay()', 'saveDrawerTvGroups()'):
            page.evaluate(action)
            self.assertIn('no unique receiver mapping', page.locator('#hubToast').inner_text())
        self.assertEqual(writes, [])
        config['devices']['tv8']['avOutput'] = 1
        page.evaluate('refreshPluto()')
        page.evaluate('openAvTvDrawer(1)')
        page.evaluate('drawerTestImage()')
        page.evaluate('saveDrawerTvGroups()')
        self.assertEqual(writes, [])
        config['devices']['tv8']['avOutput'] = 2
        config['devices']['receiver-a']['enabled'] = False
        page.evaluate('refreshPluto()')
        page.evaluate("S.avDeviceStatus['receiver-a']={online:true};openAvTvDrawer(1)")
        page.evaluate('drawerReloadDisplay()')
        self.assertIn('disabled', page.locator('#hubToast').inner_text())
        self.assertEqual(writes, [])
        config['devices']['receiver-a']['enabled'] = True
        page.evaluate('refreshPluto()')
        page.evaluate("S.avDeviceStatus['receiver-a']={online:true};openAvTvDrawer(1)")
        for action in ('drawerTestImage()', 'drawerClearDisplay()', 'drawerReloadDisplay()'):
            page.evaluate(action)
        self.assertEqual([body['target'] for target, body in writes], ['receiver-a'] * 3)
        self.assertFalse(errors, errors)

    def test_long_group_keys_wrap_and_save_without_renaming(self):
        for width in (390, 1440):
            with self.subTest(width=width):
                page, errors, config, _, writes = self.matrix(width)
                keys = ['display-' * 12 + 'front', 'display-' * 9 + 'rear']
                config['displayGroups'].update({key: [] for key in keys})
                page.evaluate('refreshPluto()')
                page.evaluate('openAvTvDrawer(1)')
                labels = page.locator('#avDrawerGroups label')
                self.assertEqual(labels.count(), 2)
                for i, key in enumerate(keys):
                    self.assertEqual(labels.nth(i).locator('span').inner_text(), key)
                self.assertTrue(page.locator('#avDrawerGroups').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
                self.assertTrue(labels.nth(0).evaluate('(e)=>e.getBoundingClientRect().bottom<=e.nextElementSibling.getBoundingClientRect().top'))
                page.locator('#avDrawerGroups input').first.check()
                page.evaluate('saveDrawerTvGroups()')
                self.assertEqual(config['displayGroups'][keys[0]], ['receiver-a'])
                self.assertEqual(config['displayGroups'][keys[1]], [])
                self.assertEqual(set(config['displayGroups']), {'all', *keys})
                self.assertEqual([target for target, _ in writes], ['/api/v1/admin/displays'])
                self.evidence(page, errors, f'matrix-long-groups-{width}')

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
                row.get_by_label('Audio priority').select_option('independent')
                page.evaluate('refreshPluto()')
                self.assertEqual(row.locator('[data-f="name"]').input_value(), 'Renamed screen')
                self.assertEqual(row.locator('[data-f="avOutput"]').input_value(), '2')
                self.assertEqual(row.get_by_label('Audio priority').input_value(), 'independent')
                page.remove_listener('dialog', page._fixture_dialog_handler)
                page.once('dialog', lambda dialog: dialog.accept())
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
                self.assertEqual(config['devices']['receiver-a']['audioScope'], 'independent')
                self.assertEqual(config['devices']['receiver-b']['audioScope'], 'room')
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
                self.assertEqual(page.locator('[data-display-id="receiver-a"]').get_by_label('Audio priority').input_value(), 'independent')
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
            self.assertIn('no unique receiver mapping', page.locator('#hubToast').inner_text())
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

    def test_rejected_power_command_does_not_record_success(self):
        page, errors, _, _, _ = self.matrix()
        page.route('**/api/v1/pluto', lambda route: route.fulfill(json={'type':'ack','action':'cecOutput','result':0,'ok':False}))
        page.evaluate('toggleRowTvPower(1)')
        self.assertIn('rejected', page.locator('#hubToast').inner_text().lower())
        self.assertIsNone(page.evaluate("localStorage.getItem('classroomHub.avPowerStates')"))
        self.assertFalse(errors, errors)

    def test_unknown_power_readings_are_not_reported_off(self):
        page, errors, _, _, _ = self.matrix()
        for value in (None, '', 'unknown'):
            page.evaluate('(value)=>{S.pluto.cecStatus={hdbtPower:[value]};renderMatrix()}', value)
            self.assertFalse(page.evaluate('avPowerStateInfo(1).known'))
            self.assertIn('not reported', page.locator('#matrix .av40PowerMini').first.get_attribute('title'))
        self.assertFalse(errors, errors)

    def test_power_and_route_keep_unsaved_drawer_fields(self):
        page, errors, config, _, _ = self.matrix()
        config['displayGroups']['lesson'] = []
        page.evaluate('refreshPluto()')
        page.evaluate('openAvTvDrawer(1)')
        page.locator('#avDrawerTvName').fill('Draft TV name')
        page.locator('[data-drawer-tv-group="lesson"]').check()
        page.evaluate('drawerTvPower(0)')
        self.assertEqual(page.locator('#avDrawerTvName').input_value(), 'Draft TV name')
        self.assertTrue(page.locator('[data-drawer-tv-group="lesson"]').is_checked())
        page.locator('#avDrawerSource').select_option('2')
        page.evaluate('drawerUpdateRoute()')
        self.assertEqual(page.locator('#avDrawerTvName').input_value(), 'Draft TV name')
        self.assertTrue(page.locator('[data-drawer-tv-group="lesson"]').is_checked())
        self.assertIn('Source 2', page.locator('#avDrawerCurrentSource').inner_text())
        self.assertFalse(errors, errors)

    def test_receiver_read_failure_does_not_mark_matrix_offline(self):
        page, errors, _, _, writes = self.matrix()
        page.route('**/api/v1/config', lambda route: route.fulfill(status=503,json={'error':'Fixture receiver config unavailable'}))
        page.evaluate('refreshPluto()')
        self.assertEqual(page.locator('#avHealth').inner_text(), 'Matrix Online')
        self.assertIn('receiver', page.locator('#avReadMsg').inner_text().lower())
        page.evaluate("S.avDeviceStatus={'receiver-a':{online:true}};openAvTvDrawer(1)")
        page.evaluate('drawerTestImage()')
        self.assertIn('unavailable', page.locator('#hubToast').inner_text().lower())
        self.assertEqual(writes, [])
        self.assertFalse(errors, errors)

    def test_refresh_requests_share_one_matrix_read(self):
        page, errors, _, labels, _ = self.matrix()
        held=[]
        page.route('**/api/v1/pluto/status', lambda route: held.append(route))
        page.evaluate('window.fixtureRefresh=Promise.all([refreshPluto(),refreshPluto()]);void 0')
        page.wait_for_timeout(150)
        try:
            self.assertEqual(len(held), 1)
        finally:
            for route in held:
                route.fulfill(json={'ok':True,'labels':labels,'videoStatus':{'allsource':[1]*8}})
        page.evaluate('fixtureRefresh')
        self.assertFalse(errors, errors)

    def test_tv_drawer_keyboard_focus_and_escape(self):
        page, errors, _, _, _ = self.matrix()
        trigger=page.locator('#matrix .av40TvName').first
        trigger.click()
        self.assertTrue(page.locator('#avDrawerTvName').evaluate('(e)=>e===document.activeElement'))
        page.keyboard.press('Shift+Tab')
        self.assertTrue(page.evaluate("avTvDrawer.contains(document.activeElement)"))
        page.keyboard.press('Escape')
        self.assertFalse(page.locator('#avTvDrawer').is_visible())
        self.assertTrue(trigger.evaluate('(e)=>e===document.activeElement'))
        self.assertFalse(errors, errors)

    def test_setup_rejects_invalid_receiver_ids_before_any_save(self):
        writes=[]
        config={'devices':{'Front_A':{'name':'Front','enabled':True}},'displayGroups':{'all':['Front_A']}}
        def transport(route,target):
            if target=='/api/v1/admin/config':
                route.fulfill(json={'ok':True,'site':{},'devices':config,'hardware':{}})
                return True
            if route.request.method in ('PUT','POST'):
                writes.append(target)
                route.fulfill(status=400 if target=='/api/v1/admin/displays' else 200,json={'error':'Invalid display id'} if target=='/api/v1/admin/displays' else {'ok':True})
                return True
            return False
        page,errors=self.page('/setup/',transport=transport)
        page.wait_for_function("document.querySelector('#receiverIds').value==='Front_A'")
        page.locator('#receiverIds').fill('invalid.receiver')
        page.locator('button[onclick="save()"]').click()
        self.assertEqual(writes,[])
        self.assertIn('receiver id',page.locator('#msg').inner_text().lower())
        page.locator('#receiverIds').fill('Front_A')
        page.locator('#displayCount').fill('2')
        page.locator('#displayCount').dispatch_event('change')
        self.assertEqual(page.locator('#receiverIds').input_value(),'Front_A, tv1')
        self.assertFalse(errors,errors)

    def test_changed_receiver_status_preserves_other_matrix_controls(self):
        page,errors,_,_,_=self.matrix()
        page.evaluate("window.fixtureRoute=document.querySelector('#matrix .route');fixtureRoute.focus();S.avDeviceStatus={'receiver-a':{online:true}};renderMatrix()")
        self.assertTrue(page.evaluate("fixtureRoute===document.querySelector('#matrix .route')&&fixtureRoute===document.activeElement"))
        self.assertFalse(errors,errors)

    def test_drawer_rejection_is_visible_without_caching_power(self):
        page,errors,_,_,_=self.matrix()
        page.route('**/api/v1/pluto',lambda route:route.fulfill(json={'type':'ack','result':0,'ok':False}))
        page.evaluate('openAvTvDrawer(1)')
        page.evaluate('drawerTvPower(0)')
        self.assertIn('rejected',page.locator('#hubToast').inner_text().lower())
        self.assertIsNone(page.evaluate("localStorage.getItem('classroomHub.avPowerStates')"))
        page.evaluate('openAvSourceDrawer(1)')
        page.evaluate('sourceDrawerPower(1)')
        self.assertIn('rejected',page.locator('#hubToast').inner_text().lower())
        self.assertFalse(errors,errors)

    def test_drawer_yields_to_login_when_session_expires(self):
        page,errors,_,_,_=self.matrix()
        page.evaluate('openAvTvDrawer(1)')
        page.evaluate('showLogin()')
        self.assertFalse(page.locator('#avTvDrawer').is_visible())
        self.assertTrue(page.locator('#loginOverlay').is_visible())
        page.wait_for_function("document.activeElement===loginUser")
        self.assertFalse(errors,errors)

    def test_av_controls_match_server_permissions(self):
        page,errors,_,_,_=self.matrix()
        page.evaluate("applyAuthUi({user:{role:'teacher',capabilities:['integrations.control']}});openAvTvDrawer(1)")
        self.assertTrue(page.locator('button[onclick="drawerTvPower(0)"]').is_disabled())
        self.assertTrue(page.locator('button[onclick="saveDrawerTvGroups()"]').is_disabled())
        self.assertTrue(page.locator('button[onclick="saveDrawerTvName()"]').is_disabled())
        page.evaluate("applyAuthUi({user:{role:'teacher',capabilities:['integrations.control','classroom.control']}})")
        self.assertFalse(page.locator('button[onclick="drawerTvPower(0)"]').is_disabled())
        self.assertTrue(page.locator('button[onclick="saveDrawerTvName()"]').is_disabled())
        page.evaluate('openAvTvDrawer(8)')
        self.assertFalse(page.locator('button[onclick="saveDrawerTvName()"]').is_disabled())
        page.evaluate('openAvSourceDrawer(1)')
        self.assertFalse(page.locator('button[onclick="saveSourceDrawer()"]').is_disabled())
        self.assertFalse(errors,errors)

    def test_receiver_editor_preserves_special_named_keys(self):
        page,errors,config,_,_=self.matrix()
        config['devices']['__proto__']={'name':'Fixture special ID','enabled':True}
        config['displayGroups']['__proto__']=['__proto__']
        page.evaluate('openReceiverSettings()')
        page.wait_for_selector('[data-display-id="__proto__"]')
        page.evaluate('saveAdminDisplaysStructured()')
        self.assertIn('__proto__',config['devices'])
        self.assertEqual(config['displayGroups']['__proto__'],['__proto__'])
        self.assertFalse(errors,errors)

    def test_malformed_matrix_status_keeps_last_inventory_and_reports_failure(self):
        page,errors,_,_,_=self.matrix()
        page.route('**/api/v1/pluto/status',lambda route:route.fulfill(body='null',content_type='application/json'))
        page.evaluate('refreshPluto()')
        self.assertEqual(page.locator('#avHealth').inner_text(),'Matrix unavailable')
        self.assertIn('Invalid status response',page.locator('#avReadMsg').inner_text())
        self.assertEqual(page.locator('#matrix .route').count(),64)
        self.assertFalse(errors,errors)
