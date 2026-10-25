"""Test-only hook fixture: writes exactly b'{' to stdout and exits 0.

Reproduces truncated, non-JSON hook output. Reads no stdin, environment,
processes, files, network, or credentials.
"""
import sys

sys.stdout.buffer.write(b'{')
sys.stdout.buffer.flush()
