---
name: focused-cleanup
description: Simplify only an agreed diff by reusing existing helpers, removing accidental complexity, and cutting clearly wasteful work, while keeping behavior and public API intact. Use after a change works and the user wants it tighter before review.
---

# Focused Cleanup

Make an agreed change smaller and clearer without changing what it does. Every edit must have a concrete benefit.

## Scope

- Agree on the exact diff first: a commit range, the branch compared with its merge base, or a list of files. State whether staged, unstaged, and untracked work is included.
- Edit only lines the diff added or changed, plus the minimum nearby code needed to keep a cleanup coherent.
- Do not reformat, rename, or tidy unrelated code. Do not run a formatter across files outside the diff.

## Workflow

1. **Understand the change.** Read the diff and its tests. Write one sentence describing what it is meant to do.
2. **Find candidates.** For each one, name the concrete benefit: fewer lines to maintain, a single source of truth, a removed failure mode, or measurably less work. No benefit, no edit.
   - *Existing helpers.* Search the codebase for a function, type, or constant that already does the job (by name, signature, or distinctive literal) before keeping new code.
   - *Accidental complexity.* Unused parameters, dead branches, wrappers that add nothing, flags only ever set one way, logic duplicated within the diff, checks for states that cannot occur.
   - *Repeated work.* Recomputation inside loops, duplicate reads, queries, or network calls, one-query-per-item patterns. Change these only when measured or plainly wasteful; do not optimize on guesses.
   - *Decision placement.* Put validation, defaults, and policy in the layer that owns them, for example parsing input once at the boundary instead of re-checking deep inside. Move a decision only when its current location causes duplication or inconsistency.
3. **Propose before editing.** Present a short numbered list. For each item give the location (`path:line`), the change, the benefit, and any risk. Keep items small and independent so the user can accept some and decline others.
4. **Apply accepted items only.** Preserve observable behavior, public signatures, exported names, error types and messages that callers rely on, configuration keys, and data formats. If an item would change any of these, flag it and leave it for a separate decision.
5. **Verify.** Run the relevant tests, linters, and type checks the repository already uses. Add a focused test when a cleanup touches logic without coverage. If something cannot be run, say so.
6. **Report.** List what changed and why, test results (quote failures), items skipped or declined, and tradeoffs deliberately kept, for example: "kept the explicit loop; it reads more clearly than the reduce and costs the same".

## Boundaries

- Do not send code to external review services or tools.
- Do not push, open pull requests, or publish. Leave commits to the user unless asked.
- Do not add dependencies to save a few lines.
- When in doubt, prefer a smaller diff over a sweeping one.
