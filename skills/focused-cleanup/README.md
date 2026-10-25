# Focused cleanup

Use this skill after a change works and you want a smaller, clearer diff before review. It searches for reusable helpers, accidental complexity, avoidable repeated work, and decisions placed in the wrong layer. Every proposed edit needs a concrete benefit; behavior and public interfaces stay intact.

## Requirements and installation

You need a local Git checkout, an agent with permission to read and edit the agreed files, and the project's existing test tools. No separate API credentials, external reviewer, or additional package dependency is required. Your agent's own authentication is separate.

For a project using `.claude/skills`, run these commands from that project's root, replacing the source path with your clone:

```sh
mkdir -p .claude/skills
cp -R /path/to/ai-coding/skills/focused-cleanup .claude/skills/
```

Check for an existing destination before copying. Installation is optional: an agent can read the `SKILL.md` file directly.

## Invoke it

From an agent session in this repository, use a prompt like this:

> Read skills/focused-cleanup/SKILL.md. Inspect only the committed changes in my named commit range. Exclude staged, unstaged, and untracked work. List small cleanup proposals with a location, concrete benefit, and risk. Do not edit until I choose the proposals; do not commit or push.

Replace “my named commit range” with actual commit refs. In another project, ask the agent to use the installed `focused-cleanup` skill or give it the installed `SKILL.md` path.

An invented input might add two equivalent string-trimming helpers in the same change. An expected first response is:

```text
Proposal 1 — src/demo/labels.py:12
Reuse the existing trim_label helper for the new caller.
Benefit: one place to maintain the same whitespace rule.
Risk: confirm both callers intentionally use identical empty-input behavior.
No files changed. Awaiting selected proposals.
```

After reviewing the proposal, a follow-up such as “Apply proposal 1 only, then run the existing label tests” authorizes that bounded edit and verification. Expected final output names the change, the tests run, and any deliberate duplication or tradeoff retained.

## Limits and troubleshooting

- **No meaningful cleanup exists:** a report saying no changes are justified is a valid result.
- **A helper looks similar but has different behavior:** preserve the separate implementation and explain the difference.
- **An edit changes an API, error contract, or data format:** leave it for a separate decision.
- **Tests need unavailable services or credentials:** report which checks could not run. Do not invent a passing result or change authentication.
- **The agent proposes a repository-wide rewrite:** restate the exact diff and reject unrelated edits.
- **The agent cannot discover the skill:** give it the exact local `SKILL.md` path.

The skill does not replace correctness or security review. It does not send source to external reviewers, install dependencies, push, or publish. There are no CLI exit codes: report whether proposals were applied and whether each verification command passed, failed, or could not run. See [SKILL.md](SKILL.md) and the repository [MIT license](../../LICENSE).
