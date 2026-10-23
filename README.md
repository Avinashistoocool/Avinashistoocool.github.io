# avinashistoocool.github.io

Personal site of Avinash Chandra Gupta. Static HTML/CSS/JS, no build step.

Everything on the page comes from GitHub: `scripts/build_data.py` reads every public repo (description or README or docstrings, languages, imports in `.py`/`.ipynb`, commits, latest diff) plus the contribution calendar, and writes `data.json`.

The `build and deploy` workflow regenerates `data.json` on every push and every hour, then publishes to GitHub Pages. In the browser, `app.js` also checks the GitHub API (cached for 5 minutes) and patches in pushes and commits newer than `data.json`, so new activity shows up without waiting for a rebuild.

Local preview:

```bash
python scripts/build_data.py      # optional: GITHUB_TOKEN avoids rate limits
python -m http.server 8000
```
