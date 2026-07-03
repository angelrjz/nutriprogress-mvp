/**
 * NutriProgress — PDF Export v2
 * Genera una ventana de reporte completa con todas las métricas en tabla,
 * idéntica a la vista de la imagen de referencia, y llama window.print().
 */

(function () {

  // ─── Utilidades de formato (copiadas de app.js para ser independientes) ──
  function fmt(n) {
    if (n === null || n === undefined) return "—";
    return Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString();
  }

  function deltaClass(delta, goodDown) {
    if (Math.abs(delta) < 0.0001) return "neutral";
    return goodDown ? (delta < 0 ? "good" : "bad") : (delta > 0 ? "good" : "bad");
  }

  function sign(n) { return n > 0 ? "+" : ""; }

  // ─── Leer estado actual de app.js (variables globales) ──────────────────
  function getAppState() {
    return {
      compDates:   window.compDates   || [],
      accDates:    window.accDates    || [],
      composition: window.composition || {},
      accuniq:     window.accuniq     || {},
      goals:       window.goals       || [],
      insights:    window.dashboardInsights || [],
      labels:      window.labels      || { composition: "Plicometría", bioimpedance: "Bioimpedancia" },
      compIndex:   window.state?.compIndex ?? 0,
      accIndex:    window.state?.accIndex  ?? 0,
      patientName: document.getElementById("patientName")?.textContent || "Paciente",
      patientAge:  document.getElementById("patientAge")?.textContent  || "",
    };
  }

  // ─── Índice baseline (primer dato válido) ─────────────────────────────
  function getBaseline(obj, keys) {
    const maxLen = Math.max(0, ...Object.values(obj).map(m => m?.values?.length || 0));
    for (let i = 0; i < maxLen; i++) {
      if (keys.some(k => {
        const v = obj[k]?.values?.[i];
        return v !== null && v !== undefined && Number.isFinite(Number(v));
      })) return i;
    }
    return 0;
  }

  // ─── Formatear fecha ────────────────────────────────────────────────────
  function fmtDate(val) {
    if (!val) return "—";
    return String(val).trim();
  }

  // ─── Generar mini sparkline SVG inline ──────────────────────────────────
  function sparkline(values, color) {
    const valid = values.filter(v => v !== null && Number.isFinite(Number(v)));
    if (valid.length < 2) return "";
    const W = 80, H = 28, pad = 3;
    const min = Math.min(...valid), max = Math.max(...valid);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      if (v === null || !Number.isFinite(Number(v))) return null;
      const x = pad + (W - pad * 2) * i / (values.length - 1);
      const y = H - pad - (H - pad * 2) * (Number(v) - min) / span;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).filter(Boolean);
    return `<svg width="${W}" height="${H}" style="vertical-align:middle;margin-left:4px;">
      <polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  }

  // ─── Tabla de métricas (todas las fechas en columnas) ───────────────────
  function buildMetricTable(obj, dates, keys, baseIndex, accentColor) {
    if (!dates.length) return "<p style='color:#888'>Sin datos.</p>";

    // Header de fechas
    let thead = `<tr><th style="text-align:left;min-width:110px;">Métrica</th>`;
    dates.forEach((d, i) => {
      const isBase = i === baseIndex;
      thead += `<th style="${isBase ? `background:${accentColor}22;color:${accentColor};` : ""}">${fmtDate(d)}</th>`;
    });
    thead += `<th style="color:${accentColor}">Cambio</th><th style="color:${accentColor}">%</th><th style="min-width:90px;">Tendencia</th></tr>`;

    // Filas de métricas
    let tbody = "";
    keys.forEach(k => {
      const m = obj[k];
      if (!m || !Array.isArray(m.values)) return;

      const baseVal = m.values[baseIndex];
      const lastVal = m.values[m.values.length - 1];
      const delta = (baseVal !== null && baseVal !== undefined && lastVal !== null && lastVal !== undefined)
        ? lastVal - baseVal : null;
      const pct = (delta !== null && baseVal && baseVal !== 0) ? delta / baseVal * 100 : null;
      const cls = delta !== null ? deltaClass(delta, m.goodDown) : "neutral";
      const clsColor = cls === "good" ? "#16a34a" : cls === "bad" ? "#dc2626" : "#6b7280";

      tbody += `<tr>
        <td style="font-weight:700;color:#1a3a4a;">${m.label} <span style="color:#888;font-weight:400;font-size:11px;">${m.unit}</span></td>`;

      dates.forEach((d, i) => {
        const v = m.values[i];
        const isBase = i === baseIndex;
        tbody += `<td style="${isBase ? `background:${accentColor}11;font-weight:700;` : ""}${v === null || v === undefined ? "color:#bbb;" : ""}">${fmt(v) !== "—" ? fmt(v) : "—"}</td>`;
      });

      tbody += `
        <td style="font-weight:800;color:${clsColor};">${delta !== null ? sign(delta) + fmt(delta) + " " + m.unit : "—"}</td>
        <td style="font-weight:800;color:${clsColor};">${pct !== null ? sign(pct) + fmt(pct) + "%" : "—"}</td>
        <td>${sparkline(m.values, m.color || accentColor)}</td>
      </tr>`;
    });

    return `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead style="background:#f0f6fa;">${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>`;
  }

  // ─── KPI cards ──────────────────────────────────────────────────────────
  function buildKpis(s) {
    const compBase = getBaseline(s.composition, ["peso","grasaPct","grasaKg","magra","pliegues"]);
    const accBase  = getBaseline(s.accuniq,     ["peso","smm","bfm","pbf","vfl"]);

    const cards = [
      { label: "Peso Plic.", obj: s.composition, key: "peso",    base: compBase, cur: s.compIndex, color: "#1593ff" },
      { label: "Grasa %",   obj: s.composition, key: "grasaPct", base: compBase, cur: s.compIndex, color: "#b25cff" },
      { label: "Pliegues",  obj: s.composition, key: "pliegues", base: compBase, cur: s.compIndex, color: "#ff3d3d" },
      { label: "Masa magra",obj: s.composition, key: "magra",    base: compBase, cur: s.compIndex, color: "#62ee5d" },
      { label: "SMM Bio.",  obj: s.accuniq,     key: "smm",      base: accBase,  cur: s.accIndex,  color: "#62ee5d" },
      { label: "PBF Bio.",  obj: s.accuniq,     key: "pbf",      base: accBase,  cur: s.accIndex,  color: "#b25cff" },
    ];

    return cards.map(c => {
      const m = c.obj[c.key];
      if (!m) return "";
      const cur  = m.values?.[c.cur];
      const base = m.values?.[c.base];
      const delta = (cur !== null && cur !== undefined && base !== null && base !== undefined) ? cur - base : null;
      const cls = delta !== null ? deltaClass(delta, m.goodDown) : "neutral";
      const clsColor = cls === "good" ? "#16a34a" : cls === "bad" ? "#dc2626" : "#6b7280";
      return `<div style="background:#f0f6fa;border:1px solid #cbd5e0;border-radius:10px;padding:12px 14px;min-width:130px;flex:1;">
        <div style="font-size:11px;color:#4a5568;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">${c.label}</div>
        <div style="font-size:26px;font-weight:900;color:${c.color};letter-spacing:-1px;">${fmt(cur)} <span style="font-size:13px;color:#6b7280;">${m.unit}</span></div>
        <div style="font-size:12px;font-weight:700;color:${clsColor};margin-top:4px;">${delta !== null ? sign(delta) + fmt(delta) + " " + m.unit + " vs inicio" : "Sin dato inicial"}</div>
      </div>`;
    }).join("");
  }

  // ─── Insights ───────────────────────────────────────────────────────────
  function buildInsights(s) {
    const items = s.insights.length ? s.insights :
      (typeof generateExecutiveInsights === "function" ? generateExecutiveInsights() : []);
    if (!items.length) return "";
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${items.map(x => `<div style="background:#f0f6fa;border:1px solid #cbd5e0;border-radius:10px;padding:11px 13px;font-size:12px;line-height:1.5;color:#1a3a4a;">${x}</div>`).join("")}
    </div>`;
  }

  // ─── Metas ──────────────────────────────────────────────────────────────
  function buildGoals(goals) {
    if (!goals.length) return "";
    const rows = goals.map(g =>
      `<tr><td style="font-weight:700;">${g.label}</td><td style="color:#1a56db;font-weight:700;">${g.targetLabel || "—"}</td></tr>`
    ).join("");
    return `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead><tr><th style="text-align:left;background:#f0f6fa;">Métrica</th><th style="background:#f0f6fa;">Meta recomendada</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // ─── HTML completo del reporte ──────────────────────────────────────────
  function buildReportHTML(s) {
    const compBase = getBaseline(s.composition, ["peso","grasaPct","grasaKg","magra","pliegues"]);
    const accBase  = getBaseline(s.accuniq,     ["peso","smm","bfm","pbf","vfl"]);

    const compKeys = ["peso","grasaPct","grasaKg","magra","pliegues","brazo","cintura","abdomen","cadera","muslo"];
    const accKeys  = ["peso","smm","bfm","pbf","vfl","vfa"];

    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" });

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte NutriProgress — ${s.patientName}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0d1117; background: #fff; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { font-size: 15px; font-weight: 800; color: #1a3a4a; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #1593ff; }
    h3 { font-size: 13px; font-weight: 700; color: #4a5568; margin-bottom: 8px; }
    section { margin-bottom: 18px; }
    table th, table td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: right; }
    table th:first-child, table td:first-child { text-align: left; }
    table thead { position: sticky; top: 0; }
    .good { color: #16a34a; font-weight: 800; }
    .bad  { color: #dc2626; font-weight: 800; }
    .neutral { color: #6b7280; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media print {
      body { font-size: 11.5px; }
      section { page-break-inside: avoid; }
      h2 { font-size: 13px; }
    }
  </style>
</head>
<body>

<!-- HEADER -->
<section style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1593ff;">
  <div>
    <div style="font-size:20px;font-weight:900;color:#1a3a4a;letter-spacing:-.5px;">NutriProgress · Reporte de Seguimiento</div>
    <div style="font-size:13px;color:#4a5568;margin-top:3px;">Plicometría + Bioimpedancia · Comparativo vs punto inicial</div>
  </div>
  <div style="text-align:right;font-size:12px;color:#4a5568;line-height:1.7;">
    <b style="color:#1a3a4a;font-size:14px;">${s.patientName}</b>${s.patientAge ? " · " + s.patientAge : ""}<br/>
    Generado: ${dateStr}<br/>
    Inicio plic.: ${fmtDate(s.compDates[compBase])} · Activo: ${fmtDate(s.compDates[s.compIndex])}<br/>
    Inicio bio.: ${fmtDate(s.accDates[accBase])} · Activo: ${fmtDate(s.accDates[s.accIndex])}
  </div>
</section>

<!-- KPIs -->
<section>
  <h2>Indicadores clave</h2>
  <div style="display:flex;flex-wrap:wrap;gap:10px;">
    ${buildKpis(s)}
  </div>
</section>

<!-- PLICOMETRÍA -->
<section>
  <h2>${s.labels.composition} — Todas las métricas y fechas</h2>
  <p style="font-size:11px;color:#4a5568;margin-bottom:8px;">La columna resaltada es el punto inicial. Cambio y % calculados desde el inicio hasta la última medición disponible.</p>
  ${buildMetricTable(s.composition, s.compDates, compKeys, compBase, "#1593ff")}
</section>

<!-- BIOIMPEDANCIA -->
<section>
  <h2>${s.labels.bioimpedance} — Todas las métricas y fechas</h2>
  ${buildMetricTable(s.accuniq, s.accDates, accKeys, accBase, "#21d6e9")}
</section>

<!-- METAS + LECTURA EJECUTIVA -->
<div class="grid2">
  <section>
    <h2>Metas del mes</h2>
    ${buildGoals(s.goals)}
  </section>
  <section>
    <h2>Lectura ejecutiva</h2>
    ${buildInsights(s)}
  </section>
</div>

<div style="margin-top:14px;font-size:10px;color:#9aa7b2;text-align:center;">
  Nota: La bioimpedancia puede variar por hidratación, glucógeno y recuperación. Usar tendencias, no datos aislados. · NutriProgress MVP
</div>

<script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; }</script>
</body>
</html>`;
  }

  // ─── Punto de entrada ───────────────────────────────────────────────────
  window.exportPDF = function () {
    const s = getAppState();

    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) {
      alert("Activa las ventanas emergentes para exportar el PDF.");
      return;
    }

    win.document.open();
    win.document.write(buildReportHTML(s));
    win.document.close();
  };

})();
