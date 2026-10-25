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

One real Claude Code 2.1.310 session ran in normal permission mode. It made 11 candidate Bash calls against inert local marker stubs. An additional test-only PreToolUse hook used `onFailure: block`. Candidate commands made no external requests and used no real secrets. Guard denials returned only fixed rule diagnostics and did not echo fake payloads. Claude's own session transcript still records the fake candidate commands. A public-safe summary is in [fixtures/observed_hook_failure_behavior.json](fixtures/observed_hook_failure_behavior.json).

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

## Validated wrapper follow-up (recorded 2026-10-25, not installed)

The source now includes `runner.py` and an explicit internal `guard.py --verdict` protocol. A pass must be a complete canonical line; empty output is a failure. The wrapper accepts only the fixed pass/deny byte strings, never echoes child diagnostics, emits no stdout, and uses exit 2 for every deny or failure. It reads at most 1 MiB of input, captures at most 256 bytes of child stdout in memory, rejects any child stderr, and has a 3-second child deadline below the configured 5-second outer hook deadline. The sibling checker path is fixed, the child environment is empty, and no shell or runtime checker selector is used.

**Deterministic result: 32 tests passed**, including the original 13-test regression/docs baseline. Fake-checker cases cover explicit pass, all fixed denies, truncated/empty output, duplicate/extra keys, unknown rules, invalid schema/version, missing newline, repeated verdicts, non-canonical formatting, legacy v1 JSON, payload echo, nonzero child exit, stderr, timeout, excessive output, missing checker, and oversized input. Temporary real-guard integration covers startup-only enrollment, existing unregistered sessions, normal authenticated workflows, diagnostic/upload denials, and malformed input. Installer tests cover configuration preservation, refusing changed runtime files before overwriting either, and selective rollback/reinstall with unrelated files preserved. These tests do not emulate Claude's runner.

A separate **actual Claude Code 2.1.310 session in normal permission mode** made seven Bash calls to inert marker stubs through an additional disposable project-local harness. Each case used an exact copy of the reviewed runner beside a fixed fake sibling checker. The harness forwarded the wrapper's exit status. The existing global v1 hook remained present; these marker commands did not match its deny rules. No candidate command performed a network request or accessed real private data.

| Fixed checker output/behavior | Actual Claude result | Marker |
| --- | --- | --- |
| Canonical explicit pass | Normal permissions prompted; one-time approval selected | Present |
| Canonical explicit deny | Blocked with fixed rule diagnostic | Absent |
| Truncated `{`, exit 0 | Blocked with fixed check-failed diagnostic | Absent |
| Empty output, exit 0 | Blocked | Absent |
| Invalid verdict, exit 0 | Blocked | Absent |
| Child timeout | Blocked | Absent |
| Unexpected fake child stderr | Blocked; child sentinel not echoed | Absent |

The tested runner SHA-256 is `c0969cea29fe47045b921c8428edc434d30527f83547b423ee8aac08dd7b60c5`. The final committed runner is byte-identical to that tested artifact. The fake harness and session were removed after the test; the public-safe result summary is [fixtures/observed_wrapper_behavior.json](fixtures/observed_wrapper_behavior.json). Global user settings and the installed v1 guard stayed byte-identical, and all preexisting enrollment markers were retained.

### What this fixes and what it cannot guarantee

The wrapper addresses the observed truncated **child-output** failure by requiring an explicit validated verdict and making external denial depend on exit 2 rather than stdout JSON. The seven-call observation supports this on the tested Claude version and harness, not every possible failure mode or host. It does not prove that a checker inspected its input correctly; a trusted checker that emits a valid but wrong pass is still accepted.

It does not protect against disabled/suppressed hooks, failed or suppressed enrollment, skipped setting sources/hosts, a replaced or corrupted wrapper that exits 0, arbitrary changes to the trusted checker, loss of exit status, or untested termination behavior. A wrapper/interpreter failure still relies on Claude's `onFailure: block` contract. A deliberately spawned descendant of a replaced checker is outside the cleanup guarantee; the shipped checker does not spawn descendants. Codex, browser, web, MCP, other clients, and other machines remain uncovered.

**No live upgrade occurred.** The active Mac still runs the older v1 direct JSON hook. Repository `guard.py`/`manage.py` changed for a future reviewed install, but active user settings and installed source did not. Enabling this wrapper requires separate approval for a safe-checkpoint selective uninstall/test/install; this PR does not authorize it. No new credentials, security bypass, network permissions, or detection rules were introduced.

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
