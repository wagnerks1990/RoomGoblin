#!/usr/bin/env python3
from pathlib import Path

p=Path(__file__).with_name('apply-automation-media-sessions.py')
s=p.read_text()
start=s.index('# Add stable session metadata and playback configuration to uploaded video delivery.')
end=s.index('# Manual media-session control API.',start)
replacement=r'''# Add stable session metadata and playback configuration to uploaded video delivery.
media_start=s.index('}else if(action==="display.media"){')
try:
    media_end=s.index('}else if(action===',media_start+10)
except ValueError:
    media_end=s.index('\n  }\n',media_start)+4
block=s[media_start:media_end]
rec_marker='const rec=mediaLibrary.files[name]||{},type=rec.type||classifyMedia(name,rec.mime||"");'
if rec_marker not in block: raise SystemExit('display media record/type marker not found')
if 'const mediaSession=' not in block:
    block=block.replace(rec_marker,rec_marker+r'''
    const mediaSession={
      sessionId:String(p.sessionId||`${event._occurrenceId||event.id||"manual"}:${event._stepId||"primary"}:${name}`),
      volume:Math.max(0,Math.min(1,Number(p.volume??1))),
      muted:!!p.muted,loop:!!p.loop,
      startAtSeconds:Math.max(0,Number(p.startAtSeconds||0)),
      endAtSeconds:Number(p.endAtSeconds)>0?Number(p.endAtSeconds):null,
      playbackRate:Math.max(.25,Math.min(4,Number(p.playbackRate||1)))
    };
''')
# Existing media code can use different quoting/order across releases. Attach the
# session fields to every display.video payload in this action without changing
# image/PDF behavior.
needle='type:"display.video"'
pos=0
changed=0
while True:
    hit=block.find(needle,pos)
    if hit<0: break
    payload=block.find('payload:{',hit)
    if payload<0: break
    brace=payload+len('payload:{')
    depth=1;i=brace;quote=None;escape=False
    while i<len(block) and depth:
        ch=block[i]
        if quote:
            if escape: escape=False
            elif ch=='\\': escape=True
            elif ch==quote: quote=None
        else:
            if ch in "'\"`": quote=ch
            elif ch=='{': depth+=1
            elif ch=='}': depth-=1
        i+=1
    if depth: raise SystemExit('unterminated display.video payload')
    close=i-1
    payload_text=block[brace:close]
    if '...mediaSession' not in payload_text:
        block=block[:close]+(',' if payload_text.strip() else '')+'...mediaSession'+block[close:]
        changed+=1
        pos=close+len('...mediaSession')+1
    else: pos=close+1
if changed==0 and '...mediaSession' not in block: raise SystemExit('no display.video payload found in display.media action')
s=s[:media_start]+block+s[media_end:]

'''
s=s[:start]+replacement+s[end:]
p.write_text(s)
print('prepared robust automation/media patch generator')
