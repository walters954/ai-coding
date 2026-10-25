"""Invented test data; never contacts an external service."""
import copy
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
HEAD, OTHER = "a" * 40, "b" * 40

def page(nodes, more=False, cursor=None):
    return {"nodes": nodes, "pageInfo": {"hasNextPage": more, "endCursor": cursor}}

def pr():
    return dict(number=42, state="OPEN", headRefOid=HEAD, isDraft=False,
                reviewDecision="APPROVED", mergeable="MERGEABLE", mergeStateStatus="CLEAN")

def review(identity="r1", state="APPROVED", head=HEAD, actor="reviewer"):
    return dict(id=identity, state=state, submittedAt="2026-01-01T12:00:00Z",
                author=dict(login=actor, __typename="User"), commit=dict(oid=head))

def check(identity="c1"):
    return dict(id=identity, __typename="CheckRun", status="COMPLETED", conclusion="SUCCESS")

def snapshot():
    return dict(pr=pr(), reviews=[review()], threads=[], checks=[check()])

def queue_row(number=42):
    return dict(id=f"p{number}", number=number, headRefOid=HEAD, baseRefName="trunk",
                isDraft=False, mergeable="MERGEABLE", mergeStateStatus="CLEAN", reviewDecision="APPROVED",
                commits={"nodes": [{"commit": {"oid": HEAD, "statusCheckRollup": {"state": "SUCCESS"}}}]})

def responses(*items):
    iterator=iter(copy.deepcopy(items))
    return lambda *_args: next(iterator)
