"""Frozen ground truth: hash check and loaders (doc 08 section 4.4 rule 1)."""
import hashlib
import json

from ..config import GROUND_TRUTH


def check_hashes():
    """Return the list of files whose sha256 differs from SHA256SUMS (empty means intact)."""
    bad = []
    for line in (GROUND_TRUTH / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split(maxsplit=1)
        if hashlib.sha256((GROUND_TRUTH / name).read_bytes()).hexdigest() != digest:
            bad.append(name)
    return bad


def truth_hash():
    return hashlib.sha256((GROUND_TRUTH / "SHA256SUMS").read_bytes()).hexdigest()[:16]


def load():
    return json.loads((GROUND_TRUTH / "ground_truth.json").read_text())
