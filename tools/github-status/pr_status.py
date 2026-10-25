#!/usr/bin/env python3
"""Inspect current-commit PR signals. This command never authorizes a merge."""
import argparse
import json
import sys

from github_api import (ReadFailure, commit_id, connection, discover_repository,
                        graphql, object_at, repository)

HEADER = """query($owner:String!,$name:String!,$pr:Int!){repository(owner:$owner,name:$name){
 pullRequest(number:$pr){number state headRefOid isDraft reviewDecision mergeable mergeStateStatus}
}}"""
REVIEWS = """query($owner:String!,$name:String!,$pr:Int!,$cursor:String){
 repository(owner:$owner,name:$name){pullRequest(number:$pr){
 reviews(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{
 id state submittedAt author{login __typename} commit{oid}}}}}}"""
THREADS = """query($owner:String!,$name:String!,$pr:Int!,$cursor:String){
 repository(owner:$owner,name:$name){pullRequest(number:$pr){
 reviewThreads(first:100,after:$cursor){pageInfo{hasNextPage endCursor}
 nodes{id isResolved isOutdated}}}}}"""
CHECKS = """query($owner:String!,$name:String!,$head:GitObjectID!,$cursor:String){
 repository(owner:$owner,name:$name){object(oid:$head){... on Commit{oid
 statusCheckRollup{contexts(first:100,after:$cursor){pageInfo{hasNextPage endCursor}
 nodes{__typename ... on CheckRun{id status conclusion}
 ... on StatusContext{id state}}}}}}}}"""


def read_pr(repo, number, api=graphql):
    owner, name = repository(repo)
    variables = {"owner": owner, "name": name, "pr": number}
    def header():
        value = object_at(api(HEADER, variables), "repository", "pullRequest")
        if not isinstance(value, dict) or value.get("number") != number:
            raise ReadFailure("PR identity is missing or inconsistent.")
        return value
    first = header()
    head = commit_id(first.get("headRefOid"))
    def pages(query, key):
        return connection(lambda cursor: object_at(
            api(query, dict(variables, cursor=cursor)), "repository", "pullRequest", key))
    reviews = pages(REVIEWS, "reviews")
    threads = pages(THREADS, "reviewThreads")
    def checks_page(cursor):
        obj = object_at(api(CHECKS, {"owner": owner, "name": name, "head": head,
                                    "cursor": cursor}), "repository", "object")
        if obj.get("oid") != head:
            raise ReadFailure("Check commit identity changed.")
        if obj.get("statusCheckRollup") is None:
            return {"nodes": [], "pageInfo": {"hasNextPage": False}}
        return object_at(obj, "statusCheckRollup", "contexts")
    checks = connection(checks_page)
    if first != header():
        raise ReadFailure("PR signals changed during the read; try again.")
    return {"pr": first, "reviews": reviews, "threads": threads, "checks": checks}


def assess(snapshot):
    try:
        pr = snapshot["pr"]
        head = commit_id(pr["headRefOid"])
        if type(pr["isDraft"]) is not bool or pr["state"] not in {"OPEN", "CLOSED", "MERGED"}:
            raise ValueError("invalid PR state")
        if pr["mergeable"] not in {"MERGEABLE", "CONFLICTING", "UNKNOWN"}:
            raise ValueError("invalid mergeability")
        if pr["reviewDecision"] not in {None, "APPROVED", "CHANGES_REQUESTED", "REVIEW_REQUIRED"}:
            raise ValueError("invalid review decision")
        reasons, waiting = [], []
        unresolved = 0
        for thread in snapshot["threads"]:
            if type(thread["isResolved"]) is not bool:
                raise ValueError("missing thread state")
            unresolved += not thread["isResolved"]
        current = {"bot": 0, "human": 0}
        latest = {}
        for review in snapshot["reviews"]:
            if (review.get("commit") or {}).get("oid") != head:
                continue
            actor = review.get("author") or {}
            bot = actor.get("__typename") == "Bot" or actor.get("login", "").endswith("[bot]")
            current["bot" if bot else "human"] += 1
            # Missing actors never contribute approval.
            if actor.get("login") and review["state"] != "PENDING":
                key = actor["login"]
                stamp = review.get("submittedAt")
                if not isinstance(stamp, str):
                    raise ValueError("missing review timestamp")
                if key not in latest or stamp >= latest[key][0]:
                    latest[key] = (stamp, review["state"])
        states = [row[1] for row in latest.values()]
        if "CHANGES_REQUESTED" in states:
            reasons.append("Current-commit review requests changes.")
        if "APPROVED" not in states:
            reasons.append("No current-commit approval observed.")
        if unresolved:
            reasons.append(f"{unresolved} unresolved review thread(s), including outdated threads.")
        checks = snapshot["checks"]
        failing = pending = 0
        for check in checks:
            if check["__typename"] == "CheckRun":
                if check["status"] in {"QUEUED", "IN_PROGRESS", "WAITING", "REQUESTED", "PENDING"}:
                    pending += 1
                elif check["status"] == "COMPLETED":
                    failing += check["conclusion"] not in {"SUCCESS", "NEUTRAL", "SKIPPED"}
                else:
                    raise ValueError("unknown check state")
            elif check["__typename"] == "StatusContext":
                if check["state"] not in {"SUCCESS", "PENDING", "FAILURE", "ERROR", "EXPECTED"}:
                    raise ValueError("unknown status state")
                pending += check["state"] in {"PENDING", "EXPECTED"}
                failing += check["state"] in {"FAILURE", "ERROR"}
            else:
                raise ValueError("unknown check type")
        if not checks:
            reasons.append("No check results observed; required checks are not inferred.")
        if failing:
            reasons.append(f"{failing} failed check(s).")
        if pending:
            waiting.append(f"{pending} check(s) pending.")
        if pr["state"] != "OPEN":
            reasons.append("PR is not open.")
        if pr["isDraft"]:
            reasons.append("PR is a draft.")
        if pr["reviewDecision"] != "APPROVED":
            reasons.append("Repository review decision is not approved.")
        if pr["mergeable"] == "UNKNOWN" or pr["mergeStateStatus"] == "UNKNOWN":
            waiting.append("Mergeability has not been computed.")
        elif pr["mergeable"] != "MERGEABLE" or pr["mergeStateStatus"] != "CLEAN":
            reasons.append("Mergeability signals are not clean.")
        status = "needs_attention" if reasons else "waiting" if waiting else "signals_satisfied"
        return {"status": status, "head": head, "unresolved_threads": unresolved,
                "current_commit_reviews": current, "checks": {"total": len(checks),
                "failed": failing, "pending": pending}, "reasons": reasons + waiting,
                "merge_authorized": False}
    except (KeyError, TypeError, ValueError) as error:
        raise ReadFailure("PR snapshot is incomplete or unsupported.") from error


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("number", type=int)
    parser.add_argument("--repo", help="owner/repository; defaults to current checkout")
    args = parser.parse_args(argv)
    if args.number < 1:
        parser.error("PR number must be positive")
    try:
        report = assess(read_pr(args.repo or discover_repository(), args.number))
        print(json.dumps(report, indent=2, sort_keys=True))
        return {"signals_satisfied": 0, "needs_attention": 1, "waiting": 8}[report["status"]]
    except ReadFailure as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
