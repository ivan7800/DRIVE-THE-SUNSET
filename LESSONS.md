# Lecciones comprobadas de CHASE-404

- **Un test de fuente no demuestra el arranque.** El ZIP original superaba sus pruebas aunque WebGL tenía un error de sintaxis y Canvas fallaba al dibujar el coche. Ahora se analiza la sintaxis en modo explícito y se ejecuta la entrada real con Canvas nativo.
- **ESM conserva ámbitos; una concatenación ingenua los destruye.** Dos auxiliares `poly` se sobrescribían al retirar imports. La entrada es modular y el builder opcional encierra cada módulo en su ámbito.
- **El eje visual depende de la cámara.** El desplazamiento positivo del estado aparecía a la izquierda en WebGL por la base de `lookAt`. Se corrigió la proyección y se compararon píxeles laterales.
- **Un desvío no puede heredar una coordenada que exceda el destino.** Viñedos conectaba a Carmelo después de su final. La conexión reinicia las coordenadas del destino y conserva las métricas del viaje, con mezcla geométrica.
- **Al restaurar un archivo, no guardar el estado anterior sobre el recién importado.** Se separa el retorno al menú del guardado en curso; hay validación, copia previa y rollback.
- **`localStorage` incluye el puerto en su origen.** El lanzador aleatorio impedía encontrar la partida en el siguiente arranque. Se prefiere un puerto estable y se ofrece respaldo exportable.
- **Un canvas oculto mediante `visibility:hidden` no recupera el foco.** Bajo WebGL se mantiene visible para accesibilidad y enfocable, con opacidad cero; el lienzo 3D lo cubre.
- **En BAT, `%errorlevel%` dentro de un bloque se expande antes de ejecutar sus comandos.** Usar `if not errorlevel 1` permite observar el resultado real y conservar el fallback.
- **Los hombros dibujados sobre cada banda de asfalto crean costuras.** Canvas ahora dibuja superficies continuas y después marcas viales.
- **Mesa GLES por software valida shaders y píxeles, no navegador ni GPU física.** La documentación conserva esa diferencia.
