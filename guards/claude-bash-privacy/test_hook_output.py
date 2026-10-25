"""Fixture fidelity and production serialization regressions.

These tests check only (1) that the test-only hook fixtures emit the exact output
shapes used in the observed Claude Code run and (2) that production guard.py
serializes complete JSON or nothing. They do not emulate, parse like, or prove
Claude runner behavior, including fail-open or fail-closed handling. Valid deny
serialization is covered by test_guard.Tests.test_protocol.
"""
import ast
import json
from pathlib import Path
import subprocess
import sys
import unittest

HERE=Path(__file__).resolve().parent
FIXTURES=HERE/'fixtures'
DECISIONS=('allow','deny','ask','defer')

def run(script,data=b''):
 return subprocess.run([sys.executable,'-I',str(script)],input=data,capture_output=True,timeout=10)

class FixtureFidelity(unittest.TestCase):
 """Fixture output only. Not Claude runner behavior."""
 def test_truncated_stdout_is_exact_non_json(self):
  p=run(FIXTURES/'truncated_stdout.py')
  self.assertEqual(p.returncode,0);self.assertEqual(p.stdout,b'{');self.assertEqual(p.stderr,b'')
  with self.assertRaises(json.JSONDecodeError):json.loads(p.stdout)
 def test_invalid_schema_stdout_is_valid_json_with_invalid_decision(self):
  p=run(FIXTURES/'invalid_schema_stdout.py')
  self.assertEqual(p.returncode,0);self.assertEqual(p.stderr,b'')
  out=json.loads(p.stdout)['hookSpecificOutput']
  self.assertEqual(out['hookEventName'],'PreToolUse');self.assertEqual(out['permissionDecision'],'INVALID_TEST_ONLY')
  self.assertNotIn(out['permissionDecision'],DECISIONS)
 def test_fixtures_are_inert(self):
  for name in ('truncated_stdout.py','invalid_schema_stdout.py'):
   with self.subTest(fixture=name):
    nodes=list(ast.walk(ast.parse((FIXTURES/name).read_text())))
    imported={a.name for n in nodes if isinstance(n,(ast.Import,ast.ImportFrom)) for a in n.names}
    used={n.attr for n in nodes if isinstance(n,ast.Attribute)}|{n.id for n in nodes if isinstance(n,ast.Name)}
    self.assertLessEqual(imported,{'sys','json'})
    self.assertFalse(used&{'stdin','environ','getenv','open','input'})
 def test_observed_record_is_public_safe_data(self):
  text=(FIXTURES/'observed_hook_failure_behavior.json').read_text()
  record=json.loads(text)
  self.assertIn('Not produced or proven by the unit tests',record['record'])
  self.assertEqual(len(record['cases']),record['candidate_commands'])
  for word in ('/Users/','/home/','session_id'):self.assertNotIn(word,text)

class ProductionSerialization(unittest.TestCase):
 """Production guard.py stdout only. Not Claude runner behavior."""
 def test_malformed_input_yields_complete_deny_json(self):
  for bad in (b'',b'{',b'{"hook_event_name":',b'\xff\xfe\x00',b'[]'):
   with self.subTest(case=bad[:8]):
    p=run(HERE/'guard.py',bad)
    self.assertEqual(p.returncode,0);self.assertEqual(p.stderr,b'')
    self.assertNotEqual(p.stdout.strip(),b'{');self.assertTrue(p.stdout.endswith(b'\n'))
    out=json.loads(p.stdout)['hookSpecificOutput']
    self.assertEqual(out['hookEventName'],'PreToolUse');self.assertEqual(out['permissionDecision'],'deny')
    self.assertIn('input-or-runtime-failure',out['permissionDecisionReason'])
if __name__=='__main__':unittest.main()
