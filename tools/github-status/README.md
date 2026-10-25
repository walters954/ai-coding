# GitHub status readers

Two read-only Python commands for understanding pull requests. Neither modifies a repository, posts a comment, resolves a thread, or authorizes a merge.

Requirements: Python 3.10 or later and an installed, authenticated GitHub CLI (`gh`) with read access to the requested repository. Python uses only its standard library. GitHub CLI is a separately installed dependency; its source is not bundled. These files follow the repository's MIT license.

From this directory:

```sh
python3 pr_status.py 42 --repo example/demo
python3 queue_snapshot.py --repo example/demo
```

`example/demo` is invented. Omit `--repo` to discover the repository from the current checkout. PR numbers are always explicit. API calls use the CLI's configured GitHub host and identity.

## PR status

`pr_status.py` reads a PR's head, all submitted review records, all review threads, and all check/status pages for that exact commit. It rereads the PR header afterward and fails if those signals changed. It separates human and bot review counts at the current commit. Review bodies, titles, usernames, branch names, and thread content are omitted from the report.

A success requires an open, non-draft PR, a current-commit approval, the repository's approved review decision, clean mergeability, observed passing/neutral/skipped check results, no pending or failing results, and no unresolved threads. Outdated unresolved threads still block success. For each known reviewer, the latest submitted review at the current commit determines their observed state. A missing author cannot establish approval. This conservative summary does not reproduce every repository ruleset or review-dismissal policy.

| Exit | Meaning |
| --- | --- |
| 0 | Observed signals satisfied; human review and merge authorization remain separate |
| 1 | At least one signal needs attention |
| 8 | Remaining signals are still waiting, with no known attention item |
| 2 | Read, validation, or consistency failure; do not treat this as a clean result |

Absent checks do not count as passing. GitHub may report a skipped check as successful while a particular repository expects stronger evidence; review the actual required-check policy before acting. No command can guarantee that state will remain unchanged after its final read.

## Queue snapshot

`queue_snapshot.py` discovers the default branch, paginates all open PRs, verifies each returned commit matches its head, and confirms the default branch did not change while paging. It requires two consecutive identical snapshots with computed mergeability. A clean empty queue also requires two successful reads. Conflicting or blocked PRs may appear in a stable snapshot: **stable means the observations agree, not that the PRs can merge**.

The report includes PR numbers, commit IDs, base branch names and summary states. Treat output from private repositories as private. This tool does not collect full checks, review threads, required rules, or deployment policy; use the individual PR reader and normal repository review process for more detail.

`--attempts` defaults to 4 (range 2–20); `--delay` defaults to 1 second (range 0–30). Read errors stop immediately with exit 2. Unknown or changing state that never stabilizes also exits 2. API calls have a 30-second timeout, and pagination has a 1,000-page safety ceiling.

## Offline tests and example output

```sh
python3 -m unittest discover -s tests -v
python3 tests/example_output.py
```

Tests use invented responses and make no network calls. The example emits a synthetic PR report and queue snapshot; it never runs `gh`. Pagination, partial responses, moved heads, unresolved reviews, stale approvals, failed checks and changing queue state are covered. Keep real output and authentication data out of commits and shared screenshots.
