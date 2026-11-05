#!/usr/bin/env python3
"""Root-only reversible installer for the isolated classroom portal, not the Hub."""
from __future__ import annotations
import argparse
import datetime
import json
import os
from pathlib import Path
import pwd
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request
from urllib.parse import urlsplit

SOURCE=Path(__file__).resolve().parent
TARGET=Path('/opt/classroom-teacher-portal')
CONFIG=Path('/etc/classroom-teacher-portal/environment')
UNIT=Path('/etc/systemd/system/classroom-teacher-portal.service')
BACKUPS=Path('/var/backups/classroom-teacher-portal')
SERVICE='classroom-teacher-portal'
FILES=['portal.py','deploy.py','README.md','AGENTS.md','SECURITY.md','CHANGELOG.md','VERSION',
       'static/index.html','static/app.js','static/style.css','static/board.html','static/board.js',
       'scorm/index.html','scorm/learner.js','scorm/style.css']

def load_env(path):
    values={}
    if path.exists():
        for line in path.read_text().splitlines():
            line=line.strip()
            if not line or line.startswith('#'):continue
            key,sep,value=line.partition('=')
            if sep and key.replace('_','').isalnum():
                values[key]=value.strip().strip('"')
    return values

def run(*args,**kw):
    return subprocess.run(list(args),check=True,**kw)

def atomic(path,data,mode=0o600):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.'+path.name,dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(data if isinstance(data,bytes) else data.encode());f.flush();os.fsync(f.fileno())
        os.chmod(name,mode);os.replace(name,path)
    finally:
        if os.path.exists(name):os.unlink(name)

def snapshot(src,dst):
    if not src.exists():return
    a=sqlite3.connect(src.resolve().as_uri()+'?mode=ro',uri=True,timeout=10)
    b=sqlite3.connect(dst)
    try:
        a.backup(b)
        if b.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise RuntimeError('SQLite snapshot failed integrity check.')
    finally:a.close();b.close()
    os.chmod(dst,0o600)

def restore(backup):
    if backup.parent!=BACKUPS or not backup.is_dir():raise RuntimeError('Invalid rollback directory.')
    for name,destination in [('environment',CONFIG),('service',UNIT)]:
        source=backup/name
        if source.exists():shutil.copy2(source,destination)
    info=json.loads((backup/'metadata.json').read_text())
    link=TARGET/'v9-current'
    if info['previous_link']:
        temporary=TARGET/'v9-rollback-link'
        temporary.unlink(missing_ok=True);temporary.symlink_to(info['previous_link']);os.replace(temporary,link)
    run('systemctl','daemon-reload');run('systemctl','restart',SERVICE)
    print('Previous portal code/configuration restored. Existing databases were retained, not rewound.')

def install(public_origin,repair_legacy=False):
    from portal import VERSION,origin
    if not CONFIG.exists() or not UNIT.exists():raise RuntimeError('An existing v8 teacher portal installation is required. No services were changed.')
    user=pwd.getpwnam('schoology-api-test')
    env=load_env(CONFIG)
    source_env=load_env(Path('/etc/schoology-api-test/environment'))
    public_origin=origin(public_origin or env.get('PORTAL_PUBLIC_ORIGIN',''))
    if len(env.get('PORTAL_ADMIN_TOKEN',''))<24:raise RuntimeError('Existing teacher token is missing or invalid. No credential has been generated or printed.')
    bind=env.get('PORTAL_BIND','127.0.0.1');port=int(env.get('PORTAL_PORT','8770'))
    if bind in ('0.0.0.0','::'):raise RuntimeError('Refusing a wildcard listener. Keep the reviewed private/loopback bind.')
    data=Path(env.get('DATA_DIR','/var/lib/schoology-api-test'))
    if not data.is_dir():raise RuntimeError('Configured persistent data directory is missing.')
    env['PORTAL_PUBLIC_ORIGIN']=public_origin
    env['ALLOWED_ORIGINS']=env.get('ALLOWED_ORIGINS') or source_env.get('ALLOWED_ORIGINS','')
    if not env['ALLOWED_ORIGINS']:raise RuntimeError('No learner CORS origins configured. Preserve the tested exact-origin allowlist first.')
    for x in env['ALLOWED_ORIGINS'].split(','):origin(x.strip())
    for x in FILES:
        if not (SOURCE/x).is_file():raise RuntimeError('Package is missing '+x)
    print('Running synthetic tests before changing the service…')
    run(sys.executable,'-m','unittest','discover','-s',str(SOURCE/'tests'),'-p','test_portal.py','-q')
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    BACKUPS.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(BACKUPS,0o700)
    backup=BACKUPS/stamp;backup.mkdir(mode=0o700)
    shutil.copy2(CONFIG,backup/'environment');shutil.copy2(UNIT,backup/'service')
    oldlink=TARGET/'v9-current'
    atomic(backup/'metadata.json',json.dumps({'version':VERSION,'previous_link':str(oldlink.resolve()) if oldlink.is_symlink() else None}))
    snapshot(data/'events.sqlite3',backup/'legacy.sqlite3')
    snapshot(data/'classroom-v9.sqlite3',backup/'v9.sqlite3')
    release=TARGET/'v9-releases'/(VERSION+'-'+stamp)
    release.mkdir(parents=True,mode=0o755)
    os.chmod(release.parent,0o755);os.chmod(release,0o755)
    for name in FILES:
        dest=release/name;dest.parent.mkdir(parents=True,exist_ok=True);os.chmod(dest.parent,0o755)
        shutil.copyfile(SOURCE/name,dest);os.chmod(dest,0o644)
    # Validate using the service UID. Configuration is passed in memory, never in argv.
    child_env={**os.environ,**env,'PYTHONDONTWRITEBYTECODE':'1'}
    run(sys.executable,str(release/'portal.py'),'--check',env=child_env,user=user.pw_uid,group=user.pw_gid,umask=0o077)
    unit=f'''[Unit]
Description=RoomGoblin Classroom Portal v9 (synthetic pilot)
After=network-online.target docker.service
Wants=network-online.target
[Service]
Type=simple
User=schoology-api-test
Group=schoology-api-test
WorkingDirectory={TARGET}/v9-current
EnvironmentFile={CONFIG}
Environment=PYTHONDONTWRITEBYTECODE=1
ExecStart=/usr/bin/python3 {TARGET}/v9-current/portal.py
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={data}
PrivateTmp=true
PrivateDevices=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
[Install]
WantedBy=multi-user.target
'''
    encoded='\n'.join(k+'='+v for k,v in env.items())+'\n'
    if any('\n' in v or '\r' in v for v in env.values()):raise RuntimeError('Invalid environment value.')
    # The following cutover is reversible; v6 API, firewall, and NPM are not restarted or rewritten.
    try:
        atomic(CONFIG,encoded)
        newlink=TARGET/'v9-new-link';newlink.unlink(missing_ok=True);newlink.symlink_to(release);os.replace(newlink,oldlink)
        atomic(UNIT,unit,0o644)
        run('systemctl','daemon-reload');run('systemctl','enable',SERVICE);run('systemctl','restart',SERVICE)
        host='['+bind+']' if ':' in bind else bind
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        healthy=False
        for _ in range(30):
            try:
                with opener.open(f'http://{host}:{port}/portal/api/v9/health',timeout=2) as response:
                    healthy=json.load(response).get('version')==VERSION
                if healthy:break
            except Exception:pass
            time.sleep(1)
        if not healthy:raise RuntimeError('New portal failed its bounded health check.')
    except BaseException:
        print('Cutover failed; restoring previous portal service.')
        restore(backup)
        raise
    atomic(TARGET/'v9-last-backup',str(backup)+'\n')
    if repair_legacy:
        # Known v6 issue: INSERT without column names fails after its additive stage migration.
        # Patch only the exact known statement. Do not restart the working API.
        old=Path('/opt/schoology-api-test/server.py')
        bad="INSERT OR IGNORE INTO commands VALUES(1,0,0,'')"
        good="INSERT OR IGNORE INTO commands(id,version,paused,hint) VALUES(1,0,0,'')"
        if old.exists() and bad in old.read_text():
            code=old.read_text().replace(bad,good)
            compile(code,str(old),'exec')
            shutil.copy2(old,backup/'api-before-safe-insert.py')
            atomic(old,code,0o644)
            print('Repaired known legacy v6 startup INSERT; API was not restarted.')
    print('PASS: '+VERSION+' is healthy.')
    print('Portal: '+public_origin+'/portal/')
    print('V6 /api routes, original database, NPM settings, and firewall are unchanged.')
    print('SQLite-safe backups: '+str(backup))
    print('Rollback: sudo python3 '+str(release/'deploy.py')+' --rollback')
    print('Use your existing separate portal administrator token; it is not printed here.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public-origin',default='')
    parser.add_argument('--rollback',action='store_true')
    parser.add_argument('--repair-legacy-startup',action='store_true')
    args=parser.parse_args()
    if os.geteuid()!=0:raise SystemExit('Run this installer with sudo.')
    try:
        if args.rollback:restore(Path((TARGET/'v9-last-backup').read_text().strip()))
        else:install(args.public_origin,args.repair_legacy_startup)
    except Exception as e:
        print('ERROR: '+str(e),file=sys.stderr);raise SystemExit(1)
