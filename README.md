# GymComm v3 · Final ajustado ES

Versión final en español para subir a GitHub/Vercel.

## Contenido

- `index.html`: app GymComm v3 final ajustada.
- `data/gymcomm_rutinas.csv`: plantilla base de rutinas compatible con la app.
- `docs/google-sheets-rutinas-template.csv`: misma plantilla para importar a Google Sheets.
- `docs/diccionario-columnas-sheets.md`: explicación friendly de cada columna del Sheet.

## Cambios incluidos

- En **Hoy** ya puedes elegir libremente qué rutina hacer. La app sigue mostrando una rutina sugerida, pero no te fuerza.
- Selector de unidad de carga: `kg` o `lb → kg`.
- Si capturas en libras, la app convierte automáticamente y guarda el dato en kg.
- La conexión a Sheets sigue siendo por CSV publicado.
- La app conserva fallback local si Sheets no está configurado.

## Cómo subir a GitHub

Sube el contenido de esta carpeta a la raíz del repositorio:

```text
index.html
README.md
data/
docs/
```

No subas la carpeta completa como una subcarpeta del repo.

## Cómo conectar Google Sheets

1. Crea un Google Sheet nuevo.
2. Importa `docs/google-sheets-rutinas-template.csv`.
3. Renombra la pestaña como `rutinas`.
4. Ve a Archivo > Compartir > Publicar en la web.
5. Selecciona la pestaña `rutinas` y formato CSV.
6. Copia el enlace CSV publicado.
7. Abre GymComm, toca ⚙️, pega el URL y usa `Guardar y recargar rutina`.

## Importante sobre privacidad y uso compartido

- El link de Vercel comparte la app, no tus datos locales.
- Cada navegador guarda su propio progreso en `localStorage`.
- La URL del Google Sheet también queda guardada localmente en cada navegador.
- Si varias personas usan el mismo CSV publicado, todas verán la misma rutina base.
- Si una persona edita ese mismo Google Sheet, todos los que usen ese CSV verán el cambio al recargar.
- Para uso multiusuario real, cada persona debe tener su propio Google Sheet o después debemos crear login/base de datos.
