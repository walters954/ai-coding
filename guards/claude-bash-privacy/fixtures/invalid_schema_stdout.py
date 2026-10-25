"""Test-only hook fixture: valid JSON with an invalid PreToolUse decision, exit 0.

Syntactically valid output whose permissionDecision is not an accepted value.
Reads no stdin, environment, processes, files, network, or credentials.
"""
import json

print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'INVALID_TEST_ONLY', 'permissionDecisionReason': 'Test-only invalid decision fixture.'}}))
