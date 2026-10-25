import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
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
 def test_runner_configuration(self):
  rt=Path('/fake/runtime');installed=m.transform({},rt,Path('/fake/python'),True)['hooks']
  start=installed['SessionStart'][0]['hooks'][0];pre=installed['PreToolUse'][0]
  self.assertEqual(start['args'],['-I',str(rt/'guard.py'),'--session-start']);self.assertNotIn('onFailure',start)
  self.assertEqual(pre['matcher'],'^Bash$');self.assertEqual(pre['hooks'][0]['args'],['-I',str(rt/'runner.py')])
  self.assertEqual(pre['hooks'][0]['onFailure'],'block');self.assertEqual(pre['hooks'][0]['timeout'],5)
 def test_scratch_refuses_different_runtime_and_uninstalls_only_owned_files(self):
  # Disposable temp config only; `claude --version` is faked, never executed.
  with tempfile.TemporaryDirectory() as d:
   root=Path(d).resolve();p=root/'settings.json';p.write_text('{}');runtime=root/m.LABEL
   fake=SimpleNamespace(returncode=0,stdout='2.1.310 (Claude Code)\n',stderr='')
   def run(action):
    with patch.object(sys,'platform','darwin'),patch.object(m.subprocess,'run',return_value=fake),patch.object(sys,'argv',['manage',action,'--claude-dir',str(root)]):m.main()
   runtime.mkdir();(runtime/'guard.py').write_bytes(b'# FAKE_OLD_V1_RUNTIME_ONLY\n')
   with self.assertRaises(SystemExit):run('install')
   self.assertEqual(p.read_text(),'{}');self.assertFalse((runtime/'runner.py').exists())
   self.assertEqual((runtime/'guard.py').read_bytes(),b'# FAKE_OLD_V1_RUNTIME_ONLY\n')
   run('uninstall');self.assertFalse(runtime.exists())
   run('install')
   for n in m.FILES:self.assertEqual((runtime/n).read_bytes(),Path(m.__file__).with_name(n).read_bytes())
   pre=json.loads(p.read_text())['hooks']['PreToolUse'][0]['hooks'][0]
   self.assertEqual(pre['args'],['-I',str(runtime/'runner.py')])
   (runtime/'runner.py').write_bytes(b'# FAKE_TAMPERED_RUNNER_ONLY\n')
   with self.assertRaises(SystemExit):run('install')
   (runtime/'runner.py').write_bytes(Path(m.__file__).with_name('runner.py').read_bytes())
   (runtime/'unrelated.txt').write_text('FAKE_UNOWNED_FILE')
   run('uninstall');self.assertEqual(json.loads(p.read_text()),{})
   self.assertEqual([f.name for f in runtime.iterdir()],['unrelated.txt'])
 def test_missing_runtime_and_timeout_are_failure_exit(self):
  missing=subprocess.run([sys.executable,'-I','/tmp/ai-coding-test-NOT-EXISTENT-guard.py'],capture_output=True)
  self.assertNotEqual(missing.returncode,0)
  with self.assertRaises(subprocess.TimeoutExpired):subprocess.run([sys.executable,'-c','import time; time.sleep(1)'],timeout=.02,capture_output=True)
if __name__=='__main__':unittest.main()
