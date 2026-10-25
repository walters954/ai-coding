"""Small read-only GitHub GraphQL transport and connection walker (stdlib only)."""
import json
import re
import subprocess


class ReadFailure(Exception):
    """A complete, consistent response could not be established."""


def repository(value):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", value):
        raise ReadFailure("Use an owner/repository name.")
    return value.split("/")


def graphql(query, variables):
    args = ["gh", "api", "graphql", "-f", "query=" + query]
    for key, value in variables.items():
        if value is not None:
            args.extend(["-F" if isinstance(value, int) else "-f", f"{key}={value}"])
    try:
        response = subprocess.run(args, capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ReadFailure("GitHub CLI unavailable or timed out.") from error
    if response.returncode:
        # CLI errors can contain local context; do not echo raw output.
        raise ReadFailure("GitHub read failed; check CLI authentication and repository access.")
    try:
        payload = json.loads(response.stdout)
        if payload.get("errors") or not isinstance(payload.get("data"), dict):
            raise ValueError("partial response")
        return payload["data"]
    except (ValueError, AttributeError) as error:
        raise ReadFailure("GitHub returned an unreadable or partial response.") from error


def discover_repository():
    try:
        response = subprocess.run(
            ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ReadFailure("Cannot discover the current repository; pass --repo.") from error
    if response.returncode:
        raise ReadFailure("Cannot discover the current repository; pass --repo.")
    value = response.stdout.strip()
    repository(value)
    return value


def connection(fetch_page):
    """Read all pages; refuse malformed pages, duplicate nodes, and cursor cycles."""
    nodes, ids, cursors = [], set(), set()
    cursor = None
    for _ in range(1000):
        try:
            page = fetch_page(cursor)
            info = page["pageInfo"]
            chunk = page["nodes"]
            if not isinstance(chunk, list) or type(info["hasNextPage"]) is not bool:
                raise ValueError("invalid page")
            for node in chunk:
                identity = node["id"]
                if not isinstance(identity, str) or not identity or identity in ids:
                    raise ValueError("duplicate or missing node")
                ids.add(identity)
                nodes.append(node)
            if not info["hasNextPage"]:
                return nodes
            cursor = info["endCursor"]
            if not isinstance(cursor, str) or not cursor or cursor in cursors:
                raise ValueError("invalid cursor")
            cursors.add(cursor)
        except (KeyError, TypeError, ValueError) as error:
            raise ReadFailure("Incomplete or inconsistent paginated response.") from error
    raise ReadFailure("Pagination limit exceeded.")


def object_at(data, *keys):
    try:
        for key in keys:
            data = data[key]
        if data is None:
            raise ValueError("missing object")
        return data
    except (KeyError, TypeError, ValueError) as error:
        raise ReadFailure("Required GitHub data is missing.") from error


def commit_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{40}", value):
        raise ReadFailure("Invalid commit identity.")
    return value
