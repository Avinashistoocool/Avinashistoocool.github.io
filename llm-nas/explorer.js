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
const tbody = document.querySelector("#candidate-table tbody");
const headings = [...document.querySelectorAll("[data-sort]")];
let sort = "proxy";
let ascending = false;
const percent = n => (n * 100).toFixed(2) + "%";

function render() {
  const sorted = [...candidates].sort((a, b) => {
    const av = a[sort] ?? -1;
    const bv = b[sort] ?? -1;
    return (typeof av === "string" ? av.localeCompare(bv) : av - bv) * (ascending ? 1 : -1);
  });
  tbody.replaceChildren();
  for (const candidate of sorted) {
    const row = document.createElement("tr");
    const values = [
      candidate.run === "llm" ? "LLM" : "Random",
      "#" + candidate.id,
      percent(candidate.proxy),
      candidate.params.toLocaleString("en-US"),
      candidate.idea + (candidate.origin.startsWith("seed") ? " (hand-designed seed)" : ""),
      candidate.test === undefined ? "Not evaluated" : percent(candidate.test)
    ];
    for (const [index, value] of values.entries()) {
      const cell = document.createElement("td");
      if (index === 0) {
        const tag = document.createElement("span");
        tag.className = "tag " + candidate.run;
        tag.textContent = value;
        cell.append(tag);
      } else {
        cell.textContent = value;
      }
      row.append(cell);
    }
    tbody.append(row);
  }
  for (const heading of headings) {
    const active = heading.dataset.sort === sort;
    heading.closest("th").setAttribute("aria-sort", active ? (ascending ? "ascending" : "descending") : "none");
    heading.querySelector("span").textContent = active ? (ascending ? "↑" : "↓") : "↕";
  }
}
for (const heading of headings) {
  heading.addEventListener("click", () => {
    if (sort === heading.dataset.sort) ascending = !ascending;
    else {
      sort = heading.dataset.sort;
      ascending = sort === "id" || sort === "params" || sort === "run";
    }
    render();
  });
}
render();
