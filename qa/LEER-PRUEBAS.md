# Evidencias de 1.1.0-rc.1

REGISTRO_FINAL.txt contiene la salida completa de QA_RUN.sh con HTTP, GLES y Chromium habilitados; terminó con código 0. Los avisos Canvas fallback son esperados en el DOM simulado sin WebGL. La advertencia VM Modules pertenece a Node, no a la consola del navegador.

- browser-results.json: 17 flujos de Chromium headless/SwiftShader, muestras RAF/heap y errores/peticiones. Hubo teletransporte QA para acceder a eventos y finales; no acredita partidas humanas completas.
- runtime-smoke.json: 12 flujos ESM/Canvas con eventos DOM simulados. journey-runtime y journey-driving añaden encuentros, finales, resolución y 122 km numéricos continuos; salida en REGISTRO_FINAL.
- gles-results.json: 24 escenas renderizadas con EGL/GLES llvmpipe. No es un navegador.
- canvas-*.png: píxeles de Canvas nativo con DOM simulado; webgl-*.png: replay GLES. Estas ocho imágenes no son capturas HTML/CSS de navegador. Las capturas nativas se inspeccionaron durante la auditoría; no se incluyen en el ZIP.
- SHA256-FUENTES.json: fuentes exactas de esta entrega. CHECKSUMS.sha256 cubre el paquete, excepto a sí mismo.

Las mediciones de FPS corresponden a gráficos por software y muestras cortas. Windows, Mint, GPU/móvil/mando físicos, escucha humana y conducción humana prolongada siguen pendientes. Véase QA_REPORT.md.
