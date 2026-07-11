
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
  bmi:"#21d6e9",
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

const DEFAULT_MONTH_GOALS = [
  {label:"Peso", targetLabel:"71.8–72.3 kg"},
  {label:"Grasa %", targetLabel:"18.0–18.3%"},
  {label:"Grasa kg", targetLabel:"13.0–13.3 kg"},
  {label:"Masa magra", targetLabel:"≥59.0 kg"},
  {label:"Pliegues", targetLabel:"94–96 mm"},
  {label:"Cintura", targetLabel:"85.0–85.5 cm"},
  {label:"Abdomen", targetLabel:"89.0–89.5 cm"}
];

function getDefaultGoals(){
  return DEFAULT_MONTH_GOALS.map(g => ({...g}));
}

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
  peso:  ["Peso",           "kg",    true],
  smm:   ["Masa muscular",  "kg",    false],
  bfm:   ["Grasa corporal", "kg",    true],
  pbf:   ["Grasa",          "%",     true],
  vfl:   ["Grasa visceral", "nivel", true],
  bmi:   ["IMC",            "kg/m²", true]
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
  vfa: "bmi",
  areavisceral: "bmi",
  bmi: "bmi",
  imc: "bmi",
  indicemasa: "bmi",
  bodymassindex: "bmi"
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


function firstValidIndex(obj, keys){
  const maxLength = Math.max(0, ...Object.values(obj || {}).map(m => Array.isArray(m.values) ? m.values.length : 0));
  for(let i=0; i<maxLength; i++){
    if(keys.some(k => {
      const m = safeMetric(obj, k);
      const v = m?.values?.[i];
      return v !== null && v !== undefined && Number.isFinite(Number(v));
    })) return i;
  }
  return 0;
}

function getBaselineIndex(kind){
  if(kind === "acc") return firstValidIndex(accuniq, ["peso","smm","bfm","pbf","vfl","bmi"]);
  return firstValidIndex(composition, ["peso","grasaPct","grasaKg","magra","pliegues","cintura","abdomen","cadera","muslo","brazo"]);
}

const MONTHS_FULL = {
  ene:"Enero", enero:"Enero", jan:"Enero", january:"Enero",
  feb:"Febrero", febrero:"Febrero", february:"Febrero",
  mar:"Marzo", marzo:"Marzo", march:"Marzo",
  abr:"Abril", abril:"Abril", apr:"Abril", april:"Abril",
  may:"Mayo", mayo:"Mayo",
  jun:"Junio", junio:"Junio", june:"Junio",
  jul:"Julio", julio:"Julio", july:"Julio",
  ago:"Agosto", agosto:"Agosto", aug:"Agosto", august:"Agosto",
  sep:"Septiembre", sept:"Septiembre", septiembre:"Septiembre", september:"Septiembre",
  oct:"Octubre", octubre:"Octubre", october:"Octubre",
  nov:"Noviembre", noviembre:"Noviembre", november:"Noviembre",
  dic:"Diciembre", diciembre:"Diciembre", dec:"Diciembre", december:"Diciembre"
};
const MONTHS_SHORT = {
  Enero:"Ene", Febrero:"Feb", Marzo:"Mar", Abril:"Abr", Mayo:"May", Junio:"Jun",
  Julio:"Jul", Agosto:"Ago", Septiembre:"Sep", Octubre:"Oct", Noviembre:"Nov", Diciembre:"Dic"
};

const MONTH_NUMBERS = {
  ene:1, enero:1, jan:1, january:1,
  feb:2, febrero:2, february:2,
  mar:3, marzo:3, march:3,
  abr:4, abril:4, apr:4, april:4,
  may:5, mayo:5,
  jun:6, junio:6, june:6,
  jul:7, julio:7, july:7,
  ago:8, agosto:8, aug:8, august:8,
  sep:9, sept:9, septiembre:9, september:9,
  oct:10, octubre:10, october:10,
  nov:11, noviembre:11, november:11,
  dic:12, diciembre:12, dec:12, december:12
};
const MONTHS_FULL_LIST = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function cleanMonthKey(value){
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function monthNumberFromLabel(value){
  return MONTH_NUMBERS[cleanMonthKey(value)] || null;
}

function isMonthOnly(value){
  return monthNumberFromLabel(value) !== null;
}

function inferredYearForMonthSequence(dates, index){
  const months = (dates || []).map(monthNumberFromLabel);
  const firstMonth = months.find(Boolean) || 1;
  let year = firstMonth >= 10 ? 2025 : 2026;
  let prev = firstMonth;
  for(let i=1; i<=index; i++){
    const current = months[i];
    if(!current) continue;
    if(prev && current < prev) year += 1;
    prev = current;
  }
  return year;
}

function formatMonthYear(monthNumber, year, opts = {}){
  const full = MONTHS_FULL_LIST[monthNumber - 1] || "";
  const month = opts.shortMonth !== false ? (MONTHS_SHORT[full] || full) : full;
  const yearText = opts.fullYear ? String(year) : String(year).slice(-2);
  const result = `${month} ${yearText}`;
  return opts.upper ? result.toUpperCase() : result;
}

function parseDateParts(value){
  const raw = String(value || "").trim();
  const numeric = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);
  if(numeric) return {day:Number(numeric[1]), month:Number(numeric[2]), year:Number(normalizeYear(numeric[3]))};
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(iso) return {day:Number(iso[3]), month:Number(iso[2]), year:Number(iso[1])};
  const wordDate = raw.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s*(\d{2}|\d{4})?$/);
  if(wordDate){
    const month = monthNumberFromLabel(wordDate[2]);
    const year = wordDate[3] ? Number(normalizeYear(wordDate[3])) : null;
    return month ? {day:Number(wordDate[1]), month, year} : null;
  }
  return null;
}

function formatDateForKind(value, kind, index, dates, opts = {}){
  if(kind === "comp" && isMonthOnly(value)){
    const month = monthNumberFromLabel(value);
    const year = inferredYearForMonthSequence(dates, index);
    return formatMonthYear(month, year, {upper: opts.upper !== false, fullYear: opts.fullYear === true});
  }
  if(kind === "acc"){
    const parts = parseDateParts(value);
    if(parts?.month && parts?.year) return formatMonthYear(parts.month, parts.year, {upper: opts.upper === true, fullYear: opts.fullYear === true});
  }
  return formatDateFriendly(value, opts.friendlyOptions || {compact:true, shortMonth:true, monthOnlyFull:false});
}

function normalizeYear(y){
  if(!y) return "";
  const n = String(y).trim();
  if(n.length === 2) return Number(n) >= 70 ? `19${n}` : `20${n}`;
  return n;
}

function formatDateFriendly(value, opts = {}){
  if(value === null || value === undefined || value === "") return "—";
  const raw = String(value).trim();
  if(!raw) return "—";
  const compact = opts.compact === true;
  const shortMonth = opts.shortMonth === true;
  const monthOnlyFull = opts.monthOnlyFull !== false;

  const numeric = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);
  if(numeric){
    const day = numeric[1].padStart(2, "0");
    const monthIndex = Number(numeric[2]) - 1;
    const fullMonths = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const month = fullMonths[monthIndex] || numeric[2];
    const year = normalizeYear(numeric[3]);
    const monthText = shortMonth ? (MONTHS_SHORT[month] || month) : month;
    return compact ? `${day} ${monthText} ${String(year).slice(-2)}` : `${day} ${monthText} ${year}`;
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(iso){
    return formatDateFriendly(`${iso[3]}.${iso[2]}.${iso[1]}`, opts);
  }

  const wordDate = raw.match(/^(\d{1,2})\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s*(\d{2}|\d{4})?$/);
  if(wordDate){
    const day = wordDate[1].padStart(2, "0");
    const key = wordDate[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const month = MONTHS_FULL[key] || wordDate[2];
    const year = normalizeYear(wordDate[3] || "");
    const monthText = shortMonth ? (MONTHS_SHORT[month] || month) : month;
    return year ? `${day} ${monthText} ${compact ? String(year).slice(-2) : year}` : `${day} ${monthText}`;
  }

  const monthKey = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if(MONTHS_FULL[monthKey]){
    const full = MONTHS_FULL[monthKey];
    return monthOnlyFull && !shortMonth ? full : (MONTHS_SHORT[full] || full);
  }

  return raw;
}

function formatDateButton(value, kind, index, dates){
  return formatDateForKind(value, kind, index, dates, {upper: kind === "comp"});
}

function formatDateRange(label, dates, baseIndex, activeIndex, kind){
  const baseDate = formatDateForKind(dates?.[baseIndex], kind, baseIndex, dates, {upper: kind === "comp"});
  const activeDate = formatDateForKind(dates?.[activeIndex], kind, activeIndex, dates, {upper: kind === "comp"});
  return `${label}: inicio ${baseDate} → activo ${activeDate}`;
}

function summarizeMetric(obj, key, baseIndex, activeIndex){
  const m = safeMetric(obj, key);
  if(!m) return null;
  const base = m.values?.[baseIndex];
  const current = m.values?.[activeIndex];
  if(base === null || base === undefined || current === null || current === undefined || !Number.isFinite(Number(base)) || !Number.isFinite(Number(current))) return null;
  const delta = current - base;
  const pct = base === 0 ? null : delta / base * 100;
  return {key, label:m.label, unit:m.unit, base, current, delta, pct, color:m.color, goodDown:m.goodDown, cls:deltaClass(delta,m.goodDown)};
}

function directionWord(delta, goodDown){
  if(delta === null || delta === undefined || Math.abs(delta) < 0.0001) return "se mantiene estable";
  const isGood = goodDown ? delta < 0 : delta > 0;
  return isGood ? "mejora" : "requiere atención";
}

function insightSentence(summary){
  if(!summary) return "";
  const sign = summary.delta > 0 ? "+" : "";
  const pctTxt = summary.pct === null ? "" : ` (${summary.pct > 0 ? "+" : ""}${fmt(summary.pct)}%)`;
  return `${summary.label}: ${fmt(summary.base)} → ${fmt(summary.current)} ${summary.unit}; cambio ${sign}${fmt(summary.delta)} ${summary.unit}${pctTxt}, ${directionWord(summary.delta, summary.goodDown)}.`;
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
    accuniq: (function(){
      const hasData = arr => Array.isArray(arr) && arr.some(v => v !== null && v !== undefined && Number.isFinite(Number(v)));
      const bmiVals = (()=>{ const v=pick(accRows,"bmi"); if(hasData(v)) return v; const v2=pick(accRows,"imc"); if(hasData(v2)) return v2; return pick(accRows,"vfa"); })();
      return {
        peso: metric("Peso",          "kg",    pick(accRows,"peso"), colors.peso, true),
        smm:  metric("Masa muscular", "kg",    pick(accRows,"smm"),  colors.smm,  false),
        bfm:  metric("Grasa corporal","kg",    pick(accRows,"bfm"),  colors.bfm,  true),
        pbf:  metric("Grasa",         "%",     pick(accRows,"pbf"),  colors.pbf,  true),
        vfl:  metric("Grasa visceral","nivel", pick(accRows,"vfl"),  colors.vfl,  true),
        bmi:  metric("IMC",           "kg/m²", bmiVals,             colors.bmi,  true)
      };
    })(),
    goals: getDefaultGoals(),
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
    goals = Array.isArray(data.goals) && data.goals.length ? data.goals : getDefaultGoals();
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

  const createGroup = (title, dates, activeIndex, onClick, kind) => {
    const group = document.createElement("div");
    group.className = "dateGroup";

    const titleEl = document.createElement("div");
    titleEl.className = "dateGroupTitle";
    titleEl.textContent = title;
    group.appendChild(titleEl);

    const btns = document.createElement("div");
    btns.className = "dateGroupBtns";

    if(!dates.length){
      const empty = document.createElement("span");
      empty.className = "mini";
      empty.textContent = "Sin fechas";
      btns.appendChild(empty);
    }

    dates.forEach((d,i)=>{
      const btn = document.createElement("button");
      btn.textContent = formatDateButton(d, kind, i, dates);
      btn.title = formatDateForKind(d, kind, i, dates, {upper: kind === "comp", fullYear:true});
      btn.className = i===activeIndex ? "active" : "";
      btn.onclick = () => onClick(i);
      btns.appendChild(btn);
    });

    group.appendChild(btns);
    box.appendChild(group);
  };

  createGroup(labels.composition || "Plicometría", compDates, state.compIndex, (i)=>{
    state.compIndex = i;
    if(state.view !== "overview" && state.view !== "compare") state.view = "composition";
    if(!(state.metric in composition)) state.metric = "pliegues" in composition ? "pliegues" : Object.keys(composition)[0];
    renderAll();
  }, "comp");

  createGroup(labels.bioimpedance || "Bioimpedancia", accDates, state.accIndex, (i)=>{
    state.accIndex = i;
    if(state.view !== "overview" && state.view !== "compare") state.view = "accuniq";
    if(!(state.metric in accuniq)) state.metric = "pbf" in accuniq ? "pbf" : Object.keys(accuniq)[0];
    renderAll();
  }, "acc");
}
function renderTabs(){
  document.querySelectorAll(".tabs button").forEach(b=>{
    b.classList.toggle("active", b.dataset.view===state.view);
    b.onclick=()=>{state.view=b.dataset.view; renderAll();}
  });
}
function renderMetricButtons(){
  const box = document.getElementById("metricBtns");
  box.innerHTML = "";

  const compKeys = ["peso","grasaPct","grasaKg","magra","pliegues","brazo","cintura","abdomen","cadera","muslo"];
  const accKeys  = ["peso","smm","bfm","pbf","vfl","bmi"];

  // Groups: [title, keys, kind]
  const showAll = state.view === "overview" || state.view === "compare";
  const showComp = showAll || state.view === "composition";
  const showAcc  = showAll || state.view === "accuniq";

  function makeGroup(title, keys, obj){
    const available = keys.filter(k => obj[k]);
    if(!available.length) return;
    const group = document.createElement("div");
    group.className = "dateGroup";
    group.style.marginBottom = "4px";
    const titleEl = document.createElement("div");
    titleEl.className = "dateGroupTitle";
    titleEl.textContent = title;
    group.appendChild(titleEl);
    const btns = document.createElement("div");
    btns.className = "dateGroupBtns";
    available.forEach(k => {
      const src = obj[k];
      if(!src) return;
      const btn = document.createElement("button");
      btn.textContent = src.label + (src.unit ? " " + src.unit : "");
      btn.className = k === state.metric ? "active" : "";
      btn.onclick = () => { state.metric = k; renderAll(); };
      btns.appendChild(btn);
    });
    group.appendChild(btns);
    box.appendChild(group);
  }

  if(showComp) makeGroup(labels.composition || "Plicometría", compKeys, composition);
  if(showAcc)  makeGroup(labels.bioimpedance || "Bioimpedancia", accKeys, accuniq);

  // Fallback if metric no longer in visible keys
  const allVisible = [
    ...(showComp ? compKeys : []),
    ...(showAcc  ? accKeys  : [])
  ];
  if(!allVisible.includes(state.metric) || !(composition[state.metric] || accuniq[state.metric])){
    state.metric = allVisible.find(k => composition[k] || accuniq[k]) || "peso";
  }
}
function renderKpis(){
  const k = document.getElementById("kpis");
  const compBase = getBaselineIndex("comp");
  const accBase = getBaselineIndex("acc");
  const cards = [
    {name:"Peso plicometría", val:composition.peso?.values?.[state.compIndex], prev:composition.peso?.values?.[compBase], unit:"kg", color:colors.peso, goodDown:true},
    {name:"Grasa plicometría", val:composition.grasaPct?.values?.[state.compIndex], prev:composition.grasaPct?.values?.[compBase], unit:"%", color:colors.grasaPct, goodDown:true},
    {name:"Pliegues", val:composition.pliegues?.values?.[state.compIndex], prev:composition.pliegues?.values?.[compBase], unit:"mm", color:colors.pliegues, goodDown:true},
    {name:"Masa magra", val:composition.magra?.values?.[state.compIndex], prev:composition.magra?.values?.[compBase], unit:"kg", color:colors.magra, goodDown:false},
    {name:`SMM ${labels.bioimpedance || "Bioimpedancia"}`, val:accuniq.smm?.values?.[state.accIndex], prev:accuniq.smm?.values?.[accBase], unit:"kg", color:colors.smm, goodDown:false},
    {name:`PBF ${labels.bioimpedance || "Bioimpedancia"}`, val:accuniq.pbf?.values?.[state.accIndex], prev:accuniq.pbf?.values?.[accBase], unit:"%", color:colors.pbf, goodDown:true}
  ];
  k.innerHTML = cards.map(c=>{
    const d = safeDelta(c.val, c.prev);
    return `<div class="panel kpi" style="--accent:${c.color}">
      <div class="name">${c.name}</div>
      <div class="value" style="color:${c.color}">${fmt(c.val)} <small style="font-size:15px;color:var(--muted)">${c.unit}</small></div>
      <div class="delta ${d === null ? "neutral" : deltaClass(d,c.goodDown)}">${deltaText(d,c.unit)} vs inicio</div>
    </div>`;
  }).join("");
}

function drawLineChart(svgId, dates, metric, activeIndex, kind){
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
    c.addEventListener("mousemove",ev=>showTip(ev,`${formatDateForKind(dates[i], kind, i, dates, {upper: kind === "comp", fullYear:true})}<br><b>${metric.label}</b>: ${fmt(v)} ${metric.unit}`));
    c.addEventListener("mouseleave",hideTip);
    c.addEventListener("click",()=>{ if(dates===compDates) state.compIndex=i; else state.accIndex=i; renderAll(); });
    const t = el("text",{x:x(i)-12,y:y(v)-13,fill:i===activeIndex?metric.color:"#f2f5f7",class:"valueText"});
    t.textContent=fmt(v);
  });
  dates.forEach((dt,i)=>{
    if(i%2!==0 && dates.length>7 && i!==dates.length-1) return;
    const t = el("text",{x:x(i),y:h-15,"text-anchor":"middle",class:"tickText",fill:i===activeIndex?metric.color:"#9aa7b2"});
    t.textContent = formatDateButton(dt, kind, i, dates).split("\n")[0];
  });
}

function renderMainChart(){
  let src;
  if(state.metric in composition && state.view!=="accuniq") src = {data:composition,dates:compDates,index:state.compIndex,kind:"comp"};
  else src = {data:accuniq,dates:accDates,index:state.accIndex,kind:"acc"};
  let metric = src.data[state.metric];
  if(!metric || !Array.isArray(metric.values)){
    metric = Object.values(src.data).find(m => m && Array.isArray(m.values)) || {label:"Sin datos", unit:"", values:[], color:"#21d6e9", goodDown:true};
  }
  document.getElementById("mainChartTitle").innerHTML = `${metric.label} <span class="badge">${metric.unit}</span>`;
  drawLineChart("mainChart", src.dates, metric, src.index, src.kind);
}

function renderNormChart(){
  const svg = document.getElementById("normChart");
  svg.innerHTML = "";
  const series = state.view==="accuniq"
    ? [["Peso",accuniq.peso],["SMM",accuniq.smm],["BFM",accuniq.bfm],["PBF",accuniq.pbf],["VFL",accuniq.vfl],["IMC",accuniq.bmi]]
    : [["Peso",composition.peso],["Grasa %",composition.grasaPct],["Grasa kg",composition.grasaKg],["Magra",composition.magra],["Pliegues",composition.pliegues],["Brazo",composition.brazo],["Cintura",composition.cintura],["Abdomen",composition.abdomen],["Cadera",composition.cadera],["Muslo",composition.muslo]];
  const dates = state.view==="accuniq" ? accDates : compDates;
  const activeIndex = state.view==="accuniq" ? state.accIndex : state.compIndex;
  const kind = state.view==="accuniq" ? "acc" : "comp";
  if(!dates.length){ svg.innerHTML = `<text x="20" y="40" class="tickText">Sin datos disponibles</text>`; return; }

  const prepared = series
    .filter(([name,m]) => m && Array.isArray(m.values))
    .map(([name,m]) => {
      const baseValue = m.values.find(x => x !== null && x !== undefined && Number.isFinite(Number(x)) && Number(x) !== 0);
      if(!baseValue) return null;
      const vals = m.values.map(v => {
        if(v === null || v === undefined || !Number.isFinite(Number(v))) return null;
        return (Number(v) / Number(baseValue) - 1) * 100;
      });
      return {name, metric:m, vals};
    })
    .filter(Boolean);

  const allVals = prepared.flatMap(s => s.vals).filter(v => v !== null && Number.isFinite(v));
  if(!allVals.length){ svg.innerHTML = `<text x="20" y="40" class="tickText">Sin datos suficientes para calcular cambio relativo</text>`; return; }

  const w = svg.clientWidth || 600, h = svg.clientHeight || 280;
  const pad={l:58,r:145,t:28,b:42};
  let min = Math.min(0, ...allVals), max = Math.max(0, ...allVals);
  const span = max - min || 1;
  let ymin = min - span * .18;
  let ymax = max + span * .18;
  if(ymin === ymax){ ymin -= 1; ymax += 1; }
  const ns="http://www.w3.org/2000/svg";
  function el(name,attrs){const e=document.createElementNS(ns,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));svg.appendChild(e);return e;}
  const x=i=>pad.l+(w-pad.l-pad.r)*(dates.length <= 1 ? 0.5 : i/(dates.length-1));
  const y=v=>pad.t+(h-pad.t-pad.b)*(1-(v-ymin)/(ymax-ymin));
  for(let i=0;i<5;i++){
    const yy=pad.t+(h-pad.t-pad.b)*i/4;
    el("line",{x1:pad.l,y1:yy,x2:w-pad.r,y2:yy,class:"axis"});
    const tv=ymax-(ymax-ymin)*i/4;
    const text=el("text",{x:8,y:yy+4,class:"tickText"}); text.textContent=`${tv>0?"+":""}${fmt(tv)}%`;
  }
  if(ymin < 0 && ymax > 0){
    el("line",{x1:pad.l,y1:y(0),x2:w-pad.r,y2:y(0),class:"axis",style:"stroke-width:2;opacity:.85"});
  }
  prepared.forEach(({name,metric:m,vals})=>{
    let d="";
    vals.forEach((v,i)=>{if(v===null)return;d+=(d===""?"M":"L")+x(i)+" "+y(v)+" ";});
    el("path",{d,stroke:m.color,class:"line"});
    vals.forEach((v,i)=>{
      if(v===null)return;
      const c=el("circle",{cx:x(i),cy:y(v),r:i===activeIndex?6:4,fill:m.color});
      c.addEventListener("mousemove",ev=>showTip(ev,`${formatDateForKind(dates[i], kind, i, dates, {upper: kind === "comp"})}<br><b>${name}</b>: ${v>0?"+":""}${fmt(v)}% vs inicio`));
      c.addEventListener("mouseleave",hideTip);
    });
  });

  // ── Etiquetas lado derecho con collision avoidance ──────────────────────
  const LABEL_H = 14; // altura mínima entre etiquetas
  // Calcular posición Y natural de cada etiqueta (valor en el activeIndex)
  const labelData = prepared.map(({name, metric:m, vals}) => {
    const active = vals[activeIndex] ?? vals[vals.length - 1];
    const yPos = active !== null ? y(active) : null;
    const pct = active !== null ? `${active > 0 ? "+" : ""}${fmt(active)}%` : null;
    return { name, color: m.color, yPos, pct };
  }).filter(s => s.yPos !== null && s.pct !== null);

  // Ordenar por posición Y (arriba → abajo)
  labelData.sort((a, b) => a.yPos - b.yPos);

  // Push-apart: si dos etiquetas están a menos de LABEL_H, separarlas
  for(let pass = 0; pass < 10; pass++){
    let moved = false;
    for(let i = 1; i < labelData.length; i++){
      const prev = labelData[i-1], cur = labelData[i];
      const gap = cur.yPos - prev.yPos;
      if(gap < LABEL_H){
        const push = (LABEL_H - gap) / 2;
        prev.yPos -= push;
        cur.yPos  += push;
        moved = true;
      }
    }
    if(!moved) break;
  }

  // Clamp dentro del SVG
  labelData.forEach(l => {
    l.yPos = Math.max(pad.t + 6, Math.min(h - pad.b - 4, l.yPos));
  });

  // Dibujar etiquetas
  const xLabel = w - pad.r + 8;
  labelData.forEach(({ name, color, yPos, pct }) => {
    el("text", {
      x: xLabel, y: yPos + 4,
      fill: color, class: "valueText",
      style: "font-size:11px;font-weight:800;"
    }).textContent = `${name} ${pct}`;
  });

  dates.forEach((dt,i)=>{
    if(i%2!==0 && dates.length>7 && i!==dates.length-1) return;
    const t = el("text",{x:x(i),y:h-15,"text-anchor":"middle",class:"tickText",fill:i===activeIndex?"#f2f5f7":"#9aa7b2"});
    t.textContent = formatDateButton(dt, kind, i, dates);
  });
}

function showTip(ev, html){
  const t=document.getElementById("tooltip");
  t.innerHTML=html; t.style.display="block";
  t.style.left=(ev.clientX+14)+"px"; t.style.top=(ev.clientY+14)+"px";
}
function hideTip(){document.getElementById("tooltip").style.display="none";}

function detailCompareList(obj, baseIndex, activeIndex, keys, dates, label, kind){
  const baseDate   = formatDateForKind(dates?.[baseIndex],  kind, baseIndex,  dates, {upper: kind === "comp"});
  const activeDate = formatDateForKind(dates?.[activeIndex], kind, activeIndex, dates, {upper: kind === "comp"});

  // Previous period = the index just before activeIndex that has valid data
  let prevIndex = null;
  for(let i = activeIndex - 1; i >= 0; i--){
    if(keys.some(k => {
      const v = obj[k]?.values?.[i];
      return v !== null && v !== undefined && Number.isFinite(Number(v));
    })){ prevIndex = i; break; }
  }
  const prevDate = prevIndex !== null
    ? formatDateForKind(dates?.[prevIndex], kind, prevIndex, dates, {upper: kind === "comp"})
    : null;

  let rows = "";
  keys.forEach(k => {
    const summary = summarizeMetric(obj, k, baseIndex, activeIndex);
    if(!summary) return;

    // vs previous period
    let prevCell = "<td>—</td><td>—</td>";
    if(prevIndex !== null){
      const prevVal = obj[k]?.values?.[prevIndex];
      const curVal  = obj[k]?.values?.[activeIndex];
      if(prevVal !== null && prevVal !== undefined && Number.isFinite(Number(prevVal)) &&
         curVal  !== null && curVal  !== undefined && Number.isFinite(Number(curVal))){
        const d = curVal - prevVal;
        const cls = deltaClass(d, summary.goodDown);
        prevCell = `<td>${fmt(prevVal)} ${summary.unit}</td><td class="${cls}">${deltaText(d, summary.unit)}</td>`;
      }
    }

    rows += `<tr>
      <td><b style="color:${summary.color}">●</b> ${summary.label}</td>
      <td>${fmt(summary.base)} ${summary.unit}</td>
      <td><b>${fmt(summary.current)} ${summary.unit}</b></td>
      <td class="${summary.cls}">${deltaText(summary.delta, summary.unit)}</td>
      ${prevCell}
    </tr>`;
  });

  if(!rows) return `<div class="mini">Sin datos suficientes para comparar ${label || "esta medición"} contra el punto inicial.</div>`;

  const prevHeader = prevDate
    ? `<th>Mes ant. (${prevDate})</th><th>Cambio</th>`
    : `<th colspan="2" style="color:var(--muted);font-size:11px;">Sin período anterior</th>`;

  return `<div class="detailMeta">
    Punto inicial: <b>${baseDate}</b> · Fecha activa: <b>${activeDate}</b>
    ${prevDate ? `· Período anterior: <b>${prevDate}</b>` : ""}
  </div>
  <table class="detailTable">
    <tr>
      <th>Métrica</th>
      <th>Inicio</th>
      <th>Activo</th>
      <th>Cambio vs inicio</th>
      ${prevHeader}
    </tr>
    ${rows}
  </table>`;
}
function renderDetails(){
  const compDate = formatDateForKind(compDates[state.compIndex], "comp", state.compIndex, compDates, {upper:true});
  const bioDate = formatDateForKind(accDates[state.accIndex], "acc", state.accIndex, accDates);
  const compBase = getBaselineIndex("comp");
  const accBase = getBaselineIndex("acc");
  const badgeText = state.view === "composition"
    ? `${labels.composition || "Plicometría"}: inicio ${formatDateForKind(compDates[compBase], "comp", compBase, compDates, {upper:true})} → activo ${compDate}`
    : state.view === "accuniq"
      ? `${labels.bioimpedance || "Bioimpedancia"}: inicio ${formatDateForKind(accDates[accBase], "acc", accBase, accDates)} → activo ${bioDate}`
      : `${labels.composition || "Plicometría"}: ${formatDateForKind(compDates[compBase], "comp", compBase, compDates, {upper:true})} → ${compDate} · ${labels.bioimpedance || "Bioimpedancia"}: ${formatDateForKind(accDates[accBase], "acc", accBase, accDates)} → ${bioDate}`;
  document.getElementById("activeDateBadge").textContent = badgeText;
  document.getElementById("compositionDetail").innerHTML = detailCompareList(composition,compBase,state.compIndex,["peso","grasaPct","grasaKg","magra","pliegues","brazo","cintura","abdomen","cadera","muslo"],compDates,labels.composition,"comp");
  document.getElementById("accuniqDetail").innerHTML = detailCompareList(accuniq,accBase,state.accIndex,["peso","smm","bfm","pbf","vfl","bmi"],accDates,labels.bioimpedance,"acc");
}
function renderGoals(){
  const box = document.getElementById("goals");
  if(!goals.length){ box.innerHTML = `<div class="mini">Sin metas cargadas.</div>`; return; }

  if(goals.some(g => g.targetLabel)){
    box.innerHTML = `<table class="goalsTable">
      <tr><th>Métrica</th><th>Meta julio recomendada</th></tr>
      ${goals.map(g => `<tr><td><b>${g.label}</b></td><td><b>${g.targetLabel || "—"}</b></td></tr>`).join("")}
    </table>`;
    return;
  }

  box.innerHTML = goals.map(g=>{
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

function makeTable(obj, baseIndex, curIndex, keys){
  let html="<tr><th>Métrica</th><th>Punto inicial</th><th>Actual</th><th>Cambio</th><th>%</th></tr>";
  let count = 0;
  keys.forEach(k=>{
    const summary = summarizeMetric(obj, k, baseIndex, curIndex);
    if(!summary || summary.base === 0) return;
    count += 1;
    html += `<tr>
      <td><b style="color:${summary.color}">●</b> ${summary.label}</td>
      <td>${fmt(summary.base)} ${summary.unit}</td>
      <td><b>${fmt(summary.current)} ${summary.unit}</b></td>
      <td class="${summary.cls}">${deltaText(summary.delta,summary.unit)}</td>
      <td class="${summary.cls}">${summary.pct === null ? "—" : `${summary.delta>0?"+":""}${fmt(summary.pct)}%`}</td>
    </tr>`;
  });
  if(!count) html += `<tr><td colspan="5" class="mini">Sin datos suficientes para comparar contra el punto inicial.</td></tr>`;
  return html;
}
function renderTables(){
  const compBase = getBaselineIndex("comp");
  const accBase = getBaselineIndex("acc");
  document.getElementById("compositionTable").innerHTML = makeTable(composition,compBase,state.compIndex,["peso","grasaPct","grasaKg","magra","pliegues","brazo","cintura","abdomen","cadera","muslo"]);
  document.getElementById("accuniqTable").innerHTML = makeTable(accuniq,accBase,state.accIndex,["peso","smm","bfm","pbf","vfl","bmi"]);
  const compRange = formatDateRange(labels.composition || "Plicometría", compDates, compBase, state.compIndex, "comp");
  const bioRange = formatDateRange(labels.bioimpedance || "Bioimpedancia", accDates, accBase, state.accIndex, "acc");
  document.getElementById("changeSubtitle").textContent = `${compRange} · ${bioRange}`;
}

function generateExecutiveInsights(){
  const compBase = getBaselineIndex("comp");
  const accBase = getBaselineIndex("acc");
  const compRange = formatDateRange(labels.composition || "Plicometría", compDates, compBase, state.compIndex, "comp");
  const bioRange = formatDateRange(labels.bioimpedance || "Bioimpedancia", accDates, accBase, state.accIndex, "acc");
  const pliegues = summarizeMetric(composition,"pliegues",compBase,state.compIndex);
  const grasaPct = summarizeMetric(composition,"grasaPct",compBase,state.compIndex);
  const grasaKg = summarizeMetric(composition,"grasaKg",compBase,state.compIndex);
  const magra = summarizeMetric(composition,"magra",compBase,state.compIndex);
  const cintura = summarizeMetric(composition,"cintura",compBase,state.compIndex);
  const abdomen = summarizeMetric(composition,"abdomen",compBase,state.compIndex);
  const cadera = summarizeMetric(composition,"cadera",compBase,state.compIndex);
  const muslo = summarizeMetric(composition,"muslo",compBase,state.compIndex);
  const brazo = summarizeMetric(composition,"brazo",compBase,state.compIndex);
  const pbf = summarizeMetric(accuniq,"pbf",accBase,state.accIndex);
  const bfm = summarizeMetric(accuniq,"bfm",accBase,state.accIndex);
  const smm = summarizeMetric(accuniq,"smm",accBase,state.accIndex);
  const vfl = summarizeMetric(accuniq,"vfl",accBase,state.accIndex);

  const items = [];
  items.push(`<b>Marco de comparación:</b> la lectura usa siempre punto inicial vs fecha activa. ${compRange}. ${bioRange}.`);
  const fatParts = [insightSentence(pliegues), insightSentence(grasaPct), insightSentence(grasaKg)].filter(Boolean);
  if(fatParts.length) items.push(`<b>Grasa y pliegues:</b> ${fatParts.join(" ")}`);
  const leanParts = [insightSentence(magra), insightSentence(smm)].filter(Boolean);
  if(leanParts.length) items.push(`<b>Masa magra / músculo:</b> ${leanParts.join(" ")}`);
  const perimeterParts = [insightSentence(cintura), insightSentence(abdomen), insightSentence(cadera), insightSentence(muslo), insightSentence(brazo)].filter(Boolean);
  if(perimeterParts.length) items.push(`<b>Perímetros completos:</b> ${perimeterParts.join(" ")}`);
  const bioParts = [insightSentence(pbf), insightSentence(bfm), insightSentence(vfl)].filter(Boolean);
  if(bioParts.length) items.push(`<b>Bioimpedancia:</b> ${bioParts.join(" ")}`);

  const focus = [];
  if(pliegues && pliegues.delta > 0) focus.push("reducir pliegues");
  if(cintura && cintura.delta > 0) focus.push("bajar cintura");
  if(magra && magra.delta < 0) focus.push("proteger masa magra");
  if(smm && smm.delta < 0) focus.push("proteger SMM");
  items.push(`<b>Foco sugerido:</b> ${focus.length ? focus.join(", ") : "mantener adherencia y consolidar tendencia"}. Esta lectura es de seguimiento visual, no diagnóstico clínico.`);
  return items;
}

function buildAiPayload(){
  const compBase = getBaselineIndex("comp");
  const accBase = getBaselineIndex("acc");
  const pickSummaries = (obj, baseIndex, activeIndex, keys) => keys.map(k => summarizeMetric(obj,k,baseIndex,activeIndex)).filter(Boolean).map(x => ({
    metric:x.label, unit:x.unit, initial:x.base, active:x.current, change:x.delta, pct:x.pct, goodDirection:x.goodDown ? "lower_is_better" : "higher_is_better"
  }));
  return {
    labels,
    patient: {name: document.getElementById("patientName")?.textContent || "Paciente", age: document.getElementById("patientAge")?.textContent || ""},
    comparison: {
      composition: {initialDate: compDates[compBase] || null, activeDate: compDates[state.compIndex] || null, metrics: pickSummaries(composition,compBase,state.compIndex,["peso","grasaPct","grasaKg","magra","pliegues","brazo","cintura","abdomen","cadera","muslo"])},
      bioimpedance: {initialDate: accDates[accBase] || null, activeDate: accDates[state.accIndex] || null, metrics: pickSummaries(accuniq,accBase,state.accIndex,["peso","smm","bfm","pbf","vfl","bmi"])}
    }
  };
}

async function requestAiSummary(){
  const btn = document.getElementById("aiSummaryBtn");
  if(!btn) return;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando...";
  try{
    const response = await fetch("/api/ai-summary", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(buildAiPayload())
    });
    if(!response.ok){
      const err = await response.json().catch(()=>({error:"No se pudo generar la lectura con AI."}));
      throw new Error(err.error || "No se pudo generar la lectura con AI.");
    }
    const data = await response.json();
    dashboardInsights = Array.isArray(data.insights) && data.insights.length ? data.insights : [data.summary || "AI no regresó lectura."];
    renderInsights();
  } catch(error){
    console.warn("AI summary unavailable; using local executive insights.", error);
    dashboardInsights = generateExecutiveInsights();
    renderInsights();
  } finally{
    btn.disabled = false;
    btn.textContent = original;
  }
}

function renderInsights(){
  const items = Array.isArray(dashboardInsights) && dashboardInsights.length ? dashboardInsights : generateExecutiveInsights();
  document.getElementById("insights").innerHTML = items.map(x=>`<div class="insight">${x}</div>`).join("");
  const btn = document.getElementById("aiSummaryBtn");
  if(btn) btn.onclick = requestAiSummary;
}

function renderAll(){
  renderTabs(); renderDateButtons(); renderMetricButtons(); renderKpis();
  renderMainChart(); renderNormChart(); renderDetails(); renderGoals(); renderTables(); renderInsights();
  // Expose live data for pdf-export.js
  window.compDates  = compDates;
  window.accDates   = accDates;
  window.composition = composition;
  window.accuniq    = accuniq;
  window.labels     = labels;
  window.dashboardInsights = dashboardInsights;
  window.state      = state;
  window.goals      = goals;
}

window.getBaselineIndex = getBaselineIndex;
window.generateExecutiveInsights = generateExecutiveInsights;
window.formatDateForKind = formatDateForKind;

window.addEventListener("resize",()=>{ renderMainChart(); renderNormChart(); });
bootstrap();
