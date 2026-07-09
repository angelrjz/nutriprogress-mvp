/**
 * NutriProgress — PDF Export v4
 * - Tabla de detalles con columna vs mes anterior + colores correctos
 * - Métricas bioimpedancia sin abreviaciones
 * - iPhone: descarga vía <a download> + data URI en lugar de window.open()
 */
(function(){

  function fmt(n){
    if(n===null||n===undefined) return "—";
    return Number.isInteger(n)?String(n):(Math.round(n*100)/100).toString();
  }
  function sign(n){ return n>0?"+":""; }
  function goodCls(delta, goodDown){
    if(delta===null||Math.abs(delta)<0.0001) return "neutral";
    return goodDown?(delta<0?"good":"bad"):(delta>0?"good":"bad");
  }
  function clsColor(cls){
    if(cls==="good") return "#16a34a";
    if(cls==="bad")  return "#dc2626";
    return "#6b7280";
  }
  function deltaText(d, unit){
    if(d===null||d===undefined) return "—";
    return `${sign(d)}${fmt(d)} ${unit||""}`;
  }

  function baseComp(){ return window.getBaselineIndex?window.getBaselineIndex("comp"):0; }
  function baseAcc(){  return window.getBaselineIndex?window.getBaselineIndex("acc") :0; }

  function fmtDate(val, kind, idx, dates){
    if(!val) return "—";
    if(window.formatDateForKind) return window.formatDateForKind(val,kind,idx,dates,{upper:kind==="comp"});
    return String(val);
  }

  // ─── Índice del período anterior con datos válidos ──────────────────────
  function prevValidIndex(obj, keys, activeIndex){
    for(let i=activeIndex-1;i>=0;i--){
      if(keys.some(k=>{
        const v=obj[k]?.values?.[i];
        return v!==null&&v!==undefined&&Number.isFinite(Number(v));
      })) return i;
    }
    return null;
  }

  // ─── Sparkline ──────────────────────────────────────────────────────────
  function sparkline(values, color){
    const valid=values.filter(v=>v!==null&&Number.isFinite(Number(v)));
    if(valid.length<2) return "";
    const W=80,H=26,pad=3;
    const min=Math.min(...valid),max=Math.max(...valid);
    const span=max-min||1;
    const pts=values.map((v,i)=>{
      if(v===null||!Number.isFinite(Number(v))) return null;
      const x=pad+(W-pad*2)*i/(values.length-1);
      const y=H-pad-(H-pad*2)*(Number(v)-min)/span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(Boolean);
    return `<svg width="${W}" height="${H}" style="vertical-align:middle;">
      <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  }

  // ─── Tabla completa: todas las métricas × todas las fechas ──────────────
  function buildFullTable(obj, dates, keys, baseIndex, activeIndex, accentColor){
    if(!dates||!dates.length) return `<p style="color:#888;font-size:12px;">Sin datos.</p>`;
    const kind = accentColor==="#1593ff"?"comp":"acc";
    const prevIndex = prevValidIndex(obj, keys, activeIndex);
    const prevDate  = prevIndex!==null ? fmtDate(dates[prevIndex], kind, prevIndex, dates) : null;

    let thead = `<tr>
      <th style="text-align:left;min-width:120px;">Métrica</th>`;
    dates.forEach((d,i)=>{
      const isBase=i===baseIndex;
      thead+=`<th style="white-space:nowrap;${isBase?`background:${accentColor}22;color:${accentColor};font-weight:900;`:""}">${fmtDate(d,kind,i,dates)}${isBase?"<br/><span style='font-size:9px;opacity:.7;'>INICIO</span>":""}</th>`;
    });
    thead+=`<th style="color:${accentColor};white-space:nowrap;">Cambio vs inicio</th>`;
    if(prevDate) thead+=`<th style="color:#6b7280;white-space:nowrap;">vs ${prevDate}</th>`;
    thead+=`<th style="min-width:88px;">Tendencia</th></tr>`;

    let tbody="",hasAny=false;
    keys.forEach(k=>{
      const m=obj[k];
      if(!m||!Array.isArray(m.values)) return;
      const baseVal=m.values[baseIndex];
      const lastVal=m.values[activeIndex];
      const delta=(baseVal!=null&&lastVal!=null&&Number.isFinite(Number(baseVal))&&Number.isFinite(Number(lastVal)))?lastVal-baseVal:null;
      const pct=delta!==null&&baseVal&&baseVal!==0?delta/baseVal*100:null;
      const cls=delta!==null?goodCls(delta,m.goodDown):"neutral";

      // vs previous
      let prevCell="";
      if(prevDate && prevIndex!==null){
        const pv=m.values[prevIndex];
        const cv=m.values[activeIndex];
        if(pv!=null&&cv!=null&&Number.isFinite(Number(pv))&&Number.isFinite(Number(cv))){
          const pd=cv-pv;
          const pcls=goodCls(pd,m.goodDown);
          prevCell=`<td style="font-weight:700;color:${clsColor(pcls)};white-space:nowrap;">${deltaText(pd,m.unit)}</td>`;
        } else {
          prevCell=`<td style="color:#bbb;">—</td>`;
        }
      }

      hasAny=true;
      tbody+=`<tr>
        <td style="font-weight:700;white-space:nowrap;"><span style="color:${m.color||accentColor};">●</span> ${m.label} <span style="color:#888;font-weight:400;font-size:10px;">${m.unit}</span></td>`;
      dates.forEach((d,i)=>{
        const v=m.values[i];
        const isBase=i===baseIndex;
        const empty=v===null||v===undefined||!Number.isFinite(Number(v));
        tbody+=`<td style="${isBase?`background:${accentColor}09;font-weight:700;`:""}${empty?"color:#ccc;":""}">${empty?"—":fmt(v)}</td>`;
      });
      tbody+=`
        <td style="font-weight:800;color:${clsColor(cls)};white-space:nowrap;">${delta!==null?`${sign(delta)}${fmt(delta)} ${m.unit}${pct!==null?` (${sign(pct)}${fmt(pct)}%)`:""}` :"—"}</td>
        ${prevCell}
        <td>${sparkline(m.values,m.color||accentColor)}</td>
      </tr>`;
    });

    if(!hasAny) return `<p style="color:#888;font-size:12px;">Sin datos suficientes.</p>`;
    return `<div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;min-width:600px;">
        <thead style="background:#f0f6fa;">${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
  }

  // ─── KPI cards ──────────────────────────────────────────────────────────
  function buildKpis(){
    const compBase=baseComp(), accBase=baseAcc();
    const cards=[
      {label:"Peso Plic.",    obj:window.composition,key:"peso",    base:compBase,cur:window.state?.compIndex??0,color:"#1593ff"},
      {label:"Grasa %",      obj:window.composition,key:"grasaPct",base:compBase,cur:window.state?.compIndex??0,color:"#b25cff"},
      {label:"Pliegues",     obj:window.composition,key:"pliegues",base:compBase,cur:window.state?.compIndex??0,color:"#ff3d3d"},
      {label:"Masa magra",   obj:window.composition,key:"magra",   base:compBase,cur:window.state?.compIndex??0,color:"#62ee5d"},
      {label:"Masa muscular",obj:window.accuniq,    key:"smm",     base:accBase, cur:window.state?.accIndex??0, color:"#62ee5d"},
      {label:"Grasa Bio %",  obj:window.accuniq,    key:"pbf",     base:accBase, cur:window.state?.accIndex??0, color:"#b25cff"},
    ];
    return cards.map(c=>{
      const m=c.obj?.[c.key];
      if(!m) return "";
      const cur=m.values?.[c.cur], base=m.values?.[c.base];
      const delta=(cur!=null&&base!=null&&Number.isFinite(Number(cur))&&Number.isFinite(Number(base)))?cur-base:null;
      const cls=delta!==null?goodCls(delta,m.goodDown):"neutral";
      return `<div style="background:#f0f6fa;border:1px solid #cbd5e0;border-radius:10px;padding:12px 14px;flex:1;min-width:120px;">
        <div style="font-size:10px;color:#4a5568;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;">${c.label}</div>
        <div style="font-size:24px;font-weight:900;color:${c.color};letter-spacing:-1px;">${fmt(cur)} <span style="font-size:12px;color:#6b7280;">${m.unit}</span></div>
        <div style="font-size:11px;font-weight:700;color:${clsColor(cls)};margin-top:3px;">${delta!==null?sign(delta)+fmt(delta)+" "+m.unit+" vs inicio":"Sin dato inicial"}</div>
      </div>`;
    }).join("");
  }

  // ─── Metas ──────────────────────────────────────────────────────────────
  function buildGoals(){
    const g=window.goals||[];
    if(!g.length) return "";
    return `<table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr>
        <th style="text-align:left;background:#f0f6fa;padding:7px 8px;border-bottom:1px solid #e2e8f0;">Métrica</th>
        <th style="background:#f0f6fa;padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">Meta</th>
      </tr></thead>
      <tbody>${g.map(x=>`<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;">${x.label}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#1a56db;font-weight:700;">${x.targetLabel||"—"}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  // ─── Insights ───────────────────────────────────────────────────────────
  function buildInsights(){
    let items=window.dashboardInsights||[];
    if(!items.length&&window.generateExecutiveInsights) items=window.generateExecutiveInsights();
    if(!items.length) return "";
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${items.map(x=>`<div style="background:#f0f6fa;border:1px solid #cbd5e0;border-radius:8px;padding:10px 12px;font-size:11px;line-height:1.5;color:#1a3a4a;">${x}</div>`).join("")}
    </div>`;
  }

  // ─── HTML completo del reporte ──────────────────────────────────────────
  function buildReport(){
    const compBase=baseComp(), accBase=baseAcc();
    const compActive=window.state?.compIndex??((window.compDates?.length||1)-1);
    const accActive =window.state?.accIndex ??((window.accDates?.length||1)-1);
    const compDates=window.compDates||[], accDates=window.accDates||[];
    const lbl=window.labels||{composition:"Plicometría",bioimpedance:"Bioimpedancia"};
    const compKeys=["peso","grasaPct","grasaKg","magra","pliegues","brazo","cintura","abdomen","cadera","muslo"];
    const accKeys =["peso","smm","bfm","pbf","vfl","vfa"];
    const now=new Date();
    const dateStr=now.toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"});
    const patientName=document.getElementById("patientName")?.textContent||"Paciente";
    const patientAge =document.getElementById("patientAge")?.textContent||"";
    const compStart =fmtDate(compDates[compBase], "comp", compBase, compDates);
    const compActStr=fmtDate(compDates[compActive],"comp",compActive,compDates);
    const accStart  =fmtDate(accDates[accBase],   "acc",  accBase,  accDates);
    const accActStr =fmtDate(accDates[accActive],  "acc",  accActive, accDates);

    return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/>
<title>Reporte NutriProgress — ${patientName}</title>
<style>
@page{size:A4 landscape;margin:10mm 12mm;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0d1117;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
h2{font-size:13px;font-weight:800;color:#0d3a6b;margin:0 0 8px;padding-bottom:5px;border-bottom:2px solid #1593ff;}
section{margin-bottom:14px;}
.good{color:#16a34a;font-weight:800;}.bad{color:#dc2626;font-weight:800;}.neutral{color:#6b7280;}
table th,table td{border-bottom:1px solid #e2e8f0;padding:5px 6px;text-align:right;}
table th:first-child,table td:first-child{text-align:left;}
@media print{body{font-size:10.5px;}section{page-break-inside:avoid;}}
</style></head><body>

<!-- HEADER -->
<section style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:8px;margin-bottom:12px;border-bottom:2px solid #1593ff;">
  <div>
    <div style="font-size:18px;font-weight:900;color:#0d3a6b;letter-spacing:-.5px;">NutriProgress · Reporte de Seguimiento</div>
    <div style="font-size:11px;color:#4a5568;margin-top:3px;">${lbl.composition} + ${lbl.bioimpedance} · Comparativo vs punto inicial y período anterior</div>
  </div>
  <div style="text-align:right;font-size:11px;color:#4a5568;line-height:1.8;">
    <b style="color:#0d3a6b;font-size:13px;">${patientName}</b>${patientAge?" · "+patientAge:""}<br/>
    ${dateStr}<br/>
    ${lbl.composition}: <b>${compStart}</b> → <b>${compActStr}</b><br/>
    ${lbl.bioimpedance}: <b>${accStart}</b> → <b>${accActStr}</b>
  </div>
</section>

<!-- KPIs -->
<section>
  <h2>Indicadores clave vs punto inicial</h2>
  <div style="display:flex;flex-wrap:wrap;gap:8px;">${buildKpis()}</div>
</section>

<!-- PLICOMETRÍA -->
<section>
  <h2>${lbl.composition} — Todas las métricas · Verde = mejora, Rojo = retroceso</h2>
  ${buildFullTable(window.composition||{},compDates,compKeys,compBase,compActive,"#1593ff")}
</section>

<!-- BIOIMPEDANCIA -->
<section>
  <h2>${lbl.bioimpedance} — Todas las métricas · Verde = mejora, Rojo = retroceso</h2>
  ${buildFullTable(window.accuniq||{},accDates,accKeys,accBase,accActive,"#21d6e9")}
</section>

<!-- METAS + LECTURA -->
<div style="display:grid;grid-template-columns:1fr 1.6fr;gap:14px;">
  <section><h2>Metas del mes</h2>${buildGoals()}</section>
  <section><h2>Lectura ejecutiva</h2>${buildInsights()}</section>
</div>

<div style="margin-top:10px;font-size:10px;color:#9aa7b2;text-align:center;border-top:1px solid #e2e8f0;padding-top:6px;">
  Nota: La bioimpedancia puede variar por hidratación, glucógeno y recuperación. Usar tendencias, no datos aislados. · NutriProgress
</div>

<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
</body></html>`;
  }

  // ─── iPhone-safe export ─────────────────────────────────────────────────
  // Safari/iOS bloquea window.open() en handlers async.
  // Solución: generar el HTML como data: URI y abrir con <a> click síncrono.
  window.exportPDF = function(){
    if(!window.compDates||!window.compDates.length){
      alert("Los datos aún no terminaron de cargar. Espera un momento y vuelve a intentarlo.");
      return;
    }
    const html = buildReport();

    // Intenta window.open (desktop/Android)
    const win = window.open("","_blank");
    if(win && !win.closed){
      win.document.open();
      win.document.write(html);
      win.document.close();
      return;
    }

    // Fallback iPhone/Safari: blob URL con <a download> o data URI
    try{
      const blob = new Blob([html],{type:"text/html;charset=utf-8"});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `NutriProgress_${(document.getElementById("patientName")?.textContent||"reporte").replace(/\s+/g,"_")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url), 5000);
    } catch(e){
      // Último recurso: data URI
      const encoded = "data:text/html;charset=utf-8,"+encodeURIComponent(html);
      window.location.href = encoded;
    }
  };

})();
