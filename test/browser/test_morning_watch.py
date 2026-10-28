import time,unittest
import test_workspaces as workspaces
class MorningWatchBrowserTests(unittest.TestCase):
 setUpClass=classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
 tearDownClass=classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
 page=workspaces.WorkspaceBrowserTests.page
 evidence=workspaces.WorkspaceBrowserTests.evidence
 def setup_page(self,width=1440):
  held=[];control={'hold_get':False,'hold_put':False};config={'enabled':True,'streamUrl':'https://stream.example.test/play','startTime':'07:00','endTime':'08:30','volumePercent':100,'targets':['all'],'offlineConfirmations':2,'checkIntervalSeconds':15}
  def transport(route,target):
   if target!='/api/v1/automations/morning-announcements':return False
   if control['hold_'+route.request.method.lower()]:held.append(route)
   else:
    if route.request.method=='PUT':config.update(route.request.post_data_json)
    route.fulfill(json={'ok':True,'config':config,'runtime':{}})
   return True
  devices={'screen':{'id':'screen','name':'Classroom display','enabled':True}}
  page,errors=self.page('/controller/',width,transport=transport,devices=devices,overrides={'/api/v1/devices':{'devices':devices,'status':{},'groups':{}}})
  page.wait_for_function("window.AUTH_STATUS?.user?.role==='admin'")
  page.evaluate("()=>{showPage('schedules');return loadMorningWatch()}")
  page.locator('#morningWatchStart').evaluate("e=>e.closest('details').open=true")
  return page,errors,held,control,config
 def captured(self,page,held,count=1):
  until=time.monotonic()+5
  while len(held)<count and time.monotonic()<until:page.wait_for_timeout(10)
  self.assertGreaterEqual(len(held),count)
 def test_old_load_preserves_new_draft(self):
  p,e,h,c,cfg=self.setup_page();c['hold_get']=True;p.evaluate('()=>{window.__watchRead=loadMorningWatch()}');self.captured(p,h)
  p.locator('#morningWatchStart').fill('09:15');h[0].fulfill(json={'ok':True,'config':cfg,'runtime':{}});p.evaluate('window.__watchRead')
  self.assertEqual(p.locator('#morningWatchStart').input_value(),'09:15');self.assertFalse(e,e)
 def test_save_preserves_newer_edits(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.locator('#morningWatchStart').fill('08:15');p.evaluate('()=>{window.__watchSave=saveMorningWatch()}');self.captured(p,h)
  p.locator('#morningWatchStart').fill('09:20');cfg.update(h[0].request.post_data_json);h[0].fulfill(json={'ok':True,'config':cfg,'runtime':{}});p.evaluate('window.__watchSave')
  self.assertEqual(p.locator('#morningWatchStart').input_value(),'09:20');self.assertFalse(e,e)
 def test_duplicate_save_has_one_pending_write(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate('()=>{window.__watchSave=saveMorningWatch();window.__duplicate=saveMorningWatch()}');self.captured(p,h);p.wait_for_timeout(200)
  self.assertEqual(len(h),1);h[0].fulfill(json={'ok':True});p.evaluate('window.__watchSave');p.evaluate('window.__duplicate');self.assertFalse(e,e)
 def test_volume_changes_serialize_pending_writes(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate('queueMorningWatchVolume(10,true)');self.captured(p,h);p.evaluate('queueMorningWatchVolume(70,true)');p.wait_for_timeout(250)
  self.assertEqual(len(h),1);self.assertEqual(h[0].request.post_data_json,{'volumePercent':10})
  h[0].fulfill(json={'ok':True});self.captured(p,h,2);self.assertEqual(h[1].request.post_data_json,{'volumePercent':70});h[1].fulfill(json={'ok':True});p.wait_for_function('!morningWatchVolumeWorker');self.assertFalse(e,e)
 def test_failed_save_keeps_draft_and_allows_retry(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.locator('#morningWatchStart').fill('09:10');p.evaluate('()=>{window.__watchSave=saveMorningWatch()}');self.captured(p,h)
  p.evaluate('enforceCapabilityControls()');self.assertTrue(p.locator('#morningWatchSaveBtn').is_disabled())
  h[0].fulfill(status=503,json={'error':'Storage unavailable'});p.evaluate('window.__watchSave');self.assertEqual(p.locator('#morningWatchStart').input_value(),'09:10');self.assertFalse(p.locator('#morningWatchSaveBtn').is_disabled());self.assertIn('Storage unavailable',p.locator('#morningWatchDraftMsg').inner_text())
  p.evaluate('()=>{window.__watchSave=saveMorningWatch()}');self.captured(p,h,2);self.assertEqual(h[1].request.post_data_json['startTime'],'09:10');h[1].fulfill(json={'ok':True});p.evaluate('window.__watchSave');self.assertEqual(p.locator('#morningWatchDraftMsg').inner_text(),'Saved');self.assertFalse(e,e)
 def test_read_started_before_save_cannot_restore_old_settings(self):
  p,e,h,c,cfg=self.setup_page();c['hold_get']=True;p.evaluate('()=>{window.__watchRead=loadMorningWatch()}');self.captured(p,h)
  p.locator('#morningWatchStart').fill('09:10');p.evaluate('saveMorningWatch()')
  h[0].fulfill(json={'ok':True,'config':cfg,'runtime':{}});p.evaluate('window.__watchRead');self.assertEqual(p.locator('#morningWatchStart').input_value(),'09:10');self.assertFalse(e,e)
 def test_new_url_draft_survives_save_and_later_reads(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.locator('#morningWatchUrl').fill('https://stream.example.test/first');p.evaluate('()=>{window.__watchSave=saveMorningWatch()}');self.captured(p,h)
  p.locator('#morningWatchUrl').fill('https://stream.example.test/newer');cfg.update(h[0].request.post_data_json);h[0].fulfill(json={'ok':True,'config':cfg});p.evaluate('window.__watchSave');p.evaluate('loadMorningWatch()');self.assertEqual(p.locator('#morningWatchUrl').input_value(),'https://stream.example.test/newer');self.assertIn('unsaved',p.locator('#morningWatchDraftMsg').inner_text());self.assertFalse(e,e)
 def test_volume_coalesces_to_latest_value_after_inflight_write(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate('queueMorningWatchVolume(10,true)');self.captured(p,h);p.evaluate('()=>{queueMorningWatchVolume(30,true);queueMorningWatchVolume(70,true)}');p.wait_for_timeout(200);self.assertEqual(len(h),1)
  h[0].fulfill(json={'ok':True});self.captured(p,h,2);self.assertEqual(h[1].request.post_data_json,{'volumePercent':70});h[1].fulfill(json={'ok':True,'liveVolume':{'applied':True}});p.wait_for_function('!morningWatchVolumeWorker');self.assertIn('70% applied live',p.locator('#morningWatchVolumeMsg').inner_text());self.assertFalse(e,e)
 def test_full_save_waits_for_volume_and_new_volume_follows_save(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate('queueMorningWatchVolume(10,true)');self.captured(p,h);p.locator('#morningWatchStart').fill('08:15');p.evaluate('()=>{window.__watchSave=saveMorningWatch()}');p.evaluate('queueMorningWatchVolume(70,true)');p.wait_for_timeout(200);self.assertEqual(len(h),1)
  h[0].fulfill(json={'ok':True});self.captured(p,h,2);body=h[1].request.post_data_json;self.assertEqual(body['startTime'],'08:15');self.assertEqual(body['volumePercent'],10);cfg.update(body);h[1].fulfill(json={'ok':True,'config':cfg});p.evaluate('window.__watchSave');self.captured(p,h,3);self.assertEqual(h[2].request.post_data_json,{'volumePercent':70});self.assertEqual(p.locator('#morningWatchVolume').input_value(),'70');h[2].fulfill(json={'ok':True});p.wait_for_function('!morningWatchVolumeWorker');self.assertFalse(e,e)
 def test_new_volume_waits_for_full_save_without_repainting_slider(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate('()=>{window.__watchSave=saveMorningWatch()}');self.captured(p,h);p.evaluate('queueMorningWatchVolume(45,true)');p.wait_for_timeout(200);self.assertEqual(len(h),1)
  h[0].fulfill(json={'ok':True,'config':cfg});p.evaluate('window.__watchSave');self.captured(p,h,2);self.assertEqual(h[1].request.post_data_json,{'volumePercent':45});self.assertEqual(p.locator('#morningWatchVolume').input_value(),'45');h[1].fulfill(json={'ok':True});p.wait_for_function('!morningWatchVolumeWorker');self.assertFalse(e,e)
 def test_save_consumes_matching_debounced_volume_once(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate('()=>{queueMorningWatchVolume(35);window.__watchSave=saveMorningWatch()}');self.captured(p,h);p.wait_for_timeout(250);self.assertEqual(len(h),1);self.assertEqual(h[0].request.post_data_json['volumePercent'],35);h[0].fulfill(json={'ok':True});p.evaluate('window.__watchSave');p.wait_for_timeout(200);self.assertEqual(len(h),1);self.assertFalse(e,e)
 def test_failed_volume_preserves_intent_and_later_change_can_succeed(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate('queueMorningWatchVolume(30,true)');self.captured(p,h);h[0].fulfill(status=503,json={'error':'Volume unavailable'});p.wait_for_function('!morningWatchVolumeWorker');self.assertIn('Volume unavailable',p.locator('#morningWatchVolumeMsg').inner_text());p.evaluate('loadMorningWatch()');self.assertEqual(p.locator('#morningWatchVolume').input_value(),'30')
  p.evaluate('queueMorningWatchVolume(60,true)');self.captured(p,h,2);h[1].fulfill(json={'ok':True});p.wait_for_function('!morningWatchVolumeWorker');self.assertEqual(p.locator('#morningWatchVolume').input_value(),'60');self.assertIn('60% saved',p.locator('#morningWatchVolumeMsg').inner_text());self.assertFalse(e,e)
 def test_unchanged_target_refresh_preserves_focus_and_unsaved_selection(self):
  p,e,h,c,cfg=self.setup_page();target=p.locator('[data-morning-target="screen"]');target.focus();p.evaluate('loadMorningWatch()');self.assertTrue(target.evaluate('el=>el===document.activeElement'));target.uncheck();p.evaluate('loadMorningWatch()');self.assertFalse(target.is_checked());self.assertFalse(e,e)
 def test_capability_loss_blocks_save_and_live_volume(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;p.evaluate("()=>{window.AUTH_STATUS.user.capabilities=['schedule.manage'];window.AUTH_STATUS.user.role='teacher';enforceCapabilityControls()}");self.assertTrue(p.locator('#morningWatchSaveBtn').is_disabled());self.assertTrue(p.locator('#morningWatchVolume').is_disabled());p.evaluate('()=>{saveMorningWatch();queueMorningWatchVolume(20,true)}');p.wait_for_timeout(200);self.assertEqual(h,[]);self.assertFalse(e,e)
 def test_save_projects_normalized_targets_without_recreating_focused_checkbox(self):
  p,e,h,c,cfg=self.setup_page();c['hold_put']=True;target=p.locator('[data-morning-target="screen"]');target.uncheck();target.focus();p.evaluate('()=>{window.__watchSave=saveMorningWatch()}');self.captured(p,h);self.assertEqual(h[0].request.post_data_json['targets'],[])
  h[0].fulfill(json={'ok':True,'config':cfg});p.evaluate('window.__watchSave');self.assertTrue(target.is_checked());self.assertTrue(target.evaluate('el=>el===document.activeElement'));self.assertFalse(e,e)
 def test_mobile_draft_status_and_controls_remain_readable(self):
  p,e,h,c,cfg=self.setup_page(390);p.locator('#morningWatchStart').fill('09:00');self.evidence(p,e,'morning-watch-mobile');p.locator('#morningWatchPanel').screenshot(path=str(workspaces.OUTPUT/'morning-watch-panel.png'))
if __name__=='__main__':unittest.main()
