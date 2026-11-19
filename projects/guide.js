(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BASE = "https://avinashistoocool.github.io/";
  const GH = "https://github.com/Avinashistoocool/";

  const state = { q: "", group: "all" };
  let data = null;

  fetch("projects.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(`projects.json ${r.status}`); return r.json(); })
    .then((d) => { data = d; build(); apply(); checkLinks(); })
    .catch((err) => {
      console.error(err);
      $("#empty").hidden = false;
      $("#empty").textContent = "Could not load the project list.";
    });

  function build() {
    const groups = [{ id: "all", title: "All" }, ...data.groups];
    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (groups.some((g) => g.id === fromHash)) state.group = fromHash;
    $("#group-filter").innerHTML = groups.map((g) =>
      `<button type="button" data-group="${esc(g.id)}" aria-pressed="${g.id === state.group}">${esc(g.title)}</button>`).join("");
    $("#group-filter").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      state.group = b.dataset.group;
      history.replaceState(null, "", state.group === "all" ? location.pathname + location.search : `#${state.group}`);
      apply();
    });

    $("#directory").innerHTML = data.groups.map((g) => {
      const items = data.projects.filter((p) => p.group === g.id);
      return `<section class="guide-group" id="g-${esc(g.id)}" data-group="${esc(g.id)}" aria-labelledby="h-${esc(g.id)}">
        <h2 id="h-${esc(g.id)}">${esc(g.title)} <span data-count></span></h2>
        <ul class="guide-list">${items.map(entry).join("")}</ul>
      </section>`;
    }).join("");

    const q = $("#q");
    q.addEventListener("input", () => { state.q = q.value.trim().toLowerCase(); apply(); });
    q.addEventListener("keydown", (e) => { if (e.key === "Escape") { q.value = ""; state.q = ""; apply(); } });
    addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== q && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); q.focus();
      }
    });
  }

  const shownTopics = (t) => (t || []).filter((x) => !/^avinash-/.test(x)).slice(0, 6);

  function entry(p) {
    const main = `${BASE}${p.repo}/`;
    const source = p.sourceUrl || `${GH}${p.repo}`;
    const tag = (s) => `<span class="v-chip${s === "merge in progress" ? " merge" : ""}"><i class="dot ${s === "merge in progress" ? "active" : "pass"}"></i>${esc(s)}</span>`;
    const link = (cls, url, label, kind, check) =>
      `<li class="${cls}"${check ? ` data-check="${esc(url)}"` : ""}><a href="${esc(url)}">${esc(label)}</a><span class="kind">${esc(kind)}</span></li>`;
    const links = [
      link("main", main, `/${p.repo}/`, p.mainLabel || "project page", true),
      ...p.pages.map((s) => link("sub", s.url, s.label, s.url.startsWith(BASE) ? (s.url.endsWith(".pdf") ? "pdf" : "page") : "download", s.url.startsWith(BASE))),
      link("src", source, `github.com/Avinashistoocool/${p.repo}`, "source ↗", false),
    ];
    const hay = [p.title, p.repo, p.short, ...(p.topics || []), ...(p.status || []), ...(p.aliases || []), ...p.pages.map((s) => s.label)].join(" ").toLowerCase();
    return `<li class="card glow entry" data-search="${esc(hay)}">
      <div class="entry-top"><h3><a href="${esc(main)}">${esc(p.title)}</a></h3><div class="tags">${(p.status || []).map(tag).join("")}</div></div>
      <p>${esc(p.short)}</p>
      <div class="topics">${shownTopics(p.topics).map((t) => `<span>${esc(t)}</span>`).join("")}</div>
      <ul class="links">${links.join("")}</ul>
    </li>`;
  }

  function apply() {
    let shown = 0;
    for (const b of document.querySelectorAll("#group-filter button")) b.setAttribute("aria-pressed", String(b.dataset.group === state.group));
    for (const sec of document.querySelectorAll(".guide-group")) {
      let n = 0;
      const groupOk = state.group === "all" || sec.dataset.group === state.group;
      for (const li of sec.querySelectorAll(".entry")) {
        const ok = groupOk && (!state.q || state.q.split(/\s+/).every((w) => li.dataset.search.includes(w)));
        li.hidden = !ok;
        if (ok) n++;
      }
      sec.hidden = n === 0;
      sec.querySelector("[data-count]").textContent = `${n} project${n === 1 ? "" : "s"}`;
      shown += n;
    }
    $("#count").textContent = `${shown} of ${data.projects.length} projects shown`;
    $("#empty").hidden = shown !== 0;
  }

  /* mark pages that are not published yet; network or CORS errors leave the link unchanged */
  function checkLinks() {
    const items = [...document.querySelectorAll("[data-check]")];
    const seen = new Map();
    let i = 0;
    const next = async () => {
      while (i < items.length) {
        const li = items[i++];
        const url = li.dataset.check;
        if (!seen.has(url)) seen.set(url, fetch(url, { method: "HEAD", cache: "no-store" }).then((r) => r.status).catch(() => 0));
        const status = await seen.get(url);
        if (status === 404) {
          li.classList.add("soon");
          li.querySelector(".kind").textContent = "coming soon";
          li.querySelector("a").setAttribute("aria-label", `${li.querySelector("a").textContent} (coming soon)`);
        }
      }
    };
    Promise.all(Array.from({ length: 4 }, next));
  }
})();
