# Diff explainer

Use this skill when a reviewer, teammate, or future maintainer needs to understand a specific code change. It produces one offline HTML page: the problem, an invented before/after example, a walkthrough, limits, and five interactive questions. It is an explanation workflow, not a code review verdict.

## Requirements and installation

You need a local Git checkout and an agent that can read files, run read-only Git commands, and write the resulting HTML. No API key, remote model reviewer, Node package, or build step is required by the skill. Your agent's own authentication is separate.

From the root of this repository, copy the complete directory into a compatible agent's skills directory. For a project using `.claude/skills`, run these commands from that project's root, replacing the source path with your clone:

```sh
mkdir -p .claude/skills
cp -R /path/to/ai-coding/skills/diff-explainer .claude/skills/
```

Check that the destination does not already contain a version you want to preserve before copying. You can also skip installation and give an agent the `SKILL.md` path directly.

## Invoke it

From an agent session in your target checkout, use a prompt like this (the paths and change are invented):

> Read skills/diff-explainer/SKILL.md and use it to explain the committed retry-counter change on this branch compared with its merge base with the default branch. Exclude staged, unstaged, and untracked work. Save the offline explanation to /tmp/retry-explained.html. Keep the code and explanation local; do not open or publish the file.

That direct path assumes this repository is the current checkout. After installing the skill elsewhere, ask the agent to use `diff-explainer`, or give it the installed `SKILL.md` path. Name a base commit or branch explicitly when the local default-branch reference is missing or stale.

Expected result: `/tmp/retry-explained.html`, a short report naming the scope and skipped files, and a clear statement that source code was inspected rather than executed. The example output path is temporary and may be cleaned up by the operating system; choose another local destination when you need to keep the result.

## Try the included example without an agent

[example.html](example.html) contains only invented code and data. Open that file in a browser using your file manager. It needs no server or network connection. Try a wrong answer, complete the five questions, then select **Reset answers**. The correct-answer positions vary; the score should reach 5 of 5 after choosing all correct answers.

The example explains a retry cap changing from four calls to three, immediate failure for permanent errors, and the remaining absence of retry delays. The HTML is illustrative, not a production retry library.

## Limits and troubleshooting

- **The agent cannot find the skill:** give it the exact local `SKILL.md` path. Skill discovery and command syntax vary by agent.
- **No default branch is found:** supply a known base ref. Local remote references can be stale; the skill does not fetch automatically.
- **The diff is too large:** choose a commit range or smaller path set before generating the explanation.
- **The page has no interactive feedback:** enable JavaScript for this local file or read the included answer key. No external scripts are needed.
- **A secret-shaped value appears in the source:** omit it from the HTML and report that something was skipped; do not reproduce the value.
- A generated explanation can be wrong. Review code quotations, examples, and answer keys before sharing. Private input can produce private output even though the HTML is offline.

This is an agent instruction resource, so it has no CLI exit codes. A useful completion report states whether the file was written, the covered scope, and anything unverified. See [SKILL.md](SKILL.md) for the complete workflow and the repository [MIT license](../../LICENSE).
