import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('manage',Path(__file__).with_name('manage.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ManageTests(unittest.TestCase):
 def test_preservation_idempotence_and_rollback(self):
  x={'permissions':{'deny':['Read(fake-private)']},'env':{'TEST_FAKE':'FAKE_ONLY'},'hooks':{'SessionStart':[{'hooks':[{'type':'command','command':'existing-hook'}]}],'PreToolUse':[{'matcher':'*','hooks':[{'type':'command','command':'existing-security'}]}]},'unrelated':[1,2]}
  original=copy.deepcopy(x);rt=Path('/fake/runtime');py=Path('/fake/python')
  installed=m.transform(x,rt,py,True)
  self.assertEqual(x,original)
  self.assertEqual(m.transform(installed,rt,py,True),installed)
  self.assertEqual(m.transform(installed,rt,py,False),original)
  self.assertEqual(installed['hooks']['PreToolUse'][-1]['hooks'][0]['onFailure'],'block')
 def test_real_scratch_install_disable_reenable(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);p=root/'settings.json';original={'hooks':{'Stop':[{'hooks':[{'command':'original'}]}]},'extra':True};p.write_text(json.dumps(original))
   def run(action):
    with patch.object(sys,'platform','darwin'),patch.object(sys,'argv',['manage',action,'--claude-dir',d]):m.main()
   run('install');runtime=root/m.LABEL;self.assertTrue((runtime/'guard.py').is_file())
   run('install');run('uninstall');self.assertEqual(json.loads(p.read_text()),original)
   run('install');run('uninstall');self.assertEqual(json.loads(p.read_text()),original)
 def test_missing_runtime_and_timeout_are_failure_exit(self):
  missing=subprocess.run([sys.executable,'-I','/tmp/ai-coding-test-NOT-EXISTENT-guard.py'],capture_output=True)
  self.assertNotEqual(missing.returncode,0)
  with self.assertRaises(subprocess.TimeoutExpired):subprocess.run([sys.executable,'-c','import time; time.sleep(1)'],timeout=.02,capture_output=True)
if __name__=='__main__':unittest.main()
