# Mac verification profile

Verified 2026-10-24 against Claude Code 2.1.310 and Python 3.14.4 on one authorized Mac. Other hosts and Windows are unverified and not installed.

## Evidence

- Eight fake-input tests passed from this canonical package, including scratch install, selective uninstall, reinstall, settings preservation, and enrollment boundaries.
- Six protocol assertions passed through the installed handlers. Candidate shell commands remained inert data; no example.invalid request was made and no real secret was used. The fake enrollment marker was removed.
- A separate fresh Claude session listed the user PreToolUse handler with matcher `^Bash$` in `/hooks` and successfully enrolled through SessionStart. It exited without a model prompt.
- The installed runtime matched the reviewed `guard.py` byte for byte. Its SHA-256 is `2434b306ed664d0eeb57ecf7579168a64388a0513b7637b4868f3fd1a3d9145c`.
- Existing user hooks and settings were preserved. Two handlers were added: startup-only enrollment and Bash inspection. Existing running sessions remained unenrolled and untouched.
- The installed runtime is an independent fixed copy under the user's Claude configuration directory. It does not depend on the repository checkout or a task staging folder.

The 2026-10-24 record above did not test real model-generated Bash interception or in-Claude timeout behavior. The later observed run below covers them for the listed cases only. Hook loading and registration do not by themselves prove full interception in every host.

## Observed hook failure handling (recorded 2026-10-25)

One real Claude Code 2.1.310 session ran in normal permission mode. It made 11 candidate Bash calls against inert local marker stubs. An additional test-only PreToolUse hook used `onFailure: block`. No real external request was made and no real secret was used. Guard denials returned only fixed rule diagnostics and did not echo fake payloads. Claude's own session transcript still records the fake candidate commands. A public-safe summary is in [fixtures/observed_hook_failure_behavior.json](fixtures/observed_hook_failure_behavior.json).

| Case | Source | Result |
| --- | --- | --- |
| Truncated stdout: exactly `{`, exit 0 | Test-only hook | **Not blocked.** Fell through to ordinary permissions, which still prompted. After explicit one-time approval, the inert local marker ran. |
| Valid JSON, invalid `permissionDecision` value, exit 0 | Test-only hook | Blocked; marker absent |
| Crash, exit 1 | Test-only hook | Blocked; marker absent |
| Timeout | Test-only hook | Blocked; marker absent |
| `ask` dialog denied | Test-only hook | Not run; marker absent |
| Environment dump, process argv, private-file upload | Installed production privacy rules, local `env`/`ps`/`curl` stubs | Blocked; markers absent |
| Ordinary, ambiguous, authorization-header commands | No denying rule | Ran under ordinary permission handling; markers present |

Global settings and the installed runtime stayed byte-identical. All existing enrollment markers were kept.

The timeout, crash, `ask`, schema, and truncated cases came from a test-only hook. Only the three privacy blocks exercised the installed production guard. `onFailure: block` therefore does not cover non-JSON stdout with exit 0 in this version. Syntactically valid JSON that fails schema validation does block.

The deterministic suite (`test_guard.py`, `test_hook_output.py`) does not emulate or prove Claude runner behavior. `test_hook_output.py` checks only that the fixtures reproduce the output shapes above and that `guard.py` serializes complete JSON for malformed fake input. Byte equality between `fixtures/invalid_schema_stdout.py` and the hook used in the run was not recorded. The truncated fixture matches the observed `{` exactly. The coordinator ran the snapshot suite and all 13 deterministic tests passed. That result covers fixture fidelity and production serialization only. It is not proof of runner behavior.

### Residual risk and proposed mitigation (not implemented)

The production guard emits valid JSON or nothing and catches input/runtime exceptions, so it should not produce truncated output in normal operation. No claim covers every future serialization or output corruption, for example an interrupted write. If that happened, the observed behavior is a fall-through to ordinary permissions, not a block.

Proposed mitigation: a separate wrapper runs the guard, captures its stdout, and validates it before returning it. Output must be either empty or a complete, schema-valid PreToolUse object. On malformed output it exits nonzero with fixed text and no echoed input. The wrapper's own stdout is still a boundary and offers no absolute guarantee. It needs a test against the exact observed `{` fixture and approval for a safe rollout through the selective uninstall/install path. There is no current live change: `guard.py`, `manage.py`, and the installed runtime are unchanged.

## Reproduce locally

Run from this directory:

```sh
python3 -B -m unittest discover -s . -v
python3 manage.py status
```

Run installation only on an authorized Mac after reviewing settings and the [policy and limitations](README.md). Verify `/hooks` in a new session. Do not test with real credentials or private payloads.

## Selective rollback

```sh
python3 manage.py uninstall
python3 manage.py status
```

Scratch rollback and reinstall preserve unrelated settings. The enabled Mac installation was left installed; a production uninstall was not performed as a verification step. Future updates require a safe checkpoint, tests, and selective uninstall/install. Do not disable all hooks or overwrite a current settings file with an old backup.

## Coverage

Narrow literal Claude Bash checks only. No Codex, browser, web, MCP, tool-output, other-client, script, encoded-command, or cross-machine enforcement. Startup enrollment failures and settings/host modes can leave sessions uncovered. See [README.md](README.md) for individual rules, false-positive risks, known gaps, and the proposed one-small-check weekly backlog.

This record intentionally omits personal machine paths, session identifiers, project names, credentials, and local configuration contents. Publication does not change the installed runtime or enroll an existing session.
