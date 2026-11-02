"""Receiver reconnect identity and bounded token renewal using the real renderer."""
import unittest
import test_display as display

MEDIA = """(() => {
 const p=HTMLMediaElement.prototype;
 Object.defineProperties(p,{
   src:{configurable:true,get(){return this.__src||''},set(value){this.__src=new URL(value,location.href).href;this.__sources=(this.__sources||[]).concat(this.__src);this.__time=0;this.__paused=true;this.__error=null}},
   currentSrc:{configurable:true,get(){return this.src}},
   currentTime:{configurable:true,get(){return this.__time||0},set(value){this.__time=Number(value)}},
   duration:{configurable:true,get(){return 120}},
   paused:{configurable:true,get(){return this.__paused!==false}},
   ended:{configurable:true,get(){return false}},
   error:{configurable:true,get(){return this.__error||null}}
 });
 p.load=function(){this.__loads=(this.__loads||0)+1;this.__error=null};
 p.play=function(){this.__paused=false;this.__plays=(this.__plays||0)+1;this.dispatchEvent(new Event('playing'));return Promise.resolve()};
 p.pause=function(){this.__paused=true;this.dispatchEvent(new Event('pause'))};
})()"""


class MediaReconnectTests(unittest.TestCase):
    setUpClass = classmethod(display.DisplayBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(display.DisplayBrowserTests.tearDownClass.__func__)
    page = display.DisplayBrowserTests.page
    settle = display.DisplayBrowserTests.settle
    replay = display.DisplayBrowserTests.replay
    command = display.DisplayBrowserTests.command

    def open_renderer(self, page):
        page.add_init_script(MEDIA)
        display.DisplayBrowserTests.open_renderer(self, page)

    def hello(self, page, token='fixture-first', **changes):
        media = {'type':'video','url':'/media/clip.mp4','sessionId':'live',
                 'autoplay':False,'muted':True,'volume':.25,'playbackRate':1.5,'startAtSeconds':4}
        media.update(changes)
        page.evaluate('(m)=>__receiverSocket.onmessage({data:JSON.stringify(m)})',
                      {'type':'hello.ack','version':display.VERSION,'assetAccessToken':token,'state':{'media':media}})
        self.settle(page)

    def video(self):
        page = self.page()
        self.hello(page)
        page.evaluate("window.__video=document.querySelector('#media video');__video.currentTime=12")
        return page

    def token(self, page, value):
        page.evaluate('(value)=>__receiverSocket.onmessage({data:JSON.stringify({type:"heartbeat.ack",assetAccessToken:value})})', value)

    def error(self, page):
        page.evaluate("__video.__error={code:2};__video.dispatchEvent(new Event('error'))")
        self.settle(page)

    def ready(self, page):
        page.evaluate("__video.dispatchEvent(new Event('loadedmetadata'));__video.dispatchEvent(new Event('canplay'))")
        self.settle(page)

    def test_renewed_hello_retains_element_position_pause_and_loaded_source(self):
        page=self.video()
        self.command(page,'display.media.control',{'action':'pause'})
        before=page.evaluate('__video.src')
        self.hello(page,'fixture-renewed')
        self.assertTrue(page.evaluate("__video===document.querySelector('#media video')"))
        self.assertEqual(page.evaluate('__video.currentTime'),12)
        self.assertEqual(page.evaluate('__video.src'),before)
        self.assertTrue(page.evaluate('__video.paused'))
        self.assertEqual(page.evaluate('__video.volume'),.25)
        self.assertEqual(page.evaluate('__video.playbackRate'),1.5)
        self.assertFalse(self.errors)

    def test_changed_session_or_source_still_replaces_video(self):
        for changes in [{'sessionId':'new'},{'url':'/media/other.mp4'},{'url':'/media/clip.mp4?variant=2'}]:
            with self.subTest(changes=changes):
                page=self.video();self.hello(page,'fixture-renewed',**changes)
                self.assertFalse(page.evaluate("__video===document.querySelector('#media video')"))
                self.assertFalse(page.evaluate('__video.isConnected'))
                self.assertFalse(self.errors)

    def test_external_media_receives_no_hub_token(self):
        page=self.video();self.hello(page,'fixture-renewed',url='https://video.example.invalid/clip.mp4')
        self.assertEqual(page.evaluate("document.querySelector('#media video').src"),'https://video.example.invalid/clip.mp4')

    def test_invalid_url_does_not_replace_or_reload_current_video(self):
        page=self.video();before=page.evaluate('__video.src');self.hello(page,'fixture-renewed',url='javascript:alert(1)')
        self.assertTrue(page.evaluate("__video===document.querySelector('#media video')"))
        self.assertEqual(page.evaluate('__video.src'),before)
        self.assertFalse(self.errors)

    def test_expired_source_uses_latest_token_and_restores_paused_position(self):
        page=self.video();self.command(page,'display.media.control',{'action':'pause'})
        self.token(page,'fixture-renewed');self.error(page);self.ready(page)
        self.assertTrue(page.evaluate("__video===document.querySelector('#media video')"))
        self.assertEqual(page.evaluate('new URL(__video.src).searchParams.get("access_token")'),'fixture-renewed')
        self.assertEqual(page.evaluate('new URL(__video.src).port'),'3020')
        self.assertEqual(page.evaluate('__video.currentTime'),12)
        self.assertTrue(page.evaluate('__video.paused && !__video.autoplay && __video.muted'))
        self.assertEqual(page.evaluate('__video.__plays||0'),0)
        self.assertFalse(self.errors)

    def test_explicit_play_on_autoplay_disabled_video_resumes_after_renewal(self):
        page=self.video();self.command(page,'display.media.control',{'action':'play'})
        self.token(page,'fixture-renewed');self.error(page);self.ready(page)
        self.assertEqual(page.evaluate('__video.currentTime'),12)
        self.assertEqual(page.evaluate('__video.__plays'),2)
        self.assertFalse(page.evaluate('__video.paused'))
        self.assertFalse(self.errors)

    def test_pause_during_renewal_wins_over_pending_resume(self):
        page=self.video();self.command(page,'display.media.control',{'action':'play'})
        self.token(page,'fixture-renewed');self.error(page)
        self.command(page,'display.media.control',{'action':'pause'});self.ready(page)
        self.assertTrue(page.evaluate('__video.paused'))
        self.assertEqual(page.evaluate('__video.__plays'),1)
        self.assertFalse(self.errors)

    def test_seek_stop_and_restart_during_renewal_keep_latest_control_intent(self):
        for action,expected,playing in [('seek',27,False),('stop',4,False),('restart',4,True)]:
            with self.subTest(action=action):
                page=self.video();self.token(page,'fixture-renewed');self.error(page)
                self.command(page,'display.media.control',{'action':action,'positionSeconds':27});self.ready(page)
                self.assertEqual(page.evaluate('__video.currentTime'),expected)
                self.assertEqual(page.evaluate('!__video.paused'),playing)
                self.assertFalse(self.errors)

    def test_play_during_renewal_waits_for_current_source_then_resumes(self):
        page=self.video();self.token(page,'fixture-renewed');self.error(page)
        self.command(page,'display.media.control',{'action':'play'})
        self.assertEqual(page.evaluate('__video.__plays||0'),0)
        self.ready(page)
        self.assertEqual(page.evaluate('__video.__plays'),1)
        self.assertEqual(page.evaluate('__video.currentTime'),12)

    def test_same_token_failure_is_visible_without_replaying_source(self):
        page=self.video();self.error(page)
        # The existing one-time media-plane fallback remains the only reload.
        count=page.evaluate('__video.__sources.length')
        self.error(page)
        self.assertEqual(page.evaluate('__video.__sources.length'),count)
        self.assertIn('video load error',page.locator('#badge').text_content())

    def test_consecutive_fresh_token_failures_are_bounded(self):
        page=self.video()
        for n in range(1,4):
            self.token(page,'fixture-renewed-'+str(n));self.error(page)
        count=page.evaluate('__video.__sources.length')
        self.token(page,'fixture-renewed-4');self.error(page)
        self.assertEqual(page.evaluate('__video.__sources.length'),count)
        self.assertIn('video load error',page.locator('#badge').text_content())

    def test_retired_error_and_canplay_cannot_reload_or_resume_successor(self):
        page=self.video();page.evaluate('window.__lateCanPlay=__video.oncanplay')
        self.command(page,'display.video',{'url':'/media/new.mp4','sessionId':'new','autoplay':False})
        self.token(page,'fixture-renewed')
        before=page.evaluate("document.querySelector('#media video').src")
        self.error(page);page.evaluate('__lateCanPlay()')
        self.assertEqual(page.evaluate("document.querySelector('#media video').src"),before)
        self.assertEqual(page.evaluate("document.querySelector('#media video').__plays||0"),0)
        self.assertFalse(self.errors)

    def test_replacement_retires_a_queued_token_reload_before_source_mutation(self):
        page=self.video();self.token(page,'fixture-renewed')
        page.evaluate("""() => {
          __video.__error={code:2};__video.dispatchEvent(new Event('error'));
          window.__oldSourceAfterFallback=__video.src;
          __receiverSocket.onmessage({data:JSON.stringify({type:'command',command:{type:'display.video',payload:{url:'/media/new.mp4',sessionId:'new',autoplay:false}}})});
        }""")
        self.settle(page)
        self.assertEqual(page.evaluate('__video.src'),page.evaluate('__oldSourceAfterFallback'))
        self.assertTrue(page.evaluate("document.querySelector('#media video').src.includes('/media/new.mp4')"))
        self.assertFalse(self.errors)

    def test_confirmed_playback_resets_the_consecutive_refresh_budget(self):
        page=self.video();self.command(page,'display.media.control',{'action':'play'})
        for n in range(1,4):
            self.token(page,'fixture-renewed-'+str(n));self.error(page)
        self.ready(page)
        count=page.evaluate('__video.__sources.length')
        self.token(page,'fixture-renewed-4');self.error(page)
        self.assertGreater(page.evaluate('__video.__sources.length'),count)
        self.assertFalse(self.errors)
