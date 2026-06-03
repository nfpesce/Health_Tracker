# Registro de salud

Aplicacion web estatica para llevar un registro personal de presion arterial,
temperatura y oxigenacion. Esta pensada para un solo usuario y para publicarse
en GitHub Pages.

## Caracteristicas

- Guarda los datos en el navegador con `localStorage`.
- Permite elegir que mediciones se piden y grafican: presion, temperatura y
  oxigenacion. Esa configuracion tambien queda guardada en el navegador.
- Al desactivar una medicion, los nuevos registros conservan el ultimo valor
  historico disponible para no descartar esos datos.
- Permite crear, editar y borrar registros.
- Acepta presion y temperatura con punto o coma decimal, por ejemplo `12.8`,
  `12,8`, `9.3`, `9,3`, `37.5` o `37,5`.
- Normaliza los valores decimales a un formato unico con punto y un decimal.
- Muestra resumen del ultimo registro.
- Grafica tendencias de presion, temperatura y oxigenacion.
- Exporta respaldos en `CSV` y `JSON`.

## Privacidad y respaldo

GitHub Pages solo sirve archivos estaticos; no tiene base de datos propia. Los
datos de esta version quedan guardados en el navegador del usuario. Para evitar
perdidas, conviene exportar un respaldo periodicamente desde la app.

## Desarrollo local

Como es una app estatica, se puede abrir `index.html` directamente o servir el
directorio con cualquier servidor local:

```bash
python -m http.server 8080
```

## Despliegue

El repositorio incluye un workflow en `.github/workflows/pages.yml` para publicar
automaticamente en GitHub Pages cuando se suben cambios a `main`.
