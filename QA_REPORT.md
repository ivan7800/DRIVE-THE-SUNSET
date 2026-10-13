# Drive the Sunset — auditoría de entrega 1.1.0-rc.1

Fecha: 13 de octubre de 2026. Alcance: ZIP derivado de 1.0.0-rc.3, sin publicación remota.

## 1. Veredicto

**Release candidate jugable dentro del alcance verificado.** La conducción ampliada, los encuentros, los finales y los renderizadores pasan las pruebas indicadas. No se reproduce un bloqueo de inicio o progreso en esta suite. No se certifica una versión estable para todos los equipos ni una calidad «excelente» por haber superado automatización. Manejo humano, mezcla escuchada y plataformas físicas siguen pendientes.

**Verificado:** ejecutado directamente. **Observado:** inspeccionado en código. **Pendiente:** sin ejecución suficiente. Un PASS de lógica no sustituye una partida humana.

## 2. Resumen ejecutivo

- Cuatro perfiles de conducción, derrape recuperable, freno prioritario y controles simultáneos corregidos.
- Cuatro capítulos por carretera y variación de paisaje por distrito, especialmente Carmelo.
- Ocho encuentros con decisiones y dieciséis finales persistentes; importación de copias anteriores.
- Luz de atardecer progresiva, motor según marcha/carga, sonido de derrape y mezcla dinámica de radio.
- Caché de escenario y resolución adaptativa; medición de Chromium real con gráficos por software.
- Riesgos restantes: rendimiento en GPU física, sesiones largas, sensación de conducción y compatibilidad fuera de Chromium Linux.

## 3. Entorno de prueba

Linux del entorno de ejecución; Node.js 24.19.0; Python 3.12.14; módulos ESM; `@napi-rs/canvas` con DOM simulado. Mesa EGL/GLES con llvmpipe para compilar shaders, dibujar y leer píxeles. Chromium 151.0.7922.34 headless mediante Playwright, WebGL ANGLE/SwiftShader. HTTP local habilitado para estas comprobaciones.

Resoluciones de navegador: 1280 × 720, 390 × 844 y 844 × 390. El tamaño móvil es una emulación de viewport/entrada, sin teléfono físico. Las imágenes Canvas/GLES son 1280 × 720. No se dispuso de Windows, Linux Mint físico, Safari, Firefox, mando, GPU física ni escucha humana.

Reproducción: `CHASE_BROWSER_BINARY=/ruta/chrome CHASE_QA_GLES=1 bash QA_RUN.sh`, con Playwright, Canvas, EGL/GLES y Pillow disponibles como herramientas de desarrollo. El juego no necesita estas dependencias para jugar. La pasada final terminó con código 0. Registros: `qa/REGISTRO_FINAL.txt`, `qa/browser-results.json`, `qa/runtime-smoke.json` y `qa/gles-results.json`.

## 4. Matriz de pruebas

Entorno **L**: Node/Linux, sin navegador ni resolución. **C**: Canvas nativo/DOM simulado, 1280 × 720. **B**: Chromium descrito arriba, escritorio salvo indicación. **G**: GLES por software, 1280 × 720. Los scripts citados contienen los pasos exactos.

| ID / nombre | Entorno y pasos realizados | Resultado esperado | Resultado observado / estado | Evidencia |
|---|---|---|---|---|
| A01 · Sintaxis y bundle | L; runner y build --check | Módulos válidos y espejo reproducible | Superada; 13 módulos | REGISTRO_FINAL |
| A02 · Recursos y subruta | L/HTTP; rastrear HTML/imports y GET; B abrir /CHASE-404/ | HTTP 200, MIME válido, sin rutas rotas | Superada; 20 recursos HTTP y ninguna petición fallida en B | package-smoke, http-smoke, browser-results |
| A03 · Lanzador Linux | L/HTTP; arrancar, consultar y cerrar dos veces | Mismo origen y recursos | Superada; 127.0.0.1:8765 estable | http-smoke, REGISTRO_FINAL |
| A04 · Lanzador Windows | L; inspeccionar batch/PowerShell | Rutas, fallback y host coherentes | Superada solo por contrato estático; Windows pendiente | launchers.test.mjs |
| B01 · Conducción básica | L; gas, freno, reversa, izquierda/derecha, reposo, límite | Dirección correcta, velocidad acotada, reposo estable | Superada en simulación; W también ejecutado en B | physics, driving-iter2/3/4, core-final, browser-results |
| B02 · Cambios y derrape | L; alternar giro, soltar, derrapar y recuperar con cuatro coches | Respuesta finita, recuperación y freno prioritario | Superada en simulación | journey-driving, driving-iter2/3/4 |
| B03 · Teclas simultáneas | C; W+↑, soltar W, después ↑ | Tecla aún pulsada sigue actuando; luego decelera | Superada | journey-runtime |
| B04 · Mando analógico | L; ejes y pedales parciales | Respuesta proporcional | Superada en física; Gamepad físico no ejecutado | journey-driving |
| B05 · Pausa y foco | C; pausa, blur, visibilidad; B menús/Esc | Simulación detenida, entrada limpia, foco vuelve | Superada en esos flujos | runtime-smoke, journey-runtime, browser-results |
| C01 · Bordes y tráfico | L; alcanzar borde, tráfico y cooldown | Contacto frena sin atravesar límites | Superada en modelo vial | physics, traffic, journey-driving |
| C02 · Cámara/geometría | L; 384 estados y foto congelada; G dibujar 24 escenas | Geometría finita, foto estable, shaders válidos | Superada por contratos/píxeles; no partida humana | renderer.test.mjs, gles-results |
| C03 · Recorrido continuo | L; controlador numérico de carril, 4 coches × 4 rutas | Alcanzar final sin saltar posiciones ni tocar borde | Superada; 16 recorridos, 122 km simulados | journey-driving |
| D01 · Desvíos/recuerdos | C/B; 3 desvíos, 16 recuerdos, 4 finales con posiciones QA | Destino/diario correctos, final accesible | Superada; usa teletransporte QA, no rutas jugadas completas | runtime-smoke, browser-e2e |
| D02 · Encuentros | C/B; situar coche en cada evento, abrir/elegir/cerrar | 8 diálogos pausados, elección persistente, foco | Superada | journey-runtime, browser-e2e |
| D03 · Finales | L; combinar opciones, guardar/cargar/copiar; C/B finales | Final correspondiente, persiste al recargar | Superada para 16 en lógica; B prueba 4 promise y 4 sin encuentro | journey-driving, journey-runtime, browser-results |
| D04 · Actividades | L/C; limpio, fluidez, explorar, contactos y Crucero | Opcionales, reinicio correcto, sin bloqueo | Superada en simulación | activities, core-final, runtime-smoke |
| E01 · Menús/foto/copia | B; inicio, garaje, ayuda, diario, rutas, PNG/JSON, Esc/foco | Controles usados funcionan, descargas válidas | Superada en 17 flujos; no auditoría exhaustiva de todos los selectores | browser-results, browser-e2e |
| E02 · Accesibilidad | L; 8 diálogos, IDs, etiquetas, canvas; B foco | Semántica y retorno de foco correctos | Superada parcialmente; lector/contraste medido pendientes | accessibility, browser-e2e |
| E03 · Móvil emulado | B 390×844/844×390; mantener gas, encuentro y garaje | Avance, sin desbordamiento horizontal | Superada; capturas revisadas, sin móvil físico | browser-results |
| F01 · Persistencia | L/C; datos inválidos, versiones, rollback, bloqueo; B recargar | Validación, conservación y aviso de fallo | Superada en casos automatizados | save, backup, core-final, journey-driving, runtime-smoke |
| G01 · Audio | B; gesto AUDIO y analizador de compresor | AudioContext activo y señal no nula | Superada para señal; mezcla audible no ejecutada | browser-e2e |
| G02 · Apariencia | Revisar muestras B escritorio/móvil y C/G | Escena/texto legibles en muestras | Verificada parcialmente; toda la ruta y valoración humana pendientes | canvas-*.png, webgl-*.png; capturas B revisadas durante auditoría |
| H01 · Rendimiento | B; 45 RAF por ruta y Auto tras calentamiento | Medición acotada al equipo | Superada como medición; cifras debajo | browser-results |
| H02 · Resolución automática | C; 100 frames lentos y cambio manual; B Carmelo Auto | Reduce resolución; manual reinicia escala | Superada | journey-runtime, browser-results |
| H03 · Pérdida WebGL | B; perder/restaurar contexto | Canvas y recuperación 3D | Superada; sin errores GL/JS registrados | browser-results |
| H04 · Sin Internet | Inspección y B sin solicitudes externas | Recursos autosuficientes con HTTP local | Observado y carga local verificada; corte físico de red no ejecutado | package-smoke, browser-results |
| H05 · Hardware/sesión larga | Sin equipo; no se ejecutaron partidas humanas prolongadas | Compatibilidad/estabilidad sostenidas | No ejecutada | Pendiente |

### Medición de rendimiento

| Ruta / calidad | FPS (45 frames RAF) | p95 ms | Heap JS MB | Resolución interna |
|---|---:|---:|---:|---|
| coast / low | 29.7 | 33.4 | 38.7 | 1280 × 720 |
| mountain / low | 29.7 | 50.0 | 39.2 | 1280 × 720 |
| vineyards / low | 28.1 | 50.0 | 43.1 | 1280 × 720 |
| carmelo / low | 24.3 | 50.1 | 20.3 | 1280 × 720 |
| carmelo / auto | 29.4 | — | — | 1088 × 612 |

Muestras cortas con SwiftShader: no demuestran ausencia de fugas ni 60 FPS sostenidos. Auto usa otro punto/instante de conducción; no es una comparación A/B controlada. Heap significa memoria JS, no toda la GPU/proceso; no se midió CPU. Contadores acumulados de geometría/caché disponibles en el JSON.

## 5. Hallazgos y causas

| ID | Severidad / estado | Reproducción y causa | Impacto / cierre |
|---|---|---|---|
| F01 | Alto · corregido | Mantener W y ↑, soltar una; el booleano compartido borraba ambas entradas | Pérdida inesperada de aceleración; Set por tecla y regresión ejecutada |
| F02 | Medio · corregido | Tocar borde y ejecutar tráfico sin coche; se sobrescribía el contacto vial | Métricas Arcade incoherentes; contacto preservado y probado |
| F03 | Medio · corregido | Cámara trasera al inicio; terreno empezaba en z=0 | Hueco de asfalto; geometría extendida detrás del origen, distancia física acotada |
| F04 | Bajo · corregido | HUD rc.3 conservaba LAST LIGHT DRIVE | Marca inconsistente; ahora DRIVE THE SUNSET |
| F05 | Medio · corregido | Abrir pausa/diálogo con render activo; animación seguía avanzando | Pausa inconsistente; reloj visual congelado y contrato foto comprobado |
| F06 | Medio · mitigado, pendiente hardware | Escena densa de Carmelo con gráficos por software | FPS limitados; caché/resolución automática añadidas. Cerrar con medición sostenida en equipos objetivo |
| F07 | Medio · riesgo tratado | Copia con finales nuevos en cliente antiguo formato 1 | Podía omitir finales; nuevas copias formato 2, importación 1 compatible |

F01–F05 se identificaron en código y sus nuevas condiciones de regresión se ejecutaron; no se afirma que cada defecto antiguo se reprodujera primero en navegador. F07 previene pérdida posible al mezclar versiones. No quedan bloqueantes/críticos reproducidos por esta suite; no equivale a ausencia universal de errores.

Las colisiones usan límites laterales y tráfico, no choque contra cada malla de edificio. Esta versión de viajes no contiene persecuciones policiales ni campaña con game over; no se las presenta como probadas.

Licencia MIT presente. Geometría, síntesis sonora, relatos e interfaces están en el proyecto, sin dependencias artísticas remotas observadas. No se realizó investigación jurídica de autoría o marcas.

## 6. Regresiones frente a 1.0.0-rc.3

Se conservan 4 coches, 4 rutas, 3 desvíos, 16 recuerdos, 3 actividades, radio, foto, Canvas/WebGL y claves locales CHASE-404. Se repitieron controles, cámara, colisiones, persistencia, bundle y rutas. Guardados antiguos se normalizan sin finales; el historial nuevo incluye desenlaces.

La entrega previa no había logrado ejecutar Chromium ni HTTP en su entorno restringido. Esta auditoría sí ejecutó ambos. Los registros previos se sustituyen por evidencia de las fuentes actuales. El nombre visible no cambia el origen ni las claves del progreso.

## 7. Pendiente de comprobar

- Jugar manualmente todas las rutas/elecciones: derrape, peso, legibilidad en movimiento y equilibrio narrativo.
- Escuchar mezcla y transiciones con altavoces/auriculares.
- Windows con Python y fallback PowerShell; Linux Mint, mando y móviles físicos.
- Firefox/Safari, lector de pantalla, navegación completa sin ratón y contraste medido.
- Sesión de 30–60 minutos, FPS/CPU/memoria sostenidos y foco real en hardware objetivo.
- URL pública de GitHub Pages y caché tras actualización. No publicada.

## 8. Plan de cierre

1. **Conducción humana:** completar cada ruta con al menos dos coches; probar giro rápido, freno, reversa y derrape. Cerrar si sentido de giro, recuperación y lectura de obstáculos son consistentes, sin atascos.
2. **Rendimiento:** medir 30 minutos en GPU integrada y móvil objetivo. Cerrar F06 con presupuesto acordado y estabilidad; ajustar detalle según resultados.
3. **Audio/accesibilidad:** escuchar emisoras y eventos; menús solo con teclado, contraste y lector. Corregir defectos reproducibles antes de etiquetar estable.
4. **Plataformas/datos:** ejecutar lanzadores; cierre/recarga, copia/restauración y cambio de origen. Conservar copia previa a migración.
5. **Publicación autorizada:** desplegar y verificar consola/red de la URL final; después etiquetar 1.1.0 estable.

## 9. GitHub Pages

Entrada index.html, .nojekyll, JS, CSS y recursos relativos presentes. HTTP en subdirectorio y navegador bajo /CHASE-404/ verificados. Usar el contenido de la carpeta CHASE-404 como raíz del sitio; no necesita compilación ni secretos en producción. Bundle opcional, entrada principal ESM.

Configuración remota, permisos, caché y URL publicada **pendientes**. No se modificó ni publicó repositorio remoto. El servidor local puede servir los recursos extraídos sin Internet; no se promete PWA ni recarga offline de URL alojada.

## 10. Conclusión

**Release candidate ampliada y comprobada**, con mejoras implementadas en las cinco áreas. Hay evidencia de Chromium nativo por software, Canvas/GLES y 122 km de integración física simulada. Excelencia y publicación estable requieren las comprobaciones humanas y de hardware pendientes.
