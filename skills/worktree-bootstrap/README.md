# Worktree bootstrap

Use this skill when a new linked Git worktree needs local development setup. Its default result is an inspection report and a plan. It can link individually named development environment files and install dependencies only under separate, explicit authorization.

## Requirements and installation

You need Git with worktree support, an agent that can inspect file names and run local Git commands, and an existing source checkout. Dependency tools are needed only if installation is authorized. No new API authentication is required by this skill; private package registries may need credentials that the user configures separately.

For a project using `.claude/skills`, run these commands from that project's root, replacing the source path with your clone:

```sh
mkdir -p .claude/skills
cp -R /path/to/ai-coding/skills/worktree-bootstrap .claude/skills/
```

Check for an existing destination first. Alternatively, give an agent the `SKILL.md` path directly; installation is not required for that method.

## Start with a plan

From an agent session in this repository, use this prompt:

> Read skills/worktree-bootstrap/SKILL.md. Inspect the current linked worktree and plan setup only. Consider the named development file apps/demo/.env.local without reading its contents. Detect the package manager. Do not create links, install dependencies, start an app, or change authentication.

In another project, ask the agent to use `worktree-bootstrap` or give it the installed `SKILL.md` path. `apps/demo/.env.local` is an invented name: replace it with the exact development file you want considered. Never paste its values into the prompt.

An invented response might look like this:

```text
Layout: linked worktree; source and destination roots identified.
Env: apps/demo/.env.local exists as an ignored, untracked regular file in source.
Destination: ignored, untracked, absent; parent is a regular directory.
Proposed action: link this named file after development-only confirmation.
Dependencies: package-lock.json found; propose npm ci in the destination root.
Changes made: none. Awaiting separate opt-in for links and installation.
```

## Opt in to actions separately

First verify the proposed paths. A symlink shares the same credential file: edits affect both worktrees, and tools in the new worktree gain access to it.

An explicit link request could be:

> The named file contains only development credentials. Link only apps/demo/.env.local from the proposed source checkout into this linked worktree. Preserve any existing file or symlink. Do not read values or install dependencies.

An installation request is separate:

> Run the proposed npm ci command in this linked worktree's root. I understand it downloads packages and may execute lifecycle scripts. Do not link environment files, start the app, or run migrations.

These are examples, not commands to execute blindly. Use the package manager, lockfile, directory, and exact command established by the plan. Existing explicit authorization applies only when it covers those same files or that exact command and directory.

## Limits and troubleshooting

- **Current checkout is the primary tree or repository is bare:** identify the intended source and linked destination before acting.
- **Source is tracked, not ignored, a symlink, or not a regular file:** do not link it.
- **Destination already exists, including a broken symlink:** preserve it and report the conflict.
- **A parent directory is linked, missing, or resolves outside the intended root:** stop that link operation. Do not create directories or overwrite anything to make it work.
- **Development-looking filename contains production credentials:** do not link it. Use separate development or sandbox access instead.
- **Multiple lockfiles disagree, no lockfile exists, or the required tool is missing:** report the signals and request a specific setup choice.
- **Registry authentication fails:** report the failure without printing configuration values or environment dumps; let the user handle authentication.
- **Install fails:** report the actual command and its failure, redact sensitive output, and stop. Do not silently retry with different registries or script flags.

No credentials or environment values are read, printed, copied, or committed. A symlink still grants access to the underlying file. Templates and separate sandbox credentials are preferred when available. The workflow does not start applications, run migrations, commit, or push.

This is an agent workflow, not a CLI: there are no skill-level numeric exit codes. The final report names each completed, skipped, conflicted, pending, or failed action and the result of an authorized install. See [SKILL.md](SKILL.md) and the repository [MIT license](../../LICENSE).
