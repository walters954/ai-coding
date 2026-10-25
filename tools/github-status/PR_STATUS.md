# PR status

Use `pr_status.py` to distinguish current-commit reviews from stale approvals and to identify unresolved threads, pending checks, failed checks, draft state and mergeability signals. It summarizes observed signals; it never performs or authorizes a merge.

## Setup and exact commands

Follow the shared [prerequisites and authentication guide](README.md#authentication-and-permission-scope). You need Python 3.10+, authenticated `gh`, repository read access, and the neighboring `github_api.py`. No Python package install is required.

Run from the repository root:

```sh
python3 tools/github-status/pr_status.py --help
```

A public read against this repository (PR 2 is the resource PR; its result can change):

```sh
python3 tools/github-status/pr_status.py 2 --repo walters954/ai-coding
```

To inspect the current checkout's GitHub repository, replace 42 with its real PR number:

```sh
python3 /path/to/ai-coding/tools/github-status/pr_status.py 42
```

That command must run with the target checkout as the working directory. In automation, passing `--repo owner/repository` explicitly avoids discovery surprises. PR numbers must be positive integers. No live JSON fixture input flag is supported; use the offline example command below instead.

An agent can invoke it with: “Read this guide, run the reader for the named repository and PR, then report JSON reasons and the exit code without changing GitHub.” It should not interpret exit 0 as permission to merge.

## Synthetic input and output

From the repository root:

```sh
python3 tools/github-status/tests/example_output.py
```

No authentication is needed for that example. The invented PR input is PR 42: open, not a draft, one human approval on commit `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, one successful check, no threads, approved repository review decision, and clean mergeability. See [fixtures.py](tests/fixtures.py) for its exact data structure.

The `synthetic_pr` entry of the emitted JSON is:

<!-- synthetic_pr:start -->
```json
{
  "checks": {
    "failed": 0,
    "pending": 0,
    "total": 1
  },
  "current_commit_reviews": {
    "bot": 0,
    "human": 1
  },
  "head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "merge_authorized": false,
  "reasons": [],
  "status": "signals_satisfied",
  "unresolved_threads": 0
}
```
<!-- synthetic_pr:end -->

`head` is the inspected commit. Review counts include only reviews associated with that commit; they do not count every historical review. `reasons` explains unsatisfied or waiting conditions. Review bodies, usernames, title, branch name and thread text are intentionally absent from the report.

## What the assessment means

- All review records, review threads, and checks/status contexts are paginated. A failing check or unresolved thread on a later page is not skipped.
- Reviews are grouped by their recorded commit. An approval on an earlier commit cannot establish current-commit approval.
- For each known author, the latest submitted review at the current commit supplies the observed review state. Bot and human review counts are separate; missing authors cannot establish approval. This conservative rule does not fully reproduce every dismissal or branch-policy rule.
- Every unresolved thread blocks success, including a thread GitHub marks outdated. The reader never resolves it.
- Success additionally requires an open, non-draft PR, an approved repository review decision, at least one observed check result, no failed/pending checks, and clean computed mergeability. Passing, neutral and skipped checks are accepted as observed results; absence of checks is not passing.
- The PR header is reread after collection. A changed head or changed header invalidates the snapshot. Reviews and checks can still change concurrently; this is not an atomic transaction.

## Exit codes

| Code | Meaning | Caller action |
| --- | --- | --- |
| 0 | `signals_satisfied` | Report the observations; obtain any required human approval separately. |
| 1 | `needs_attention` | Read `reasons`, including unresolved threads, stale/missing approval or failures. |
| 8 | `waiting` | No known attention item remains, but checks or mergeability are pending. Rerun later. |
| 2 | Invalid arguments, transport/read failure or incomplete/inconsistent response | Treat status as unknown. Fix the input or access issue; do not assume a green PR. |

If both a known problem and pending state exist, exit 1 takes precedence. Parser errors and read failures go to standard error; a valid assessment JSON goes to standard output even for exit 1 or 8. A shell with `set -e` may stop on a valid nonzero assessment, so handle the documented codes deliberately.

A safe invalid-input check that makes no API calls:

```sh
python3 tools/github-status/pr_status.py 0
```

Expected: an error saying the PR number must be positive and exit 2.

## Limits and troubleshooting

- **Checks pass but status is 1:** inspect the reasons. A draft, old approval, unresolved outdated thread, or missing repository approval is enough.
- **No required-review policy exists:** the repository review decision may be empty. This tool conservatively reports attention rather than inventing approval.
- **Mergeability is unknown:** GitHub may still be computing it. Rerun later; do not update a branch just to force a different result.
- **The head moved during collection:** rerun for the new head. Do not reuse the earlier assessment.
- **No checks are returned:** check access and repository policy; absence can mean no checks ran. It never establishes success.
- **A check is skipped:** the reader accepts that observed conclusion, but your repository may require stronger evidence. Verify policy before acting.
- **Unsupported schema or access error:** use the [shared troubleshooting guide](README.md#shared-troubleshooting-and-limits).

The reader does not enforce all rulesets, prove deployed behavior, distinguish every reviewer authority level, or guarantee that the state remains unchanged. It never supplies merge authorization.
