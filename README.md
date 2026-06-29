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


## v4 - Fechas de bioimpedancia completas

Esta version muestra todas las fechas de Plicometria y todas las fechas de Bioimpedancia en el selector de fecha activa. Ya no se limita a un unico boton de Bioimpedancia con la ultima fecha.

La integracion directa con InBody debe tratarse como fase posterior y requiere acceso autorizado a LookinBody Web/API o integraciones oficiales del proveedor.

## v5 - Punto inicial y lectura ejecutiva

Cambios principales:

- El resumen de cambios ya no compara contra la medicion anterior. Ahora compara siempre contra el punto inicial de cada tipo de medicion.
- El detalle de fecha activa muestra punto inicial, fecha activa y cambio por metrica.
- Los KPIs superiores muestran cambio vs inicio.
- La lectura ejecutiva ya no queda vacia: si no hay insights en la hoja/JSON, la app genera una lectura automatica local basada en los datos.
- Se agrego un boton opcional `Generar con AI`.

### AI opcional con OpenAI

La AI no debe conectarse desde el navegador, porque eso expondria la API key. La v5 incluye una funcion de Vercel en:

```text
api/ai-summary.js
```

Para activarla en Vercel:

1. Ir al proyecto en Vercel.
2. Settings > Environment Variables.
3. Agregar:

```text
OPENAI_API_KEY=tu_api_key
```

Opcional:

```text
OPENAI_MODEL=gpt-4.1-mini
```

4. Hacer redeploy.
5. Abrir el dashboard y presionar `Generar con AI`.

Si no hay API key configurada o la funcion falla, la app conserva una lectura automatica local como respaldo.

## v6 - Fechas friendly

Esta version formatea fechas numericas como `07.06.24` en formato legible para paciente, por ejemplo:

```text
07 Junio 2024
```

En botones y ejes se usa una version compacta para no saturar la interfaz:

```text
07 Jun 24
```

Los rangos de comparacion, detalles y lectura ejecutiva usan fechas friendly.


## v7 - UX de cambio relativo, fechas y metas

Cambios principales:

- El antiguo `Resumen normalizado` ahora se muestra como `Cambio relativo vs inicio`. En lugar de enseñar valores base 100 como `Peso 95.37`, muestra variacion porcentual como `Peso -4.63%`.
- Las fechas de plicometria se muestran como mes + año: `DIC 25`, `ENE 26`, `FEB 26`, etc.
- Las fechas de bioimpedancia se muestran sin dia: `Jun 24`, `Jul 24`, `Ene 25`, `Mar 26`, etc.
- La app ya no muestra el mensaje visible `AI pendiente` cuando falta `OPENAI_API_KEY`; usa la lectura automatica local como respaldo silencioso.
- `Metas del mes` ahora puede mostrarse como tabla de metas recomendadas, por ejemplo `Meta julio recomendada`.
