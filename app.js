(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAY = 864e5;
  const ago = (iso) => {
    const d = Math.floor((Date.now() - new Date(iso)) / DAY);
    if (d <= 0) return "today";
    if (d < 30) return `${d}d ago`;
    if (d < 365) return `${Math.floor(d / 30)}mo ago`;
    return `${Math.floor(d / 365)}y ago`;
  };
  const GROUP_COLORS = { "ML": "#52a8ff", "Science": "#ededed", "Geo / CV": "#62c073", "LLM / web": "#999999", "Tooling": "#3a3a3a" };

  /* ---------------- mobile menu ---------------- */
  const menuBtn = $("#menu-btn"), menu = $("#mobile-menu");
  const setMenu = (open) => {
    menu.hidden = !open;
    document.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  menuBtn.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) setMenu(false); });
  addEventListener("resize", () => { if (innerWidth > 820 && !menu.hidden) setMenu(false); });

  /* ---------------- radial glow follows the pointer ---------------- */
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest && e.target.closest(".glow");
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty("--gx", `${e.clientX - r.left}px`);
    c.style.setProperty("--gy", `${e.clientY - r.top}px`);
  });

  /* ---------------- hero: simulated jet in (eta, phi) ---------------- */
  function jetCanvas() {
    const cv = $("#jet");
    const ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W, H, dpr, parts = [];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

    function build() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = [];
      const prongs = [
        { x: 0.66, y: 0.36, s: 0.05, e: 1 },
        { x: 0.74, y: 0.44, s: 0.035, e: 0.75 },
        { x: 0.6, y: 0.47, s: 0.03, e: 0.55 },
      ];
      const n = Math.round(Math.min(900, (W * H) / 1400));
      for (let i = 0; i < n; i++) {
        const p = prongs[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2];
        const r = Math.abs(gauss());
        const core = Math.random() < 0.75;
        const spread = core ? p.s : p.s * 3.2;
        const x = p.x + gauss() * spread * (W > H ? 1 : 1.6);
        const y = p.y + gauss() * spread * (W > H ? 1.6 : 1);
        const energy = Math.max(0.05, p.e * Math.exp(-r * 1.4) * (core ? 1 : 0.35) * rnd(0.4, 1.2));
        parts.push({ x, y, e: energy, ph: rnd(0, Math.PI * 2), sp: rnd(0.2, 0.7), charged: Math.random() < 0.6 });
      }
      for (let i = 0; i < 260; i++) {
        parts.push({ x: Math.random(), y: Math.random() * 0.8, e: rnd(0.02, 0.08), ph: rnd(0, 6.28), sp: rnd(0.1, 0.3), charged: Math.random() < 0.5 });
      }
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W * 0.67, H * 0.4, 0, W * 0.67, H * 0.4, Math.max(W, H) * 0.55);
      g.addColorStop(0, "rgba(82,168,255,0.10)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth = 1;
      const step = Math.max(48, Math.round(W / 24));
      for (let x = (W % step) / 2; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
      for (let y = (H % step) / 2; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }

      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(W * 0.67, H * 0.41, Math.min(W, H) * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const time = t / 1000;
      for (const p of parts) {
        const wob = reduce ? 0 : Math.sin(time * p.sp + p.ph) * 2.2;
        const x = p.x * W + wob, y = p.y * H + (reduce ? 0 : Math.cos(time * p.sp * 0.8 + p.ph) * 2.2);
        const r = 0.8 + Math.sqrt(p.e) * 6;
        const a = Math.min(1, 0.15 + p.e * 1.1);
        ctx.fillStyle = p.e > 0.45 ? `rgba(255,255,255,${a})` : p.charged ? `rgba(82,168,255,${a})` : `rgba(153,153,153,${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = "11px 'Geist Mono', monospace";
      ctx.fillStyle = "rgba(153,153,153,0.7)";
      ctx.fillText("Δη", W - 40, H * 0.41 - 6);
      ctx.fillText("Δφ", W * 0.67 + 6, 110);
      if (!reduce) requestAnimationFrame(draw);
    }
    build();
    addEventListener("resize", () => { build(); if (reduce) draw(0); });
    requestAnimationFrame(draw);
  }
  jetCanvas();

  /* ---------------- data-driven sections ---------------- */
  fetch("data.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then(render)
    .catch((err) => console.error("data.json", err));

  function render(d) {
    const { user, projects, commits, libraries, languages, diff, contributions } = d;

    $("#year").textContent = new Date().getFullYear();
    $("#generated").textContent = `data from the GitHub API · updated ${ago(d.generated_at)}`;
    if (commits.length) $("#hero-last").textContent = `LAST PUSH ${ago(commits[0].date).toUpperCase()}`;
    for (const a of document.querySelectorAll('a[href*="buymeacoffee"]')) a.href = user.support_url;

    /* metrics */
    const kb = projects.reduce((s, p) => s + p.size_kb, 0);
    const codeKB = Math.round(languages.reduce((s, l) => s + l.bytes, 0) / 1024);
    const metric = { projects: projects.length, contrib: contributions.total, kb: codeKB || kb, stars: projects.reduce((s, p) => s + p.stars, 0) };
    for (const el of document.querySelectorAll("[data-k]")) countUp(el, metric[el.dataset.k]);

    renderStream(projects, commits);
    renderHealth(projects, commits);
    renderLibStacks(libraries, projects.length);
    renderDiff(diff);
    renderProjects(projects);
    renderLibTable(libraries, projects.length);
    renderContrib(contributions);
    renderContact(user);
  }

  function countUp(el, target) {
    if (!Number.isFinite(target)) { el.textContent = "—"; return; }
    const io = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 900;
      const tick = (t) => {
        const f = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - f, 3))).toLocaleString();
        if (f < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
  }

  /* event stream: repos on the left, commits as spans on the right */
  function renderStream(projects, commits) {
    const list = $("#stream-list"), rows = $("#stream-rows");
    const byRepo = {};
    for (const c of commits) (byRepo[c.repo] ||= []).push(c);
    const repos = projects.filter((p) => byRepo[p.name]).sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
    const all = { name: "all repositories", created_at: projects.reduce((m, p) => (p.created_at < m ? p.created_at : m), new Date().toISOString()) };

    const select = (repo) => {
      for (const b of list.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.repo === repo.name));
      const cs = repo === all ? commits.slice(0, 40) : byRepo[repo.name];
      const start = new Date(repo === all ? cs[cs.length - 1].date : repo.created_at).getTime();
      const end = Date.now();
      const span = Math.max(DAY, end - start);
      const days = Math.max(1, Math.round(span / DAY));
      $("#trace-id").innerHTML = `trace <b>${esc(repo.name)}</b>`;
      $("#chip-span").innerHTML = `<i class="dot active"></i>${cs.length} COMMITS`;
      $("#chip-dur").innerHTML = `<i class="dot ${days < 30 ? "pass" : "warn"}"></i>${days} DAYS`;
      const w = Math.max(0.8, 100 / Math.max(days, 1));
      rows.innerHTML = cs.map((c, i) => {
        const left = Math.min(100 - w, ((new Date(c.date) - start) / span) * 100);
        const label = repo === all ? `<span class="sha">${esc(c.repo.slice(0, 14))}</span>` : `<span class="sha">${esc(c.sha)}</span>`;
        return `<tr class="${i === 0 ? "focus" : ""}"><td><a href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.message)}">${label}${esc(c.message)}</a></td>
          <td><div class="timeline"><i style="left:${left.toFixed(2)}%;width:${w.toFixed(2)}%"></i></div></td>
          <td class="r">${ago(c.date)}</td></tr>`;
      }).join("");
    };

    const items = [all, ...repos];
    list.innerHTML = items.map((p) => {
      const n = p === all ? commits.length : byRepo[p.name].length;
      const fresh = p === all || Date.now() - new Date(p.pushed_at) < 30 * DAY;
      return `<button type="button" data-repo="${esc(p.name)}" aria-pressed="false"><i class="dot ${fresh ? "pass" : "warn"}"></i>${esc(p.name)}<span class="n">${n}</span></button>`;
    }).join("");
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) select(items.find((p) => p.name === b.dataset.repo));
    });
    select(all);
  }

  /* bento 1: repo health */
  function renderHealth(projects, commits) {
    const since = Date.now() - 30 * DAY;
    const rows = projects.map((p) => {
      const recent = commits.filter((c) => c.repo === p.name && new Date(c.date) > since).length;
      const age = Math.floor((Date.now() - new Date(p.pushed_at)) / DAY);
      const status = age <= 14 ? ["pass", "ACTIVE"] : age <= 90 ? ["warn", "IDLE"] : ["fail", "STALE"];
      return { p, recent, status, age };
    }).sort((a, b) => a.age - b.age).slice(0, 6);
    $("#health").innerHTML = rows.map(({ p, recent, status }) =>
      `<li><span title="${esc(p.name)}">${esc(p.name)}</span><span class="delta ${recent ? "pos" : ""}">${recent ? "+" + recent : "±0"}</span><span class="v-chip"><i class="dot ${status[0]}"></i>${status[1]}</span></li>`
    ).join("");
  }

  /* bento 2: stacked bars of libraries per domain */
  function renderLibStacks(libs, nRepos) {
    const groups = {};
    for (const l of libs) (groups[l.group] ||= []).push(l);
    const order = Object.keys(GROUP_COLORS).filter((g) => groups[g]);
    const max = Math.max(...order.map((g) => groups[g].reduce((s, l) => s + l.repos, 0)));
    $("#lib-stacks").innerHTML = order.map((g) => {
      const ls = groups[g].sort((a, b) => b.repos - a.repos);
      const total = ls.reduce((s, l) => s + l.repos, 0);
      const segs = ls.map((l, i) => `<i title="${esc(l.name)} · ${l.repos}/${nRepos} repos" style="width:${(l.repos / max) * 100}%;background:${GROUP_COLORS[g]};opacity:${Math.max(0.35, 1 - i * 0.12)}"></i>`).join("");
      return `<div class="stack-row"><div class="lab"><b>${esc(g)}</b><span>${esc(ls.slice(0, 3).map((l) => l.name).join(" · "))}</span></div><div class="stack-bar">${segs}</div></div>`;
    }).join("");
    $("#lib-legend").innerHTML = `<span>${libs.length} libraries · segment = one library · length = repos using it</span>`;
  }

  /* bento 3: latest diff */
  function renderDiff(diff) {
    if (!diff) { $("#diff").textContent = "no recent code diff"; return; }
    $("#diff-title").textContent = diff.message.length > 60 ? diff.message.slice(0, 58) + "…" : diff.message;
    $("#diff-sub").innerHTML = `${esc(diff.repo)} · ${esc(diff.file.split("/").pop())} · <span style="color:#62c073">+${diff.additions}</span> −${diff.deletions}`;
    const lines = diff.lines;
    $("#diff").innerHTML = lines.map((l, i) => {
      let cls = "";
      if (l.startsWith("+")) cls = lines[i - 1] && lines[i - 1].startsWith("-") ? "mod" : "add";
      else if (l.startsWith("-")) cls = "del";
      return `<span class="${cls}">${esc(l) || " "}</span>`;
    }).join("");
  }

  function renderProjects(projects) {
    $("#project-grid").innerHTML = projects.map((p) => {
      const fresh = Date.now() - new Date(p.pushed_at) < 30 * DAY;
      return `<a class="card project glow" href="${esc(p.url)}" target="_blank" rel="noopener">
        <div class="project-top"><h3>${esc(p.name)}</h3><span class="v-chip"><i class="dot ${fresh ? "pass" : "warn"}"></i>★ ${p.stars}</span></div>
        <p>${esc(p.text)}</p>
        <div class="libs">${p.libs.map((l) => `<span>${esc(l)}</span>`).join("")}</div>
        <div class="project-meta"><span>${esc(p.language || "—")} · ${p.commits}${p.commits >= 30 ? "+" : ""} commits · pushed ${ago(p.pushed_at)}</span><span class="open">open ↗</span></div>
      </a>`;
    }).join("");
  }

  function renderLibTable(libs, nRepos) {
    $("#lib-rows").innerHTML = libs.slice(0, 20).map((l) =>
      `<tr><td>${esc(l.name)}</td><td><span class="v-chip"><i class="dot" style="background:${GROUP_COLORS[l.group]}"></i>${esc(l.group)}</span></td>
       <td><div class="usage"><i style="width:${(l.repos / nRepos) * 100}%"></i></div></td><td class="r">${l.repos}/${nRepos}</td></tr>`
    ).join("");
  }

  function renderContrib(c) {
    const days = c.days.slice().sort((a, b) => (a.col - b.col) || (a.row - b.row));
    $("#contrib-grid").innerHTML = days.map((d) => `<i data-l="${d.level}" title="${esc(d.date)}" style="grid-row:${d.row + 1};grid-column:${d.col + 1}"></i>`).join("");
    $("#contrib-chip").innerHTML = `<i class="dot pass"></i>${c.total} TOTAL`;
  }

  function renderContact(user) {
    const rows = [];
    if (user.email) rows.push(["mail", user.email, `mailto:${user.email}`]);
    for (const s of user.socials || []) rows.push([s.provider, s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), s.url]);
    if (user.blog) rows.push(["web", user.blog.replace(/^https?:\/\//, ""), user.blog.startsWith("http") ? user.blog : `https://${user.blog}`]);
    rows.push(["github", `github.com/${user.login}`, user.html_url]);
    if (user.location) rows.push(["based", user.location, null]);
    $("#contact-list").innerHTML = rows.map(([k, v, u]) =>
      `<li><span>${esc(k)}</span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v)}</li>`
    ).join("");
  }
})();
