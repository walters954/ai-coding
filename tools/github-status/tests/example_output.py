"""Print synthetic reports without contacting GitHub."""
import json
from fixtures import HEAD, responses, snapshot
from pr_status import assess
from queue_snapshot import stable_snapshot
value=dict(default_branch=dict(branch="trunk",head=HEAD),prs=[])
print(json.dumps(dict(synthetic_pr=assess(snapshot()),synthetic_queue=stable_snapshot(
    responses(value,value),pause=lambda _:None)),indent=2,sort_keys=True))
