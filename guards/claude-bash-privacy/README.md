# Claude Bash privacy guard v1

A small accidental-disclosure guard for Claude Code on an authorized Mac. It reads the proposed Bash command as data and never executes it, reads credentials, inspects process arguments, makes network calls, or records payloads. It does not provide comprehensive data loss prevention.

## Policy

Prefer process metadata such as `ps -p 123 -o pid,ppid,comm`. Do not dump full process arguments or environments into an agent transcript. Keep secret values out of request bodies, URLs, uploads, logs, and saved evidence. Use existing credentials only as required for an authorized API operation.

The enabled literal rules deny:

- `ps` with the common `u`, `f`, or `e` flags, or explicit `args`/`command` output fields; `pgrep` with `-a`.
- Bare `env`, `printenv`, `set`, and `export`, including supported null/persisted dump forms.
- `curl` data/form/upload arguments naming `.env` variants, SSH private keys, or AWS credential paths.
- `curl` payload arguments containing explicit secret/private-identifier labels plus expansion or assignment syntax, and URLs with such labels in the query. Labels include API_KEY, ACCESS_TOKEN, AUTH_TOKEN, SECRET, PASSWORD, PRIVATE_KEY, SSN, SOCIAL_SECURITY, and PASSPORT_NUMBER.

Normal requests with Authorization or x-api-key headers remain subject to Claude's existing permissions. They receive no affirmative allow from this hook. Ordinary commands, public file uploads, and application SDK workflows remain usable. A legitimate payload with a labeled private field can be denied; remove the private field or review scope rather than renaming fields to evade the guard.

## Supported semantics and rollout

Reviewed 2026-10-24 against installed Claude Code **2.1.310** and the current [official hook reference](https://code.claude.com/docs/en/hooks) and [guide](https://code.claude.com/docs/en/hooks-guide).

- User settings merge with existing hooks. Match `^Bash$`; stdin contains `hook_event_name`, `tool_name`, and `tool_input.command`.
- Denials use an exit-0 JSON `hookSpecificOutput` with `hookEventName: PreToolUse` and `permissionDecision: deny`. Nonmatches emit nothing; existing permission rules apply.
- `onFailure: block` (requires 2.1.295+) is the configured failure mode. It does **not** cover every invalid output. In an observed 2.1.310 normal-permission run ([mac-verification.md](mac-verification.md)), a nonzero-exit crash, a timeout, and syntactically valid JSON with an invalid `permissionDecision` value each blocked. Truncated non-JSON stdout (exactly `{`, exit 0) did not block. It fell through to ordinary permissions, which still prompted. The hook uses exec-form absolute interpreter and script paths with isolated Python (`-I`) and a five-second timeout.
- A separate SessionStart handler enrolls **startup only**. It creates one empty mode-0600 marker named by SHA-256 of the session ID in a mode-0700 directory. No command, secret, transcript, URL, or environment value is saved. Existing live sessions and previously unregistered resumed/forked/cleared sessions remain outside coverage even if settings reload. An enrolled session stays enrolled on resume.
- Registration failure is surfaced but SessionStart cannot block startup. No marker means no coverage. New-session enrollment and Bash invocation must both work; configuration alone does not prove interception.

## Tests and limits

Run from this directory:

```sh
python3 -m unittest discover -s . -v
```

Fixtures use example.invalid, fake private identifiers, and fake secret names only. They never run the candidate commands or send a request. Tests cover denied, permitted, and ambiguous commands; JSON decisions; malformed/oversized/missing command input; enrollment boundaries; fixed error text; missing runtime and timeout process failures; settings preservation; idempotent install; uninstall and reinstall against a temporary settings directory.

Missing-runtime/timeout tests establish process failure and assert the configured `onFailure` setting. Claude's own failure handling is based on the official version-matched contract unless separately verified through a real Claude tool interception. Do not claim the unit harness is a live Claude end-to-end test.

`test_hook_output.py` checks fixture fidelity and production serialization only. The test-only fixtures under `fixtures/` emit exactly `{` (non-JSON) and valid JSON with an invalid decision. Malformed fake input to `guard.py` must produce complete deny JSON, never truncated output. These tests do not emulate or prove how the Claude runner handles either output. The production guard emits valid JSON or nothing and catches input/runtime exceptions. That is not a guarantee against every future serialization or output corruption, such as an interrupted write. A proposed, unimplemented mitigation is described in [mac-verification.md](mac-verification.md).

Known gaps include shell substitutions, aliases/functions, alternative spellings, option combinations, encoded commands, interpreter programs, scripts, config-file-driven curl, curl stdin/pipelines, indirect variable names, arbitrary private files, literal unlabeled credentials, direct `printenv API_KEY`, `ps` defaults/other output fields, and other network clients. shlex is not a complete shell parser; ambiguous syntax is passed through. The guard cannot stop a determined bypass or prevent values already present in a prompt/tool input from reaching Claude or its own logs. It does not redact tool output. No secret-value database or entropy scanner is used.

| Surface | v1 state |
| --- | --- |
| Claude Code Bash on enrolled Mac sessions | Narrow checks only |
| Existing unregistered sessions | Excluded; do not restart or modify worktrees |
| Claude Read/Write, WebFetch, MCP, file mentions, model text | No guard |
| Codex shell/tools | No guard |
| Browser, web, connectors, other applications, direct terminal | No guard |
| Windows and other machines | Not installed; profile unverified |

Project/managed settings, `--bare`, disabled hooks, omitted setting sources, failed enrollment, and host/SDK behavior can prevent this user hook from running. It is user-level configuration, not a tamper-proof managed policy.

## Mac install and selective rollback

Inspect the local instructions and current settings first. Run the fake tests, confirm Claude is at least 2.1.295, and authorize the particular Mac. Use an absolute Python 3 interpreter. The installer refuses non-Mac platforms, disabled hooks, symlinked settings/runtime directories, and a different existing runtime. It does not change network access, credentials, permissions rules, or unrelated configuration. The stable runtime is a reviewed copy, not a live symlink to changing source.

```sh
python3 manage.py install
python3 manage.py status
python3 manage.py uninstall
```

`uninstall` is the disable/rollback operation for this guard only. It removes handlers bearing the exact v1 marker and its runtime/session markers. Other hooks and settings stay in place. Never set disableAllHooks to roll this back. Do not restore an old whole-settings backup over newer changes. No whole-settings backup is saved because existing settings can contain secrets.

Test a change in a temporary target first with `--claude-dir /ABS/TEMP/DIR`. Installation writes settings atomically after a concurrent-change check; a tiny final race with another settings writer remains, so coordinate configuration ownership. Formatting is normalized to JSON but unrelated values are preserved. Update by uninstalling at a safe checkpoint, rerunning tests, then installing. Restarting live work is not required or authorized. Reenroll through a fresh session after updating; old enrollment markers are removed by uninstall.

After installation, inspect `/hooks` in a fresh Claude session and verify both handlers. A harmless fake-input direct handler check verifies protocol/configuration but not real model tool interception. Do not test with real secrets or issue real uploads. If the interpreter/runtime disappears, Bash can be blocked until this guard is selectively removed or repaired.

## One small check per week

Each addition starts with fake fixtures, a false-positive review against authenticated workflows, a stated bypass/gap, and an install/rollback check. Install only after review on the authorized machine.

1. Direct named-secret environment reads (without blocking existence-only checks).
2. One tested command-substitution variant for process dumps.
3. One additional curl stdin/private-file upload form.
4. One explicit private-identifier payload shape with legitimate fixture coverage.
5. Assess a separately supported Codex shell enforcement path; do not claim the Claude hook covers it.
6. Assess browser/MCP/web outbound controls separately with destination and auth-flow constraints.

Schedule weekly review separately when desired; this implementation creates no automation or cross-machine installation.
