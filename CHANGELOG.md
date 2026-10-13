# Cambios de CHASE-404: DRIVE THE SUNSET

## 1.1.0-rc.4 — 13 octubre 2026

- Un encuentro narrativo nuevo en cada carretera (12 en total), con decisiones persistentes y recuperación mediante guardado. Los finales conservan sus 16 variantes y usan la última escena disponible.
- Cámara trasera y cinematográfica con encuadre progresivo al ganar velocidad; capó conserva el encuadre original.
- Atmósfera y relleno de luz sutilmente diferenciados por costa, sierra, viñedos y Carmelo.
- Señales musicales breves para encuentros, elecciones y desvíos, solo con Audio activado.
- Pruebas nuevas para encuentro/guardado y framing/iluminación. Requiere repetir la verificación del navegador tras estos cambios.

## 1.1.0-rc.3 — 13 octubre 2026

- Retirado el renderizador de carretera Canvas 2D y su selector; la conducción utiliza WebGL exclusivamente.
- Si WebGL no inicia o pierde el contexto, se detiene el viaje, aparece un aviso accesible y se ofrece reintentar. No se presenta la vista 2D como si el juego siguiera operativo.
- Guardados anteriores con una preferencia `renderer` siguen siendo legibles; esa opción obsoleta se ignora. El minimapa y la captura PNG conservan Canvas 2D como utilidades.
- Regresión de fallo WebGL añadida; la validación con Chromium/GPU y móviles queda pendiente en esta candidata.

## 1.1.0-rc.2 — 13 octubre 2026

- Controles de conducción táctiles con compatibilidad Touch Events en paralelo a Pointer Events, con estado de pulsación separado y captura de puntero protegida ante errores. Instrucción móvil visible desde inicio; controles algo más abajo para reducir solape con el coche.
- Los encuentros se anuncian con antelación, indican distancia y dan margen breve para recuperar una parada pasada; el botón queda deshabilitado hasta estar cerca y casi detenido.
- El garaje nombra el modo gráfico y explica si WebGL no se pudo iniciar, por qué se desactivan cámara y faros 3D.
- Audio con más nivel, verificación de AudioContext en estado `running` y aviso claro si iOS/navegador no lo desbloquea.
- Añadidas regresiones de Touch Events, señalización previa de encuentros y umbral RMS de audio. Pendientes de confirmar en iPhone físico: respuesta táctil y sonido audible.

## 1.1.0-rc.1 — 13 octubre 2026

- Conducción diferenciada: peso de dirección, derrape recuperable y agarre por coche; pedal de freno prioritario, stick/gatillos analógicos y control táctil de derrape.
- Correcciones: W/↑ y A/← simultáneos, contacto de borde conservado en la fase de tráfico, extensión del asfalto detrás de la cámara inicial, pausa de animación y rótulo residual del título anterior.
- Ocho encuentros opcionales con dos decisiones y dieciséis desenlaces guardados en el diario. Las copias formato 2 conservan decisiones y finales; se importan copias antiguas.
- Capítulos de carretera y variaciones por zona en WebGL; ladera de Carmelo abierta, casco de Alba, bosque/lago y costa poblada. Luz gradual opcional, motor por carga y marcha, ruido de derrape.
- Caché de geometría estática por tramos de 24 m y resolución adaptativa en Automático.
- Chromium nativo headless/SwiftShader disponible en esta intervención; regresión extendida de encuentros, audio, contexto gráfico, descargas, guardado y móvil emulado. Corregido el test que buscaba la copia JSON en el garaje.

## 1.0.0-rc.3 — 13 octubre 2026

- Título público cambiado a **Drive the Sunset** en la portada, pantalla inicial, HTML y documentación.
- Se conserva `CHASE-404` como identificador técnico, subruta de GitHub Pages y espacio de guardado; las partidas existentes siguen siendo compatibles.
- Comprobados entrada ESM/Canvas, enlaces, bundle y sintaxis SVG tras el cambio.

## 1.0.0-rc.2 — 12 octubre 2026

- Unificado el host del lanzador PowerShell con el de Python (`127.0.0.1`) para que el fallback de Windows conserve el mismo origen de `localStorage` cuando el puerto coincida. Añadida regresión estática del contrato; Windows real sigue pendiente.
- Diversificados color, altura, retranqueo, remates y arbolado de Carmelo en WebGL. Verificados contratos del renderizador y 24 escenas GLES por software.
- Regenerados el bundle opcional, capturas de evidencia y hashes de fuentes. Corregidas las referencias del manifiesto QA.
- Esta entrega sigue siendo RC: faltan navegador nativo, Windows físico, móvil, mando, audio escuchado y mediciones de rendimiento.

## 1.0.0-rc.1 — 12 de octubre de 2026

Primera entrega con el alcance completo de cuatro carreteras y cuatro coches. Es una candidata a release: las pruebas de navegador y dispositivos físicos quedan identificadas en QA_REPORT.md.

### Añadido

- Cuatro recorridos de 8 / 7,5 / 9 / 6 km, tres conexiones y 16 paradas originales.
- Meridian S 1992; Solstice convertido en descapotable real, seis pinturas y dos acabados de llantas.
- Tres actividades Arcade opcionales: viaje limpio, ruta fluida y exploración. Crucero conserva su libertad.
- Radio original con tres composiciones sintetizadas, motores diferenciados y mezclador independiente.
- Atardecer, amanecer, noche y lluvia; tres cámaras y faros en WebGL.
- Foto PNG sin HUD, diario ampliado, copia JSON, importación validada y descarga de la copia previa.
- Contraste, texto grande, movimiento reducido, entrada táctil y Gamepad API; pruebas físicas pendientes.
- Portada original para el portal de apps en `assets/portal-cover.svg`.
- Verificación de la entrada ESM con Canvas nativo y DOM simulado, replay gráfico Mesa GLES y pruebas de sintaxis/bundle.

### Cambiado

- Un mismo estado, física, tráfico, rutas y guardados alimenta Canvas y WebGL. No hay dos partidas diferentes según el renderizador.
- Entrada principal única `index.html` mediante módulos nativos. INICIO/start/prototype conservan enlaces compatibles hacia ella.
- Canvas tiene paisaje, fachadas, coches y carretera continuos; WebGL incorpora edificios agrupados, balcones, comercios, escaleras y hitos.
- Guardado v2 con lectura compatible de las claves v1. Los datos anteriores se validan antes de usarlos.
- El atlas integra la curva real de carretera y muestra el desvío y las paradas.
- El servidor Python intenta un puerto local estable para conservar el origen del guardado entre arranques.

### Corregido

- Error de sintaxis que bloqueaba WebGL y colisión de auxiliares `poly` en el bundle Canvas.
- Runner que intentaba ejecutar una prueba Python con Node; ahora distingue intérpretes y comprueba la entrada utilizada.
- Traslación lateral del coche estando parado y pérdida de tiempo a baja cadencia. La simulación usa pasos fijos.
- Inversión visual izquierda/derecha en la proyección WebGL, comprobada con píxeles.
- Teclas retenidas y foco incorrecto después de menús, pausa o cambio de ventana. Canvas permanece enfocable bajo WebGL.
- Recuperación de vehículo y modo contradictoria con el garaje y el HUD.
- Mensajes de postal guardada pese a un fallo del almacenamiento.
- Desvío al Carmelo que podía empezar después del final de la ruta; ahora empieza el destino en km 0 y mezcla su geometría.
- Importación que podía sobrescribir el viaje recién restaurado al volver al menú.
- Actividades que progresaban en Crucero pese a indicar que estaban en espera.
- Señales 3D con destinos equivocados, costuras entre bandas Canvas y métricas que ocultaban fotogramas largos.
- Evaluación anticipada de `%errorlevel%` en los bloques del BAT, que podía ocultar fallos de Python.

### Retirado del paquete

- Comparador experimental y documentación antigua que describían versiones divergentes.
- Pruebas basadas únicamente en buscar cadenas de la demo retirada o en contextos gráficos ficticios. Se conservan el original y el historial en el ZIP de entrada, sin modificarlo.

No se ha publicado esta entrega ni se ha modificado el repositorio remoto.
