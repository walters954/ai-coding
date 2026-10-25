# Skills

Each skill is a folder containing a `SKILL.md` file (with YAML `name` and `description` front matter) plus any supporting files. To use one, copy its directory into the skills folder of a tool that supports this format. Locations and supported features vary by tool, so check your tool's documentation; compatibility across tools is not automatic.

```sh
# Example: copy one skill into your tool's skills folder
cp -R skills/diff-explainer <your-tool-skills-folder>/

# Or copy several
cp -R skills/focused-cleanup skills/worktree-bootstrap <your-tool-skills-folder>/
```

The three new skills below do not push, publish, or send code to outside services. The existing review skill invokes a separately authenticated reviewer when requested.

## [diff-explainer](diff-explainer/README.md)

Explains an explicitly scoped, public or user-authorized diff as a single offline HTML page: the problem, an invented before/after example, a walkthrough, risks and limits, and five interactive questions. Inspection is read-only, the base branch is discovered rather than assumed, and the output is written only where the user chooses. See [the offline example](diff-explainer/example.html) for a sample page that needs no build step.

## [focused-cleanup](focused-cleanup/README.md)

Simplifies only an agreed diff: reuses existing helpers, removes accidental complexity, and cuts clearly wasteful work while keeping behavior and public API intact. Proposes small edits for approval, runs existing tests, and reports the tradeoffs it kept.

## [worktree-bootstrap](worktree-bootstrap/README.md)

Inspects a git worktree and produces a setup plan. By default it only inspects and plans. Linking named development env files and installing dependencies each require a separate, explicit opt-in. It never reads env values, never overwrites existing files or symlinks, and stops when package-manager signals conflict.

## codex-code-review

Existing skill, maintained separately from the three above. See its own [SKILL.md](codex-code-review/SKILL.md) for usage and requirements.

## Related tools

The Python tools live in [tools/github-status](../tools/github-status/README.md) and are separate from these skills.

## License and dependencies

The new instructions and invented example follow the repository's [MIT license](../LICENSE). No third-party text, fonts, images, or design assets are bundled. Skills need a compatible agent and local Git; cleanup and setup may use the project's own tools after authorization. The GitHub readers require Python and a separately installed GitHub CLI, with no Python package dependencies.
