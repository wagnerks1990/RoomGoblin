#!/usr/bin/env python3
import server as core

core.VERSION='1.0.0-alpha.84'

# Supported first-class add-ons. Existing containers outside this set can still
# be adopted for inspect/log/start/stop/restart; creation and removal remain
# restricted to reviewed managed containers and images.
core.MANAGED_CONTAINERS.update({
    'mosquitto','govee2mqtt','music-assistant-server','veyon-webapi'
})
core.MANAGED_IMAGES.update({
    'eclipse-mosquitto:2.0.22',
    'ghcr.io/wez/govee2mqtt:2025.04.13-17d43d72',
    'ghcr.io/music-assistant/server:2.9.13',
})

_original_managed_docker=core.managed_docker

def _adopt_existing(name):
    name=str(name or '')
    if not core.DOCKER_NAME_RE.fullmatch(name):
        raise RuntimeError('Invalid Docker container name')
    probe=core.run(['docker','inspect',name],10,False)
    if probe.returncode!=0:
        raise RuntimeError('Container does not exist and cannot be adopted')
    core.MANAGED_CONTAINERS.add(name)
    return name

def managed_docker(args,cwd=''):
    if isinstance(args,list) and args:
        verb=args[0]
        if verb in ('start','stop','restart','kill','inspect') and len(args)>=2:
            _adopt_existing(args[-1])
        elif verb=='logs' and len(args)>=2:
            _adopt_existing(args[-1])
    return _original_managed_docker(args,cwd)

core.managed_docker=managed_docker

if __name__=='__main__':
    core.serve()
