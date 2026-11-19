# avinashistoocool.github.io

Personal site of Avinash Chandra Gupta. Static HTML/CSS/JS, no build step.

Everything on the page comes from GitHub: `scripts/build_data.py` reads every public repo (description or README or docstrings, languages, imports in `.py`/`.ipynb`, commits, latest diff) plus the contribution calendar, and writes `data.json`.

The `build and deploy` workflow can regenerate `data.json` on every push and every hour when GitHub Pages uses Actions deployment. The site currently publishes from the `main` branch because the account's Actions jobs fail before a runner starts. This means the workflow cannot publish its refreshed `data.json` while branch deployment is active. In the browser, `app.js` checks the GitHub API (cached for 5 minutes) and patches in newer pushes and commits.

The [PLE Lab](https://avinashistoocool.github.io/ple-lab/) and
[LLM NAS](https://avinashistoocool.github.io/llm-nas/) pages show static
interactive result snapshots from their public repositories. GitHub Pages
does not run the PLE Python explorer, train models, or execute NAS searches.
Use the instructions in each project repository to run those tools locally.

Local preview:

```bash
python scripts/build_data.py      # optional: GITHUB_TOKEN avoids rate limits
python -m http.server 8000
```
