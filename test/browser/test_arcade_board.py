"""Synthetic learner values only; exercises the real native receiver."""
import unittest
import test_display as display
OUTPUT=display.OUTPUT


class ArcadeBoardBrowserTests(unittest.TestCase):
    setUpClass = classmethod(display.DisplayBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(display.DisplayBrowserTests.tearDownClass.__func__)
    page = display.DisplayBrowserTests.page
    open_renderer = display.DisplayBrowserTests.open_renderer
    settle = display.DisplayBrowserTests.settle
    replay = display.DisplayBrowserTests.replay
    command = display.DisplayBrowserTests.command

    def board(self, page, rows=8, expiry=8000, waiting=False):
        page.evaluate('''([count,expiry,waiting])=>{
          const rows=Array.from({length:count},(_,i)=>({firstName:['Alex','Blair','Casey','Drew','Emery','Finley','Gray','Hayden'][i],period:'P3',arcadeScore:18450-i*1700,level:4-i%3,board:1+i%4,answered:25-i*2,total:55,completed:1,assignments:20,lastActivityAt:Date.now()-i*60000}));
          window.__receiverSocket.onmessage({data:JSON.stringify({type:'command',command:{type:'display.text',payload:{arcade:{version:1,title:'Donkey Kong · IT I',period:'P3',rows,leader:rows[0],count,offset:0,waiting,generatedAt:Date.now()}}},transient:{expiresAt:Date.now()+expiry,previousState:{text:'Scheduled screen'}}})});
        }''', [rows, expiry, waiting])
        self.settle(page)

    def test_arcade_layout_and_private_projection(self):
        page=self.page();self.board(page)
        self.assertEqual(page.locator('.arcade-row').count(),8)
        self.assertEqual(page.locator('.arcade-hero-score').inner_text(),'18,450')
        self.assertIn('Just saved',page.locator('.arcade-row').first.inner_text())
        self.assertTrue(page.locator('.arcade-gorilla').evaluate('(i)=>i.complete && i.naturalWidth>0'))
        self.assertTrue(page.locator('.arcade-board').evaluate('(e)=>e.scrollHeight<=e.clientHeight && e.scrollWidth<=e.clientWidth'))
        self.assertFalse(self.errors)
        page.screenshot(path=str(OUTPUT/f'{self.engine}-arcade-board.png'))

    def test_refresh_and_expiry_restore_native_display(self):
        page=self.page();self.board(page);self.board(page,expiry=200)
        self.assertTrue(page.locator('.arcade-board').is_visible())
        page.locator('.arcade-board').wait_for(state='hidden')
        self.assertEqual(page.locator('#text').inner_text(),'Scheduled screen')
        self.board(page);self.command(page,'display.title',{'text':'New lesson'})
        self.assertFalse(page.locator('.arcade-board').is_visible())
        self.assertEqual(page.locator('#title').inner_text(),'New lesson')

    def test_waiting_state_and_reduced_motion(self):
        page=self.page(1366,768);page.emulate_media(reduced_motion='reduce');self.board(page,rows=0,waiting=True)
        self.assertIn('STAND BY',page.locator('.arcade-live').inner_text())
        self.assertEqual(page.locator('.arcade-gorilla').evaluate('(e)=>getComputedStyle(e).animationName'),'none')
        self.assertEqual(page.locator('.arcade-row').count(),0)
        page.screenshot(path=str(OUTPUT/f'{self.engine}-arcade-waiting.png'))

    def test_learner_text_is_not_markup_and_large_values_stay_inside_rows(self):
        page=self.page();self.board(page)
        page.evaluate('''()=>window.__receiverSocket.onmessage({data:JSON.stringify({type:'command',command:{type:'display.text',payload:{arcade:{version:1,rows:[{firstName:'<img src=x onerror=alert(1)>VeryLongName',period:'P3',arcadeScore:999999999,level:99,board:4,answered:10000,total:10000}],count:1}}},transient:{expiresAt:Date.now()+8000,previousState:{text:'Lesson'}}})})''')
        self.assertEqual(page.locator('.arcade-person img').count(),0)
        self.assertEqual(page.locator('.arcade-points').inner_text(),'999,999,999')
        self.assertTrue(page.locator('.arcade-row').evaluate('(e)=>e.scrollWidth<=e.clientWidth'))
        self.assertFalse(self.errors)


if __name__ == '__main__':
    unittest.main()
