"""Validating PreToolUse transport for the fixed sibling guard.py (proposed, not installed).

stdout is always empty. Exit 0 only for a complete, exact internal pass verdict;
a validated deny or any failure exits 2 with fixed text on stderr. Never executes,
logs, stores, or echoes the hook payload or child diagnostics. This validates one
transport boundary; it cannot make the hook runner or this file tamper-proof.
"""
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import time

GUARD = Path(__file__).resolve().with_name('guard.py')
LIMIT = 1024 * 1024  # Same input cap as guard.LIMIT.
TIMEOUT = 3  # Below the configured five-second outer hook timeout.
OUTPUT_CAP = 256  # The longest valid verdict is under 80 bytes.
RULES = frozenset({'process-argv', 'process-argv-env', 'environment-dump', 'private-file-upload', 'secret-in-request-body', 'secret-in-url', 'input-or-runtime-failure'})
POLICY = 'Policy: agent-os/00-resources/claude-bash-privacy.md'
FAILURE = 'Privacy guard: check-failed. Bash blocked because the guard verdict was missing or invalid. Retry, or remove this guard selectively if it stays unavailable. ' + POLICY + '\n'

def line(obj):
    return (json.dumps(obj, sort_keys=True, separators=(',', ':')) + '\n').encode()

# Exact canonical bytes only: rejects truncation, duplicate/extra keys, unknown rules and other versions.
VERDICTS = {line({'v': 1, 'verdict': 'pass'}): None}
VERDICTS.update({line({'rule': r, 'v': 1, 'verdict': 'deny'}): r for r in RULES})

def denial(rule):
    # Fixed text from the rule allowlist only. Never echo input, URLs, paths, values, or child output.
    return 'Privacy guard: ' + rule + '. Use metadata-only diagnostics or remove private data from the request. ' + POLICY + '\n'

def command():
    # Fixed child: no shell, environment override, argv selector, or alternative checker path.
    return [sys.executable, '-I', str(GUARD), '--verdict']

def child(raw):
    """Run the checker with bounded in-memory output. Return its stdout, or None on any transport failure."""
    if not os.path.isabs(sys.executable) or not GUARD.is_file():
        return None
    p = subprocess.Popen(command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={}, cwd=str(GUARD.parent), close_fds=True)
    out, pending, ok, code = b'', memoryview(raw), True, None
    deadline = time.monotonic() + TIMEOUT
    try:
        os.set_blocking(p.stdin.fileno(), False)
        with selectors.DefaultSelector() as sel:
            sel.register(p.stdin, selectors.EVENT_WRITE)
            sel.register(p.stdout, selectors.EVENT_READ)
            sel.register(p.stderr, selectors.EVENT_READ)
            while ok and sel.get_map():
                left = deadline - time.monotonic()
                if left <= 0:
                    ok = False
                    break
                for key, _ in sel.select(left):
                    f = key.fileobj
                    if f is p.stdin:
                        try:
                            pending = pending[os.write(f.fileno(), pending[:65536]):]
                        except BlockingIOError:
                            continue
                        except BrokenPipeError:
                            pending = pending[:0]  # Child stopped reading; its verdict is still validated.
                        if not pending:
                            sel.unregister(f)
                            f.close()
                        continue
                    chunk = os.read(f.fileno(), OUTPUT_CAP + 1)
                    if not chunk:
                        sel.unregister(f)
                    elif f is p.stderr or len(out) + len(chunk) > OUTPUT_CAP:
                        ok = False  # Unexpected diagnostics or excessive output; never accumulated or echoed.
                        break
                    else:
                        out += chunk
        if ok:
            code = p.wait(timeout=max(deadline - time.monotonic(), 0))
    except (OSError, ValueError, subprocess.TimeoutExpired):
        ok = False
    finally:
        if p.poll() is None:
            p.kill()
        p.wait()
        for f in (p.stdin, p.stdout, p.stderr):
            f.close()
    return out if ok and code == 0 else None

def main():
    try:
        raw = sys.stdin.buffer.read(LIMIT + 1)
        out = child(raw) if len(raw) <= LIMIT else None
        if out in VERDICTS:
            rule = VERDICTS[out]
            if rule is None:
                return  # Validated explicit pass: exit 0, normal Claude permissions continue.
            message = denial(rule)
        else:
            message = FAILURE
    except Exception:
        message = FAILURE
    # Deny and failure both rely on PreToolUse exit-2 blocking; no stdout can be truncated into a pass.
    sys.stderr.write(message)
    sys.stderr.flush()
    sys.exit(2)

if __name__ == '__main__':
    main()
