
const DEFAULT_COLORS = {
  peso:"#1593ff",
  magra:"#62ee5d",
  grasaKg:"#ff8c16",
  grasaPct:"#b25cff",
  pliegues:"#ff3d3d",
  smm:"#62ee5d",
  bfm:"#ff8c16",
  pbf:"#b25cff",
  vfl:"#ff3d3d",
  vfa:"#21d6e9",
  cintura:"#62ee5d",
  abdomen:"#ff8c16",
  cadera:"#b25cff",
  muslo:"#ff3d3d",
  brazo:"#1593ff"
};
let colors = {...DEFAULT_COLORS};
let compDates = [];
let composition = {};
let accDates = [];
let accuniq = {};
let goals = [];
let dashboardInsights = [];
let labels = { composition: "Plicometría", bioimpedance: "Bioimpedancia" };
let state = {view:"overview", metric:"pliegues", compIndex:0, accIndex:0};

const COMPOSITION_METRICS = {
  peso: ["Peso", "kg", true],
  grasaPct: ["Grasa", "%", true],
  grasaKg: ["Grasa corporal", "kg", true],
  magra: ["Masa magra", "kg", false],
  pliegues: ["Pliegues", "mm", true],
  brazo: ["Brazo", "cm", false],
  cintura: ["Cintura", "cm", true],
  abdomen: ["Abdomen", "cm", true],
  cadera: ["Cadera", "cm", true],
  muslo: ["Muslo", "cm", true]
};

const BIOIMPEDANCE_METRICS = {
  peso: ["Peso", "kg", true],
  smm: ["SMM", "kg", false],
  bfm: ["Masa grasa", "kg", true],
  pbf: ["PBF", "%", true],
  vfl: ["Grasa visceral", "nivel", true],
  vfa: ["VFA", "cm²", true]
};

const HEADER_ALIASES = {
  dashboardtitle: "dashboardTitle",
  titulotablero: "dashboardTitle",
  dashboardtitulo: "dashboardTitle",
  dashboardsubtitle: "dashboardSubtitle",
  subtitulo: "dashboardSubtitle",
  dashboarddescripcion: "dashboardSubtitle",
  paciente: "paciente",
  patient: "paciente",
  nombre: "paciente",
  edad: "edad",
  age: "edad",
  fecha: "fecha",
  date: "fecha",
  tipo: "tipo",
  type: "tipo",
  medicion: "tipo",
  equipo: "equipo",
  device: "equipo",
  peso: "peso",
  weight: "peso",
  grasapct: "grasaPct",
  grasaporcentaje: "grasaPct",
  porcentajegrasa: "grasaPct",
  grasapercent: "grasaPct",
  pgrasa: "grasaPct",
  grasakg: "grasaKg",
  masagrasa: "grasaKg",
  kggrasa: "grasaKg",
  bfm: "bfm",
  magra: "magra",
  masamagra: "magra",
  leanmass: "magra",
  pliegues: "pliegues",
  sumapliegues: "pliegues",
  plieguesmm: "pliegues",
  brazo: "brazo",
  cintura: "cintura",
  abdomen: "abdomen",
  cadera: "cadera",
  muslo: "muslo",
  smm: "smm",
  skeletalmusclemass: "smm",
  skeletalmasamuscular: "smm",
  pbf: "pbf",
  porcgrasa: "pbf",
  vfl: "vfl",
  grasavisceral: "vfl",
  visceral: "vfl",
  vfa: "vfa",
  areavisceral: "vfa"
};

function parseNumber(value){
  if(value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace("%","").replace(",",".").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseCsvLine(line){
  const result = [];
  let current = "";
  let insideQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"' && line[i+1] === '"'){
      current += '"';
      i++;
    } else if(ch === '"'){
      insideQuotes = !insideQuotes;
    } else if(ch === ',' && !insideQuotes){
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function normalizeHeader(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[%º°²]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function canonicalHeader(header){
  const normalized = normalizeHeader(header);
  return HEADER_ALIASES[normalized] || header.trim();
}

function parseCsv(text){
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if(!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(h => canonicalHeader(h));
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] || "").trim());
    return row;
  }).filter(row => Object.values(row).some(v => v !== ""));
}
function metric(label, unit, values, color, goodDown){
  return {label, unit, values, color, goodDown};
}

function buildMetricSet(source = {}, configs = {}, length = 0){
  const output = {};
  Object.entries(configs).forEach(([key, [label, unit, goodDown]]) => {
    const existing = source[key] || {};
    const values = Array.isArray(existing.values)
      ? existing.values
      : Array.from({length}, () => null);
    output[key] = {
      label: existing.label || label,
      unit: existing.unit || unit,
      values,
      color: existing.color || colors[key] || DEFAULT_COLORS[key] || "#21d6e9",
      goodDown: typeof existing.goodDown === "boolean" ? existing.goodDown : goodDown
    };
  });
  return output;
}

function safeMetric(obj, key){
  const m = obj && obj[key];
  return m && Array.isArray(m.values) ? m : null;
}

function safeDelta(current, previous){
  if(current === null || current === undefined || previous === null || previous === undefined) return null;
  return current - previous;
}

function transformSheetRows(rows){
  const compRows = rows.filter(r => (r.tipo || "").toLowerCase().includes("plic"));
  const accRows = rows.filter(r => {
    const tipo = (r.tipo || "").toLowerCase();
    return tipo.includes("bio") || tipo.includes("acc") || tipo.includes("inbody") || tipo.includes("tanita") || tipo.includes("seca");
  });
  const pick = (list, key) => list.map(r => parseNumber(r[key]));
  const last = arr => arr.length ? arr[arr.length-1] : "—";
  return {
    meta: {
      dashboardTitle: rows[0]?.dashboardTitle || "Dashboard Integral<br/>Plicometría + Bioimpedancia",
      dashboardSubtitle: rows[0]?.dashboardSubtitle || "Seguimiento visual de plicometría y bioimpedancia.",
      patientName: rows[0]?.paciente || "Paciente Demo",
      patientAge: rows[0]?.edad || "—",
      lastComposition: last(compRows.map(r => r.fecha)),
      lastAccuniq: last(accRows.map(r => r.fecha)),
      labels: { composition: "Plicometría", bioimpedance: "Bioimpedancia" }
    },
    colors,
    compDates: compRows.map(r => r.fecha),
    composition: {
      peso: metric("Peso", "kg", pick(compRows,"peso"), colors.peso, true),
      grasaPct: metric("Grasa", "%", pick(compRows,"grasaPct"), colors.grasaPct, true),
      grasaKg: metric("Grasa corporal", "kg", pick(compRows,"grasaKg"), colors.grasaKg, true),
      magra: metric("Masa magra", "kg", pick(compRows,"magra"), colors.magra, false),
      pliegues: metric("Pliegues", "mm", pick(compRows,"pliegues"), colors.pliegues, true),
      brazo: metric("Brazo", "cm", pick(compRows,"brazo"), colors.brazo, false),
      cintura: metric("Cintura", "cm", pick(compRows,"cintura"), colors.cintura, true),
      abdomen: metric("Abdomen", "cm", pick(compRows,"abdomen"), colors.abdomen, true),
      cadera: metric("Cadera", "cm", pick(compRows,"cadera"), colors.cadera, true),
      muslo: metric("Muslo", "cm", pick(compRows,"muslo"), colors.muslo, true)
    },
    accDates: accRows.map(r => r.fecha),
    accuniq: {
      peso: metric("Peso", "kg", pick(accRows,"peso"), colors.peso, true),
      smm: metric("SMM", "kg", pick(accRows,"smm"), colors.smm, false),
      bfm: metric("Masa grasa", "kg", pick(accRows,"bfm"), colors.bfm, true),
      pbf: metric("PBF", "%", pick(accRows,"pbf"), colors.pbf, true),
      vfl: metric("Grasa visceral", "nivel", pick(accRows,"vfl"), colors.vfl, true),
      vfa: metric("VFA", "cm²", pick(accRows,"vfa"), colors.vfa, true)
    },
    goals: [],
    insights: []
  };
}

function applyLabels(){
  const tab = document.getElementById("bioimpedanceTab");
  const detailLabel = document.getElementById("bioimpedanceDetailLabel");
  const tableLabel = document.getElementById("bioimpedanceTableLabel");
  if(tab) tab.textContent = labels.bioimpedance || "Bioimpedancia";
  if(detailLabel) detailLabel.textContent = labels.bioimpedance || "Bioimpedancia";
  if(tableLabel) tableLabel.textContent = labels.bioimpedance || "Bioimpedancia";
}

function applyMeta(meta = {}){
  const setHTML = (id, value) => { const el = document.getElementById(id); if(el && value !== undefined) el.innerHTML = value; };
  const setText = (id, value) => { const el = document.getElementById(id); if(el && value !== undefined) el.textContent = value; };
  setHTML("dashboardTitle", meta.dashboardTitle);
  setText("dashboardSubtitle", meta.dashboardSubtitle);
  setText("patientName", meta.patientName);
  setText("patientAge", meta.patientAge);
  setText("lastComposition", meta.lastComposition);
  setText("lastAccuniq", meta.lastAccuniq);
  labels = meta.labels || labels;
  applyLabels();
}


function getSheetUrl(params){
  const hash = window.location.hash || "";
  if(hash.startsWith("#sheet=")){
    return decodeURIComponent(hash.slice(7));
  }
  return params.get("sheet");
}

async function loadDashboardData(){
  const params = new URLSearchParams(window.location.search);
  const sheetUrl = getSheetUrl(params);
  const dataUrl = params.get("data") || "./data/dashboard-data.json";

  if(sheetUrl){
    const response = await fetch(`${sheetUrl}${sheetUrl.includes("?") ? "&" : "?"}cacheBust=${Date.now()}`);
    if(!response.ok) throw new Error("No se pudo cargar la hoja publicada.");
    const rows = parseCsv(await response.text());
    return transformSheetRows(rows);
  }

  const response = await fetch(dataUrl);
  if(!response.ok) throw new Error("No se pudo cargar data/dashboard-data.json");
  return response.json();
}

async function bootstrap(){
  try{
    const data = await loadDashboardData();
    colors = {...DEFAULT_COLORS, ...(data.colors || {})};
    compDates = Array.isArray(data.compDates) ? data.compDates : [];
    accDates = Array.isArray(data.accDates) ? data.accDates : [];
    composition = buildMetricSet(data.composition || {}, COMPOSITION_METRICS, compDates.length);
    accuniq = buildMetricSet(data.accuniq || data.bioimpedancia || {}, BIOIMPEDANCE_METRICS, accDates.length);
    goals = Array.isArray(data.goals) ? data.goals : [];
    labels = data.labels || data.meta?.labels || labels;
    dashboardInsights = Array.isArray(data.insights) ? data.insights : [];
    state.compIndex = Math.max(0, compDates.length - 1);
    state.accIndex = Math.max(0, accDates.length - 1);
    applyMeta(data.meta || {});
    renderAll();
  } catch(error){
    document.body.innerHTML = `<div class="app"><div class="panel"><h1>No se pudo cargar el dashboard</h1><p class="mini">${error.message}</p><p class="mini">Para verlo localmente, ejecuta un servidor: <code>python3 -m http.server 8000</code>.</p></div></div>`;
    console.error(error);
  }
}

function fmt(n){
  if(n===null || n===undefined) return "—";
  return Number.isInteger(n) ? String(n) : (Math.round(n*100)/100).toString();
}
function deltaClass(delta, goodDown){
  if(Math.abs(delta)<0.0001) return "neutral";
  return goodDown ? (delta<0 ? "good":"bad") : (delta>0 ? "good":"bad");
}
function deltaText(delta, unit){
  if(delta===null || delta===undefined) return "—";
  const sign = delta>0?"+":"";
  return `${sign}${fmt(delta)} ${unit||""}`;
}
function getMode(){
  if(state.view==="accuniq") return "acc";
  if(state.view==="composition") return "comp";
  return state.metric in accuniq && !(state.metric in composition) ? "acc":"comp";
}
function metricSource(){
  const mode = getMode();
  if(mode==="acc") return {data:accuniq, dates:accDates, index:state.accIndex};
  return {data:composition, dates:compDates, index:state.compIndex};
}

function renderDateButtons(){
  const box = document.getElementById("dateBtns");
  box.innerHTML = "";
  compDates.forEach((d,i)=>{
    const btn = document.createElement("button");
    btn.textContent = d;
    btn.className = i===state.compIndex ? "active" : "";
    btn.onclick = ()=>{ state.compIndex=i; renderAll(); };
    box.appendChild(btn);
  });
  const accBtn = document.createElement("button");
  accBtn.textContent = accDates.length ? `${labels.bioimpedance || "Bioimpedancia"} ${accDates[state.accIndex] || accDates[accDates.length-1]}` : (labels.bioimpedance || "Bioimpedancia");
  accBtn.className = state.view==="accuniq" ? "ghost" : "ghost";
  accBtn.onclick=()=>{state.view="accuniq";state.accIndex=Math.max(0, accDates.length-1);renderAll();};
  box.appendChild(accBtn);
}
function renderTabs(){
  document.querySelectorAll(".tabs button").forEach(b=>{
    b.classList.toggle("active", b.dataset.view===state.view);
    b.onclick=()=>{state.view=b.dataset.view; renderAll();}
  });
}
function renderMetricButtons(){
  const box = document.getElementById("metricBtns");
  const metricKeys = state.view==="accuniq"
    ? Object.keys(accuniq)
    : state.view==="composition"
      ? Object.keys(composition)
      : ["pliegues","grasaPct","grasaKg","magra","cintura","abdomen","peso","smm","bfm","pbf","vfl"];
  box.innerHTML="";
  metricKeys.forEach(k=>{
    const src = composition[k] || accuniq[k];
    if(!src) return;
    const btn=document.createElement("button");
    btn.textContent=src.label;
    btn.className=k===state.metric?"active":"";
    btn.onclick=()=>{state.metric=k; renderAll();};
    box.appendChild(btn);
  });
  if(!metricKeys.includes(state.metric) || !(composition[state.metric] || accuniq[state.metric])) state.metric=metricKeys.find(k => composition[k] || accuniq[k]) || "peso";
}
function renderKpis(){
  const k = document.getElementById("kpis");
  const cards = [
    {name:"Peso plicometría", val:composition.peso?.values?.[state.compIndex], prev:composition.peso?.values?.[Math.max(0,state.compIndex-1)], unit:"kg", color:colors.peso, goodDown:true},
    {name:"Grasa plicometría", val:composition.grasaPct?.values?.[state.compIndex], prev:composition.grasaPct?.values?.[Math.max(0,state.compIndex-1)], unit:"%", color:colors.grasaPct, goodDown:true},
    {name:"Pliegues", val:composition.pliegues?.values?.[state.compIndex], prev:composition.pliegues?.values?.[Math.max(0,state.compIndex-1)], unit:"mm", color:colors.pliegues, goodDown:true},
    {name:"Masa magra", val:composition.magra?.values?.[state.compIndex], prev:composition.magra?.values?.[Math.max(0,state.compIndex-1)], unit:"kg", color:colors.magra, goodDown:false},
    {name:`SMM ${labels.bioimpedance || "Bioimpedancia"}`, val:accuniq.smm?.values?.[state.accIndex], prev:accuniq.smm?.values?.[Math.max(0,state.accIndex-1)], unit:"kg", color:colors.smm, goodDown:false},
    {name:`PBF ${labels.bioimpedance || "Bioimpedancia"}`, val:accuniq.pbf?.values?.[state.accIndex], prev:accuniq.pbf?.values?.[Math.max(0,state.accIndex-1)], unit:"%", color:colors.pbf, goodDown:true}
  ];
  k.innerHTML = cards.map(c=>{
    const d = safeDelta(c.val, c.prev);
    return `<div class="panel kpi" style="--accent:${c.color}">
      <div class="name">${c.name}</div>
      <div class="value" style="color:${c.color}">${fmt(c.val)} <small style="font-size:15px;color:var(--muted)">${c.unit}</small></div>
      <div class="delta ${d === null ? "neutral" : deltaClass(d,c.goodDown)}">${deltaText(d,c.unit)} vs anterior</div>
    </div>`;
  }).join("");
}

function drawLineChart(svgId, dates, metric, activeIndex){
  const svg = document.getElementById(svgId);
  svg.innerHTML = "";
  const vals = (metric.values || []).map(v=>v===null?null:Number(v));
  const valid = vals.filter(v=>v!==null && Number.isFinite(v));
  if(!valid.length){ svg.innerHTML = `<text x="20" y="40" class="tickText">Sin datos disponibles</text>`; return; }
  const w = svg.clientWidth || 600, h = svg.clientHeight || 280;
  const pad = {l:50,r:22,t:28,b:42};
  const min = Math.min(...valid), max = Math.max(...valid);
  const span = max-min || 1;
  const ymin = min - span*.12, ymax = max + span*.12;
  const x = i => pad.l + (w-pad.l-pad.r)*(vals.length <= 1 ? 0.5 : i/(vals.length-1));
  const y = v => pad.t + (h-pad.t-pad.b)*(1-(v-ymin)/(ymax-ymin));
  const ns = "http://www.w3.org/2000/svg";
  function el(name, attrs){
    const e = document.createElementNS(ns,name);
    Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
    svg.appendChild(e); return e;
  }
  for(let i=0;i<5;i++){
    const yy = pad.t + (h-pad.t-pad.b)*i/4;
    el("line",{x1:pad.l,y1:yy,x2:w-pad.r,y2:yy,class:"axis"});
    const tv = ymax - (ymax-ymin)*i/4;
    const text = el("text",{x:8,y:yy+4,class:"tickText"});
    text.textContent = fmt(tv);
  }
  let d="";
  vals.forEach((v,i)=>{
    if(v===null) return;
    d += (d===""?"M":"L")+x(i)+" "+y(v)+" ";
  });
  el("path",{d,stroke:metric.color,class:"line"});
  vals.forEach((v,i)=>{
    if(v===null) return;
    const c = el("circle",{cx:x(i),cy:y(v),r:i===activeIndex?7:5,fill:metric.color,class:i===activeIndex?"dot active":"dot",style:`color:${metric.color}`});
    c.addEventListener("mousemove",ev=>showTip(ev,`${dates[i]}<br><b>${metric.label}</b>: ${fmt(v)} ${metric.unit}`));
    c.addEventListener("mouseleave",hideTip);
    c.addEventListener("click",()=>{ if(dates===compDates) state.compIndex=i; else state.accIndex=i; renderAll(); });
    const t = el("text",{x:x(i)-12,y:y(v)-13,fill:i===activeIndex?metric.color:"#f2f5f7",class:"valueText"});
    t.textContent=fmt(v);
  });
  dates.forEach((dt,i)=>{
    if(i%2!==0 && dates.length>7 && i!==dates.length-1) return;
    const t = el("text",{x:x(i),y:h-15,"text-anchor":"middle",class:"tickText",fill:i===activeIndex?metric.color:"#9aa7b2"});
    t.textContent = dt.split("\n")[0];
  });
}

function renderMainChart(){
  let src;
  if(state.metric in composition && state.view!=="accuniq") src = {data:composition,dates:compDates,index:state.compIndex};
  else src = {data:accuniq,dates:accDates,index:state.accIndex};
  let metric = src.data[state.metric];
  if(!metric || !Array.isArray(metric.values)){
    metric = Object.values(src.data).find(m => m && Array.isArray(m.values)) || {label:"Sin datos", unit:"", values:[], color:"#21d6e9", goodDown:true};
  }
  document.getElementById("mainChartTitle").innerHTML = `${metric.label} <span class="badge">${metric.unit}</span>`;
  drawLineChart("mainChart", src.dates, metric, src.index);
}

function renderNormChart(){
  const svg = document.getElementById("normChart");
  svg.innerHTML = "";
  const series = state.view==="accuniq"
    ? [["Peso",accuniq.peso],["SMM",accuniq.smm],["BFM",accuniq.bfm],["PBF",accuniq.pbf],["VFL",accuniq.vfl]]
    : [["Peso",composition.peso],["Magra",composition.magra],["Grasa kg",composition.grasaKg],["Grasa %",composition.grasaPct],["Pliegues",composition.pliegues]];
  const dates = state.view==="accuniq" ? accDates : compDates;
  const activeIndex = state.view==="accuniq" ? state.accIndex : state.compIndex;
  if(!dates.length){ svg.innerHTML = `<text x="20" y="40" class="tickText">Sin datos disponibles</text>`; return; }
  const w = svg.clientWidth || 600, h = svg.clientHeight || 280;
  const pad={l:50,r:95,t:28,b:42}, ymin=60,ymax=115;
  const ns="http://www.w3.org/2000/svg";
  function el(name,attrs){const e=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));svg.appendChild(e);return e;}
  for(let i=0;i<5;i++){
    const yy=pad.t+(h-pad.t-pad.b)*i/4;
    el("line",{x1:pad.l,y1:yy,x2:w-pad.r,y2:yy,class:"axis"});
    const tv=ymax-(ymax-ymin)*i/4;
    const text=el("text",{x:8,y:yy+4,class:"tickText"}); text.textContent=fmt(tv);
  }
  const x=i=>pad.l+(w-pad.l-pad.r)*(dates.length <= 1 ? 0.5 : i/(dates.length-1));
  const y=v=>pad.t+(h-pad.t-pad.b)*(1-(v-ymin)/(ymax-ymin));
  series.filter(([name,m]) => m && Array.isArray(m.values)).forEach(([name,m],idx)=>{
    const baseValue = m.values.find(x=>x!==null && x!==0);
    if(!baseValue) return;
    const vals=m.values.map(v=>v===null?null:v/baseValue*100);
    let d="";
    vals.forEach((v,i)=>{if(v===null)return;d+=(d===""?"M":"L")+x(i)+" "+y(v)+" ";});
    el("path",{d,stroke:m.color,class:"line"});
    vals.forEach((v,i)=>{if(v===null)return;el("circle",{cx:x(i),cy:y(v),r:i===activeIndex?6:4,fill:m.color});});
    const last = vals[vals.length-1];
    if(last!==null){
      el("text",{x:w-pad.r+8,y:y(last)+4,fill:m.color,class:"valueText"}).textContent=`${name} ${fmt(last)}`;
    }
  });
}

function showTip(ev, html){
  const t=document.getElementById("tooltip");
  t.innerHTML=html; t.style.display="block";
  t.style.left=(ev.clientX+14)+"px"; t.style.top=(ev.clientY+14)+"px";
}
function hideTip(){document.getElementById("tooltip").style.display="none";}

function detailList(obj, index, keys){
  return keys.map(k=>{
    const m=obj[k], v=m?.values[index];
    if(!m || v===undefined) return "";
    return `<div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.08);padding:8px 0">
      <span class="mini">${m.label}</span><b style="color:${m.color}">${fmt(v)} ${m.unit}</b>
    </div>`;
  }).join("");
}
function renderDetails(){
  document.getElementById("activeDateBadge").textContent = compDates[state.compIndex] || "—";
  document.getElementById("compositionDetail").innerHTML = detailList(composition,state.compIndex,["peso","grasaPct","grasaKg","magra","pliegues","cintura","abdomen"]);
  document.getElementById("accuniqDetail").innerHTML = detailList(accuniq,state.accIndex,["peso","smm","bfm","pbf","vfl","vfa"]);
}
function renderGoals(){
  if(!goals.length){ document.getElementById("goals").innerHTML = `<div class="mini">Sin metas cargadas.</div>`; return; }
  document.getElementById("goals").innerHTML = goals.map(g=>{
    const remaining = g.goodDown ? Math.max(0,g.current-g.target) : Math.max(0,g.target-g.current);
    const base = g.goodDown ? Math.max(.01,g.current) : Math.max(.01,g.target);
    const pct = Math.max(0,Math.min(100,100-(remaining/base*100)));
    return `<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <b>${g.label}</b>
        <span class="mini">Actual: <b>${fmt(g.current)} ${g.unit}</b> · Meta: <b>${fmt(g.target)} ${g.unit}</b></span>
      </div>
      <div class="progressBar"><div class="progressFill" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
}
function makeTable(obj, prevIndex, curIndex, keys){
  let html="<tr><th>Métrica</th><th>Anterior</th><th>Actual</th><th>Cambio</th><th>%</th></tr>";
  keys.forEach(k=>{
    const m = safeMetric(obj, k);
    if(!m) return;
    const prev=m.values[prevIndex], cur=m.values[curIndex];
    if(prev===null || cur===null || prev===undefined || cur===undefined || prev === 0) return;
    const d=cur-prev, pct=d/prev*100, cls=deltaClass(d,m.goodDown);
    html += `<tr>
      <td><b style="color:${m.color}">●</b> ${m.label}</td>
      <td>${fmt(prev)} ${m.unit}</td>
      <td><b>${fmt(cur)} ${m.unit}</b></td>
      <td class="${cls}">${deltaText(d,m.unit)}</td>
      <td class="${cls}">${d>0?"+":""}${fmt(pct)}%</td>
    </tr>`;
  });
  return html;
}
function renderTables(){
  document.getElementById("compositionTable").innerHTML = makeTable(composition,Math.max(0,state.compIndex-1),state.compIndex,["peso","grasaPct","grasaKg","magra","pliegues","brazo","cintura","abdomen","cadera","muslo"]);
  document.getElementById("accuniqTable").innerHTML = makeTable(accuniq,Math.max(0,state.accIndex-1),state.accIndex,["peso","smm","bfm","pbf","vfl","vfa"]);
  document.getElementById("changeSubtitle").textContent = "última medición vs anterior";
}
function renderInsights(){
  const items = Array.isArray(dashboardInsights) && dashboardInsights.length ? dashboardInsights : ["<b>Dashboard activo:</b> agrega insights en la hoja o JSON para mostrar lectura ejecutiva."];
  document.getElementById("insights").innerHTML = items.map(x=>`<div class="insight">${x}</div>`).join("");
}

function renderAll(){
  renderTabs(); renderDateButtons(); renderMetricButtons(); renderKpis();
  renderMainChart(); renderNormChart(); renderDetails(); renderGoals(); renderTables(); renderInsights();
}
window.addEventListener("resize",()=>{renderMainChart();renderNormChart();});
bootstrap();