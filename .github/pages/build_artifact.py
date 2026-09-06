#!/usr/bin/env python3
"""GitHub Pages artifact tool for demelloeng.com.br — allowlist V1.

Stdlib only. No build, no transformation. Every published file is materialised
straight from `git cat-file` at the target commit, so the artifact bytes ARE the
commit's blob bytes regardless of platform / core.autocrlf.

Subcommands
  build       <ref> --out DIR [--report FILE]   copy allowlisted files -> DIR
  validate    <ref> --artifact DIR              gates G2 / G3 / G4 / G5
  smoke-local --artifact DIR                    the artifact serves the required surface
  smoke-live  <base-url>                        positive + negative HTTP smoke

Allowlist: .github/pages/allowlist.txt  (30 exact paths + one "orcamento/assets/**").
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.request

REPO_DEFAULT = "."
ALLOWLIST_DEFAULT = os.path.join(".github", "pages", "allowlist.txt")

# G3 — these must never appear in the artifact.
FORBIDDEN_EXACT = [
    ".gitignore",
    "assets/images/case-padrepedro-bim.jpeg",
    "assets/images/case-padrepedro-render.jpeg",
    "assets/images/logo-empilhada-branca.png",
]
FORBIDDEN_PREFIX = ["orcamento-src/", ".github/"]

# G5 anchors — bytes that must survive untouched (no rebuild / rename / minify).
RUNTIME_BUNDLE = "orcamento/assets/index-CACrEf69.js"
RUNTIME_CSS = "orcamento/assets/index-B9z1Kqrw.css"

# §8 positive smoke surface (paths, mapped to URLs by the caller).
SMOKE_POSITIVE = [
    "index.html", "servicos/index.html", "orcamento/index.html",
    "empresa/index.html", "empresa/trajetoria-do-fundador.html",
    "metodologia/index.html", "experiencia-tecnica/index.html",
    "contato/index.html", "sitemap.xml", "robots.txt",
    "assets/css/style.css", "assets/js/nav.js", "assets/js/three-d-stage.js",
    "assets/models/guatupe.obj",
    RUNTIME_BUNDLE, RUNTIME_CSS,
]
SMOKE_POSITIVE_URLS = [
    "/", "/servicos/", "/orcamento/", "/empresa/",
    "/empresa/trajetoria-do-fundador.html", "/metodologia/",
    "/experiencia-tecnica/", "/contato/", "/sitemap.xml", "/robots.txt",
    "/assets/css/style.css", "/assets/js/nav.js", "/assets/js/three-d-stage.js",
    "/assets/models/guatupe.obj",
    "/orcamento/assets/index-CACrEf69.js", "/orcamento/assets/index-B9z1Kqrw.css",
]

# §9 negative smoke — must be 404 after the new pipeline.
SMOKE_NEGATIVE_URLS = [
    "/orcamento-src/", "/orcamento-src/package.json",
    "/orcamento-src/.env.development", "/orcamento-src/.env.production",
    "/orcamento-src/src/journey.mjs",
    "/orcamento-src/src/pricing/pricing-table.v1.json",
    "/orcamento-src/tests/pricing.test.mjs",
    "/orcamento-src/fixtures/MAPA_ESTADOS_IT075.json",
    "/assets/images/case-padrepedro-bim.jpeg",
    "/assets/images/case-padrepedro-render.jpeg",
    "/assets/images/logo-empilhada-branca.png",
]


# --------------------------------------------------------------------------- git
def git(root: str, *args: str) -> bytes:
    return subprocess.run(
        ["git", "-C", root, *args], check=True, capture_output=True
    ).stdout


def rev_parse(root: str, ref: str) -> str:
    return git(root, "rev-parse", ref).decode().strip()


def tracked(root: str, ref: str) -> list[str]:
    out = git(root, "ls-tree", "-r", "-z", "--name-only", ref).decode("utf-8")
    return [p for p in out.split("\0") if p]


def blob(root: str, ref: str, rel: str) -> bytes:
    return git(root, "cat-file", "-p", f"{ref}:{rel}")


# --------------------------------------------------------------------- allowlist
def load_allowlist(path: str) -> tuple[list[str], list[str]]:
    exact: list[str] = []
    prefixes: list[str] = []
    for raw in open(path, encoding="utf-8"):
        s = raw.split("#", 1)[0].strip()
        if not s:
            continue
        if s.endswith("/**"):
            prefixes.append(s[:-2])  # "orcamento/assets/**" -> "orcamento/assets/"
        elif "*" in s or s.startswith("/") or ".." in s.split("/"):
            sys.exit(f"BAD_ALLOWLIST_ENTRY (exact repo-relative path or trailing /** only): {s!r}")
        else:
            exact.append(s)
    return exact, prefixes


def resolve(all_files: list[str], exact: list[str], prefixes: list[str]) -> dict[str, str]:
    fset = set(all_files)
    chosen: dict[str, str] = {}
    for p in exact:
        if p not in fset:
            sys.exit(f"G2 FAIL — allowlisted exact path not tracked at ref: {p}")
        chosen[p] = "exact"
    for pre in prefixes:
        hits = [f for f in all_files if f.startswith(pre)]
        if not hits:
            sys.exit(f"G2 FAIL — allowlist pattern matched nothing: {pre}**")
        for f in hits:
            chosen.setdefault(f, f"glob:{pre}**")
    return chosen


def sha_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ------------------------------------------------------------------- subcommands
def cmd_build(a) -> int:
    root = os.path.abspath(a.root)
    ref = rev_parse(root, a.ref)
    exact, prefixes = load_allowlist(a.allowlist)
    chosen = resolve(tracked(root, ref), exact, prefixes)

    out = os.path.abspath(a.out)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)

    report = {"ref": ref, "count": len(chosen), "files": []}
    for rel in sorted(chosen):
        data = blob(root, ref, rel)
        dst = os.path.join(out, rel)
        os.makedirs(os.path.dirname(dst) or out, exist_ok=True)
        with open(dst, "wb") as fh:
            fh.write(data)
        report["files"].append(
            {"path": rel, "sha256": sha_bytes(data), "bytes": len(data), "reason": chosen[rel]}
        )

    print(f"build: ref={ref[:10]} published={len(chosen)} files -> {out}")
    if a.report:
        rp = os.path.abspath(a.report)
        os.makedirs(os.path.dirname(rp) or ".", exist_ok=True)
        with open(rp, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=1, ensure_ascii=False)
        print(f"build: report -> {rp}")
    return 0


def _artifact_files(artifact: str) -> list[str]:
    rels: list[str] = []
    for dirpath, _, files in os.walk(artifact):
        for f in files:
            rels.append(os.path.relpath(os.path.join(dirpath, f), artifact).replace(os.sep, "/"))
    return sorted(rels)


def cmd_validate(a) -> int:
    root = os.path.abspath(a.root)
    ref = rev_parse(root, a.ref)
    artifact = os.path.abspath(a.artifact)
    exact, prefixes = load_allowlist(a.allowlist)
    expected = resolve(tracked(root, ref), exact, prefixes)  # G2

    have = _artifact_files(artifact)
    exp_set, have_set = set(expected), set(have)

    missing = sorted(exp_set - have_set)
    extra = sorted(have_set - exp_set)

    # G3 — forbidden must be absent (check the tree AND every artifact file)
    g3 = set()
    for p in FORBIDDEN_EXACT:
        if os.path.exists(os.path.join(artifact, p)):
            g3.add(p)
    for pre in FORBIDDEN_PREFIX:
        if os.path.exists(os.path.join(artifact, pre.rstrip("/"))):
            g3.add(pre)
    for h in have:
        if h in FORBIDDEN_EXACT or any(h.startswith(pre) for pre in FORBIDDEN_PREFIX):
            g3.add(h)
    g3 = sorted(g3)

    # G4 — byte-equivalence vs the commit's blobs
    mismatches = []
    for rel in sorted(have_set & exp_set):
        if sha_file(os.path.join(artifact, rel)) != sha_bytes(blob(root, ref, rel)):
            mismatches.append(rel)

    # G5 — runtime bundle / css untouched (no rebuild / rename / minify)
    g5 = []
    for rel in (RUNTIME_BUNDLE, RUNTIME_CSS):
        ap = os.path.join(artifact, rel)
        if not os.path.exists(ap):
            g5.append(f"{rel} (absent)")
        elif sha_file(ap) != sha_bytes(blob(root, ref, rel)):
            g5.append(f"{rel} (bytes changed)")

    print(f"validate: ref={ref[:10]}")
    print(f"  FILES_EXPECTED   = {len(expected)}")
    print(f"  FILES_IN_ARTIFACT= {len(have)}")
    print(f"  MISSING          = {len(missing)}  {missing or ''}")
    print(f"  EXTRA            = {len(extra)}  {extra or ''}")
    print(f"  MISMATCHES       = {len(mismatches)}  {mismatches or ''}")
    print(f"  G3_FORBIDDEN_HITS= {len(g3)}  {g3 or ''}")
    print(f"  G5_RUNTIME       = {'OK' if not g5 else g5}")

    ok = not (missing or extra or mismatches or g3 or g5)
    print(f"  RESULT           = {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


def cmd_smoke_local(a) -> int:
    artifact = os.path.abspath(a.artifact)
    fails = []
    for rel in SMOKE_POSITIVE:
        if not os.path.isfile(os.path.join(artifact, rel)):
            fails.append(f"missing positive: {rel}")
    for rel in (
        "orcamento-src/package.json", "orcamento-src/src/journey.mjs",
        ".gitignore", "assets/images/case-padrepedro-bim.jpeg",
        "assets/images/logo-empilhada-branca.png",
    ):
        if os.path.exists(os.path.join(artifact, rel)):
            fails.append(f"present negative: {rel}")
    # /orcamento/ HTML must reference the two runtime assets present in the artifact
    orc = os.path.join(artifact, "orcamento", "index.html")
    if os.path.isfile(orc):
        html = open(orc, encoding="utf-8", errors="replace").read()
        for asset in ("index-CACrEf69.js", "index-B9z1Kqrw.css"):
            if asset not in html:
                fails.append(f"/orcamento/index.html does not reference {asset}")
            if not os.path.isfile(os.path.join(artifact, "orcamento", "assets", asset)):
                fails.append(f"/orcamento/assets/{asset} absent from artifact")
    else:
        fails.append("orcamento/index.html absent")

    print(f"smoke-local: {'PASS' if not fails else 'FAIL'}")
    for f in fails:
        print(f"  - {f}")
    return 0 if not fails else 1


def _http(url: str) -> tuple[int, str, int, bool]:
    """Return (status, content_type, body_len, looks_like_custom_404)."""
    req = urllib.request.Request(
        url, method="GET",
        headers={"Cache-Control": "no-cache", "User-Agent": "demello-pages-smoke/1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
            ct = r.headers.get("Content-Type", "")
            code = r.status
    except urllib.error.HTTPError as e:
        body = e.read()
        ct = e.headers.get("Content-Type", "") if e.headers else ""
        code = e.code
    except Exception as e:  # noqa: BLE001
        return (-1, f"ERR {e}", 0, False)
    text = body[:4000].decode("utf-8", "replace")
    custom404 = ("default-src 'none'" in text and "unsafe-inline" in text) or (
        "For root URLs (like http://example.com/) you must provide an index.html file" in text
    )
    return (code, ct, len(body), custom404)


def cmd_smoke_live(a) -> int:
    base = a.base.rstrip("/")
    import time as _t

    bust = str(int(_t.time()))
    ok = True

    print(f"smoke-live: base={base}")
    print("  -- positive (expect 200, real content) --")
    for path in SMOKE_POSITIVE_URLS:
        code, ct, n, c404 = _http(f"{base}{path}?cb={bust}")
        good = code == 200 and not c404
        ok &= good
        print(f"  {'OK  ' if good else 'FAIL'} {code:>4} {ct:<32.32} {n:>9}  {path}")

    print("  -- negative (expect 404 / not real content) --")
    for path in SMOKE_NEGATIVE_URLS:
        code, ct, n, c404 = _http(f"{base}{path}?cb={bust}")
        # pass = not a real 200 payload: 404, or (200 AND custom-404 body)
        good = (code != 200) or c404
        ok &= good
        print(f"  {'OK  ' if good else 'FAIL'} {code:>4} {ct:<32.32} {n:>9}  custom404={c404}  {path}")

    print(f"  RESULT = {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


# --------------------------------------------------------------------------- cli
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build")
    b.add_argument("ref", nargs="?", default=os.environ.get("GITHUB_SHA", "HEAD"))
    b.add_argument("--root", default=REPO_DEFAULT)
    b.add_argument("--allowlist", default=ALLOWLIST_DEFAULT)
    b.add_argument("--out", required=True)
    b.add_argument("--report", default=None)
    b.set_defaults(func=cmd_build)

    v = sub.add_parser("validate")
    v.add_argument("ref", nargs="?", default=os.environ.get("GITHUB_SHA", "HEAD"))
    v.add_argument("--root", default=REPO_DEFAULT)
    v.add_argument("--allowlist", default=ALLOWLIST_DEFAULT)
    v.add_argument("--artifact", required=True)
    v.set_defaults(func=cmd_validate)

    s = sub.add_parser("smoke-local")
    s.add_argument("--artifact", required=True)
    s.set_defaults(func=cmd_smoke_local)

    l = sub.add_parser("smoke-live")
    l.add_argument("base")
    l.set_defaults(func=cmd_smoke_live)

    a = ap.parse_args()
    return a.func(a)


if __name__ == "__main__":
    sys.exit(main())
