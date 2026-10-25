import copy
import json
import subprocess
import unittest
from unittest.mock import patch
from fixtures import HEAD, OTHER, check, page, pr, queue_row, responses, review, snapshot
from github_api import ReadFailure, connection, graphql, repository
from pr_status import assess, read_pr
from queue_snapshot import read_queue, stable_snapshot

class TransportTests(unittest.TestCase):
    def test_partial_graphql_data(self):
        result=subprocess.CompletedProcess([], 0, json.dumps(dict(data={}, errors=[{}])), "")
        with patch("github_api.subprocess.run", return_value=result), self.assertRaises(ReadFailure):
            graphql("query{}", {})
    def test_raw_error_is_not_exposed(self):
        result=subprocess.CompletedProcess([], 1, "", "synthetic-private-error")
        with patch("github_api.subprocess.run", return_value=result), self.assertRaises(ReadFailure) as error:
            graphql("query{}", {})
        self.assertNotIn("synthetic-private-error", str(error.exception))
    def test_cli_missing(self):
        with patch("github_api.subprocess.run", side_effect=FileNotFoundError), self.assertRaises(ReadFailure):
            graphql("query{}", {})
    def test_invalid_repository(self):
        for value in ["demo", "owner/demo extra", "https://example.invalid/demo"]:
            with self.subTest(value=value), self.assertRaises(ReadFailure): repository(value)
    def test_all_pages(self):
        cursors=[]
        def fetch(cursor):
            cursors.append(cursor)
            return page([dict(id="one")], True, "next") if cursor is None else page([dict(id="two")])
        self.assertEqual(len(connection(fetch)), 2)
        self.assertEqual(cursors, [None, "next"])
    def test_duplicate_and_cyclic_or_missing_cursor(self):
        cases=[(page([dict(id="same")],True,"next"),page([dict(id="same")])),
               (page([],True,"next"),page([],True,"next")),(page([],True,None),),({"nodes":[]},)]
        for pages in cases:
            with self.subTest(pages=pages), self.assertRaises(ReadFailure): connection(responses(*pages))

class AssessmentTests(unittest.TestCase):
    def test_success_is_not_authorization(self):
        result=assess(snapshot())
        self.assertEqual(result["status"],"signals_satisfied")
        self.assertFalse(result["merge_authorized"])
        self.assertNotIn("reviewer",json.dumps(result))
    def test_unresolved_threads_block_even_when_outdated(self):
        for outdated in [False,True]:
            data=snapshot();data["threads"]=[dict(id="t1",isResolved=False,isOutdated=outdated)]
            self.assertEqual(assess(data)["status"],"needs_attention")
    def test_stale_or_missing_actor_cannot_approve(self):
        for record in [review(head=OTHER),dict(review(),author=None)]:
            data=snapshot();data["reviews"]=[record]
            self.assertEqual(assess(data)["status"],"needs_attention")
    def test_latest_changes_request(self):
        data=snapshot();record=review("r2","CHANGES_REQUESTED")
        record["submittedAt"]="2026-01-02T12:00:00Z";data["reviews"].append(record)
        self.assertEqual(assess(data)["status"],"needs_attention")
    def test_check_states(self):
        cases=[([],"needs_attention"),([dict(check(),conclusion="FAILURE")],"needs_attention"),
               ([dict(check(),status="QUEUED",conclusion=None)],"waiting"),
               ([dict(id="s1",__typename="StatusContext",state="ERROR")],"needs_attention")]
        for checks,expected in cases:
            data=snapshot();data["checks"]=checks
            self.assertEqual(assess(data)["status"],expected)
    def test_closed_draft_conflicted_and_unknown(self):
        for change,expected in [(dict(isDraft=True),"needs_attention"),(dict(state="MERGED"),"needs_attention"),
                                (dict(mergeable="CONFLICTING"),"needs_attention"),(dict(mergeable="UNKNOWN"),"waiting")]:
            data=snapshot();data["pr"].update(change)
            self.assertEqual(assess(data)["status"],expected)
    def test_incomplete_thread_or_unknown_check(self):
        for changes in [dict(threads=[dict(id="t1")]),dict(checks=[dict(__typename="FutureType")])]:
            data=snapshot();data.update(changes)
            with self.assertRaises(ReadFailure): assess(data)

class PrReadTests(unittest.TestCase):
    def api(self,moved=False):
        counts=dict(header=0,reviews=0,threads=0,checks=0)
        def fetch(query,variables):
            if "reviews(first" in query:
                kind="reviews";later=bool(variables["cursor"])
                record=review("r2" if later else "r1",actor="helper" if later else "reviewer")
                result={"repository":{"pullRequest":{"reviews":page([record],not later,"next")}}}
            elif "reviewThreads" in query:
                kind="threads";later=bool(variables["cursor"])
                record=dict(id="t2" if later else "t1",isResolved=not later,isOutdated=False)
                result={"repository":{"pullRequest":{"reviewThreads":page([record],not later,"next")}}}
            elif "statusCheckRollup" in query:
                kind="checks";later=bool(variables["cursor"]);record=check("c2" if later else "c1")
                if later:record["conclusion"]="FAILURE"
                result={"repository":{"object":{"oid":HEAD,"statusCheckRollup":{"contexts":page([record],not later,"next")}}}}
            else:
                kind="header";value=pr()
                if moved and counts[kind]:value["headRefOid"]=OTHER
                result={"repository":{"pullRequest":value}}
            counts[kind]+=1
            return result
        return fetch,counts
    def test_paginated_late_failures(self):
        api,counts=self.api();data=read_pr("example/demo",42,api)
        self.assertEqual(counts,dict(header=2,reviews=2,threads=2,checks=2))
        result=assess(data)
        self.assertEqual(result["checks"]["failed"],1)
        self.assertEqual(result["unresolved_threads"],1)
        self.assertEqual(result["status"],"needs_attention")
    def test_moved_head(self):
        api,_=self.api(True)
        with self.assertRaises(ReadFailure):read_pr("example/demo",42,api)

class QueueTests(unittest.TestCase):
    def data(self,rows):
        base={"repository":{"defaultBranchRef":{"name":"trunk","target":{"oid":HEAD}}}}
        return base,{"repository":{"pullRequests":page(rows)}},copy.deepcopy(base)
    def test_non_main_default_branch(self):
        value=read_queue("example/demo",responses(*self.data([queue_row()])))
        self.assertEqual(value["default_branch"]["branch"],"trunk")
    def test_queue_pagination(self):
        base,_,end=self.data([])
        pages=[{"repository":{"pullRequests":page([queue_row(1)],True,"next")}},
               {"repository":{"pullRequests":page([queue_row(2)])}}]
        self.assertEqual(len(read_queue("example/demo",responses(base,*pages,end))["prs"]),2)
    def test_mismatched_commit(self):
        row=queue_row();row["commits"]["nodes"][0]["commit"]["oid"]=OTHER
        with self.assertRaises(ReadFailure):read_queue("example/demo",responses(*self.data([row])))
    def test_base_changed_or_partial_queue(self):
        base,queue,end=self.data([]);end["repository"]["defaultBranchRef"]["target"]["oid"]=OTHER
        for items in [(base,queue,end),(base,{"repository":{"pullRequests":{"nodes":[]}}})]:
            with self.assertRaises(ReadFailure):read_queue("example/demo",responses(*items))
    def test_empty_queue_requires_two_reads(self):
        value=dict(default_branch=dict(branch="trunk",head=HEAD),prs=[])
        result=stable_snapshot(responses(value,value),pause=lambda _:None)
        self.assertEqual(result["reads"],2);self.assertFalse(result["merge_authorized"])
    def test_unknown_or_changing_does_not_stabilize(self):
        value=read_queue("example/demo",responses(*self.data([queue_row()])))
        unknown=copy.deepcopy(value);unknown["prs"][0]["mergeable"]="UNKNOWN"
        changed=copy.deepcopy(value);changed["prs"][0]["head"]=OTHER
        for items in [(unknown,unknown),(value,changed)]:
            with self.assertRaises(ReadFailure):stable_snapshot(responses(*items),attempts=2,pause=lambda _:None)
    def test_errors_are_not_empty_queue(self):
        def fail():raise ReadFailure("unavailable")
        with self.assertRaises(ReadFailure):stable_snapshot(fail,pause=lambda _:None)
    def test_invalid_limits_do_not_read(self):
        for attempts,delay in [(1,0),(21,0),(2,-1),(2,float("nan"))]:
            with self.assertRaises(ReadFailure):stable_snapshot(lambda:self.fail("must not fetch"),attempts,delay)

if __name__=="__main__":unittest.main()
