# GitHub status readers

Use these tools when you want a repeatable readout of a PR's current signals or a stable view of an open PR queue. They read GitHub; they do not post comments, resolve threads, modify branches, or authorize merges.

| Resource | Use it for | Guide |
| --- | --- | --- |
| `pr_status.py` | Current-commit reviews, unresolved threads, and checks for one PR | [PR status: commands, output and exits](PR_STATUS.md) |
| `queue_snapshot.py` | Two matching complete snapshots of open PRs | [Queue snapshot: commands, output and exits](QUEUE_SNAPSHOT.md) |

## Prerequisites and installation

- Python **3.10 or later**.
- A separately installed [GitHub CLI](https://cli.github.com/manual/installation), available as `gh` on PATH.
- An authenticated GitHub identity with access to the selected repository.

No Python packages need installation. Clone or download the repository and run the scripts from its root:

```sh
python3 --version
gh --version
python3 tools/github-status/pr_status.py --help
python3 tools/github-status/queue_snapshot.py --help
```

Keep `github_api.py` beside both scripts if copying the tool directory elsewhere. New resources use original instructions and invented examples under the repository's [MIT license](../../LICENSE); the separately installed GitHub CLI has its own license and is not bundled.

## Authentication and permission scope

If the CLI is already authenticated, reuse that approved identity. Otherwise the interactive browser flow is:

```sh
gh auth login --hostname github.com --web
```

Run login yourself; it may ask you to select Git protocol and account settings. The readers never log in, alter credentials, or request additional permissions. Do not put a token in a command argument, source file, fixture, screenshot, or issue. If you use an environment-provided credential, configure it privately through your normal credential manager rather than copying an example token.

The data needed are repository metadata and refs, PR/review/thread information, and commit check/status results. When choosing fine-grained credentials or an app identity, review repository selection and the **read** permission areas for Metadata, Contents, Pull requests, Commit statuses, and Checks where available. This is a list of required data areas, not a universally tested token recipe: GraphQL field support, credential types, organization approval and host policy can vary. An inaccessible field causes failure rather than a partial success.

The standard CLI login is broader than these scripts. The [CLI login manual](https://cli.github.com/manual/gh_auth_login) documents `repo`, `read:org`, and `gist` for classic-token login; those scopes are not proof that a credential is read-only. Use your approved least-privilege setup. [GitHub's fine-grained permission reference](https://docs.github.com/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) describes the individual permission areas. Do not broaden permissions automatically when a read fails.

API calls use the CLI's configured host and identity. From a checkout, omitting `--repo` asks `gh repo view` to discover its repository. For predictable use, pass `--repo owner/repository`; names in the form of URLs are rejected. These tools are tested against GitHub.com; other hosts and policies may behave differently.

## Agent invocation

These are Python commands, not installed skills. Give an agent the tool guide and a bounded read request:

> Read tools/github-status/PR_STATUS.md. Run the PR status reader for PR 2 in walters954/ai-coding. Report the exit code and reasons. Do not post, push, resolve threads, or merge.

Replace the repository and PR number with your authorized target. Public-repository reads are still network calls. Reports from private repositories remain private: the queue output includes base-branch names and commit IDs, while the PR report omits review bodies and usernames.

## Offline tests and example output

From the repository root:

```sh
python3 -m unittest discover -s tools/github-status/tests -v
python3 tools/github-status/tests/example_output.py
```

Both commands use invented responses and make no network calls. The second emits `synthetic_pr` and `synthetic_queue` reports; see [the saved synthetic output](examples/synthetic-output.json). [fixtures.py](tests/fixtures.py) contains the corresponding synthetic inputs. Pagination, partial reads, changed heads, outdated unresolved threads, stale approvals, failed checks and changing queues are tested.

## Shared troubleshooting and limits

| Symptom | Action |
| --- | --- |
| `gh` missing or timed out | Install the CLI or check network connectivity; each CLI call times out after 30 seconds. |
| Repository cannot be discovered | Run inside the intended checkout or pass `--repo owner/repository`. |
| GitHub read failed | Check the selected account, repository access, organization approval and credential permissions locally. Raw CLI errors are suppressed because they can contain private context. |
| Partial/unsupported response | Do not treat it as an empty queue or green PR. Retry after checking access; the API schema or host may differ. |
| API/rate-limit failure | Stop and wait for access or rate limits to recover; these commands do not automatically expand permissions or retry indefinitely. |
| Import error for `github_api` | Keep all three Python files in the same directory and run by the documented script path. |
| Command exits nonzero | Read the tool-specific exit table. Exit 1 can be a valid PR assessment, not a transport failure. |

GraphQL pagination is bounded to 1,000 pages per connection. Connections are fully paginated, but GitHub does not provide a single transaction across all these reads. A later review, check update, new PR, or push can change the answer immediately after the last read. Neither tool replaces the actual repository review, deployment policy, or human merge decision.
