#!/usr/bin/env python3
"""SUZI public-push heuristic preflight. Never prints matched values.

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

def scan_one(root, name):
    p = pathlib.Path(name)
    if p.is_absolute() or ".." in p.parts:
        return "invalid_path"
    if any(part.lower() in BLOCKED_PARTS for part in p.parts[:-1]) or p.suffix.lower() in BLOCKED_EXT or p.name.lower().startswith(".env"):
        return "restricted_path"
    path = root / p
    if not path.is_file():
        return "missing_file"
    if path.is_symlink():
        return "symlink_review"
    if p.suffix.lower() not in TEXT_EXT and p.name not in {"LICENSE", "NOTICE"}:
        return "binary_or_unknown_manual_review"
    data = path.read_bytes()
    if any(rx.search(data) for rx in BLOCKED_RE):
        return "restricted_marker_or_credential_shape"
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=pathlib.Path, default=pathlib.Path("."))
    ap.add_argument("--tracked", action="store_true")
    ap.add_argument("paths", nargs="*")
    ns = ap.parse_args()
    root = ns.root.resolve()
    paths = list(ns.paths)
    if ns.tracked:
        proc = subprocess.run(["git", "-C", str(root), "ls-files", "-z"], capture_output=True, check=False)
        if proc.returncode != 0:
            print(json.dumps({"result":"HOLD","reason":"git_list_failed"}))
            return 2
        paths += [s.decode("utf-8", errors="replace") for s in proc.stdout.split(b"\0") if s]
    if not paths:
        print(json.dumps({"result":"HOLD","reason":"no_files_supplied"}))
        return 2
    results = [{"path": p, "reason": reason} for p in sorted(set(paths)) if (reason := scan_one(root, p))]
    # Do not echo secret content; filenames may still be sensitive, so use limited relative paths.
    outcome = "HOLD" if results else "AUTOMATED_CHECKS_PASS_HUMAN_REVIEW_REQUIRED"
    print(json.dumps({"result":outcome,"findings":results,"files_checked":len(set(paths)),"limitations":"No commit history, actual secret detector, binary content, or private-language semantic review."}, indent=2))
    return 1 if results else 0

if __name__ == "__main__":
    sys.exit(main())