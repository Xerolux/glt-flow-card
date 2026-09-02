"""No component test may depend on something the HA lanes do not ship.

The lanes build their workspace from `custom_components/` and `tests/` plus the
staged card, and nothing else. A test that reaches outside those -- for a
fixture under a top-level `test/` directory, for a module under `src/`, or for a
binary like `node` -- passes locally and fails only in `ha-artifacts`, where the
log is long and the cause is far from the symptom.

That has now happened twice: the semantic parity test shelled out to `node` and
imported from `src/`, and the Phase-4 corpus test read a fixture from a
top-level `test/` directory. Twice is a pattern, so it gets a guard.

This is a source check rather than a behavioural one, which the project normally
avoids. It is justified here because the failure it prevents is invisible to
every behavioural test that could be written: locally, the paths all exist.
"""
from __future__ import annotations

from pathlib import Path
import re

SUITE = Path(__file__).resolve().parent

#: What the lane workspace actually contains, from tools/test-ha-artifacts.mjs.
LANE_ROOTS = ("custom_components", "tests", "config")

#: Repository directories that exist locally but never reach the lane.
ABSENT_IN_LANE = ("src", "dist", "tools", "docs", "schemas", "node_modules", "build")

#: Host binaries the Python-only lane container does not provide.
ABSENT_BINARIES = ("node", "npm", "npx", "playwright")

#: This file names the very things it forbids, so it exempts itself.
EXEMPT = {"test_lane_portability.py"}

_ROOT_PATH = re.compile(
    r"""["'](?:\.{0,2}/)?(""" + "|".join(ABSENT_IN_LANE) + r""")/[^"']*["']""",
)
_SUBPROCESS_BINARY = re.compile(
    r"""["'](""" + "|".join(ABSENT_BINARIES) + r""")["']\s*,""",
)
#: A top-level `test/` directory (singular) is the browser's tree, not the
#: Companion's; only `tests/` travels into the lane.
_SINGULAR_TEST_DIR = re.compile(r"""["'](?:\.{0,2}/)?test/[^"']*["']""")


def _sources() -> list[Path]:
    return sorted(
        path for path in SUITE.rglob("*.py")
        if path.name not in EXEMPT and "__pycache__" not in path.parts
    )


def test_no_component_test_reads_a_directory_the_lane_lacks() -> None:
    offenders: list[str] = []
    for path in _sources():
        body = path.read_text("utf-8")
        for pattern, why in (
            (_ROOT_PATH, "a repository directory the lane workspace does not contain"),
            (_SINGULAR_TEST_DIR, "the top-level test/ tree, which the lane does not copy"),
        ):
            for match in pattern.finditer(body):
                offenders.append(f"{path.name}: {match.group(0)} -- {why}")
    assert not offenders, "\n".join(offenders)


def test_no_component_test_shells_out_to_a_host_binary() -> None:
    """The lane container is Python only; there is no node on PATH."""
    offenders: list[str] = []
    for path in _sources():
        body = path.read_text("utf-8")
        for match in _SUBPROCESS_BINARY.finditer(body):
            offenders.append(f"{path.name}: spawns {match.group(1)!r}, absent in the lane")
    assert not offenders, "\n".join(offenders)


def test_the_guard_actually_matches_the_shapes_it_claims_to() -> None:
    """A guard nobody has seen fire is a guard nobody should trust."""
    assert _ROOT_PATH.search('path = "src/v100/semantic-model.mjs"')
    assert _ROOT_PATH.search("path = '../dist/glt-flow-card.js'")
    assert _SINGULAR_TEST_DIR.search('FIXTURE = "test/fixtures/operations/site.project.json"')
    assert _SUBPROCESS_BINARY.search('subprocess.run(["node", "-e", script])')
    # And does not fire on the things that are fine.
    assert not _SINGULAR_TEST_DIR.search('p = "tests/components/glt_flow_card/x.json"')
    assert not _ROOT_PATH.search('p = "custom_components/glt_flow_card/panels.py"')


def test_every_lane_root_is_reachable_from_this_suite() -> None:
    """Sanity: the roots this guard trusts really are the ones that travel."""
    repository = SUITE.parents[2]
    for name in LANE_ROOTS:
        if name == "config":
            continue  # created by the lane runner, not committed
        assert (repository / name).is_dir(), name
