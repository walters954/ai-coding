"""Structural checks for the bundled offline example (no browser or network)."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import unittest

class ExampleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.questions = []
        self.network = []
        self.policy = None
        self.feedback = 0
    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if "q" in attrs.get("class", "").split():
            self.questions.append(int(attrs["data-answer"]))
        if attrs.get("aria-live") == "polite":
            self.feedback += 1
        if attrs.get("http-equiv", "").lower() == "content-security-policy":
            self.policy = attrs.get("content", "")
        if tag in {"script", "link", "img", "iframe", "audio", "video"}:
            for key in ("src", "href", "srcset"):
                if attrs.get(key):
                    self.network.append(attrs[key])

class ExampleTests(unittest.TestCase):
    def test_offline_example_and_varied_accessible_questions(self):
        source = Path(__file__).resolve().parents[3] / "skills/diff-explainer/example.html"
        parser = ExampleParser()
        parser.feed(source.read_text())
        self.assertEqual(len(parser.questions), 5)
        self.assertTrue(all(0 <= value < 4 for value in parser.questions))
        self.assertLessEqual(max(Counter(parser.questions).values()), 2)
        self.assertEqual(parser.feedback, 5)
        self.assertEqual(parser.network, [])
        self.assertIn("default-src 'none'", parser.policy)

if __name__ == "__main__":
    unittest.main()
