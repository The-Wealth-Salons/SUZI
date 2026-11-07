#!/usr/bin/env python3
"""SUZI public-push heuristic preflight. Never prints matched values.

By default the report contains only aggregate reason counts, never file
paths: a restricted filename can itself be sensitive, and this script's
output lands in public CI logs (docs/PUBLICATION_REVIEW.md). Pass
--details in a private review context only, to include the paths.

With --tracked, the scan covers the tree of the commit HEAD points to
(git ls-tree + git show), not the index or the working tree, so a file
that is committed and then staged for deletion is still scanned: the
commit is what a push would publish.

This intentionally does NOT replace gitleaks, git history scanning, binary review,
PR title/comment review, partner clearance, or human semantic approval.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

BLOCKED_PARTS = {"secrets", "private", "internal", "personal-data", "raw-transcripts", "family-photos"}
BLOCKED_EXT = {".p12", ".pfx", ".pem", ".key", ".sqlite", ".sqlite3", ".env"}
TEXT_EXT = {".md", ".txt", ".json", ".yaml", ".yml", ".html", ".css", ".js", ".ts", ".tsx", ".jsx", ".py", ".toml", ".svg", ".xml", ".sh", ".csv"}
BLOCKED_RE = [
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    re.compile(rb"(?:sk_live_|github_pat_|ghp_|gho_|ghu_|ghs_|ghr_|xoxb-|xoxp-)[A-Za-z0-9_-]{8,}"),
    re.compile(rb"(?im)^\s*(?:PRIVATE\s+CONTENT|INTERNAL\s+ONLY|DO\s+NOT\s+PUBLISH)\s*:"),
]

def path_reason(p):
    """Restricted-path rules for a repo-relative path, from any source.

    Every path component is inspected, including the filename itself and
    its stem: a tracked file named private.md or secrets.txt is restricted
    even though its parent directories are ordinary.
    """
    if p.is_absolute() or ".." in p.parts:
        return "invalid_path"
    name = p.name.lower()
    if (
        any(part.lower() in BLOCKED_PARTS for part in p.parts)
        or p.stem.lower() in BLOCKED_PARTS
        or name in BLOCKED_PARTS
        or p.suffix.lower() in BLOCKED_EXT
        or name.startswith(".env")
    ):
        return "restricted_path"
    return None

def content_reason(p, data):
    if p.suffix.lower() not in TEXT_EXT and p.name not in {"LICENSE", "NOTICE"}:
        return "binary_or_unknown_manual_review"
    if any(rx.search(data) for rx in BLOCKED_RE):
        return "restricted_marker_or_credential_shape"
    return None

def scan_one(root, name):
    p = pathlib.Path(name)
    reason = path_reason(p)
    if reason:
        return reason
    path = root / p
    if not path.is_file():
        return "missing_file"
    if path.is_symlink():
        return "symlink_review"
    return content_reason(p, path.read_bytes())

def scan_committed(root):
    """Scan the tree of the commit HEAD points to.

    Returns (paths, results), or None if the tree cannot be listed.
    """
    ls = subprocess.run(["git", "-C", str(root), "ls-tree", "-r", "-z", "HEAD"], capture_output=True, check=False)
    if ls.returncode != 0:
        return None
    entries = []
    for chunk in ls.stdout.split(b"\0"):
        if not chunk:
            continue
        meta, _, raw = chunk.partition(b"\t")
        mode = meta.split(b" ")[0].decode("ascii", "replace")
        entries.append((raw.decode("utf-8", errors="replace"), mode))
    results = []
    for name, mode in entries:
        p = pathlib.Path(name)
        reason = path_reason(p)
        if reason is None and mode == "120000":
            reason = "symlink_review"
        if reason is None and mode == "160000":
            reason = "binary_or_unknown_manual_review"
        if reason is None:
            show = subprocess.run(["git", "-C", str(root), "show", "HEAD:" + name], capture_output=True, check=False)
            reason = "missing_file" if show.returncode != 0 else content_reason(p, show.stdout)
        if reason:
            results.append({"path": name, "reason": reason})
    return [name for name, _ in entries], results

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=pathlib.Path, default=pathlib.Path("."))
    ap.add_argument("--tracked", action="store_true")
    ap.add_argument("--details", action="store_true", help="Include finding paths in the report. Private review contexts only: paths can be sensitive and must not reach public CI logs.")
    ap.add_argument("paths", nargs="*")
    ns = ap.parse_args()
    root = ns.root.resolve()
    results = []
    checked = set()
    if ns.tracked:
        scanned = scan_committed(root)
        if scanned is None:
            print(json.dumps({"result": "HOLD", "reason": "git_list_failed"}))
            return 2
        tracked_paths, tracked_results = scanned
        checked.update(tracked_paths)
        results += tracked_results
    for name in ns.paths:
        checked.add(name)
        reason = scan_one(root, name)
        if reason:
            results.append({"path": name, "reason": reason})
    if not checked:
        print(json.dumps({"result": "HOLD", "reason": "no_files_supplied"}))
        return 2
    outcome = "HOLD" if results else "AUTOMATED_CHECKS_PASS_HUMAN_REVIEW_REQUIRED"
    report = {"result": outcome, "files_checked": len(checked), "limitations": "No commit history, actual secret detector, binary content, or private-language semantic review."}
    if ns.details:
        report["findings"] = results
    else:
        counts = {}
        for r in results:
            counts[r["reason"]] = counts.get(r["reason"], 0) + 1
        report["findings_by_reason"] = counts
    print(json.dumps(report, indent=2))
    return 1 if results else 0

if __name__ == "__main__":
    sys.exit(main())
