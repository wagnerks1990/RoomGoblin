#!/usr/bin/env python3
from pathlib import Path

p=Path(__file__).with_name('apply-automation-convergence.py')
s=p.read_text()
old="""# The clock is constructed before database-backed timezone settings are loaded.
needle='''}catch(error){console.warn(`Stored scheduler timezone ignored: ${error.message}`)}\nfunction privacyRetentionPolicy()'''
s=replace_once(s,needle,''' }catch(error){console.warn(`Stored scheduler timezone ignored: ${error.message}`)}\nschedulerClock.timezone=SCHEDULER_TIMEZONE;\nfunction privacyRetentionPolicy()'''.lstrip(), 'scheduler clock timezone sync')
"""
new=r"""# The clock is constructed before database-backed timezone settings are loaded.
# Synchronize it after the persisted site timezone is applied. Keep the patch robust
# to surrounding formatting changes and harmless if the source already contains it.
if 'schedulerClock.timezone=SCHEDULER_TIMEZONE;' not in s:
    marker='''  process.env.TZ=SCHEDULER_TIMEZONE;\n}catch(error){console.warn(`Stored scheduler timezone ignored: ${error.message}`)}'''
    s=replace_once(s,marker,marker+'\nschedulerClock.timezone=SCHEDULER_TIMEZONE;','scheduler clock timezone sync')
"""
if old not in s:
    raise SystemExit('convergence timezone helper block not found')
p.write_text(s.replace(old,new,1))
print('convergence helper prepared')
