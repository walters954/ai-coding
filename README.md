<p align="center">
  <a href="https://revenueeng.com">
    <img src="assets/warren.jpg" alt="Warren Walters" width="140" style="border-radius:50%">
  </a>
</p>

<h1 align="center">ai-coding</h1>

<p align="center">
  The Claude Code skills and config I actually use to ship code.
</p>

<p align="center">
  <a href="https://revenueeng.com"><b>Newsletter</b></a> &nbsp;·&nbsp;
  <a href="https://www.youtube.com/@Walters954"><b>YouTube</b></a>
</p>

---

I'm Warren. I write everything in Claude Code, usually with several work streams going at once in
separate worktrees. That's great for throughput and terrible for attention: by the third parallel
stream you are skimming diffs instead of reading them. These are the guardrails I built so that
stops being a problem.

Everything here is small, editable, and meant to be forked. Take what's useful, change what
isn't, delete the rest.

I break down how I use these on [YouTube](https://www.youtube.com/@Walters954), and write up the
ones that earn their keep in [the newsletter](https://revenueeng.com).

## Skills

| Skill | What it does |
| --- | --- |
| [`codex-code-review`](skills/codex-code-review/SKILL.md) | Runs the OpenAI Codex CLI as an independent, read-only second-opinion review of a diff before it becomes a PR, then triages the findings instead of applying them blindly. |

## Projects & Demos

| Project | What it does | Tech Stack |
| --- | --- | --- |
| [`jev-account-dedupe`](projects/jev-account-dedupe) | CRM Account Deduplication using Jev System One evaluation model on Vercel AI Gateway & TypeSafe AI. Evaluates duplicates with zero generation tokens, ~50–100ms latency, collapsible presentation panels, and live cost comparison vs traditional LLMs. | Next.js 16, TypeScript, TypeSafe AI SDK, Vercel AI SDK, Tailwind CSS |

More to come: worktree setup, close-out, and my `CLAUDE.md` conventions.

## Install

Copy a skill directory into your project's `.claude/skills/`:

```bash
git clone https://github.com/walters954/ai-coding.git
cp -R ai-coding/skills/codex-code-review /path/to/your-project/.claude/skills/
```

Or make it available in every project by linking it into your user scope:

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/ai-coding/skills/codex-code-review" ~/.claude/skills/codex-code-review
```

Claude Code follows symlinks for skill discovery, so linking beats copying. One source of truth,
nothing to re-sync when you edit a skill.

A skill's invocable name is its **directory name**, not the `name:` in the frontmatter.

## Why a second model reviews the code

The review skill exists because of one specific failure mode. A model that wrote the code is not
a neutral reviewer of it. It knows what it meant, so it reads its own intent back into the diff.

The highest-value thing you can ask an outside reviewer: **are my invariants actually enforced,
or only intended?**

That question caught a real one for me. A branch had a "never deploy to production" rule that
was genuinely in the design and genuinely in the instructions, and nowhere in the code. A
misconfigured connector would have sailed straight through. The rule existed in my head. The
review is what moved it into the codebase.

Treat any review output as claims to verify, never as truth to apply. These models are just as
confident when they're wrong.

## License

MIT. See [LICENSE](LICENSE).
