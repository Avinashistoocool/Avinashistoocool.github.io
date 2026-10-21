# avinashistoocool.github.io

Personal site of Avinash Chandra Gupta. Static HTML/CSS/JS, no build step.

Everything on the page comes from GitHub: `scripts/build_data.py` reads every public repo (description or README or docstrings, languages, imports in `.py`/`.ipynb`, commits, latest diff) plus the contribution calendar, and writes `data.json`. The pixel logo is generated from the GitHub avatar.

The `build and deploy` workflow regenerates `data.json` on every push and once a day, then publishes to GitHub Pages.

Local preview:

```bash
python scripts/build_data.py      # optional: GITHUB_TOKEN avoids rate limits
python -m http.server 8000
```
