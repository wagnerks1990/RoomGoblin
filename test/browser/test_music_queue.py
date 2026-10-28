import time,unittest
import test_music_studio as music
import test_workspaces as workspaces
class MusicQueueBrowserTests(unittest.TestCase):
 setUpClass=classmethod(workspaces.WorkspaceBrowserTests.setUpClass.__func__)
 tearDownClass=classmethod(workspaces.WorkspaceBrowserTests.tearDownClass.__func__)
 page=workspaces.WorkspaceBrowserTests.page
 def setup_page(self):
  p,e,requests=music.music_page(self);self.commands=requests;held=[];p.route('**/api/v1/music-assistant/background/queue?*',lambda route:held.append(route));return p,e,held
 def captured(self,p,h,n):
  end=time.monotonic()+5
  while len(h)<n and time.monotonic()<end:p.wait_for_timeout(10)
  self.assertGreaterEqual(len(h),n)
 def reply(self,p,route,name,status=200,queue_id="speaker"):
  data={'queue':{'id':queue_id,'shuffle':False,'repeat':'off','currentIndex':0},'items':[{'id':name,'name':name}]} if status==200 else {'error':name}
  with p.expect_request_finished(lambda r:r==route.request):route.fulfill(status=status,json=data)
  p.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
 def test_older_success_cannot_replace_newer_queue(self):
  p,e,h=self.setup_page();button=p.get_by_role('button',name='Refresh queue',exact=True);button.click();self.captured(p,h,1);button.click();self.captured(p,h,2);self.reply(p,h[1],'Latest queue');self.reply(p,h[0],'Obsolete queue');self.assertIn('Latest queue',p.locator('.musicQueue').inner_text());self.assertNotIn('Obsolete queue',p.locator('.musicQueue').inner_text());self.assertFalse(e,e)
 def test_older_error_cannot_erase_newer_queue(self):
  p,e,h=self.setup_page();button=p.get_by_role('button',name='Refresh queue',exact=True);button.click();self.captured(p,h,1);button.click();self.captured(p,h,2);self.reply(p,h[1],'Latest queue');self.reply(p,h[0],'Obsolete error',503);self.assertIn('Latest queue',p.locator('.musicQueue').inner_text());self.assertNotIn('Obsolete error',p.locator('.musicQueue').inner_text());self.assertFalse(e,e)
 def test_returning_to_same_output_retires_its_old_request(self):
  p,e,h=self.setup_page();p.get_by_role('button',name='Refresh queue',exact=True).click();self.captured(p,h,1);p.locator('#musicOutput').select_option('classroom-hub-tv1');self.captured(p,h,2);p.locator('#musicOutput').select_option('speaker');self.captured(p,h,3);self.reply(p,h[2],'Current speaker queue');self.reply(p,h[1],'Old other output');self.reply(p,h[0],'Obsolete speaker queue');self.assertIn('Current speaker queue',p.locator('.musicQueue').inner_text());self.assertNotIn('Obsolete speaker queue',p.locator('.musicQueue').inner_text());self.assertFalse(e,e)
 def test_current_error_is_visible_and_current_retry_can_recover(self):
  p,e,h=self.setup_page();button=p.get_by_role('button',name='Refresh queue',exact=True);button.click();self.captured(p,h,1);self.reply(p,h[0],'Current queue unavailable',503);self.assertIn('Current queue unavailable',p.locator('.musicQueue').inner_text());button.click();self.captured(p,h,2);self.reply(p,h[1],'Recovered queue');self.assertIn('Recovered queue',p.locator('.musicQueue').inner_text());self.assertNotIn('Current queue unavailable',p.locator('.musicQueue').inner_text());self.assertFalse(e,e)
 def test_cleared_output_retires_pending_queue_and_blocks_commands(self):
  p,e,h=self.setup_page();p.get_by_role('button',name='Refresh queue',exact=True).click();self.captured(p,h,1);p.locator('#musicOutput').select_option('');self.reply(p,h[0],'Retired queue');self.assertNotIn('Retired queue',p.locator('.musicQueue').inner_text());p.get_by_role('button',name='Next',exact=True).click();self.assertIn('Choose an output',p.locator('.musicNotice').inner_text());self.assertEqual(self.commands,[]);self.assertFalse(e,e)
 def test_current_queue_actions_keep_the_selected_output_and_item(self):
  p,e,h=self.setup_page();p.locator('#musicOutput').select_option('classroom-hub-tv1');self.captured(p,h,1);self.reply(p,h[0],'TV current item',queue_id='classroom-hub-tv1');p.locator('.musicQueue').get_by_role('button',name='Play current',exact=True).click();self.captured(p,h,2);self.reply(p,h[1],'TV current item',queue_id='classroom-hub-tv1');command=next(x for x in self.commands if x.get('command')=='player_queues/play_index');self.assertEqual(command['args']['queue_id'],'classroom-hub-tv1');self.assertEqual(command['args']['index'],'TV current item');self.assertFalse(e,e)
if __name__=='__main__':unittest.main()
