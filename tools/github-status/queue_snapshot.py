#!/usr/bin/env python3
"""Read a stable open-PR snapshot. Stability is not permission to merge."""
import argparse
import json
import math
import sys
import time

from github_api import (ReadFailure, commit_id, connection, discover_repository,
                        graphql, object_at, repository)

BASE = """query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
 defaultBranchRef{name target{oid}}}}"""
QUEUE = """query($owner:String!,$name:String!,$cursor:String){
 repository(owner:$owner,name:$name){pullRequests(states:OPEN,first:100,after:$cursor){
 pageInfo{hasNextPage endCursor} nodes{id number headRefOid baseRefName isDraft
 mergeable mergeStateStatus reviewDecision commits(last:1){nodes{commit{oid
 statusCheckRollup{state}}}}}}}}"""


def read_queue(repo, api=graphql):
    owner, name = repository(repo)
    variables = {"owner": owner, "name": name}
    def base():
        ref = object_at(api(BASE, variables), "repository", "defaultBranchRef")
        branch = ref["name"]
        if not isinstance(branch, str) or not branch:
            raise ReadFailure("Default branch is missing.")
        return {"branch": branch, "head": commit_id(object_at(ref, "target", "oid"))}
    try:
        first = base()
        rows = connection(lambda cursor: object_at(
            api(QUEUE, dict(variables, cursor=cursor)), "repository", "pullRequests"))
        if base() != first:
            raise ReadFailure("Default branch changed during pagination.")
        prs, numbers = [], set()
        for row in rows:
            number = row["number"]
            head = commit_id(row["headRefOid"])
            if type(number) is not int or number < 1 or number in numbers:
                raise ValueError("invalid PR number")
            numbers.add(number)
            if type(row["isDraft"]) is not bool or not isinstance(row["baseRefName"], str):
                raise ValueError("invalid PR metadata")
            if row["mergeable"] not in {"MERGEABLE", "CONFLICTING", "UNKNOWN"}:
                raise ValueError("invalid mergeability")
            if not isinstance(row["mergeStateStatus"], str):
                raise ValueError("invalid merge state")
            if row["reviewDecision"] not in {None, "APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"}:
                raise ValueError("invalid review state")
            commits = row["commits"]["nodes"]
            if len(commits) != 1 or commits[0]["commit"]["oid"] != head:
                raise ValueError("commit identity mismatch")
            rollup = commits[0]["commit"]["statusCheckRollup"]
            check_state = None if rollup is None else rollup["state"]
            if check_state not in {None, "SUCCESS", "PENDING", "FAILURE", "ERROR", "EXPECTED"}:
                raise ValueError("invalid check rollup")
            prs.append({"number": number, "head": head, "base": row["baseRefName"],
                        "draft": row["isDraft"], "mergeable": row["mergeable"],
                        "merge_state": row["mergeStateStatus"],
                        "review_decision": row["reviewDecision"], "check_state": check_state})
        return {"default_branch": first, "prs": sorted(prs, key=lambda row: row["number"])}
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise ReadFailure("Queue response is incomplete or unsupported.") from error


def stable_snapshot(fetch, attempts=4, delay=1, pause=time.sleep):
    if not 2 <= attempts <= 20 or not math.isfinite(delay) or not 0 <= delay <= 30:
        raise ReadFailure("Use 2–20 attempts and a finite delay between 0 and 30 seconds.")
    previous = None
    for attempt in range(attempts):
        # Read errors remain errors; they are never interpreted as an empty queue.
        current = fetch()
        unknown = any(row["mergeable"] == "UNKNOWN" or row["merge_state"] == "UNKNOWN"
                      for row in current["prs"])
        if not unknown and previous is not None and current == previous:
            return {"status": "stable_snapshot", **current, "merge_authorized": False,
                    "reads": attempt + 1}
        previous = None if unknown else current
        if attempt + 1 < attempts:
            pause(delay)
    raise ReadFailure("Queue did not stabilize within the requested reads.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", help="owner/repository; defaults to current checkout")
    parser.add_argument("--attempts", type=int, default=4)
    parser.add_argument("--delay", type=float, default=1)
    args = parser.parse_args(argv)
    try:
        # Validate before issuing any API reads.
        if not 2 <= args.attempts <= 20 or not math.isfinite(args.delay) or not 0 <= args.delay <= 30:
            raise ReadFailure("Use 2–20 attempts and a finite delay between 0 and 30 seconds.")
        repo = args.repo or discover_repository()
        report = stable_snapshot(lambda: read_queue(repo), args.attempts, args.delay)
        print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except ReadFailure as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
