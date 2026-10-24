# Mac verification profile

Verified 2026-10-24 against Claude Code 2.1.310 and Python 3.14.4 on one authorized Mac. Other hosts and Windows are unverified and not installed.

## Evidence

- Eight fake-input tests passed from this canonical package, including scratch install, selective uninstall, reinstall, settings preservation, and enrollment boundaries.
- Six protocol assertions passed through the installed handlers. Candidate shell commands remained inert data; no example.invalid request was made and no real secret was used. The fake enrollment marker was removed.
- A separate fresh Claude session listed the user PreToolUse handler with matcher `^Bash$` in `/hooks` and successfully enrolled through SessionStart. It exited without a model prompt.
- The installed runtime matched the reviewed `guard.py` byte for byte. Its SHA-256 is `2434b306ed664d0eeb57ecf7579168a64388a0513b7637b4868f3fd1a3d9145c`.
- Existing user hooks and settings were preserved. Two handlers were added: startup-only enrollment and Bash inspection. Existing running sessions remained unenrolled and untouched.
- The installed runtime is an independent fixed copy under the user's Claude configuration directory. It does not depend on the repository checkout or a task staging folder.

Real model-generated Bash interception and in-Claude timeout behavior were **not tested**. Missing-runtime/timeout process failures and the configured `onFailure: block` setting were tested separately; Claude's handling relies on its documented contract. Hook loading and registration do not by themselves prove full interception in every host.

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
