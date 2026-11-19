# avinashistoocool.github.io

Personal site of Avinash Chandra Gupta. Static HTML/CSS/JS, no build step.

The homepage activity comes from GitHub: `scripts/build_data.py` reads public repos (description or README or docstrings, languages, imports, commits, latest diff) plus the contribution calendar, and writes `data.json`.

The site publishes from the `main` branch because this account's Actions jobs fail before a runner starts. The old `build and deploy` workflow is manual-only while branch deployment is active. To refresh the checked-in `data.json`, run `python scripts/build_data.py` and commit the result. In the browser, `app.js` checks the GitHub API (cached for 5 minutes) and patches in newer pushes and commits.

The [project guide](https://avinashistoocool.github.io/projects/) lists every
project by area, with its page, demos, docs and GitHub source. The list lives in
`projects/projects.json`; the homepage project cards are built from the same file.
Each project page is published by its own repository at `/{RepoName}/`.

The [PLE Lab](https://avinashistoocool.github.io/PLE-Lab/) and
[LLM NAS](https://avinashistoocool.github.io/llm-nas/) pages are served from the
`PLE-Lab` and `llm-nas` repositories and show recorded experimental results.
Visitors can use the
[browser PLE token explorer](https://avinashistoocool.github.io/PLE-Lab/explorer.html)
to search and compare the 2,000 published token vectors. Its neighbours
are computed within that subset, not the full vocabulary. GitHub Pages does
not run the full PLE Python explorer, perform inference, train models or
execute NAS searches. Use the instructions in each project repository to
run those tools locally. The old `/ple-lab/` URLs redirect to `/PLE-Lab/`.

Local preview:

```bash
python scripts/build_data.py      # optional: GITHUB_TOKEN avoids rate limits
python -m http.server 8000
```
