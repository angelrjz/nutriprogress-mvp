# NutriProgress MVP

Primera versión modular del dashboard de plicometría + bioimpedancia para convertirlo en app vendible a nutriólogos.

## Qué incluye

- `index.html`: estructura del dashboard.
- `styles.css`: diseño visual separado.
- `app.js`: lógica del dashboard.
- `data/dashboard-data.json`: datos demo externos al HTML.
- `docs/google-sheets-template.csv`: plantilla para subir a Google Sheets.

## Cómo correrlo localmente

Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
```

Abre:

```text
http://localhost:8000
```

No abras directamente el archivo `index.html`, porque el navegador puede bloquear la carga de `data/dashboard-data.json`.

## Cómo actualizar datos sin tocar el HTML

Edita `data/dashboard-data.json` y agrega nuevas fechas o mediciones. El dashboard se actualiza al recargar.

## Cómo conectarlo a Google Sheets

1. Sube `docs/google-sheets-template.csv` a Google Sheets.
2. Mantén la columna `tipo` con estos valores:
   - `plicometria` para mediciones manuales de pliegues y perímetros.
   - `bioimpedancia` para equipos como InBody, ACCUNIQ, Tanita o SECA.
3. En Google Sheets, usa Archivo > Compartir > Publicar en la web.
4. Elige la hoja correcta y formato CSV.
5. Copia la URL CSV publicada.
6. Usa el dashboard con `#sheet=` para pegar la URL CSV sin complicarte con caracteres especiales:

```text
https://TU-DOMINIO.vercel.app/#sheet=URL_CSV_PUBLICA_DE_GOOGLE_SHEETS
```

Ejemplo local:

```text
http://localhost:8000/#sheet=URL_CSV_PUBLICA_DE_GOOGLE_SHEETS
```

## Cómo publicarlo en Vercel

1. Crea un repo en GitHub.
2. Sube estos archivos.
3. Conecta el repo a Vercel.
4. Cada cambio que subas a GitHub se publicará automáticamente.

## Próximo paso comercial

Convertir esta versión en producto multi-paciente:

- Panel del nutriólogo.
- Lista de pacientes.
- Link privado por paciente.
- Branding del consultorio.
- Reporte exportable para WhatsApp/PDF.


## Nota v3 - carga robusta desde Google Sheets

Esta versión agrega tolerancia a errores cuando Google Sheets trae columnas incompletas, nombres de columnas con mayúsculas/minúsculas diferentes o métricas vacías. Si falta una métrica, el dashboard la omite en lugar de romperse con errores de `values`.

Para probar en Vercel usa el link con el parámetro codificado:

```text
https://TU-DOMINIO.vercel.app/#sheet=URL_CSV_CODIFICADA
```
