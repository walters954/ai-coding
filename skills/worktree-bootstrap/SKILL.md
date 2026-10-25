---
name: worktree-bootstrap
description: Inspect a git worktree and produce a setup plan for local development env files and dependencies. Default is read-only inspection and planning. Linking named development env files and installing dependencies each require their own explicit user opt-in.
---

# Worktree Bootstrap

A new linked worktree starts without ignored local files (such as development env files) and without installed dependencies. This workflow inspects the worktree and proposes how to fill those gaps safely.

## Default: inspect and plan only

Unless the user explicitly opts in to a specific action below, do not create, link, copy, install, or modify anything. Produce the plan and stop.

Actions that need their own, separate opt-in:

- **A. Link named development env files.** The user names each file, for example `apps/demo/.env.local`. Approval covers only the files named.
- **B. Install dependencies.** Approved separately from A, for a specific command in a specific directory.

Approval for one action never implies the other. Existing explicit authorization may be reused only when it covers the same named files or exact install command and directory.

Always out of scope: starting the app, running migrations or seeds, logging in, changing authentication, creating or editing credentials, editing `.gitignore`, committing, and pushing.

## 1. Discover the worktree layout

Quote every path; worktree paths may contain spaces.

```sh
git rev-parse --show-toplevel
git rev-parse --path-format=absolute --git-dir
git rev-parse --path-format=absolute --git-common-dir
git worktree list --porcelain
```

- If the git dir and the common dir are the same, the current tree is the main working tree. If they differ, it is a linked worktree. (Older git versions lack `--path-format`; resolve both paths to absolute form before comparing.)
- In porcelain output each record begins with `worktree <path>`. The path is everything after the first space, spaces included. The first record is the main working tree. Records may also carry `bare`, `detached`, `locked`, or `prunable`. Use `git worktree list --porcelain -z` when paths might contain newlines or other unusual characters.
- **Source** is the main working tree, or another worktree the user names. **Destination** is the current linked worktree.
- If the current tree is the main working tree, or the main repository is bare, ask the user which worktree to treat as source.
- Report and skip worktrees that are prunable or missing.

## 2. Inventory env files without reading them

Never read, print, diff, hash, search, or summarize the contents of env files, and never print the process environment (`env`, `printenv`, `set`, `export -p`). Work with names and file types only.

Only consider files the user names. Never glob patterns such as `.env*` and never link whole directories. Accept only relative paths inside both worktree roots; reject `..`, absolute paths, and parent directories that are symlinks. Verify resolved parent directories remain inside the intended roots before linking.

For each named file, run these from the root of the source tree and again from the root of the destination tree:

```sh
f="apps/demo/.env.local"
test -e "$f" && echo "exists"
test -L "$f" && echo "symlink"
git check-ignore -q -- "$f" && echo "ignored"
git ls-files --error-unmatch -- "$f" >/dev/null 2>&1 && echo "TRACKED"
```

**Source must be:** an existing regular file that is not a symlink, ignored by git, and not tracked. Otherwise it is not linkable; report why. Ask the user to confirm it contains development or sandbox credentials; a development-looking filename alone is not evidence of that.

**Destination must be:** ignored by git in the destination tree (ignore rules can differ between branches) and not tracked. If it is not ignored, do not link it, because the symlink could be committed.

| Destination state | Action |
|---|---|
| Absent, and not a symlink | Candidate for linking |
| Regular file | Preserve it; report a conflict |
| Symlink, including a broken one | Preserve it; report its target path from `readlink` |
| Directory | Preserve it; report a conflict |
| Parent directory missing | Report it; do not create directories |

Do not link files that hold production or shared deployment credentials, such as `.env.production`, `.env.prod`, private keys, or cloud credential files, even when they appear in a list. Explain why and suggest development or sandbox credentials instead.

Prefer templates. If the repository has a committed template such as `apps/demo/.env.example`, propose creating the destination file from it so the user fills in sandbox values themselves. That keeps credentials separate between trees. Creating the file is still a write and needs the user's approval; do not print the template's values.

Include these consequences in the plan:

- A symlink points at the same file. Edits in either worktree change it in both, and deleting or moving the source breaks the link.
- Any tool, script, or agent running in the destination worktree gets the same credential access as in the source tree.
- Removing a link later with `rm` on the symlink removes only the link. Confirm with `test -L` first.

## 3. Link files (only with opt-in A)

Re-check each approved file immediately before acting, then create the link without overwriting anything:

```sh
src="<source-tree>/apps/demo/.env.local"
dst="apps/demo/.env.local"
if [ -e "$dst" ] || [ -L "$dst" ]; then
  echo "conflict: $dst already exists; left unchanged"
else
  ln -s -- "$src" "$dst"
fi
```

- Never use force or overwrite flags.
- Afterwards, confirm `test -L "$dst"` succeeds and that `git status --porcelain -- "$dst"` prints nothing. If the link shows as untracked, remove only the link you just created and report it.
- Never stage or commit secret files or symlinks to them.

## 4. Dependencies (plan by default; install only with opt-in B)

Detect signals in the destination tree; do not guess.

- JavaScript: `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`, `bun.lockb`, and the `packageManager` field in `package.json`.
- Python: `uv.lock`, `poetry.lock`, `Pipfile.lock`, `pdm.lock`, `requirements*.txt`.
- Others: `Gemfile.lock`, `Cargo.lock`, `go.sum`, `composer.lock`.

Respect repository configuration and documentation: version files (`.nvmrc`, `.tool-versions`, `engines`), workspace files, package-manager config files, and documented setup scripts or make targets. Package-manager config files can hold registry tokens; note that they exist but do not print their values.

Stop and ask the user when:

- More than one package-manager signal applies to the same project, for example `yarn.lock` next to `package-lock.json`, or a `packageManager` field that disagrees with the lockfile.
- There is no lockfile.
- The required tool or version is not available.
- The repository documents its own bootstrap script.

Propose a lockfile-respecting command for the detected tool and version, such as `npm ci` or `pnpm install --frozen-lockfile`, along with the directory to run it in.

Before asking for opt-in B, state plainly that installing downloads packages and can run lifecycle and build scripts with the user's permissions, and that repository scripts are code too. Show the exact command and directory; approval covers only that. Do not silently add or remove flags such as `--ignore-scripts` or change registry settings; offer them as options if the user wants.

Run the install in the destination worktree only, and do nothing after it: no app start, no migrations, no seed data.

## 5. Report

- **Layout:** main tree, current tree, whether it is linked or main, other worktrees and their status.
- **Env files:** for each named file, the source state, destination state, ignored and tracked status, proposed or completed action, and conflicts.
- **Dependencies:** signals found, proposed command, or the reason for stopping.
- **Pending:** anything awaiting opt-in, and anything that failed, with its output.
