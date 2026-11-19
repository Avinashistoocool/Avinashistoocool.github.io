(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const WIDTH = 384;
  const LAYERS = 6;
  const DIM = 64;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = $("cloud");
  const ctx = canvas.getContext("2d");
  let data, bytes, scales, norms, maxNorm, selected = 0, layer = 0, shownLayer = 0;
  let yaw = -0.5, pitch = 0.25, zoom = 1, dragging = false, moved = false;
  let startX = 0, startY = 0, hovered = -1, searchMatches = [], matchIndex = 0;
  let projected = [], frame = 0, lastTime = 0, extent = 1, freqMin = 0, freqMax = 1;
  const clusterPalette = ["#f79470", "#69cbc0", "#f0d47a", "#b19cdb", "#a9d985", "#e499c0", "#88bce3", "#ddae80"];

  function fail(error) {
    $("status").classList.add("error");
    $("status").textContent = `Published explorer data could not be loaded: ${error.message}. Try reloading this page over HTTP (not file://).`;
    $("workspace").hidden = true;
    console.error("PLE token atlas:", error);
  }

  async function load() {
    try {
      if (!ctx) $("canvas-error").hidden = false;
      const projectionResponse = await fetch("data/projection.json");
      if (!projectionResponse.ok) throw new Error(`projection.json HTTP ${projectionResponse.status}`);
      const projection = await projectionResponse.json();
      if (projection.space !== "shared" || projection.n_layer !== LAYERS || projection.ple_dim !== DIM ||
          projection.row_width !== WIDTH || !Number.isInteger(projection.n) || projection.n < 1 ||
          !Array.isArray(projection.points) || projection.points.length !== projection.n ||
          !Array.isArray(projection.explained_variance) || projection.explained_variance.length !== LAYERS ||
          projection.vector_file !== "vectors.i8.bin" || projection.scale_file !== "scales.f32.bin") {
        throw new Error("projection.json does not match the published 6 × 64 shared-space contract");
      }
      const [vectorResponse, scaleResponse] = await Promise.all([
        fetch("data/" + projection.vector_file), fetch("data/" + projection.scale_file)
      ]);
      if (!vectorResponse.ok || !scaleResponse.ok) throw new Error(`vector files HTTP ${vectorResponse.status} / ${scaleResponse.status}`);
      const [vectorBuffer, scaleBuffer] = await Promise.all([vectorResponse.arrayBuffer(), scaleResponse.arrayBuffer()]);
      if (vectorBuffer.byteLength !== projection.n * WIDTH || scaleBuffer.byteLength !== projection.n * 4) {
        throw new Error("vector or scale binary size does not match projection.json");
      }
      const rawScales = new DataView(scaleBuffer);
      const rowScales = Float32Array.from({ length: projection.n }, (_, i) => rawScales.getFloat32(i * 4, true));
      if (rowScales.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("invalid vector scale");
      if (projection.points.some((point) => !Number.isInteger(point.id) ||
          !Array.isArray(point.coords) || point.coords.length !== LAYERS ||
          point.coords.some((coords) => !Array.isArray(coords) || coords.length !== 3 || coords.some((v) => !Number.isFinite(v))))) {
        throw new Error("invalid projection point or coordinate");
      }
      data = projection;
      bytes = new Int8Array(vectorBuffer);
      scales = rowScales;
      norms = Array.from({ length: projection.n }, (_, row) => Array.from({ length: LAYERS + 1 }, (_, slot) => {
        const from = row * WIDTH + (slot === LAYERS ? 0 : slot * DIM);
        const length = slot === LAYERS ? WIDTH : DIM;
        let sum = 0;
        for (let k = 0; k < length; k++) sum += bytes[from + k] ** 2;
        return Math.sqrt(sum) * scales[row];
      }));
      maxNorm = Array.from({ length: LAYERS }, (_, slot) => Math.max(...norms.map((row) => row[slot]), 1e-9));
      const frequencyValues = projection.points.map((point) => Number(point.log_freq)).filter(Number.isFinite);
      freqMin = Math.min(...frequencyValues);
      freqMax = Math.max(...frequencyValues);
      if (!Number.isFinite(freqMin)) { freqMin = 0; freqMax = 1; }
      const spread = projection.points.flatMap((point) => point.coords.flat().map(Math.abs)).sort((a, b) => a - b);
      extent = Math.max(1e-6, spread[Math.floor(spread.length * .995)]);
      const clusterAvailable = projection.points.some((point) => point.cluster !== undefined && point.cluster !== null);
      if (clusterAvailable) $("color").add(new Option("Cluster", "cluster"));
      $("dataset-size").textContent = `${projection.n.toLocaleString()} PUBLISHED TOKEN ROWS`;
      $("status").textContent = "";
      $("workspace").hidden = false;
      updateLayer();
      select(0);
      updateMatches();
      if (ctx) requestDraw();
    } catch (error) { fail(error); }
  }

  function piece(point) {
    return typeof point.piece === "string" ? point.piece : String(point.id);
  }
  function tokenLabel(point) {
    return JSON.stringify(piece(point));
  }
  function select(index) {
    if (!data || index < 0 || index >= data.n) return;
    selected = index;
    const point = data.points[index];
    $("token-heading").textContent = tokenLabel(point);
    $("token-id").textContent = `ID ${point.id}`;
    $("token-meta").textContent = `Rank ${point.rank ?? "unknown"} · Frequency ${Number.isFinite(Number(point.freq)) ? Number(point.freq).toLocaleString() : "unknown"} · row ${index + 1} of ${data.n}`;
    renderHeatmap();
    renderNorms();
    renderNeighbors();
    requestDraw();
  }

  function renderHeatmap() {
    const root = $("heatmap");
    root.replaceChildren();
    const max = Math.max(...Array.from({ length: WIDTH }, (_, i) => Math.abs(bytes[selected * WIDTH + i] * scales[selected])), 1e-9);
    const cells = document.createDocumentFragment();
    for (let l = 0; l < LAYERS; l++) {
      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = `L${l}`;
      cells.append(label);
      for (let d = 0; d < DIM; d++) {
        const value = bytes[selected * WIDTH + l * DIM + d] * scales[selected];
        const intensity = Math.abs(value / max);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.style.backgroundColor = value < 0 ? `hsl(181 42% ${93 - intensity * 53}%)` : `hsl(13 64% ${93 - intensity * 45}%)`;
        const description = `Layer ${l}, dimension ${d}: ${value.toFixed(6)}`;
        cell.setAttribute("aria-label", description);
        cell.title = description;
        cell.addEventListener("pointerenter", () => { $("cell-value").textContent = description; });
        cell.addEventListener("focus", () => { $("cell-value").textContent = description; });
        cells.append(cell);
      }
    }
    root.append(cells);
    root.setAttribute("aria-label", `Heatmap of actual quantized vector values for token ${piece(data.points[selected])}, six layers by 64 dimensions`);
    $("cell-value").textContent = "Hover or focus a cell for its reconstructed value.";
  }

  function renderNorms() {
    const root = $("norms");
    root.replaceChildren();
    const max = Math.max(...norms[selected].slice(0, LAYERS), 1e-9);
    for (let l = 0; l < LAYERS; l++) {
      const row = document.createElement("div");
      row.className = `norm-row${l === layer ? " active" : ""}`;
      const name = document.createElement("span");
      name.textContent = `L${l}`;
      const track = document.createElement("span");
      track.className = "norm-track";
      const bar = document.createElement("span");
      bar.style.width = `${100 * norms[selected][l] / max}%`;
      track.append(bar);
      const value = document.createElement("span");
      value.textContent = norms[selected][l].toFixed(3);
      row.append(name, track, value);
      root.append(row);
    }
  }

  function renderNeighbors() {
    const root = $("neighbors");
    root.replaceChildren();
    const slot = $("neighbor-scope").value === "full" ? LAYERS : layer;
    const offset = slot === LAYERS ? 0 : slot * DIM;
    const length = slot === LAYERS ? WIDTH : DIM;
    const base = selected * WIDTH + offset;
    const nearby = [];
    for (let row = 0; row < data.n; row++) {
      if (row === selected || !norms[row][slot] || !norms[selected][slot]) continue;
      let dot = 0;
      const candidate = row * WIDTH + offset;
      for (let k = 0; k < length; k++) dot += bytes[base + k] * bytes[candidate + k];
      const cosine = dot * scales[selected] * scales[row] / (norms[selected][slot] * norms[row][slot]);
      if (Number.isFinite(cosine)) nearby.push({ row, cosine });
    }
    nearby.sort((a, b) => b.cosine - a.cosine || a.row - b.row);
    for (const neighbor of nearby.slice(0, 8)) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("span");
      name.textContent = `${tokenLabel(data.points[neighbor.row])} · #${data.points[neighbor.row].id}`;
      const score = document.createElement("span");
      score.textContent = neighbor.cosine.toFixed(4);
      button.append(name, score);
      button.addEventListener("click", () => select(neighbor.row));
      item.append(button);
      root.append(item);
    }
    if (!root.childElementCount) {
      const item = document.createElement("li");
      item.textContent = "No comparable nonzero vectors in this subset.";
      root.append(item);
    }
  }

  function updateMatches() {
    if (!data) return;
    const query = $("search").value.trim().toLowerCase();
    const exact = /^\d+$/.test(query) ? Number(query) : NaN;
    searchMatches = query ? data.points.map((point, index) => ({ point, index })).filter(({ point }) =>
      point.id === exact || piece(point).toLowerCase().includes(query)).sort((a, b) =>
      (b.point.id === exact) - (a.point.id === exact) || a.index - b.index).slice(0, 10) : [];
    matchIndex = 0;
    drawMatches();
  }
  function drawMatches() {
    const root = $("matches");
    root.replaceChildren();
    searchMatches.forEach(({ point, index }, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = i === matchIndex ? "active" : "";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(i === matchIndex));
      button.textContent = tokenLabel(point);
      const id = document.createElement("small");
      id.textContent = `ID ${point.id} · RANK ${point.rank ?? "—"}`;
      button.append(id);
      button.addEventListener("click", () => select(index));
      root.append(button);
    });
    if ($("search").value.trim() && !searchMatches.length) root.textContent = "No matching published tokens.";
  }

  function updateLayer() {
    layer = Number($("layer").value);
    $("layer-value").textContent = String(layer);
    const explained = data.explained_variance[layer];
    const total = Array.isArray(explained) ? explained.reduce((sum, value) => sum + Number(value), 0) : NaN;
    $("variance").textContent = Number.isFinite(total) ? `Shared 3D PCA · ${(total * 100).toFixed(1)}% total` : "Shared 3D PCA · variance unavailable";
    $("pca-caveat").textContent = Number.isFinite(total)
      ? `The shared-space PCA axes explain ${explained.map((v) => `${(v * 100).toFixed(1)}%`).join(", ")} of variance individually (${(total * 100).toFixed(1)}% together). Map distances do not replace cosine similarity in 64 dimensions.`
      : "Shared-space PCA captures only a small fraction of variance. Map distances do not replace cosine similarity in 64 dimensions.";
    if (data) { renderNorms(); renderNeighbors(); requestDraw(); }
  }

  function colorFor(index) {
    const point = data.points[index], mode = $("color").value;
    if (mode === "cluster") {
      const cluster = point.cluster;
      if (cluster === undefined || cluster === null) return "#a9bdb2";
      const hash = [...String(cluster)].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
      return clusterPalette[Math.abs(hash) % clusterPalette.length];
    }
    if (mode === "norm") {
      const fraction = Math.min(1, norms[index][layer] / maxNorm[layer]);
      return `hsl(${180 - fraction * 165} 66% ${66 - fraction * 14}%)`;
    }
    const fraction = Math.max(0, Math.min(1, (Number(point.log_freq) - freqMin) / (freqMax - freqMin || 1)));
    return `hsl(${182 - fraction * 167} 68% ${65 - fraction * 11}%)`;
  }

  function requestDraw() {
    if (ctx && data && !frame) frame = requestAnimationFrame(draw);
  }
  function draw(now) {
    frame = 0;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#102b2a";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#34504d";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const delta = layer - shownLayer;
    shownLayer = reducedMotion.matches ? layer : shownLayer + delta * Math.min(1, lastTime ? (now - lastTime) / 170 : 1);
    lastTime = now;
    const first = Math.floor(shownLayer), second = Math.min(LAYERS - 1, first + 1), blend = shownLayer - first;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const size = Math.min(width, height) * 0.39 * zoom / extent;
    projected = data.points.map((point, index) => {
      const a = point.coords[first], b = point.coords[second];
      const x = a[0] * (1 - blend) + b[0] * blend;
      const y = a[1] * (1 - blend) + b[1] * blend;
      const z = a[2] * (1 - blend) + b[2] * blend;
      const rx = x * cy - z * sy, rz = x * sy + z * cy;
      const ry = y * cp - rz * sp, depth = y * sp + rz * cp;
      const perspective = 3.5 / (3.5 + depth / extent);
      return { index, x: width / 2 + rx * size * perspective, y: height / 2 - ry * size * perspective, depth, perspective };
    }).sort((a, b) => b.depth - a.depth);
    for (const p of projected) {
      if (p.index === selected) continue;
      ctx.globalAlpha = p.index === hovered ? 1 : 0.72;
      ctx.fillStyle = colorFor(p.index);
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.index === hovered ? 5 : 2.4) * Math.max(.6, Math.min(1.7, p.perspective)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const chosen = projected.find((p) => p.index === selected);
    if (chosen) {
      ctx.strokeStyle = "#fff4d8";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(chosen.x, chosen.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ff946e";
      ctx.beginPath(); ctx.arc(chosen.x, chosen.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (Math.abs(delta) > .005 && !reducedMotion.matches) requestDraw();
  }

  function hit(x, y) {
    let best = -1, distance = 100;
    for (const point of projected) {
      const squared = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (squared < distance) { best = point.index; distance = squared; }
    }
    return best;
  }
  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (!data || !ctx) return;
    dragging = true; moved = false; startX = event.clientX; startY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!data || !ctx) return;
    if (dragging) {
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      yaw += dx * .008; pitch = Math.max(-1.5, Math.min(1.5, pitch + dy * .008));
      startX = event.clientX; startY = event.clientY;
      $("tooltip").hidden = true;
      requestDraw();
    } else {
      const { x, y } = pointerPosition(event);
      const index = hit(x, y);
      if (hovered !== index) { hovered = index; requestDraw(); }
      const tip = $("tooltip");
      tip.hidden = index < 0;
      if (index >= 0) {
        tip.textContent = `${tokenLabel(data.points[index])} · ID ${data.points[index].id}`;
        tip.style.left = `${Math.max(0, Math.min(canvas.clientWidth - 180, x + 12))}px`;
        tip.style.top = `${Math.max(0, y - 38)}px`;
      }
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    if (!moved) { const { x, y } = pointerPosition(event); select(hit(x, y)); }
  });
  canvas.addEventListener("pointercancel", () => { dragging = false; });
  canvas.addEventListener("pointerleave", () => { if (!dragging) { hovered = -1; $("tooltip").hidden = true; requestDraw(); } });
  canvas.addEventListener("wheel", (event) => {
    if (!data || !ctx) return;
    event.preventDefault();
    zoom = Math.max(.35, Math.min(5, zoom * Math.exp(-event.deltaY * .001)));
    requestDraw();
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    if (!data || !ctx) return;
    if (event.key === "ArrowLeft") yaw -= .12;
    else if (event.key === "ArrowRight") yaw += .12;
    else if (event.key === "ArrowUp") pitch = Math.max(-1.5, pitch - .12);
    else if (event.key === "ArrowDown") pitch = Math.min(1.5, pitch + .12);
    else if (event.key === "+" || event.key === "=") zoom = Math.min(5, zoom * 1.15);
    else if (event.key === "-") zoom = Math.max(.35, zoom / 1.15);
    else return;
    event.preventDefault(); requestDraw();
  });
  $("reset-view").addEventListener("click", () => { yaw = -.5; pitch = .25; zoom = 1; requestDraw(); });
  $("layer").addEventListener("input", updateLayer);
  $("color").addEventListener("change", requestDraw);
  $("neighbor-scope").addEventListener("change", () => { if (data) renderNeighbors(); });
  $("search").addEventListener("input", updateMatches);
  $("search").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!searchMatches.length) return;
    event.preventDefault();
    matchIndex = (matchIndex + (event.key === "ArrowDown" ? 1 : -1) + searchMatches.length) % searchMatches.length;
    drawMatches();
  });
  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (searchMatches.length) select(searchMatches[matchIndex].index);
    else if ($("search").value.trim()) $("matches").textContent = "No matching published tokens.";
  });
  new ResizeObserver(requestDraw).observe(canvas);
  load();
})();
