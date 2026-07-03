/**
 * NutriProgress — PDF Export (v1)
 *
 * Estrategia: window.print() con @media print en styles.css.
 * Antes de imprimir:
 *   1. Clona cada SVG de gráfica como <img> data-URI para que los browsers
 *      que no imprimen SVG inline los rendericen igual.
 *   2. Inyecta un stamp de fecha y paciente visible sólo en impresión.
 *   3. Fuerza "Resumen integral" como vista activa (muestra todas las secciones).
 *   4. Muestra overlay de "Preparando reporte…" durante el proceso.
 *   5. Restaura el estado original después de que el diálogo de impresión cierra.
 */

(function () {
  // ─── Overlay de carga ────────────────────────────────────────────────────
  function createOverlay() {
    const el = document.createElement("div");
    el.id = "pdfLoadingOverlay";
    el.innerHTML = `<div class="spinner"></div><div>Preparando reporte PDF…</div>`;
    document.body.appendChild(el);
    return el;
  }

  function showOverlay() {
    let el = document.getElementById("pdfLoadingOverlay");
    if (!el) el = createOverlay();
    el.classList.add("visible");
  }

  function hideOverlay() {
    const el = document.getElementById("pdfLoadingOverlay");
    if (el) el.classList.remove("visible");
  }

  // ─── Convertir SVG a data-URI PNG (vía canvas) ───────────────────────────
  function svgToDataUri(svgEl) {
    return new Promise((resolve) => {
      try {
        const bbox = svgEl.getBoundingClientRect();
        const w = Math.max(bbox.width || 600, 300);
        const h = Math.max(bbox.height || 280, 180);

        // Serializar el SVG incluyendo todos los estilos computados del DOM
        const clone = svgEl.cloneNode(true);
        clone.setAttribute("width", w);
        clone.setAttribute("height", h);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

        // Inline computed fill/stroke de los elementos hijos
        Array.from(clone.querySelectorAll("*")).forEach((el, i) => {
          const orig = svgEl.querySelectorAll("*")[i];
          if (!orig) return;
          const cs = window.getComputedStyle(orig);
          ["fill", "stroke", "font-size", "font-weight", "font-family"].forEach((prop) => {
            const val = cs.getPropertyValue(prop);
            if (val && val !== "none" && val !== "") {
              el.style[prop] = val;
            }
          });
        });

        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(clone);
        const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          const ctx = canvas.getContext("2d");
          ctx.scale(dpr, dpr);
          // Fondo oscuro para los charts (se invertirá a claro en print)
          ctx.fillStyle = "#071018";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      } catch (e) {
        console.warn("pdf-export: SVG snapshot failed", e);
        resolve(null);
      }
    });
  }

  // ─── Inject stamp ────────────────────────────────────────────────────────
  function injectStamp() {
    const existing = document.getElementById("pdf-stamp-el");
    if (existing) existing.remove();

    const patientName = document.getElementById("patientName")?.textContent || "";
    const patientAge = document.getElementById("patientAge")?.textContent || "";
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", {
      day: "2-digit", month: "long", year: "numeric"
    });
    const timeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

    const stamp = document.createElement("div");
    stamp.id = "pdf-stamp-el";
    stamp.className = "pdf-stamp";
    stamp.innerHTML = `NutriProgress · ${patientName}${patientAge ? ", " + patientAge : ""} · Generado el ${dateStr} a las ${timeStr}`;
    document.querySelector(".app").prepend(stamp);
    return stamp;
  }

  // ─── Snapshot SVGs → IMG ─────────────────────────────────────────────────
  async function snapshotCharts() {
    const svgIds = ["mainChart", "normChart"];
    const replacements = [];

    for (const id of svgIds) {
      const svgEl = document.getElementById(id);
      if (!svgEl) continue;

      const dataUri = await svgToDataUri(svgEl);
      if (!dataUri) continue;

      const img = document.createElement("img");
      img.src = dataUri;
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.className = "pdf-chart-snapshot";

      // Reemplazar el svgWrap content con la imagen
      const wrap = svgEl.parentElement;
      if (wrap) {
        wrap.style.height = "auto";
        svgEl.style.display = "none";
        wrap.appendChild(img);
        replacements.push({ wrap, svgEl, img });
      }
    }

    return replacements;
  }

  // ─── Restaurar estado ────────────────────────────────────────────────────
  function restoreCharts(replacements) {
    replacements.forEach(({ wrap, svgEl, img }) => {
      svgEl.style.display = "";
      wrap.style.height = "";
      if (img.parentElement) img.parentElement.removeChild(img);
    });
  }

  // ─── Forzar vista overview (todas las secciones visibles) ───────────────
  function forceOverviewMode() {
    // Guardar estado actual de app.js
    const savedView = typeof state !== "undefined" ? state.view : null;

    // Activar "Resumen integral" para que todos los paneles estén visibles
    if (typeof state !== "undefined" && state.view !== "overview") {
      state.view = "overview";
      if (typeof renderAll === "function") renderAll();
    }

    return savedView;
  }

  function restoreView(savedView) {
    if (savedView && typeof state !== "undefined" && state.view !== savedView) {
      state.view = savedView;
      if (typeof renderAll === "function") renderAll();
    }
  }

  // ─── Punto de entrada principal ──────────────────────────────────────────
  window.exportPDF = async function () {
    showOverlay();

    // Pequeño delay para que el overlay sea visible antes de bloquear el hilo
    await new Promise((r) => setTimeout(r, 80));

    let replacements = [];
    let stamp = null;
    let savedView = null;

    try {
      // 1. Forzar vista completa
      savedView = forceOverviewMode();

      // Esperar a que los charts rerenderizen
      await new Promise((r) => setTimeout(r, 150));

      // 2. Snapshot de SVGs como imágenes
      replacements = await snapshotCharts();

      // 3. Stamp de fecha/paciente
      stamp = injectStamp();

      // 4. Ocultar el botón de export en la impresión (ya está en el CSS, pero por si acaso)
      const exportBtn = document.getElementById("pdfExportBtn");
      if (exportBtn) exportBtn.style.display = "none";

      hideOverlay();

      // 5. Imprimir
      window.print();

    } finally {
      // 6. Restaurar todo — se ejecuta cuando el diálogo de impresión cierra
      //    (print() es síncrono en la mayoría de browsers; en iOS puede no serlo)
      setTimeout(() => {
        restoreCharts(replacements);
        if (stamp) stamp.remove();
        restoreView(savedView);
        const exportBtn = document.getElementById("pdfExportBtn");
        if (exportBtn) exportBtn.style.display = "";
        hideOverlay();
      }, 500);
    }
  };

})();
