"""Rebuild the public figure from the original experiment's archived records."""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, MultipleLocator

HERE = Path(__file__).resolve().parent
SOURCE = Path.home() / "llm-nas"
REPORT = (SOURCE / "analysis" / "RESULTS.md").read_text(encoding="utf-8")
RUNS = {
    "Random": (SOURCE / "runs" / "random" / "archive.jsonl", "#126c85"),
    "LLM · 3B": (SOURCE / "runs" / "llm_qwen3b" / "archive.jsonl", "#bd543e"),
}
records = {
    label: [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    for label, (path, _) in RUNS.items()
}
assert all(sum(bool(e.get("trained")) for e in entries) == 30 for entries in records.values())
for label, entries in records.items():
    top = sorted((e for e in entries if e["status"] == "ok"), key=lambda e: -e["val_acc"])[:5]
    for e in top:
        assert f"`#{e['id']}` {e['val_acc']:.4f}, {e['params']:,} params" in REPORT

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 13,
    "svg.fonttype": "none",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.edgecolor": "#aab7b4",
    "text.color": "#17232a",
    "axes.labelcolor": "#344950",
    "xtick.color": "#344950",
    "ytick.color": "#344950",
    "figure.facecolor": "#fffefa",
    "axes.facecolor": "#fffefa",
    "savefig.facecolor": "#fffefa",
})
fig, (progress, scatter) = plt.subplots(1, 2, figsize=(16, 9), gridspec_kw={"wspace": .30})
fig.subplots_adjust(left=.085, right=.95, top=.74, bottom=.22)
fig.text(.065, .94, "LLM-GUIDED NAS VS RANDOM SEARCH", fontsize=13, fontweight="bold", color="#126c85")
fig.text(.065, .86, "Proxy validation accuracy during search", fontsize=33, fontweight="bold")
fig.text(.065, .79, "CIFAR-10  /  one run per strategy  /  proxy validation accuracy (not test accuracy)", fontsize=14, color="#4c5c61")

for label, entries in records.items():
    color = RUNS[label][1]
    trained = [e for e in entries if e.get("trained")]
    best = 0
    trajectory = []
    for e in trained:
        if e["status"] == "ok":
            best = max(best, e["val_acc"])
        trajectory.append(best * 100)
    progress.step(range(1, 31), trajectory, where="post", linewidth=3, color=color, label=label)
    progress.scatter([30], [trajectory[-1]], s=95, color=color, zorder=5)
    progress.annotate(f"{trajectory[-1]:.2f}%", (30, trajectory[-1]), xytext=(-10, 12 if label == "Random" else -25),
                      textcoords="offset points", ha="right", color=color, weight="bold", fontsize=15)
    top = sorted((e for e in entries if e["status"] == "ok"), key=lambda e: -e["val_acc"])[:5]
    scatter.scatter([e["params"] / 1000 for e in top], [e["val_acc"] * 100 for e in top],
                    s=135, color=color, edgecolor="#fffefa", linewidth=1.6, zorder=4, label=label)
    for e in top:
        if e["id"] in (5, 48, 30) and ((label == "Random" and e["id"] in (5, 30)) or (label == "LLM · 3B" and e["id"] == 48)):
            offset = (-32, -25) if label == "Random" and e["id"] == 30 else (7, 9)
            scatter.annotate(f"#{e['id']}", (e["params"] / 1000, e["val_acc"] * 100),
                             xytext=offset, textcoords="offset points", fontsize=12, weight="bold", color=color)

for ax in (progress, scatter):
    ax.grid(color="#e1e6e1", linewidth=1)
    ax.set_axisbelow(True)
    ax.set_ylim(60, 72)
    ax.yaxis.set_major_locator(MultipleLocator(2))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:.0f}%"))
    ax.tick_params(length=0, pad=9)
    ax.legend(loc="upper left", frameon=False, fontsize=12)
progress.set_title("01   BEST SO FAR · 30 ATTEMPTS / STRATEGY", fontsize=14, weight="bold", loc="left", pad=22)
progress.set_xlim(1, 32)
progress.set_xticks([1, 5, 10, 15, 20, 25, 30])
progress.set_xlabel("Proxy-training attempts, in archive order", labelpad=19)
progress.set_ylabel("Best proxy validation accuracy", labelpad=15)
scatter.set_title("02   TOP FIVE / STRATEGY · 10 POINTS", fontsize=14, weight="bold", loc="left", pad=22)
scatter.set_xlim(250, 850)
scatter.set_xticks([300, 400, 500, 600, 700, 800])
scatter.set_xlabel("Parameters (thousands)", labelpad=19)
scatter.set_ylabel("Proxy validation accuracy", labelpad=15)
fig.text(.065, .09, "SOURCE  runs/*/archive.jsonl · analysis/RESULTS.md     |     Seeds included; 2 random attempts timed out (flat steps); top five only in scatter.", fontsize=11, color="#4c5c61")
fig.savefig(HERE / "llm-nas-results.png", dpi=150)
svg = HERE / "llm-nas-results.svg"
fig.savefig(svg)
content = svg.read_text(encoding="utf-8").replace('width="1152pt" height="648pt"', 'width="1600" height="900"', 1)
svg.write_text(content, encoding="utf-8")
print("Wrote", svg, "and 2400 × 1350 PNG")
