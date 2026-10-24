"""Narrow Claude Bash guard. Never executes input, reads secrets, or logs payloads."""
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import sys

STATE = Path(__file__).resolve().parent / 'sessions'
LIMIT = 1024 * 1024
SECRET = re.compile(r'(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET|PASSWORD|PRIVATE_KEY|SSN|SOCIAL_SECURITY|PASSPORT_NUMBER)', re.I)
PRIVATE_FILE = re.compile(r'(?:^|[/@])(?:\.env(?:\.[\w-]+)?|id_rsa|id_ed25519|credentials)(?:$|[\s/])|\.aws/credentials|\.ssh/id_', re.I)

def decision(command, depth=0):
    """Return a fixed rule id or None. This is a literal command filter, not a shell parser."""
    if depth > 4:
        return None
    try:
        lex = shlex.shlex(command, posix=True, punctuation_chars=';&|\n')
        lex.whitespace = ' \t\r'
        lex.whitespace_split = True
        lex.commenters = '#'
        tokens = list(lex)
    except ValueError:
        return None  # ambiguous shell syntax is outside narrow coverage
    groups, group = [], []
    for t in tokens + [';']:
        if t and all(c in ';&|\n' for c in t):
            if group:
                groups.append(group)
            group = []
        else:
            group.append(t)
    for a in groups:
        while a and (a[0] in ('command', 'builtin', 'sudo') or re.match(r'^\w+=', a[0])):
            a = a[1:]
        if not a:
            continue
        name = a[0].rsplit('/', 1)[-1]
        args = a[1:]
        if name in ('bash', 'sh', 'zsh') and '-c' in args:
            i = args.index('-c')
            if i + 1 < len(args):
                rule = decision(args[i + 1], depth + 1)
                if rule:
                    return rule
        if name == 'ps':
            if any(re.search(r'(?:^|,)(?:args|command)(?:=|,|$)', t) for t in args):
                return 'process-argv'
            if any(re.fullmatch(r'-?[a-zA-Z]+', t) and ('e' in t or 'f' in t or 'u' in t) for t in args):
                return 'process-argv-env'
        if name == 'pgrep' and any(t.startswith('-') and 'a' in t for t in args):
            return 'process-argv'
        if name == 'printenv' and (not args or args == ['-0']):
            return 'environment-dump'
        if name == 'env' and (not args or args == ['-0']):
            return 'environment-dump'
        if name in ('set', 'export') and (not args or args == ['-p']):
            return 'environment-dump'
        if name != 'curl':
            continue
        payloads = []
        for i,t in enumerate(args):
            if t in ('-d', '--data', '--data-raw', '--data-binary', '--data-urlencode', '-F', '--form', '-T', '--upload-file', '--json'):
                if i+1 < len(args):
                    payloads.append(args[i+1])
            elif t.startswith(('--data=', '--data-raw=', '--data-binary=', '--data-urlencode=', '--form=', '--upload-file=', '--json=')):
                payloads.append(t.split('=',1)[1])
            elif t.startswith(('-d', '-F', '-T')) and len(t)>2:
                payloads.append(t[2:])
        for p in payloads:
            if PRIVATE_FILE.search(p):
                return 'private-file-upload'
            if SECRET.search(p) and ('$' in p or '=' in p or ':' in p):
                return 'secret-in-request-body'
        for t in args:
            if t.startswith(('http://','https://')) and '?' in t and SECRET.search(t.split('?',1)[1]):
                return 'secret-in-url'
    return None

def marker(session):
    if not isinstance(session,str) or not session or len(session)>200:
        raise ValueError('invalid session')
    return STATE / hashlib.sha256(session.encode()).hexdigest()

def deny(rule):
    # Fixed reasons only. Do not echo input, URLs, paths, variable values, or errors.
    print(json.dumps({'hookSpecificOutput': {'hookEventName':'PreToolUse', 'permissionDecision':'deny', 'permissionDecisionReason': 'Privacy guard v1: '+rule+'. Use metadata-only diagnostics or remove private data from the request. Policy: agent-os/00-resources/claude-bash-privacy.md'}}))

def main():
    try:
        raw = sys.stdin.buffer.read(LIMIT+1)
        if len(raw)>LIMIT:
            raise ValueError('oversize')
        event = json.loads(raw)
        if '--session-start' in sys.argv:
            # Existing running and resumed sessions stay out of this rollout.
            if event.get('hook_event_name') == 'SessionStart' and event.get('source') == 'startup':
                p = marker(event.get('session_id'))
                STATE.mkdir(mode=0o700, exist_ok=True)
                p.touch(mode=0o600, exist_ok=True)
            return
        if event.get('hook_event_name') != 'PreToolUse' or event.get('tool_name') != 'Bash':
            return
        if not marker(event.get('session_id')).is_file():
            return
        command = event.get('tool_input',{}).get('command')
        if not isinstance(command,str):
            raise ValueError('invalid command')
        rule = decision(command)
        if rule:
            deny(rule)
    except Exception:
        # Runtime/schema failure blocks; no traceback or private input emitted.
        if '--session-start' in sys.argv:
            sys.stderr.write('Privacy guard session registration failed; new session coverage unavailable.\n')
            sys.exit(1)
        deny('input-or-runtime-failure')

if __name__ == '__main__':
    main()
