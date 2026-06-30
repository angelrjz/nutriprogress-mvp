# Diccionario de columnas · GymComm Sheets

Esta hoja alimenta la rutina de GymComm. La app espera que los encabezados se mantengan exactamente iguales. Puedes editar los valores de cada fila, pero no cambies el nombre de las columnas.

## Columnas obligatorias

| Columna | Qué significa | Ejemplo | Cómo usarla |
|---|---|---|---|
| `routine_id` | Identificador interno de la rutina. Debe ser único y sin espacios. | `push` | Usa minúsculas. No lo cambies si ya hay registros guardados. |
| `routine_name` | Nombre visible de la rutina. | `Push` | Esto aparece en la app. |
| `routine_emoji` | Emoji para identificar la rutina. | `💪` | Opcional, pero ayuda visualmente. |
| `routine_note` | Nota general de la rutina. | `Press horizontal como ancla.` | Úsala para explicar el foco del día. |
| `ex_id` | Identificador interno del ejercicio. Debe ser único dentro de la rutina. | `p1` | No lo cambies si ya hay registros guardados. |
| `ex_name` | Nombre visible del ejercicio. | `Press pecho horizontal barra` | Esto aparece en la tarjeta del ejercicio. |
| `musculo` | Grupo muscular principal. | `Pecho` | Sirve como etiqueta visual. |
| `bloque` | Tipo de bloque dentro de la rutina. | `Principal`, `Accesorio`, `Volumen` | Ayuda a distinguir prioridades. |
| `series` | Número de series a registrar. | `3` | La app creará esa cantidad de filas de captura. |
| `reps_target` | Rango o patrón objetivo de reps. | `6-9`, `8·8 drop`, `fallo` | Los rangos tipo `6-9` activan reglas de progresión. |
| `weight_ref` | Peso de referencia inicial en kg. | `100` | Siempre escríbelo en kg, aunque la app pueda capturar en lb. |
| `descanso` | Descanso sugerido entre series. | `90s` | Informativo por ahora. |
| `tags` | Etiquetas especiales separadas por coma o pipe. | `dropset`, `biserie-a`, `biserie-b`, `video` | Controla badges y alertas. |
| `notas` | Instrucciones específicas del ejercicio. | `Revisar técnica antes de cargar peso.` | Aparece dentro de la tarjeta del ejercicio. |

## Tags disponibles

| Tag | Significado | Efecto en la app |
|---|---|---|
| `dropset` | Serie con reducción de peso sin descanso. | Muestra badge amarillo Dropset. |
| `biserie-a` | Primer ejercicio de una biserie. | Agrupa visualmente como Biserie A. |
| `biserie-b` | Segundo ejercicio de una biserie. | Agrupa visualmente como Biserie B. |
| `video` | Requiere revisión de video. | Crea alerta morada en Coach. |

## Reglas importantes

1. No cambies los encabezados.
2. No repitas `ex_id` dentro de la misma rutina.
3. `weight_ref` siempre va en kg.
4. Para que la app recomiende subir/mantener peso, usa rangos tipo `6-9`, `8-10`, `10-12`.
5. Patrones como `8·8 drop` o `fallo` se registran, pero no tienen regla automática de subida de peso.
6. Si compartes la app con otra persona, lo ideal es que esa persona use su propia copia del Google Sheet.
