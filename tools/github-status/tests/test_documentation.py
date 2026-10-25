"""Keep documented offline output and CLI examples in sync without network calls."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
TOOLS = ROOT / "tools/github-status"


class DocumentationTests(unittest.TestCase):
    def run_python(self, script, *arguments):
        # Any unexpected GitHub CLI call fails locally rather than reaching a network.
        with tempfile.TemporaryDirectory() as folder:
            fake_cli = Path(folder) / "gh"
            fake_cli.write_text("#!/bin/sh\nexit 99\n")
            fake_cli.chmod(0o755)
            environment = dict(os.environ, PATH=folder)
            return subprocess.run(
                [sys.executable, str(TOOLS / script), *arguments], cwd=ROOT,
                capture_output=True, text=True, env=environment, timeout=10,
            )

    def test_generated_synthetic_output_matches_saved_and_documented_output(self):
        result = self.run_python("tests/example_output.py")
        self.assertEqual(result.returncode, 0, result.stderr)
        generated = json.loads(result.stdout)
        saved = json.loads((TOOLS / "examples/synthetic-output.json").read_text())
        self.assertEqual(generated, saved)
        for name, key in [("PR_STATUS.md", "synthetic_pr"),
                          ("QUEUE_SNAPSHOT.md", "synthetic_queue")]:
            source = (TOOLS / name).read_text()
            block = re.search(
                rf"<!-- {key}:start -->\s*```json\n(.*?)\n```\s*<!-- {key}:end -->",
                source, re.S,
            )
            self.assertIsNotNone(block)
            self.assertEqual(json.loads(block.group(1)), generated[key])

    def test_documented_help_commands(self):
        for script in ["pr_status.py", "queue_snapshot.py"]:
            result = self.run_python(script, "--help")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("--repo", result.stdout)

    def test_documented_invalid_pr_number(self):
        result = self.run_python("pr_status.py", "0")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertIn("PR number must be positive", result.stderr)

    def test_documented_invalid_attempt_count(self):
        result = self.run_python("queue_snapshot.py", "--attempts", "1")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertIn("attempts", result.stderr)
        self.assertNotIn("discover", result.stderr)


if __name__ == "__main__":
    unittest.main()
