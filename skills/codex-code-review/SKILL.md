---
name: codex-code-review
description: Get an independent, second-opinion code review of a diff using the OpenAI Codex CLI (`codex exec`), then triage and act on its findings. Use when the user says "use codex to review this", "get a codex review", "second opinion on this diff with codex", "have codex check my changes", "codex code review", "run codex on this PR/branch", or pairs "codex" with reviewing/checking code. Complements (does not replace) the human review and the repo's own `/review` — it's an adversarial cross-check before shipping.
allowed-tools: Bash(codex *), Bash(git *), Bash(gh *), Read, Grep, Agent
version: 1.0.0
metadata:
  maintainer: Warren Walters (@walters954)
  last_updated: 2026-07-25
  stability: stable
  repo: walters954/ai-coding
---

# Codex Code Review

Use the **OpenAI Codex CLI** (`codex`, package `codex-cli`) to get an independent review of a
diff — a different model/harness looking at the same change before it ships. It's a cross-check,
not a replacement: it catches things one reviewer's mental model misses. Treat its findings as
*claims to verify*, never as truth to apply blindly.

This skill is the repeatable version of a review that worked well in practice: Codex confirmed a
design was sound but surfaced that a "never touch prod" invariant was only *assumed*, not
*enforced* — a real gap the primary author had missed.

## When to reach for it

- Before opening / merging a non-trivial PR, for a second opinion on correctness, security, and simplicity.
- After you've written a change and want an adversarial pass ("what did I miss?").
- When the user explicitly asks for a "codex review".

For a quick self-check, run it inline. For anything sizeable, **run it as a sub-agent** (see below)
so the noisy tool output stays out of your main context and you keep only the findings.

## Prerequisites (check first, fail fast)

```bash
codex --version                 # expect: codex-cli <version> (developed against 0.145.0)
test -f ~/.codex/auth.json && echo "authed" || echo "NOT authed"
```

- If `codex` isn't found: `npm i -g @openai/codex` (or Homebrew), then stop and tell the user.
- If not authenticated: Codex needs a browser login the user must do themselves. Ask them to run
  `codex login` (or `! codex login` in-session) — do **not** try to auth headlessly. `CODEX_API_KEY`
  / `OPENAI_API_KEY` also work if set.
- Never fabricate a review. If Codex errors or can't auth, report the exact error and stop.

## The core command

Codex reviews run **non-interactively** through `codex exec`, in a **read-only sandbox** (a review
never needs to write), pointed at the repo with `-C`:

```bash
codex exec -s read-only -C <repo-dir> "<focused review prompt>"
```

- `-s read-only` — sandbox mode; review only reads. (Other modes: `workspace-write`, `danger-full-access` — not for reviews.)
- `-C <dir>` — working root. Use the absolute path of the worktree/repo you want reviewed.
- `-m <model>` — optional model override (a capable default is selected automatically).
- `codex exec` never prompts — it runs to completion and prints the review to stdout.

There is also a dedicated subcommand, `codex exec review`, with scope flags:

```bash
codex exec review --uncommitted          # staged + unstaged + untracked changes
codex exec review --base <branch>         # everything the branch adds vs <branch>
codex exec review --commit <sha>          # just the changes in one commit
```

## ⚠️ The gotcha that will bite you

In `codex exec review`, a **custom prompt is mutually exclusive with the scope flags.** This fails:

```
codex exec review --base origin/main "focus on the auth logic"
# error: the argument '--base <BRANCH>' cannot be used with '[PROMPT]'
```

So you must choose:

- **Default review, scoped diff:** `codex exec review --base <branch>` (or `--commit`, `--uncommitted`)
  — no custom instructions, Codex uses its built-in review rubric.
- **Custom focus prompt:** drop the subcommand and use plain `codex exec` with a prompt that
  *names the diff itself*, e.g. "Review the changes in `git diff HEAD~1..HEAD`, focusing on …".
  This is the more powerful path — it lets you steer what Codex scrutinizes.

**Scope caution:** `origin/main` often sits *ahead* of your branch's base, so `git diff origin/main`
floods the review with unrelated files (other people's merges show up as reverse-diffs). Prefer
scoping to the branch's own commits — `--commit <sha>`, or a prompt referencing
`git diff <merge-base>..HEAD` / `git diff HEAD~<n>..HEAD`. Confirm the intended diff first:

```bash
git -C <repo-dir> --no-pager diff --stat <base>..HEAD
```

## Writing a good focus prompt

Generic prompts get generic reviews. Name the change, then the failure modes you actually worry about:

```
Review the diff in `git diff HEAD~1..HEAD` for correctness, security, and simplicity.
Context: <one-sentence what the change does and why>.
Focus especially on: (1) <invariant that must hold — e.g. "X can never reach prod">;
(2) <the trickiest new logic>; (3) any race / injection / error-handling gap in <area>;
(4) whether the docs/instructions match the code. Flag concrete bugs with file:line and a
severity, and call out anything over-engineered or simpler.
```

The single highest-value instruction: **ask it to check whether your invariants are actually
enforced, not just intended.** That's where second opinions pay off.

## Running it as a sub-agent (recommended for real reviews)

Delegate the run so the transcript noise stays out of your context and you keep only the conclusion.
Launch a general-purpose agent (synchronously if you need the result to act on) and tell it to:

1. `cd`/`-C` into the exact repo dir, confirm the diff with `git diff --stat <base>..HEAD`.
2. Run the Codex command (handle the prompt-vs-scope gotcha; scope to the branch's own commits).
3. Return **Codex's findings verbatim**, plus a distilled list — one line each:
   `[severity] file:line — issue — suggested fix` — and Codex's overall verdict.
4. **Not modify any code** — review only.

If Codex fails/hangs (>~8 min), have it retry once with a narrower scope and, failing that, report
the exact error rather than inventing findings.

## Triage: what to do with the findings

Codex is confident even when wrong — **verify before you act.**

1. For each finding, open the cited `file:line` and confirm the claim is real in *this* code.
2. Keep the substantive ones — correctness, security, an unenforced invariant. Apply fixes.
3. Note (don't reflexively implement) low-value / stylistic / speculative ones; say why you skipped them.
4. Discard anything that misreads the code, and say so.
5. After applying fixes, **re-run the project's checks** (typecheck / tests / build / lint) — a review
   fix still has to pass CI.
6. Record the audit trail: a short PR comment ("Ran Codex; it confirmed X, flagged Y; fixed A, skipped B")
   is worth a lot to reviewers and future-you.

## Worked example (real)

Reviewing a Salesforce guardrails branch:

```bash
# confirm the branch's own diff (origin/main had advanced past the base)
git -C <worktree> --no-pager diff --stat HEAD~1..HEAD

# custom focus prompt via plain `codex exec` (NOT `review`, because of the prompt/flag conflict),
# scoped to the commit's diff, read-only
codex exec -s read-only -C <worktree> \
  "Review the changes in \`git diff HEAD~1..HEAD\` for correctness, security, and simplicity.
   Focus on: (1) whether the guard's 'never deploy to prod' invariant is actually *enforced*, not
   assumed; (2) the second-org auth path; (3) error-handling gaps. Flag bugs with file:line + severity."
```

Codex confirmed the happy path was sound, but flagged that nothing verified the target org was
actually a sandbox — a misconfigured connector could still hit prod. That became a real fix
(verify `IsSandbox=true` after login, else refuse), turning an assumed invariant into an enforced
one. Findings that misread the code were noted and dropped; the survivors got fixed and re-tested.

## Notes

- Keep reviews **read-only**. If you want Codex to *apply* fixes, that's a separate, deliberate
  `workspace-write` run — not part of a review.
- This complements the human review and any repo `/review` or `/code-review` command; run whichever
  the situation calls for, and don't let a green Codex pass substitute for understanding the change.
