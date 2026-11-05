"""Installer helpers tested without root, systemd, or production paths."""
from pathlib import Path
import importlib.util,hashlib,sqlite3,tempfile,unittest
spec=importlib.util.spec_from_file_location('deploy',Path(__file__).resolve().parents[1]/'deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)
class DeploymentTests(unittest.TestCase):
 def test_atomic_mode_and_replacement(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'environment';deploy.atomic(p,'A=old\n');deploy.atomic(p,'A=new\n')
   self.assertEqual(p.read_text(),'A=new\n');self.assertEqual(p.stat().st_mode&0o777,0o600)
 def test_environment_read_does_not_execute_shell(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'environment';p.write_text('A=$(never-run)\n# comment\nB="safe"\n')
   self.assertEqual(deploy.load_env(p),{'A':'$(never-run)','B':'safe'})
 def test_sqlite_backup_retains_data_without_mutation(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'source.sqlite3';dst=Path(td)/'backup.sqlite3'
   with sqlite3.connect(p) as db:db.execute('CREATE TABLE x(v TEXT)');db.execute("INSERT INTO x VALUES('synthetic')")
   before=hashlib.sha256(p.read_bytes()).hexdigest();deploy.snapshot(p,dst)
   with sqlite3.connect(dst) as db:self.assertEqual(db.execute('SELECT v FROM x').fetchone()[0],'synthetic')
   self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),before)
 def test_sqlite_wal_backup_includes_committed_wal(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'source.sqlite3';dst=Path(td)/'backup.sqlite3';db=sqlite3.connect(p)
   db.execute('PRAGMA journal_mode=WAL');db.execute('CREATE TABLE x(v TEXT)');db.execute("INSERT INTO x VALUES('wal')");db.commit()
   try:
    deploy.snapshot(p,dst)
    with sqlite3.connect(dst) as b:self.assertEqual(b.execute('SELECT v FROM x').fetchone()[0],'wal')
   finally:db.close()
 def test_legacy_insert_repair_is_restart_safe(self):
  with sqlite3.connect(':memory:') as db:
   db.execute('CREATE TABLE commands(id INTEGER PRIMARY KEY,version INTEGER,paused INTEGER,hint TEXT,stage INTEGER DEFAULT 1)')
   db.execute("INSERT OR IGNORE INTO commands(id,version,paused,hint) VALUES(1,0,0,'')")
   db.execute('UPDATE commands SET version=4,stage=3 WHERE id=1')
   db.execute("INSERT OR IGNORE INTO commands(id,version,paused,hint) VALUES(1,0,0,'')")
   self.assertEqual(db.execute('SELECT version,stage FROM commands').fetchone(),(4,3))
 def test_installer_preserves_api_network_config(self):
  s=(Path(__file__).resolve().parents[1]/'deploy.py').read_text()
  self.assertNotIn('172.18.',s);self.assertNotIn('ufw allow',s);self.assertNotIn("restart','schoology-api-test",s)
 def test_runtime_files_are_present(self):
  for name in deploy.FILES:self.assertTrue((Path(__file__).resolve().parents[1]/name).is_file(),name)
if __name__=='__main__':unittest.main()

class CutoverTests(unittest.TestCase):
 def fixture(self,root):
  from types import SimpleNamespace
  target=root/'opt';target.mkdir();cfg=root/'environment';data=root/'data';data.mkdir();unit=root/'portal.service'
  cfg.write_text('PORTAL_ADMIN_TOKEN=synthetic-installer-token-12345678901234567890\nPORTAL_BIND=127.0.0.1\nPORTAL_PORT=8770\nDATA_DIR='+str(data)+'\nALLOWED_ORIGINS=https://content.example.test\n')
  unit.write_text('original v8 unit')
  with sqlite3.connect(data/'events.sqlite3') as db:db.execute('CREATE TABLE x(v INTEGER)');db.execute('INSERT INTO x VALUES(8)')
  return target,cfg,data,unit,SimpleNamespace(pw_uid=1000,pw_gid=1000)
 def test_cutover_and_rollback_logic_with_mock_systemd(self):
  import io,os
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);target,cfg,data,unit,user=self.fixture(root);original=cfg.read_text();calls=[]
   class Opener:
    def open(self,*a,**kw):return io.BytesIO(b'{"version":"9.0.0-pilot.1"}')
   with patch.multiple(deploy,TARGET=target,CONFIG=cfg,UNIT=unit,BACKUPS=root/'backups'),patch.object(deploy.pwd,'getpwnam',return_value=user),patch.object(deploy,'run',side_effect=lambda *a,**kw:calls.append(a)),patch.object(deploy.urllib.request,'build_opener',return_value=Opener()):
    deploy.install('https://portal.example.test')
    self.assertIn('v9-current',unit.read_text());self.assertTrue((target/'v9-current').is_symlink())
    self.assertEqual((target/'v9-current'/'static').stat().st_mode&0o777,0o755)
    deploy.restore(Path((target/'v9-last-backup').read_text().strip()))
    self.assertEqual(unit.read_text(),'original v8 unit');self.assertEqual(cfg.read_text(),original)
    self.assertFalse(any('schoology-api-test' in c and 'restart' in c for c in calls))
 def test_health_failure_restores_v8(self):
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);target,cfg,data,unit,user=self.fixture(root);original=cfg.read_text()
   class Opener:
    def open(self,*a,**kw):raise OSError('injected health failure')
   with patch.multiple(deploy,TARGET=target,CONFIG=cfg,UNIT=unit,BACKUPS=root/'backups'),patch.object(deploy.pwd,'getpwnam',return_value=user),patch.object(deploy,'run',return_value=None),patch.object(deploy.urllib.request,'build_opener',return_value=Opener()),patch.object(deploy.time,'sleep',return_value=None):
    with self.assertRaises(RuntimeError):deploy.install('https://portal.example.test')
    self.assertEqual(unit.read_text(),'original v8 unit');self.assertEqual(cfg.read_text(),original)
    with sqlite3.connect(data/'events.sqlite3') as db:self.assertEqual(db.execute('SELECT v FROM x').fetchone()[0],8)
