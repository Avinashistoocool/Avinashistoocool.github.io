// All candidate measurements below are transcribed from analysis/RESULTS.md.
const candidates = [
  {run:"llm",id:48,proxy:.6668,params:298026,origin:"mutate",idea:"Introduce depthwise separable convolutions (DSConv) in the first stage of the parent architecture.",test:.8934},
  {run:"llm",id:0,proxy:.6644,params:288746,origin:"seed:simple_cnn",idea:"Plain 3-stage VGG-style CNN with BatchNorm and max-pooling.",test:.8864},
  {run:"llm",id:2,proxy:.6610,params:321578,origin:"seed:mobile_small",idea:"MobileNetV2-style inverted residual blocks (expansion 4) with depthwise convolutions."},
  {run:"llm",id:24,proxy:.6552,params:297256,origin:"mutate",idea:"Introduce a depthwise separable convolution (DSConv) in the first stage to potentially reduce parameters and improve efficiency."},
  {run:"llm",id:4,proxy:.6542,params:295290,origin:"mutate",idea:"Introduce a depthwise separable convolution in the third stage of the parent architecture to reduce parameters and improve efficiency."},
  {run:"random",id:30,proxy:.6908,params:627870,origin:"random",idea:"Inverted blocks, widths [64, 96, 144], depths [3, 3, 3], k=3, ReLU, residuals and SE.",test:.9133},
  {run:"random",id:5,proxy:.6900,params:801326,origin:"random",idea:"Inverted blocks, widths [64, 96, 144], depths [3, 3, 3], k=3, SiLU, residuals and SE.",test:.9272},
  {run:"random",id:22,proxy:.6846,params:614106,origin:"random",idea:"Inverted blocks, widths [64, 96, 144], depths [3, 1, 2], k=3, SiLU, residuals without SE."},
  {run:"random",id:1,proxy:.6550,params:418586,origin:"random",idea:"Inverted blocks, widths [64, 128], depths [3, 3], k=3, GELU, residuals without SE."},
  {run:"random",id:0,proxy:.6506,params:525394,origin:"random",idea:"Inverted blocks, widths [48, 72, 112, 160], depths [2, 3, 2, 2], k=3, SiLU, residuals without SE."}
];
const plot = document.querySelector("#plot");
const list = document.querySelector("#candidate-list");
const report = "https://github.com/Avinashistoocool/llm-nas/blob/master/analysis/RESULTS.md";
let filter = "all";
let selected = candidates[0];
const percent = n => (n * 100).toFixed(2) + "%";
const name = c => `${c.run === "llm" ? "LLM" : "Random"} #${c.id}`;

function choose(candidate) {
  selected = candidate;
  document.querySelector("#detail-name").textContent = name(candidate);
  document.querySelector("#detail-idea").textContent = candidate.idea;
  document.querySelector("#detail-proxy").textContent = percent(candidate.proxy);
  document.querySelector("#detail-params").textContent = candidate.params.toLocaleString("en-US");
  document.querySelector("#detail-origin").textContent = candidate.origin;
  document.querySelector("#detail-test").textContent = candidate.test === undefined ? "Not reported" : percent(candidate.test) + " (20 epochs)";
  document.querySelector("#detail-link").href = report + (candidate.run === "llm" ? "#top-5-of-llm_qwen3b" : "#top-5-of-random");
  document.querySelectorAll("[data-candidate]").forEach(button => {
    const active = button.dataset.candidate === `${candidate.run}-${candidate.id}`;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function render() {
  plot.replaceChildren();
  list.replaceChildren();
  const visible = candidates.filter(c => filter === "all" || c.run === filter);
  if (!visible.includes(selected)) selected = visible[0];
  for (const candidate of visible) {
    const key = `${candidate.run}-${candidate.id}`;
    const label = `${name(candidate)}: ${percent(candidate.proxy)} proxy validation, ${candidate.params.toLocaleString("en-US")} parameters${candidate.test === undefined ? "" : ", " + percent(candidate.test) + " finalist test"}`;
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `dot-button ${candidate.run}`;
    dot.dataset.candidate = key;
    dot.setAttribute("aria-label", label);
    dot.title = label;
    dot.style.left = `${(candidate.params - 250000) / 600000 * 100}%`;
    dot.style.bottom = `${(candidate.proxy - .60) / .10 * 100}%`;
    dot.addEventListener("click", () => choose(candidate));
    dot.addEventListener("mouseenter", () => choose(candidate));
    plot.append(dot);
    const row = document.createElement("button");
    row.type = "button";
    row.className = candidate.run;
    row.dataset.candidate = key;
    row.setAttribute("aria-label", label);
    const title = document.createElement("span");
    title.textContent = name(candidate);
    const accuracy = document.createElement("strong");
    accuracy.textContent = percent(candidate.proxy);
    row.append(title, accuracy);
    row.addEventListener("click", () => choose(candidate));
    row.addEventListener("mouseenter", () => choose(candidate));
    list.append(row);
  }
  choose(selected);
}
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
  filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach(item => {
    const active = item === button;
    item.classList.toggle("selected", active);
    item.setAttribute("aria-pressed", String(active));
  });
  render();
}));
document.querySelector("#copy-command").addEventListener("click", async event => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(document.querySelector("#commands").textContent);
    button.textContent = "Copied!";
  } catch {
    button.textContent = "Select text to copy";
  }
  setTimeout(() => { button.textContent = "Copy commands"; }, 2500);
});
render();
