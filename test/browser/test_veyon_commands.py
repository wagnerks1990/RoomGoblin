"""Real Veyon command UI against deterministic queued job responses."""
import unittest
import test_workspaces as harness


class VeyonCommandBrowserTests(unittest.TestCase):
    setUpClass = classmethod(harness.WorkspaceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(harness.WorkspaceBrowserTests.tearDownClass.__func__)
    page = harness.WorkspaceBrowserTests.page
    evidence = harness.WorkspaceBrowserTests.evidence

    def command_page(self, width=1440):
        computers = [{'id': f'pc-{n}', 'name': f'Workstation {n}', 'role': 'student', 'online': True,
                      'authenticated': True, 'user': {'login': 'fixture'}, 'featureState': {'screenLock': False}} for n in range(24)]
        state = {'jobs': [], 'submitted': [], 'cancelled': [], 'fail_submit': False, 'history_error': False, 'ownedLocks': []}
        def transport(route, target):
            if target == '/api/v1/veyon/jobs':
                route.fulfill(status=503 if state['history_error'] else 200, json={'error': 'Queue unavailable'} if state['history_error'] else {'jobs': state['jobs'], 'ownedLocks': state['ownedLocks']})
                return True
            if target == '/api/v1/veyon/feature':
                command = route.request.post_data_json
                state['submitted'].append(command)
                if state['fail_submit']:
                    route.abort('failed')
                    return True
                for older in state['jobs']:
                    if older['feature'] == command['feature']:
                        for result in older['results']:
                            if result['id'] in command['targets'] and result['state'] in ('queued', 'retrying'):
                                result.update(state='cancelled', reason='superseded')
                number = len(state['submitted'])
                job = {'id': f'job-{number}', 'sequence': number, 'requestId': command['requestId'], 'feature': command['feature'],
                       'active': command['active'], 'createdAt': f'2026-01-01T12:00:{number:02d}Z', 'state': 'queued',
                       'results': [{'id': target, 'name': target, 'state': 'queued', 'attempts': 0, 'ok': False} for target in command['targets']]}
                state['jobs'].insert(0, job)
                route.fulfill(status=202, json={'ok': True, 'job': job})
                return True
            if target.endswith('/cancel') and '/veyon/jobs/' in target:
                job = next(job for job in state['jobs'] if job['id'] == target.split('/')[-2])
                state['cancelled'].append(job['id'])
                for result in job['results']:
                    if result['state'] in ('queued', 'retrying'):
                        result.update(state='cancelled', reason='operator')
                route.fulfill(json={'ok': True, 'job': job})
                return True
            return False
        page, errors = self.page('/controller/veyon.html', width, transport=transport, overrides={
            '/api/v1/veyon/computers': {'computers': computers}, '/api/v1/veyon/status': {'keyName': 'fixture'}})
        page.locator('[data-select="pc-23"]').wait_for()
        page.locator('#pausePreviews').click()
        page.locator('#selectAll').click()
        if not page.locator('#selectionCommands').evaluate('el => el.open'):
            page.locator('#selectionCommands > summary').click()
        return page, errors, state

    def test_24_target_progress_distinguishes_acceptance_confirmation_and_failures(self):
        page, errors, state = self.command_page()
        page.locator('#lock').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued:')")
        self.assertEqual(len(state['submitted'][0]['targets']), 24)
        self.assertTrue(state['submitted'][0]['requestId'])
        page.locator('#lock').click()
        self.assertEqual(len(state['submitted']), 1, 'A pending identical lock must not be dispatched twice')
        self.assertIn('24 pending', page.locator('#commandSummary').inner_text())
        self.assertIn('Queued', page.locator('[data-command-computer="pc-0"]').inner_text())
        self.assertIn('Screen lock: off', page.locator('[data-select="pc-0"]').locator('xpath=ancestor::article').inner_text())
        job = state['jobs'][0]
        for index, phase in enumerate(('running', 'retrying', 'succeeded', 'succeeded', 'failed', 'unknown')):
            job['results'][index]['state'] = phase
        job['results'][2]['verified'] = True
        job['results'][4]['error'] = 'Computer did not confirm lock'
        job['results'][5]['error'] = 'Connection ended before confirmation'
        page.locator('#commandHistory > summary').click()
        page.locator('#refreshCommandJobs').click()
        page.wait_for_function("document.querySelector('[data-command-computer=pc-2]').textContent.includes('Confirmed')")
        for target, label in [('pc-0', 'Running'), ('pc-1', 'Retrying'), ('pc-2', 'Confirmed'), ('pc-3', 'Accepted'), ('pc-4', 'Failed'), ('pc-5', 'Outcome unknown')]:
            self.assertIn(label, page.locator(f'[data-command-computer="{target}"]').inner_text())
        page.locator('[data-job="job-1"] > summary').click()
        self.assertEqual(page.locator('[data-command-target]').count(), 24)
        self.evidence(page, errors, 'veyon-queued-24-progress')
        page.reload()
        page.wait_for_function("document.querySelector('#commandSummary').textContent.includes('2 need attention')")
        self.assertIn('Confirmed', page.locator('[data-command-computer="pc-2"]').inner_text())
        self.assertEqual(len(state['submitted']), 1, 'Reload restores history without redispatch')

    def test_unlock_supersedes_old_lock_and_cancel_only_waiting_targets(self):
        page, errors, state = self.command_page(width=390)
        page.locator('#lock').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued:')")
        state['jobs'][0]['results'][0]['state'] = 'failed'
        page.locator('#unlock').click()
        page.wait_for_function("document.querySelector('[data-command-computer=pc-0]').textContent.startsWith('Unlock')")
        self.assertEqual([command['active'] for command in state['submitted']], [True, False])
        self.assertEqual(state['jobs'][1]['results'][1]['reason'], 'superseded')
        page.locator('#commandHistory > summary').click()
        page.locator('[data-job="job-1"] > summary').click()
        self.assertEqual(page.locator('[data-job="job-1"] [data-job-action="retry"]').count(), 0, 'Never retry an older lock over a newer unlock')
        state['jobs'][0]['results'][0]['state'] = 'running'
        page.locator('#refreshCommandJobs').click()
        page.wait_for_function("document.querySelector('[data-command-computer=pc-0]').textContent.includes('Running')")
        page.locator('[data-job="job-2"] > summary').click()
        page.remove_listener('dialog', page._fixture_dialog_handler)
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('[data-job="job-2"] [data-job-action="cancel"]').click()
        page.wait_for_function("document.querySelector('[data-command-computer=pc-1]').textContent.includes('Cancelled')")
        self.assertEqual(state['cancelled'], ['job-2'])
        self.assertEqual(state['jobs'][0]['results'][0]['state'], 'running')
        self.evidence(page, errors, 'veyon-queue-cancel-mobile')

    def test_uncertain_submission_reuses_lock_request_id_and_keeps_stale_history(self):
        page, errors, state = self.command_page()
        state['fail_submit'] = True
        page.locator('#lock').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.includes('Submission outcome is unconfirmed')")
        first = state['submitted'][0]['requestId']
        state['fail_submit'] = False
        page.locator('#lock').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued:')")
        self.assertEqual(state['submitted'][1]['requestId'], first)
        state['jobs'] = []
        state['ownedLocks'] = [{'id': 'pc-0', 'feature': 'screenLock', 'recoveryPending': True},
                               {'id': 'pc-1', 'feature': 'fullScreenDemoClient', 'recoveryPending': True}]
        page.locator('#commandHistory > summary').click()
        page.locator('#refreshCommandJobs').click()
        page.wait_for_function("document.querySelector('#commandSummary').textContent.includes('2 control recoveries pending')")
        self.assertIn('Waiting for reconnect', page.locator('[data-command-computer=pc-0]').inner_text())
        self.assertIn('Control recovery', page.locator('[data-command-computer=pc-1]').inner_text())
        self.assertIn('Locks or broadcasts may still be active', page.locator('#commandRecoveryState').inner_text())
        self.assertEqual(page.evaluate("commandTitle({feature:'fullScreenDemoClient',active:false})"), 'Stop full-screen broadcast')
        state['history_error'] = True
        page.locator('#refreshCommandJobs').click()
        page.wait_for_function("document.querySelector('#commandHistoryError').textContent.includes('stale')")
        self.assertIn('2 control recoveries pending', page.locator('#commandSummary').inner_text())
        self.assertFalse(errors, errors)

    def test_new_message_is_not_deduplicated_and_opposite_lock_invalidates_uncertain_id(self):
        page, errors, state = self.command_page()
        page.remove_listener('dialog', page._fixture_dialog_handler)
        for text in ('First message', 'Second message'):
            page.once('dialog', lambda dialog, text=text: dialog.accept(text))
            page.locator('#message').click()
            page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued:')")
        self.assertEqual([command['arguments']['text'] for command in state['submitted']], ['First message', 'Second message'])
        state['fail_submit'] = True
        page.locator('#lock').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.includes('Submission outcome is unconfirmed')")
        uncertain_id = state['submitted'][-1]['requestId']
        state['fail_submit'] = False
        page.locator('#unlock').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued: Unlock')")
        page.locator('#lock').click()
        page.wait_for_function("document.querySelector('#commandFeedback').textContent.startsWith('Queued: Lock')")
        self.assertNotEqual(state['submitted'][-1]['requestId'], uncertain_id)
        page.evaluate('computers[0].featureState = null; render()')
        card = page.locator('[data-select="pc-0"]').locator('xpath=ancestor::article')
        self.assertIn('Screen lock: unknown', card.inner_text())
        self.assertIn('Input lock: unknown', card.inner_text())
        self.assertFalse(errors, errors)
