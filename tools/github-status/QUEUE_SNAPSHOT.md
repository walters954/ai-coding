# Queue snapshot

Use `queue_snapshot.py` when you want a bounded read of all open pull requests and want to avoid treating a partial response, transient unknown mergeability, or changing queue as a settled result. It does not decide which PRs should merge.

## Setup and exact commands

Use the shared [prerequisites and authentication guide](README.md#authentication-and-permission-scope): Python 3.10+, authenticated `gh`, repository read access, and the neighboring `github_api.py`. No Python packages need installation.

From the repository root:

```sh
python3 tools/github-status/queue_snapshot.py --help
python3 tools/github-status/queue_snapshot.py --repo walters954/ai-coding --attempts 4 --delay 1
```

The second command reads a public repository; its output changes as PRs change. To discover the repository from a different checkout, run this from that checkout:

```sh
python3 /path/to/ai-coding/tools/github-status/queue_snapshot.py
```

An agent can invoke it with: “Read this guide, take a queue snapshot for the named repository, and report the snapshot or exact read failure. Do not update branches, reviews, or PRs.”

## Synthetic input and output

From the repository root, with no authentication or network:

```sh
python3 tools/github-status/tests/example_output.py
```

The synthetic queue input consists of two identical successful reads: default branch `trunk`, commit `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, and no open PRs. The `synthetic_queue` entry of the output is:

<!-- synthetic_queue:start -->
```json
{
  "default_branch": {
    "branch": "trunk",
    "head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "merge_authorized": false,
  "prs": [],
  "reads": 2,
  "status": "stable_snapshot"
}
```
<!-- synthetic_queue:end -->

For a nonempty queue, each `prs` entry contains a PR number, head commit, base branch, draft flag, mergeability, merge state, review decision and check-rollup state. See [fixtures.py](tests/fixtures.py) for an invented one-PR response and [the tests](tests/test_status.py) for multi-page and changing-queue cases. There is no live fixture-input CLI flag.

## Stability and pagination

The default branch is discovered from GitHub rather than assumed to be `main`. Every open-PR page is read; duplicate identities, missing fields, cursor loops, or mismatched head/commit IDs fail the read. The default-branch ref is read again after pagination and must match the initial ref.

Two consecutive identical complete snapshots with computed mergeability establish `stable_snapshot`. Empty queues require two successful reads too. Unknown mergeability resets agreement; it cannot produce success. A failed API call stops immediately rather than being interpreted as zero PRs.

A conflicted, draft, blocked or unapproved PR can be part of a stable snapshot. **Stability means those observations agree, not that any PR can merge.** `merge_authorized` is always false. The report contains only check-rollup state, not full checks, required-rule evaluation, reviews, review threads or deployment evidence.

## Options and exit codes

| Option | Default | Valid range |
| --- | --- | --- |
| `--repo owner/repository` | Discover from current checkout | Explicit repository name; not a URL |
| `--attempts` | 4 | Integer 2–20 |
| `--delay` | 1 second | Finite number 0–30 seconds between reads |

Each individual CLI call has a 30-second timeout; a paginated read can take longer than one call. Delay is a pause between snapshots, not a polling service or a promise of exact wall-clock duration.

| Exit | Meaning |
| --- | --- |
| 0 | JSON `stable_snapshot` obtained; no merge approval is implied |
| 2 | Invalid input, read/validation error, or queue failed to stabilize within the attempt budget |

There is no exit 1 or 8 for this command. Successful JSON goes to standard output. Failure text goes to standard error; it is never a successful empty queue.

A safe argument-validation example that makes no API calls:

```sh
python3 tools/github-status/queue_snapshot.py --attempts 1
```

Expected: a message requiring 2–20 attempts and exit 2.

## Troubleshooting and limits

- **Unknown mergeability:** wait and rerun. Increasing the bounded attempt count may help computation settle; it does not fix conflicts.
- **Queue changes continuously:** choose a later moment or report that no stable snapshot was obtained. Do not freeze other people's work to satisfy the tool.
- **Default branch changes during paging:** the read is discarded. Retry with current state.
- **A stable result contains a failing check or conflict:** that is expected; use the [PR status reader](PR_STATUS.md) and the normal review process for details.
- **Access, schema, rate-limit or CLI failure:** consult the [shared guide](README.md#shared-troubleshooting-and-limits). Do not grant wider permissions automatically.
- **Private repository output:** branch names and commit IDs can be sensitive. Keep real reports out of public logs and screenshots.

Matching reads are evidence of temporary agreement, not a transactional snapshot or proof that no update happened between reads. State can change immediately afterward. The tool neither modifies the queue nor supplies permission to merge it.
