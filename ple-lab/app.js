(() => {
  "use strict";
  const SVG = "http://www.w3.org/2000/svg";
  const chart = document.getElementById("chart");
  const title = document.getElementById("chart-title");
  const description = document.getElementById("chart-description");
  const selection = document.getElementById("chart-selection");
  const source = document.getElementById("chart-source");
  const key = document.getElementById("chart-key");
  const series = {
    steps: [250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000],
    baseline: [3.5031, 2.928, 2.6683, 2.5085, 2.3905, 2.3009, 2.2281, 2.1604, 2.11, 2.0737, 2.0435, 2.0288],
    ple: [3.4508, 2.8717, 2.6055, 2.4466, 2.3379, 2.2567, 2.1892, 2.1336, 2.091, 2.059, 2.033, 2.0198]
  };
  const ablations = [
    {label:"L0", value:0.08986}, {label:"L1", value:0.04341}, {label:"L2", value:0.02780},
    {label:"L3", value:0.02930}, {label:"L4", value:0.02454}, {label:"L5", value:0.03110},
    {label:"ALL", value:0.62097}
  ];
  const cache = [
    {label:"GPU", mb:309.1, hit:null, peak:496.7, p50:46.56, rate:5453},
    {label:"LRU 1%", mb:3.1, hit:77.4, peak:190.8, p50:49.91, rate:5030},
    {label:"LRU 5%", mb:15.5, hit:87.9, peak:203.1, p50:51.17, rate:4686},
    {label:"LRU 20%", mb:61.8, hit:87.9, peak:249.4, p50:57.09, rate:4436},
    {label:"TOP-K 5%", mb:15.5, hit:95.5, peak:203.1, p50:58.14, rate:4387}
  ];
  const modes = {
    training: {
      title:"Validation loss, one seed per model",
      description:"Same dense configuration and 24.6M sampled training-token positions, one seed each. The PLE model has more parameters and took longer to train. A 0.009 nats/token gap from one seed cannot establish an improvement.",
      source:"https://github.com/Avinashistoocool/PLE-Lab#results-rtx-4050-laptop-6-gb",
      legend:[["Baseline", "#43948a"], ["PLE, 64 dimensions", "#df603d"]],
      desc:"Validation loss from steps 250–3000 for baseline-small and ple-small, one training seed each."
    },
    ablation: {
      title:"Ablation of PLE token input by layer",
      description:"On 25,500 TinyStories validation predictions, remove each layer’s token input in turn—or remove all of them. The context path stays active.",
      source:"https://github.com/Avinashistoocool/PLE-Lab/blob/master/results/explorer_findings.json",
      legend:[["Single layer", "#43948a"], ["All layers", "#df603d"]],
      desc:"Delta loss in nats when a layer or all PLE token inputs are zeroed. All layers together: 0.621."
    },
    cache: {
      title:"Static 5% row cache on synthetic-big",
      description:"Synthetic-big prefill: compare resident table/cache VRAM with the share of token lookups served from cache. Less memory does not imply less latency.",
      source:"https://github.com/Avinashistoocool/PLE-Lab/blob/master/results/offload/synthetic-big-20261112-192517.json",
      legend:[["Table VRAM (MB)", "#df603d"], ["Hit rate (%)", "#43948a"]],
      desc:"Synthetic-big prefill table VRAM in MB as bars, and token hit rate as green circles for cached strategies."
    },
    latency: {
      title:"Prefill latency by table source",
      description:"Synthetic-big prefill, full-model B=1 × 256: compare measured p50 latency per forward. The small cache reduces VRAM; its forward pass can be slower.",
      source:"https://github.com/Avinashistoocool/PLE-Lab/blob/master/results/offload/synthetic-big-20261112-192517.json",
      legend:[["All-in-GPU", "#43948a"], ["Offloaded cache", "#df603d"]],
      desc:"Synthetic-big prefill median forward latency in milliseconds: GPU 46.56, LRU 1% 49.91, LRU 5% 51.17, LRU 20% 57.09, top-k 5% 58.14."
    }
  };
  function node(tag, attrs = {}, parent = chart) {
    const el = document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
    parent.appendChild(el);
    return el;
  }
  function text(x, y, value, options = {}) {
    const t = node("text", {x,y,fill:"#526563","font-size":11,"font-family":"ui-monospace, Consolas, monospace",...options});
    t.textContent = value;
    return t;
  }
  function inspect(el, label, value) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `${label}: ${value}. Press Enter for details.`);
    const select = () => {selection.textContent = `${label} · ${value}`;};
    el.addEventListener("click", select);
    el.addEventListener("focus", select);
    el.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {event.preventDefault();select();}
    });
  }
  function grid(yMin,yMax,ticks,unit) {
    const top=25, bottom=300, left=55, right=620;
    const scale=v=> bottom-(v-yMin)/(yMax-yMin)*(bottom-top);
    ticks.forEach(v=>{const y=scale(v);node("line",{x1:left,y1:y,x2:right,y2:y,stroke:"#dce3da","stroke-width":1});text(left-8,y+4,String(v),{"text-anchor":"end"});});
    text(left,16,unit,{"font-weight":"bold",fill:"#152c2c"});
    node("line",{x1:left,y1:bottom,x2:right,y2:bottom,stroke:"#71877d"});
    return {scale,top,bottom,left,right};
  }
  function plotTraining() {
    const {scale,bottom,left,right}=grid(1.9,3.7,[2,2.4,2.8,3.2,3.6],"VALIDATION LOSS ↓");
    const x=i=>left+i*(right-left)/(series.steps.length-1);
    [0,2,4,6,8,11].forEach(i=>text(x(i),bottom+21,String(series.steps[i]),{"text-anchor":"middle"}));
    text(right,bottom+43,"TRAINING STEP",{"text-anchor":"end"});
    [["baseline","#43948a"],["ple","#df603d"]].forEach(([name,color])=>{
      node("polyline",{points:series[name].map((v,i)=>`${x(i)},${scale(v)}`).join(" "),fill:"none",stroke:color,"stroke-width":3,"stroke-linejoin":"round"});
      series[name].forEach((v,i)=>{
        const circle=node("circle",{class:"chart-point",cx:x(i),cy:scale(v),r:5,fill:color,stroke:"#fbfaf4","stroke-width":1.5});
        inspect(circle,`${name==="ple"?"PLE":"Baseline"} at step ${series.steps[i]}`,`${v.toFixed(4)} validation loss`);
      });
    });
  }
  function plotAblation() {
    const {scale,bottom,left,right}=grid(0,.7,[0,.1,.2,.3,.4,.5,.6,.7],"CHANGE IN LOSS (NATS) ↑");
    const slot=(right-left)/ablations.length;
    ablations.forEach((item,i)=>{
      const w=Math.min(slot-16,56), x=left+i*slot+(slot-w)/2, y=scale(item.value);
      const rect=node("rect",{class:"chart-bar",x,y,width:w,height:bottom-y,fill:i===6?"#df603d":"#43948a"});
      inspect(rect,`Remove ${item.label==="ALL"?"all layers":item.label}`,`+${item.value.toFixed(5)} nats per prediction`);
      text(x+w/2,bottom+22,item.label,{"text-anchor":"middle"});
      text(x+w/2,y-8,`+${item.value.toFixed(3)}`,{"text-anchor":"middle",fill:"#152c2c","font-size":10});
    });
  }
  function plotCache() {
    const {scale,bottom,left,right,top}=grid(0,350,[0,100,200,300],"RESIDENT TABLE / CACHE VRAM (MB)");
    const slot=(right-left)/cache.length;
    cache.forEach((item,i)=>{
      const w=Math.min(slot-28,62), x=left+i*slot+(slot-w)/2, y=scale(item.mb);
      const rect=node("rect",{class:"chart-bar",x,y,width:w,height:bottom-y,fill:"#df603d"});
      inspect(rect,`${item.label} resident table memory`,`${item.mb.toFixed(1)} MB${item.hit===null?"":`, ${item.hit.toFixed(1)}% hit rate`}`);
      text(x+w/2,y-8,`${item.mb.toFixed(1)}`,{"text-anchor":"middle",fill:"#152c2c","font-size":10});
      if(item.hit!==null) {
        const dot=node("circle",{class:"chart-point",cx:x+w/2,cy:top+(100-item.hit)/100*170,r:8,fill:"#43948a",stroke:"#fff","stroke-width":2});
        inspect(dot,`${item.label} token hits`,`${item.hit.toFixed(1)}% hit rate; ${item.mb.toFixed(1)} MB resident`);
        text(x+w/2,top+(100-item.hit)/100*170-14,`${item.hit.toFixed(1)}%`,{"text-anchor":"middle",fill:"#2c6e67","font-size":10});
      }
      text(x+w/2,bottom+22,item.label,{"text-anchor":"middle","font-size":10});
    });
  }
  function plotLatency() {
    const {scale,bottom,left,right}=grid(0,65,[0,10,20,30,40,50,60],"P50 LATENCY PER FORWARD (MS) ↓");
    const slot=(right-left)/cache.length;
    cache.forEach((item,i)=>{
      const w=Math.min(slot-28,68),x=left+i*slot+(slot-w)/2,y=scale(item.p50);
      const rect=node("rect",{class:"chart-bar",x,y,width:w,height:bottom-y,fill:i===0?"#43948a":"#df603d"});
      inspect(rect,`${item.label} synthetic-big prefill`,`p50 ${item.p50.toFixed(2)} ms; ${item.mb.toFixed(1)} MB table VRAM; ${item.rate.toLocaleString("en-US")} tokens/s`);
      text(x+w/2,y-9,item.p50.toFixed(2),{"text-anchor":"middle",fill:"#152c2c","font-size":11});
      text(x+w/2,bottom+22,item.label,{"text-anchor":"middle","font-size":10});
    });
  }
  const plots={training:plotTraining,ablation:plotAblation,cache:plotCache,latency:plotLatency};
  function render(mode) {
    document.querySelectorAll("[data-chart]").forEach(button=>{
      const active=button.dataset.chart===mode;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    const info=modes[mode];
    title.textContent=info.title;
    description.textContent=info.description;
    source.href=info.source;
    document.getElementById("chart-index").textContent=`FIGURE ${String(Object.keys(modes).indexOf(mode)+1).padStart(2,"0")} / 04`;
    key.replaceChildren(...info.legend.map(([label,color])=>{
      const span=document.createElement("span"),swatch=document.createElement("i");
      swatch.style.setProperty("--swatch",color);
      span.append(swatch,document.createTextNode(label));
      return span;
    }));
    selection.textContent="Select a plotted point to inspect it.";
    chart.replaceChildren();
    node("title",{id:"chart-svg-title"}).textContent=info.title;
    node("desc",{id:"chart-svg-desc"}).textContent=info.desc;
    chart.setAttribute("aria-label",info.desc);
    plots[mode]();
  }
  document.querySelectorAll("[data-chart]").forEach(button=>button.addEventListener("click",()=>render(button.dataset.chart)));
  const layerDeltas=ablations.slice(0,6).map(item=>item.value);
  document.querySelectorAll("[data-layer]").forEach(button=>button.addEventListener("click",()=>{
    const layer=Number(button.dataset.layer),delta=layerDeltas[layer];
    document.querySelectorAll("[data-layer]").forEach(item=>{
      const selected=item===button;
      item.classList.toggle("selected",selected);
      item.setAttribute("aria-pressed",String(selected));
    });
    document.getElementById("layer-name").textContent=`L${layer}`;
    document.getElementById("layer-note").textContent=`Removing only layer ${layer}’s token input raises validation loss by +${delta.toFixed(3)} nats per prediction.`;
    document.getElementById("layer-meter").style.width=`${delta/layerDeltas[0]*100}%`;
  }));
  render("training");
})();
