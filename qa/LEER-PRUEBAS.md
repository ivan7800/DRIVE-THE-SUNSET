# Evidencias de la release candidate 1.1.0-rc.2

`REGISTRO_RC2.txt` contiene 28 comandos que pasaron sobre esta entrega: 23 archivos de lógica, runtime Canvas/DOM simulado, regresiones nuevas de Touch Events/encuentros, builder y empaquetado. No incluye navegador, HTTP, GLES ni iPhone.

`REGISTRO_RC1.txt`, `browser-results.json`, `runtime-smoke.json` y `gles-results.json` son resultados históricos de RC1. Se incluyen como referencia de la base y no deben interpretarse como reejecución de RC2. En RC1 Chromium headless/SwiftShader pasó 17 flujos; la salida se documenta en QA_REPORT.md.

Las capturas `canvas-*.png` proceden de Canvas nativo con DOM simulado; `webgl-*.png` son escenas replay GLES por software. Ninguna es una captura HTML/CSS de navegador ni de iPhone.

`SHA256-FUENTES.json` lista las fuentes de la entrega. `CHECKSUMS.sha256` verifica el contenido empaquetado, excepto el propio archivo de checksums.

Pendiente en iPhone: controles táctiles mantenidos, audio audible, selector gráfico/WebGL y legibilidad. Véase QA_REPORT.md.
