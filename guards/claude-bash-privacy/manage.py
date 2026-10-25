"""Install/remove only this hook; never replace other settings or back up secrets."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import re
import sys
import tempfile

LABEL='ai-coding-privacy-guard-v1'
# Fixed owned runtime files. PreToolUse runs runner.py, which validates guard.py's internal verdict.
FILES=('guard.py','runner.py')

def owned(h):
    return h.get('statusMessage') == LABEL

def transform(settings, runtime, python, install):
    # Pure transform, retaining every unrelated field and hook.
    out=json.loads(json.dumps(settings))
    hooks=out.setdefault('hooks',{})
    for event in ('SessionStart','PreToolUse'):
        if event not in hooks:
            continue
        groups=[]
        for group in hooks[event]:
            remaining=[h for h in group.get('hooks',[]) if not owned(h)]
            if remaining or not any(owned(h) for h in group.get('hooks',[])):
                groups.append(dict(group,hooks=remaining))
        if groups:hooks[event]=groups
        else:hooks.pop(event,None)
    if install:
        for event,args in [('SessionStart',[str(runtime/'guard.py'),'--session-start']),('PreToolUse',[str(runtime/'runner.py')])]:
            handler={'type':'command','command':str(python),'args':['-I']+args,'timeout':5,'statusMessage':LABEL}
            # Runtime failure blocks Bash; startup failure is surfaced but cannot block SessionStart.
            if event=='PreToolUse':handler['onFailure']='block'
            group={'hooks':[handler]}
            if event=='PreToolUse':group['matcher']='^Bash$'
            hooks.setdefault(event,[]).append(group)
    if not hooks:out.pop('hooks',None)
    return out

def atomic(path,data,mode):
    fd,name=tempfile.mkstemp(prefix='.privacy-',dir=path.parent)
    try:
        os.fchmod(fd,mode)
        with os.fdopen(fd,'wb') as f:
            f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(name,path)
    finally:
        if os.path.exists(name):os.unlink(name)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('action',choices=['install','uninstall','status'])
    p.add_argument('--claude-dir',type=Path,default=Path.home()/'.claude')
    a=p.parse_args();root=a.claude_dir.resolve();settings=root/'settings.json';runtime=root/LABEL
    if settings.is_symlink() or runtime.is_symlink():raise SystemExit('Refusing symlink target; inspect manually.')
    before=settings.read_bytes() if settings.exists() else b'{}'
    data=json.loads(before)
    if a.action=='status':
        pre=[h for g in data.get('hooks',{}).get('PreToolUse',[]) for h in g.get('hooks',[]) if owned(h)]
        print(json.dumps({'installedHandlers':sum(owned(h) for groups in data.get('hooks',{}).values() for g in groups for h in g.get('hooks',[])), 'runtimeExists':(runtime/'guard.py').is_file(),'runnerExists':(runtime/'runner.py').is_file(),'preToolUseScripts':sorted({Path((h.get('args') or [''])[-1]).name for h in pre}),'hooksDisabledAtUserScope':data.get('disableAllHooks',False)}));return
    if a.action=='install':
        if sys.platform!='darwin':raise SystemExit('Only the Mac profile is verified; other platforms are not installed.')
        version=subprocess.run(['claude','--version'],capture_output=True,text=True,timeout=10)
        match=re.match(r'(\d+)\.(\d+)\.(\d+)',version.stdout)
        if version.returncode or not match or tuple(map(int,match.groups())) < (2,1,295):raise SystemExit('Claude Code 2.1.295+ required; no installation performed.')
        if data.get('disableAllHooks') is True:raise SystemExit('Existing hooks disabled; refusing to change security settings.')
        root.mkdir(mode=0o700,parents=True,exist_ok=True)
        runtime.mkdir(mode=0o700,exist_ok=True)
        sources={n:Path(__file__).with_name(n).read_bytes() for n in FILES}
        if any((runtime/n).is_symlink() for n in FILES):raise SystemExit('Refusing symlink target; inspect manually.')
        # Update only after explicit uninstall so source changes cannot silently affect live sessions.
        # Every file is checked before any is written, so a refusal leaves the old runtime intact.
        if any((runtime/n).exists() and (runtime/n).read_bytes()!=s for n,s in sources.items()):raise SystemExit('Different runtime exists: uninstall at a safe checkpoint before updating.')
        for n,s in sources.items():atomic(runtime/n,s,0o600)
    out=transform(data,runtime,Path(sys.executable).resolve(),a.action=='install')
    after=(json.dumps(out,indent=2)+'\n').encode()
    # Prevent a detected concurrent write from being overwritten (small final race remains).
    if (settings.read_bytes() if settings.exists() else b'{}')!=before:raise SystemExit('Settings changed concurrently; retry after inspection.')
    atomic(settings,after,(settings.stat().st_mode & 0o777) if settings.exists() else 0o600)
    if a.action=='uninstall' and runtime.exists():
        # Only our fixed files and empty session markers; never recursively remove arbitrary files.
        for f in (runtime/'sessions').glob('*'):
            if f.is_file() and len(f.name)==64 and all(c in '0123456789abcdef' for c in f.name) and f.stat().st_size==0:f.unlink()
        if (runtime/'sessions').exists() and not any((runtime/'sessions').iterdir()):(runtime/'sessions').rmdir()
        for n in FILES:(runtime/n).unlink(missing_ok=True)
        if not any(runtime.iterdir()):runtime.rmdir()
    print(a.action+' complete; unrelated settings preserved; no settings payload logged.')

if __name__=='__main__':main()
