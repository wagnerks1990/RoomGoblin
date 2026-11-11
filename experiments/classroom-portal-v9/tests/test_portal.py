"""Synthetic-only HTTP, storage, isolation, and export regression tests."""
import concurrent.futures
import contextlib
import hashlib
import http.client
import io
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
import zipfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from portal import App, LimitedServer, Problem, PREFIX, VERSION, seed_definition, origin

TOKEN='unit-test-only-'+'x'*32
class PortalTests(unittest.TestCase):
    def test_origin_rejects_header_controls_before_url_normalization(self):
        for value in ['https://allowed.example\r\nX-Injected: yes', 'https://allowed.example\t', 'https://allowed.example\x7f', ' https://allowed.example']:
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                origin(value)

    def test_cors_uses_only_the_exact_configured_origin(self):
        path = '/learner/state'
        for value in ['http://localhost:9999', 'http://localhost:9999.evil.example', 'null']:
            with self.subTest(origin=value):
                _, _, headers = self.request(path, 'OPTIONS', headers={'Origin': value})
                if value == 'http://localhost:9999':
                    self.assertEqual(headers.get('Access-Control-Allow-Origin'), value)
                else:
                    self.assertNotIn('Access-Control-Allow-Origin', headers)

    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.app=App(Path(cls.tmp.name)/'v9.sqlite3', TOKEN, 'http://127.0.0.1:1', ['http://localhost:9999'], test=True)
        cls.server=LimitedServer(('127.0.0.1',0),cls.app)
        cls.origin='http://127.0.0.1:'+str(cls.server.server_port)
        cls.app.public_origin=cls.origin
        cls.thread=threading.Thread(target=lambda:cls.server.serve_forever(poll_interval=.02),daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.tmp.cleanup()
    def request(self,path,method='GET',body=None,headers=None):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=10)
        h=dict(headers or {})
        if body is not None:h['Content-Type']='application/json'
        c.request(method,PREFIX+path,json.dumps(body) if body is not None else None,h)
        r=c.getresponse();raw=r.read();response_headers=dict(r.getheaders());status=r.status;c.close()
        try:data=json.loads(raw)
        except (ValueError,UnicodeDecodeError):data=raw
        return status,data,response_headers
    def teacher(self):
        status,d,h=self.request('/login','POST',{'token':TOKEN},{'Origin':self.origin})
        self.assertEqual(status,200)
        return {'Cookie':h['Set-Cookie'].split(';')[0],'Origin':self.origin,'X-CSRF-Token':d['csrf']}
    def new_assignment(self,title='Test assignment'):
        h=self.teacher();d=seed_definition();d['title']=title
        status,r,_=self.request('/assignments','POST',{'course_id':'demo-class','definition':d},h)
        self.assertEqual(status,200,r);return r['id']
    def learner(self,aid=None,label='Synthetic A'):
        aid=aid or self.new_assignment()
        z=self.app.export(aid,label)
        with zipfile.ZipFile(io.BytesIO(z)) as archive:
            c=json.loads(archive.read('config.js').decode().removeprefix('window.CLASSROOM_CONFIG=').rstrip(';\n'))
        return {'Authorization':'Bearer '+c['token'],'Origin':'http://localhost:9999'},c
    def event(self,kind,payload,eid='one'):
        return {'events':[{'id':eid,'kind':kind,'payload':payload}]}
    def answers(self):
        return {c['id']:'A synthetic complete response to '+c['label'] for c in seed_definition()['criteria']}
    def test_health_and_teacher_html(self):
        s,d,_=self.request('/health');self.assertEqual(s,200);self.assertEqual(d['version'],VERSION)
    def test_teacher_rejects_no_session(self):
        self.assertEqual(self.request('/overview')[0],401)
    def test_wrong_login_and_origin(self):
        self.assertEqual(self.request('/login','POST',{'token':'wrong'},{'Origin':self.origin})[0],401)
        self.assertEqual(self.request('/login','POST',{'token':TOKEN},{'Origin':'https://untrusted.invalid'})[0],403)
    def test_csrf_required(self):
        h=self.teacher();h.pop('X-CSRF-Token')
        self.assertEqual(self.request('/courses','POST',{'name':'X','period':'Y'},h)[0],403)
    def test_logout_invalidates_session(self):
        h=self.teacher();self.assertEqual(self.request('/logout','POST',{},h)[0],200)
        self.assertEqual(self.request('/overview',headers=h)[0],401)
    def test_create_course_and_assignment(self):
        h=self.teacher();s,d,_=self.request('/courses','POST',{'name':'IT II','period':'P7'},h);self.assertEqual(s,200)
        definition=seed_definition();s,a,_=self.request('/assignments','POST',{'course_id':d['id'],'definition':definition},h);self.assertEqual(s,200,a)
        self.assertTrue(a['id'])
    def test_invalid_criteria_and_deadlines(self):
        h=self.teacher();d=seed_definition();d['criteria'][0]['points']=-1
        self.assertEqual(self.request('/assignments','POST',{'course_id':'demo-class','definition':d},h)[0],400)
        d=seed_definition();d['cutoff_at']=10
        self.assertEqual(self.request('/assignments','POST',{'course_id':'demo-class','definition':d},h)[0],400)
    def test_export_contents_and_no_admin_token(self):
        aid=self.new_assignment();z=self.app.export(aid,'Synthetic Package')
        with zipfile.ZipFile(io.BytesIO(z)) as archive:
            self.assertIsNone(archive.testzip());ET.fromstring(archive.read('imsmanifest.xml'))
            for n in archive.namelist():
                self.assertNotIn(TOKEN.encode(),archive.read(n))
            self.assertIn('learner.js',archive.namelist())
    def test_export_locks_definition(self):
        aid=self.new_assignment();self.learner(aid)
        self.assertEqual(self.request('/assignments','POST',{'id':aid,'revision':1,'course_id':'demo-class','definition':seed_definition()},self.teacher())[0],409)
    def test_exact_cors_and_empty_204(self):
        h={'Origin':'http://localhost:9999','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}
        s,d,rh=self.request('/learner/events','OPTIONS',headers=h)
        self.assertEqual(s,204);self.assertEqual(d,b'');self.assertEqual(rh['Access-Control-Allow-Origin'],h['Origin'])
        h['Origin']='https://evil.invalid';self.assertEqual(self.request('/learner/events','OPTIONS',headers=h)[0],403)
        h['Origin']='null';self.assertEqual(self.request('/learner/events','OPTIONS',headers=h)[0],403)
    def test_teacher_endpoints_have_no_learner_cors(self):
        s,_,h=self.request('/overview',headers={'Origin':'http://localhost:9999'})
        self.assertEqual(s,401);self.assertNotIn('Access-Control-Allow-Origin',h)
    def test_learner_cannot_access_teacher_or_another_assignment(self):
        h,c=self.learner();self.assertEqual(self.request('/overview',headers=h)[0],401)
        self.assertEqual(self.request('/command','POST',{},h)[0],401)
        aid=self.new_assignment('Other class');s,d,_=self.request('/learner/state?assignment='+aid,headers=h)
        self.assertEqual(s,200);self.assertEqual(d['command']['assignment_id'],c['assignment']['id'])
    def test_events_persist_before_ack_and_duplicate_idempotent(self):
        h,c=self.learner();body=self.event('progress',{'answered':1,'total':4,'preview':True})
        self.assertEqual(self.request('/learner/events','POST',body,h)[0],200)
        self.assertEqual(self.request('/learner/events','POST',body,h)[0],200)
        with self.app.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM events WHERE grant_id=?',(c['participant']['id'],)).fetchone()[0],1)
        body['events'][0]['payload']['answered']=2
        self.assertEqual(self.request('/learner/events','POST',body,h)[0],409)
    def test_bad_batch_is_atomic(self):
        h,c=self.learner();body={'events':[{'id':'good','kind':'progress','payload':{'answered':1}},{'id':'bad','kind':'invalid','payload':{}}]}
        self.assertEqual(self.request('/learner/events','POST',body,h)[0],400)
        with self.app.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM events WHERE grant_id=?',(c['participant']['id'],)).fetchone()[0],0)
    def test_concurrent_same_id(self):
        h,c=self.learner();body=self.event('progress',{'answered':1})
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            out=list(pool.map(lambda _:self.request('/learner/events','POST',body,h)[0],range(8)))
        self.assertEqual(out,[200]*8)
        with self.app.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM events WHERE grant_id=?',(c['participant']['id'],)).fetchone()[0],1)
    def test_submission_validation_and_scope(self):
        aid=self.new_assignment();ha,ca=self.learner(aid,'A');hb,_=self.learner(aid,'B')
        s,d,_=self.request('/learner/events','POST',self.event('submission',{'answers':self.answers()}),ha);self.assertEqual(s,200,d)
        s,d,_=self.request('/learner/state',headers=hb);self.assertEqual(len(d['submissions']),0)
        s,d,_=self.request('/learner/state',headers=ha);self.assertEqual(len(d['submissions']),1)
        self.assertEqual(self.request('/learner/events','POST',self.event('submission',{'answers':{}},'bad'),ha)[0],400)
    def test_published_review_reaches_only_own_client(self):
        aid=self.new_assignment();h,c=self.learner(aid);self.request('/learner/events','POST',self.event('submission',{'answers':self.answers()}),h)
        sid=c['participant']['id']+':one';th=self.teacher();scores={x['id']:x['points'] for x in seed_definition()['criteria']}
        body={'id':sid,'revision':0,'scores':scores,'feedback':'Teacher reviewed test','published':False,'late_exception':False}
        s,_,_=self.request('/review','POST',body,th);self.assertEqual(s,200)
        self.assertIsNone(self.request('/learner/state',headers=h)[1]['submissions'][0]['review'])
        body.update(revision=1,published=True);self.assertEqual(self.request('/review','POST',body,th)[0],200)
        review=self.request('/learner/state',headers=h)[1]['submissions'][0]['review'];self.assertEqual(review['awarded'],20)
        self.assertEqual(self.request('/review','POST',body,th)[0],409)
        body['revision']=2;body['scores']['alloc']=6;self.assertEqual(self.request('/review','POST',body,th)[0],400)
    def test_scoped_commands_and_lease(self):
        ha,ca=self.learner();hb,cb=self.learner();th=self.teacher()
        payload={'assignment_id':ca['assignment']['id'],'revision':0,'paused':True,'stage':3,'hint':'Synthetic hint','discussion_open':False,'pause_seconds':10}
        self.assertEqual(self.request('/command','POST',payload,th)[0],200)
        self.assertTrue(self.request('/learner/state',headers=ha)[1]['command']['paused'])
        self.assertFalse(self.request('/learner/state',headers=hb)[1]['command']['paused'])
        self.assertEqual(self.request('/command','POST',payload,th)[0],409)
        with self.app.connect() as db:db.execute('UPDATE commands SET paused_until=? WHERE assignment_id=?',(time.time()-1,ca['assignment']['id']))
        self.assertFalse(self.request('/learner/state',headers=ha)[1]['command']['paused'])
    def test_discussion_threads_moderation_and_cross_assignment_parent(self):
        aid=self.new_assignment();ha,ca=self.learner(aid,'A');hb,cb=self.learner(aid,'B');hc,_=self.learner()
        self.assertEqual(self.request('/learner/events','POST',self.event('discussion',{'body':'Original','parent_id':None},'parent'),ha)[0],200)
        parent=ca['participant']['id']+':parent'
        self.assertEqual(self.request('/learner/events','POST',self.event('discussion',{'body':'Reply','parent_id':parent},'reply'),hb)[0],200)
        self.assertEqual(self.request('/learner/events','POST',self.event('discussion',{'body':'Wrong class','parent_id':parent}),hc)[0],400)
        th=self.teacher();self.assertEqual(self.request('/moderate','POST',{'id':parent,'hidden':True},th)[0],200)
        self.assertEqual(len(self.request('/learner/state',headers=hb)[1]['posts']),0)
        self.request('/moderate','POST',{'id':parent,'hidden':False},th)
        self.assertEqual(len(self.request('/learner/state',headers=hb)[1]['posts']),2)
    def test_teacher_reply_and_audit(self):
        aid=self.new_assignment();s,d,_=self.request('/reply','POST',{'assignment_id':aid,'body':'Teacher response','parent_id':None},self.teacher());self.assertEqual(s,200,d)
        self.assertTrue(self.request('/audit',headers=self.teacher())[1]['audit'])
    def test_revoke_and_display_least_privilege(self):
        h,c=self.learner();th=self.teacher();self.request('/revoke','POST',{'id':c['participant']['id']},th)
        self.assertEqual(self.request('/learner/state',headers=h)[0],401)
        s,d,_=self.request('/display','POST',{'assignment_id':c['assignment']['id']},th);self.assertEqual(s,200)
        dh={'Authorization':'Bearer '+urlsplit(d['url']).fragment}
        s,r,_=self.request('/display/state',headers=dh);self.assertEqual(s,200);self.assertEqual(set(r),{'title','submitted','posts','stage','synthetic'})
        self.assertEqual(self.request('/learner/state',headers=dh)[0],401)
    def test_late_cap_and_cutoff(self):
        d=seed_definition();d['due_at']=time.time()-100
        s,a,_=self.request('/assignments','POST',{'course_id':'demo-class','definition':d},self.teacher());self.assertEqual(s,200)
        h,c=self.learner(a['id']);self.request('/learner/events','POST',self.event('submission',{'answers':self.answers()}),h)
        body={'id':c['participant']['id']+':one','revision':0,'scores':{x['id']:x['points'] for x in d['criteria']},'feedback':'Late test','published':True,'late_exception':False}
        s,r,_=self.request('/review','POST',body,self.teacher());self.assertEqual(s,200);self.assertEqual(r['review']['awarded'],10)
        d['cutoff_at']=time.time()-10
        s,a,_=self.request('/assignments','POST',{'course_id':'demo-class','definition':d},self.teacher());self.assertEqual(s,200)
        h,_=self.learner(a['id']);self.assertEqual(self.request('/learner/events','POST',self.event('submission',{'answers':self.answers()}),h)[0],403)
    def test_readonly_legacy_unchanged(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'old.sqlite3'
            with sqlite3.connect(p) as db:db.execute('CREATE TABLE events(id TEXT,kind TEXT,payload TEXT,created REAL)');db.execute("INSERT INTO events VALUES('legacy','test','{}',1)")
            before=hashlib.sha256(p.read_bytes()).hexdigest();prev=self.app.legacy_path;self.app.legacy_path=p
            try:self.assertEqual(self.app.legacy()['events_count'],1)
            finally:self.app.legacy_path=prev
            self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),before)
    def test_csv_formula_safety(self):
        h,c=self.learner(label='=SYNTHETIC()');self.request('/learner/events','POST',self.event('submission',{'answers':self.answers()}),h)
        raw=self.app.csv_export(c['assignment']['id']).decode('utf-8-sig');self.assertIn("'=SYNTHETIC()",raw)
    def test_unsafe_input_is_text_in_package(self):
        d=seed_definition();d['title']='</script><script>alert(1)</script>'
        s,a,_=self.request('/assignments','POST',{'course_id':'demo-class','definition':d},self.teacher());self.assertEqual(s,200)
        with zipfile.ZipFile(io.BytesIO(self.app.export(a['id'],'A'))) as z:
            self.assertNotIn(b'</script>',z.read('config.js'));ET.fromstring(z.read('imsmanifest.xml'))
    def test_database_survives_app_restart(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'db.sqlite3';a=App(p,TOKEN,self.origin,test=True)
            with a.connect() as db:a.audit(db,'restart-test','x')
            b=App(p,TOKEN,self.origin,test=True)
            with b.connect() as db:self.assertEqual(db.execute("SELECT COUNT(*) FROM audit WHERE action='restart-test'").fetchone()[0],1)

if __name__=='__main__':unittest.main(verbosity=2)
