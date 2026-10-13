# Drive the Sunset — auditoría de entrega 1.1.0-rc.3

## Anexo RC3 · retirada del renderizador 2D

**Veredicto:** RC3 elimina el renderizado 2D de la carretera y su selección. El modo de conducción ya no cae silenciosamente a Canvas cuando WebGL falla: bloquea el inicio, explica el requisito y permite reintentar. Sigue siendo candidata; no certifico publicación porque no se pudo iniciar el servidor HTTP de pruebas ni repetir Chromium/GPU en esta intervención.

**Hallazgo corregido:** la causa era `configureRenderer()` en `js/main.js`: ante un error de contexto WebGL seleccionaba `renderer='canvas'` y dibujaba la escena completa con `drawScene()`. La pantalla mostraba una presentación 2D aunque el usuario buscara la versión 3D. Ahora ese camino se ha retirado; Canvas se conserva solo para minimapa y exportación PNG.

**Pruebas RC3 ejecutadas:** 23 archivos `*.test.mjs`, los dos flujos de runtime, generación/verificación del bundle y prueba de empaquetado pasan. El smoke incluye WebGL simulado y verifica que, si falta, el juego muestra `rendererWarning`, deshabilita iniciar y no empieza una partida 2D. Esto no equivale a ejecutar WebGL real ni comprobar una GPU.

**Prueba bloqueada:** `tests/http-smoke.py` no pudo abrir un puerto local; Python devolvió `PermissionError: [Errno 1] Operation not permitted`. El runner se detuvo ahí. HTTP, Chromium E2E, shaders con navegador y conducción en iPhone/Safari quedan pendientes en RC3. La causa observada es la restricción del entorno de pruebas, no un fallo del juego.

**Impacto intencional:** los dispositivos y navegadores sin WebGL ya no podrán conducir; verán un aviso que pide activar la aceleración gráfica y ofrece reintentar. Los guardados previos siguen aceptándose y su campo obsoleto `renderer` se ignora.

**Estado de publicación:** los cambios de esta RC3 están en el árbol local del proyecto. La actualización del repositorio y de GitHub Pages debe confirmarse por separado antes de afirmar que la web pública ya la sirve.

---

## Registro histórico RC2

Fecha: 13 de octubre de 2026. Esta RC2 corrige observaciones recibidas tras la publicación. La suite HTTP/Chromium/GLES completa disponible corresponde a RC1 y se conserva como historial; no se ejecutó de nuevo sobre RC2. Sin cambios remotos.

## 1. Veredicto

**Release candidate; mejoras RC2 verificadas en lógica y DOM simulado.** Pasan 28 grupos dirigidos sobre el código RC2, incluidas las correcciones de entrada táctil, aviso de encuentros y el nuevo manejo de AudioContext. La pasada completa con HTTP, Chromium y GLES fue sobre RC1, no se repitió tras estas ediciones. Por tanto no declaro que esta RC2 esté recertificada en navegador ni que el audio suene en iPhone. No hay prueba física del teléfono.

**Verificado:** ejecutado directamente. **Observado:** inspeccionado en código. **Pendiente:** sin ejecución suficiente. Un PASS de lógica no sustituye una partida humana.

## 2. Resumen ejecutivo

- Cuatro perfiles de conducción, derrape recuperable, freno prioritario y controles simultáneos corregidos.
- Cuatro capítulos por carretera y variación de paisaje por distrito, especialmente Carmelo.
- Ocho encuentros con decisiones y dieciséis finales persistentes; importación de copias anteriores.
- Luz de atardecer progresiva, motor según marcha/carga, sonido de derrape y mezcla dinámica de radio.
- Caché de escenario y resolución adaptativa; medición de Chromium real con gráficos por software.
- Riesgos restantes: rendimiento en GPU física, sesiones largas, sensación de conducción y compatibilidad fuera de Chromium Linux.

## 3. Entorno de prueba

RC2: Linux, Node.js 24.19.0, módulos ESM, `@napi-rs/canvas` y DOM simulado; 23 archivos `.test.mjs`, dos flujos runtime, builder y empaquetado pasaron (28 comandos). RC1, como referencia anterior: Python 3.12.14, Mesa llvmpipe, Chromium 151.0.7922.34 headless/SwiftShader y HTTP local.

Las resoluciones 1280 × 720, 390 × 844 y 844 × 390 y las muestras Canvas/GLES pertenecen a RC1. El viewport móvil fue emulado; no es iPhone físico. No se dispuso de Windows, Linux Mint físico, Safari, Firefox, mando, GPU física ni escucha humana.

Registros RC2: `qa/REGISTRO_RC2.txt`. Registros históricos RC1: `qa/REGISTRO_RC1.txt`, `qa/browser-results.json`, `qa/runtime-smoke.json` y `qa/gles-results.json`. Playwright, Canvas y GLES son herramientas de desarrollo, no requisitos del juego.

## 4. Matriz de pruebas

Entorno **L**: Node/Linux. **C**: Canvas nativo/DOM simulado. **B**: Chromium headless (RC1). **G**: GLES por software (RC1). Nota: salvo filas identificadas RC2, las pruebas de navegador, HTTP y GLES son evidencia de RC1 y no se han repetido en RC2. `REGISTRO_RC2.txt` identifica los 28 comandos de regresión sobre el código entregado.

| ID / nombre | Entorno y pasos realizados | Resultado esperado | Resultado observado / estado | Evidencia |
|---|---|---|---|---|
| A01 · Sintaxis y bundle | L; runner y build --check | Módulos válidos y espejo reproducible | Superada; 13 módulos | REGISTRO_RC1 |
| A02 · Recursos y subruta | L/HTTP; rastrear HTML/imports y GET; B abrir /CHASE-404/ | HTTP 200, MIME válido, sin rutas rotas | Superada; 20 recursos HTTP y ninguna petición fallida en B | package-smoke, http-smoke, browser-results |
| A03 · Lanzador Linux | L/HTTP; arrancar, consultar y cerrar dos veces | Mismo origen y recursos | Superada; 127.0.0.1:8765 estable | http-smoke, REGISTRO_RC1 |
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
| D02 · Encuentros | C RC2; acercarse a 400 m, comprobar aviso y botón bloqueado; acercarse a la parada y elegir | Aviso anticipado, frenar y activar al llegar | Superada en DOM simulado; interacciones Browser de RC1 anteriores | REGISTRO_RC2, journey-runtime; browser-results es RC1 |
| D03 · Finales | L; combinar opciones, guardar/cargar/copiar; C/B finales | Final correspondiente, persiste al recargar | Superada para 16 en lógica; B prueba 4 promise y 4 sin encuentro | journey-driving, journey-runtime, browser-results |
| D04 · Actividades | L/C; limpio, fluidez, explorar, contactos y Crucero | Opcionales, reinicio correcto, sin bloqueo | Superada en simulación | activities, core-final, runtime-smoke |
| E01 · Menús/foto/copia | B; inicio, garaje, ayuda, diario, rutas, PNG/JSON, Esc/foco | Controles usados funcionan, descargas válidas | Superada en 17 flujos; no auditoría exhaustiva de todos los selectores | browser-results, browser-e2e |
| E02 · Accesibilidad | L; 8 diálogos, IDs, etiquetas, canvas; B foco | Semántica y retorno de foco correctos | Superada parcialmente; lector/contraste medido pendientes | accessibility, browser-e2e |
| E03 · Móvil emulado | B RC1 390×844/844×390; mantener gas, encuentro y garaje. RC2 simula Touch Events de gas y release | Controles visibles y liberación al retirar dedo | RC1 superada; la ruta alternativa táctil de RC2 superada en DOM simulado. iPhone pendiente | browser-results (RC1), REGISTRO_RC2 |
| F01 · Persistencia | L/C; datos inválidos, versiones, rollback, bloqueo; B recargar | Validación, conservación y aviso de fallo | Superada en casos automatizados | save, backup, core-final, journey-driving, runtime-smoke |
| G01 · Audio | B RC1; gesto AUDIO y analizador. RC2 requiere estado `running` y eleva mezcla; cambio no ejecutado en navegador | Audio activo y nivel medible | Señal probada en RC1; umbral RMS RC2 añadido al test, sin ejecución Browser; no escucha en iPhone | browser-results (RC1), REGISTRO_RC2 |
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

Los datos RAF/heap de la tabla son el ensayo corto RC1 con SwiftShader; no demuestran ausencia de fugas ni 60 FPS sostenidos. Auto usa otro instante, no es comparación A/B. No se midió CPU. No se recogió nuevo benchmark RC2.

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
| F08 | Alto · corregido en código, iPhone pendiente | Mantener GAS táctil en Safari; Pointer Capture puede variar o fallar. Ahora captura protegida, ruta Touch Events en paralelo a Pointer Events, con estado de pulsación separado y controles reposicionados | La simulación Touch Events pasa; el iPhone real debe confirmar que mantiene gas/freno/giro y los suelta |
| F09 | Alto · mejora aplicada, escucha pendiente | Al pasar rápido cerca de un evento, el aviso previo era breve y no daba distancia de frenada | Anuncio desde 450 m, botón indica distancia y permite una recuperación breve marcha atrás. DOM simulado pasa; partida real pendiente |
| F10 | Medio · mitigado, escucha pendiente | Audio podía figurar como ON si `resume()` no dejaba AudioContext en `running`; niveles de mezcla eran bajos | Comprueba estado, comunica bloqueo y eleva ganancia. DOM simulado pasa; nuevo RMS y escucha iPhone pendientes |
| F11 | Medio · aclarado | En Canvas cámara/faros 3D aparecían desactivados sin explicar por qué | Garaje nombra modo gráfico y fallback; test de selector WebGL actual en navegador pendiente |

F01–F05 se identificaron en código y sus regresiones se ejecutaron. F07 previene pérdida al mezclar versiones. RC2 añade los siguientes hallazgos reportados desde el iPhone:

Las colisiones usan límites laterales y tráfico, no choque contra cada malla de edificio. Esta versión de viajes no contiene persecuciones policiales ni campaña con game over; no se las presenta como probadas.

Licencia MIT presente. Geometría, síntesis sonora, relatos e interfaces están en el proyecto, sin dependencias artísticas remotas observadas. No se realizó investigación jurídica de autoría o marcas.

## 6. Regresiones frente a 1.0.0-rc.3

Se conservan 4 coches, 4 rutas, 3 desvíos, 16 recuerdos, 3 actividades, radio, foto, Canvas/WebGL y claves locales CHASE-404. Se repitieron controles, cámara, colisiones, persistencia, bundle y rutas. Guardados antiguos se normalizan sin finales; el historial nuevo incluye desenlaces.

La entrega previa no había logrado ejecutar Chromium ni HTTP en su entorno restringido. Esta auditoría sí ejecutó ambos. Los registros previos se sustituyen por evidencia de las fuentes actuales. El nombre visible no cambia el origen ni las claves del progreso.

## 7. Pendiente de comprobar

- En iPhone Safari, mantener cada control táctil y comprobar que la acción comienza y termina al levantar el dedo; también probar botones del HUD y orientación.
- Activar AUDIO y escuchar motor, emisoras y avisos; confirmar en iPhone si el modo silencio, el volumen o la política de autoplay lo bloquean.
- En el garaje, confirmar qué opción de Modo gráfico se muestra y si WebGL, cámara y faros están disponibles.
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

Entrada index.html, .nojekyll, JS, CSS y recursos relativos presentes. HTTP en subdirectorio y navegador bajo /CHASE-404/ se verificaron en RC1. Repetir el smoke del sitio tras subir RC2. Usar el contenido de la carpeta CHASE-404 como raíz del sitio; no necesita compilación ni secretos en producción. Bundle opcional, entrada principal ESM.

Configuración remota, permisos, caché y URL publicada **pendientes**. No se modificó ni publicó repositorio remoto. El servidor local puede servir los recursos extraídos sin Internet; no se promete PWA ni recarga offline de URL alojada.

## 10. Conclusión

**Release candidate con correcciones informadas por la prueba del usuario.** Sus 28 regresiones dirigidas pasan; no se volvió a ejecutar toda la suite Chromium/HTTP/GLES en RC2. Para cerrar el reporte, I. Roig debe verificar los controles y el audio en iPhone; después se puede repetir Chromium y subir los archivos al sitio. Sigue siendo RC, no publicación estable certificada.
