"""Collect everything the site shows into data.json, straight from GitHub.

    python scripts/build_data.py        # GITHUB_TOKEN is used if set

Nothing is written by hand per project: descriptions come from the repo
description, else the README's first paragraph, else the largest module's
docstring. Languages, libraries (imports), commits, diffs and the
contribution calendar are all read from the repos and the profile.
"""
import base64
import datetime as dt
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

USER = os.environ.get("PROFILE_USER", "Avinashistoocool")
SUPPORT_URL = os.environ.get("SUPPORT_URL") or "https://buymeacoffee.com/avinashistoocool"
ROOT = Path(__file__).resolve().parent.parent
PIP_NAMES = {"cv2": "opencv", "sklearn": "scikit-learn", "PIL": "pillow", "yaml": "pyyaml",
             "bs4": "beautifulsoup4", "google": "google-adk", "dotenv": "python-dotenv", "osgeo": "gdal"}
GROUPS = [
    ("ML", {"torch", "tensorflow", "keras", "jax", "scikit-learn", "xgboost", "ultralytics", "transformers",
            "weaver", "torchvision", "timm", "gymnasium", "stable_baselines3"}),
    ("Science", {"numpy", "scipy", "pandas", "matplotlib", "seaborn", "uproot", "awkward", "vector", "sympy",
                 "numba", "h5py", "tqdm", "plotly"}),
    ("Geo / CV", {"opencv", "rasterio", "pyproj", "shapely", "gdal", "pillow", "skimage", "geopandas"}),
    ("LLM / web", {"openai", "anthropic", "groq", "httpx", "requests", "playwright", "beautifulsoup4", "ddgs",
                   "google-adk", "flask", "fastapi", "uvicorn", "streamlit"}),
]


def fetch(url, raw=False):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": USER})
    tok = os.environ.get("GITHUB_TOKEN")
    if tok and "api.github.com" in url:
        req.add_header("Authorization", f"Bearer {tok}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
    except urllib.error.HTTPError as ex:
        if ex.code in (404, 409, 422, 451):
            return None
        raise
    return data if raw else json.loads(data)


def api(path):
    return fetch("https://api.github.com/" + path.lstrip("/"))


def clean_md(t):
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"[*_`~]+", "", t)
    t = t.replace("\u2014", "-").replace("\u2013", "-")
    t = re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200d]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def first_paragraph(md):
    md = re.sub(r"```.*?```", "", md, flags=re.S)
    for block in re.split(r"\n\s*\n", md):
        b = block.strip()
        if not b or b[0] in "#|>-*!<=" or re.match(r"^\d+\.", b):
            continue
        b = clean_md(b)
        if len(b) >= 40 and not re.match(r"^(hackathon|team|status|author)\b", b, re.I):
            return b
    return ""


def group_of(lib):
    for name, members in GROUPS:
        if lib in members:
            return name
    return "Tooling"


def scan_code(repo, branch):
    tree = api(f"repos/{USER}/{repo}/git/trees/{urllib.parse.quote(branch)}?recursive=1")
    if not tree:
        return Counter(), "", 0
    blobs = [t for t in tree.get("tree", []) if t["type"] == "blob"
             and not re.search(r"(^|/)(\.venv|venv|site-packages|node_modules)/", t["path"])]
    paths = [t["path"] for t in blobs]
    local = {Path(p).stem for p in paths} | {p.split("/")[0] for p in paths}
    found, doc = Counter(), ""
    code = sorted((t for t in blobs if t["path"].endswith((".py", ".ipynb"))), key=lambda t: -t.get("size", 0))[:60]
    for t in code:
        b = fetch(f"https://raw.githubusercontent.com/{USER}/{repo}/{urllib.parse.quote(branch)}/{urllib.parse.quote(t['path'])}", raw=True)
        if not b:
            continue
        src = b.decode("utf-8", "replace")
        if t["path"].endswith(".ipynb"):
            try:
                src = "\n".join("".join(c.get("source", [])) for c in json.loads(src).get("cells", [])
                                if c.get("cell_type") == "code")
            except ValueError:
                continue
        mods = set()
        for m in re.finditer(r"^\s*(?:from|import)\s+([A-Za-z_]\w*)", src, re.M):
            mod = m.group(1)
            if mod not in sys.stdlib_module_names and mod not in local and mod != "__future__":
                mods.add(PIP_NAMES.get(mod, mod))
        found.update(mods)
        if not doc and t["path"].endswith(".py"):
            m = re.match(r'\s*(?:#[^\n]*\n\s*)*(?:"""|\'\'\')(.*?)(?:"""|\'\'\')', src, re.S)
            if m:
                lines = [l.strip() for l in m.group(1).strip().splitlines()]
                lines = [l for l in lines if l and not re.fullmatch(r"[=\-~]+", l)]
                cand = clean_md(" ".join(lines))
                if len(lines) > 1 and len(lines[0]) < 40:
                    cand = clean_md(lines[0].rstrip(".:") + ". " + " ".join(lines[1:]))
                if len(cand) >= 40:
                    doc = cand.split(" Requires:")[0].split(" Dependencies:")[0]
    return found, doc, sum(1 for t in code if t["path"].endswith(".py"))


def contributions():
    page = fetch(f"https://github.com/users/{USER}/contributions", raw=True)
    if not page:
        return {"total": 0, "days": []}
    page = page.decode("utf-8", "replace")
    days = [{"date": d, "row": int(r), "col": int(c), "level": int(l)} for d, r, c, l in re.findall(
        r'data-date="(\d{4}-\d\d-\d\d)"[^>]*?id="contribution-day-component-(\d+)-(\d+)"[^>]*?data-level="(\d)"', page)]
    total = sum(int(n) for n in re.findall(r'for="contribution-day-component-\d+-\d+"[^>]*>(\d+) contributions?', page))
    return {"total": total, "days": days}


def latest_diff(repo, sha):
    c = api(f"repos/{USER}/{repo}/commits/{sha}")
    if not c:
        return None
    files = [f for f in c.get("files", []) if f.get("patch")]
    files.sort(key=lambda f: -(f.get("additions", 0) + f.get("deletions", 0)))
    if not files:
        return None
    code_ext = (".py", ".ipynb", ".js", ".ts", ".sh", ".c", ".cpp", ".go", ".rs", ".md")
    f = next((f for f in files if f["filename"].endswith(code_ext)), None)
    if not f:
        return None
    lines = []
    for l in f["patch"].splitlines():
        if l.startswith("@@"):
            if lines:
                break
            continue
        lines.append(l[:110])
        if len(lines) >= 14:
            break
    return {"repo": repo, "sha": sha[:7], "message": c["commit"]["message"].split("\n")[0],
            "file": f["filename"], "additions": f.get("additions", 0), "deletions": f.get("deletions", 0),
            "lines": lines, "url": c["html_url"]}


def pixel_logo(url, n=16):
    """Avatar quantised to an n x n pixel grid, used as the site logo."""
    try:
        from PIL import Image
    except ImportError:
        return
    sep = "&" if "?" in url else "?"
    im = Image.open(io.BytesIO(fetch(f"{url}{sep}s=256", raw=True))).convert("RGB")
    small = im.resize((n, n), Image.BOX).quantize(colors=8, method=Image.MEDIANCUT).convert("RGB")
    rects = []
    for y in range(n):
        for x in range(n):
            r, g, b = small.getpixel((x, y))
            rects.append(f'<rect x="{x}" y="{y}" width="1.02" height="1.02" fill="#{r:02x}{g:02x}{b:02x}"/>')
    (ROOT / "assets" / "logo.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n} {n}" shape-rendering="crispEdges">{"".join(rects)}</svg>',
        encoding="utf-8")


def main():
    user = api(f"users/{USER}")
    socials = api(f"users/{USER}/social_accounts") or []
    repos = [r for r in api(f"users/{USER}/repos?per_page=100&type=owner")
             if not r["fork"] and not r["archived"] and r["name"].lower() != USER.lower() and r["size"] > 0]
    langs, libs, lib_files = Counter(), Counter(), Counter()
    projects, commits, emails = [], [], Counter()
    for r in repos:
        rd = api(f"repos/{USER}/{r['name']}/readme")
        md = base64.b64decode(rd["content"]).decode("utf-8", "replace") if rd else ""
        found, doc, n_py = scan_code(r["name"], r["default_branch"])
        repo_langs = api(f"repos/{USER}/{r['name']}/languages") or {}
        for k, v in repo_langs.items():
            langs[k] += v
        for lib, n in found.items():
            libs[lib] += 1
            lib_files[lib] += n
        text = clean_md(r["description"] or "") or first_paragraph(md) or doc
        if not text:
            title = re.search(r"^#\s+(.+)$", md, re.M)
            text = (clean_md(title.group(1)) + ". " if title else "") + \
                   (f"{n_py} Python modules using {', '.join(sorted(found)[:4])}." if n_py else "")
        rc = api(f"repos/{USER}/{r['name']}/commits?per_page=30") or []
        for c in rc:
            em = c["commit"]["author"]["email"]
            if "noreply" not in em and (c.get("author") or {}).get("login") == USER:
                emails[em] += 1
            commits.append({"repo": r["name"], "sha": c["sha"], "date": c["commit"]["author"]["date"],
                            "message": c["commit"]["message"].split("\n")[0][:120], "url": c["html_url"]})
        projects.append({
            "name": r["name"], "url": r["html_url"], "text": text.strip(), "stars": r["stargazers_count"],
            "forks": r["forks_count"], "language": r["language"], "pushed_at": r["pushed_at"],
            "created_at": r["created_at"], "topics": r.get("topics", []), "size_kb": r["size"],
            "commits": len(rc), "libs": sorted(found, key=lambda k: -found[k])[:6],
        })
    projects.sort(key=lambda p: (p["stars"], p["pushed_at"]), reverse=True)
    commits.sort(key=lambda c: c["date"], reverse=True)
    diff = None
    for c in commits[:15]:
        diff = latest_diff(c["repo"], c["sha"])
        if diff:
            break
    for c in commits:
        c["sha"] = c["sha"][:7]
    email = user.get("email") or (emails.most_common(1)[0][0] if emails else None)
    lib_list = [{"name": k, "repos": v, "files": lib_files[k], "group": group_of(k)}
                for k, v in sorted(libs.items(), key=lambda kv: (-kv[1], -lib_files[kv[0]], kv[0]))]
    data = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "user": {"login": USER, "name": user.get("name") or USER, "bio": clean_md(user.get("bio") or ""),
                 "avatar": user["avatar_url"], "since": user["created_at"][:4], "followers": user["followers"],
                 "public_repos": user["public_repos"], "location": user.get("location"),
                 "email": email, "blog": user.get("blog") or None, "socials": socials,
                 "html_url": user["html_url"], "support_url": SUPPORT_URL},
        "projects": projects,
        "commits": commits[:60],
        "languages": [{"name": k, "bytes": v} for k, v in langs.most_common()],
        "libraries": lib_list,
        "diff": diff,
        "contributions": contributions(),
    }
    (ROOT / "assets").mkdir(exist_ok=True)
    pixel_logo(user["avatar_url"])
    (ROOT / "data.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
    print(f"data.json: {len(projects)} projects, {len(data['commits'])} commits, "
          f"{len(lib_list)} libraries, {data['contributions']['total']} contributions")


if __name__ == "__main__":
    main()
