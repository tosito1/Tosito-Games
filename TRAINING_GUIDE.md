# Guía de Entrenamiento Elite-Gen con PGNMentor

Has expandido la base de datos de tu IA con más de 480 datasets nuevos. Aquí tienes cómo sacarle el máximo partido.

## 1. Organización de los Datos
Las partidas se han organizado automáticamente en:
- `Partidas/pgnmentor/jugadores`: Partidas de Grandes Maestros (Carlsen, Kasparov, etc.)
- `Partidas/pgnmentor/aperturas`: Libros de aperturas específicos (Siciliana, Gambito de Dama, etc.)
- `Partidas/pgnmentor/torneos`: Historial de eventos mundiales y torneos clásicos.

## 2. Cómo Iniciar el Entrenamiento
Para entrenar a la IA con TODO este conocimiento acumulado:
1. Ejecuta `JUGAR.bat`.
2. Elige la **Opción 13: ENTRENAMIENTO ULTRA-LIMIT (Hybrid PRO)**.
3. El script detectará automáticamente todas las carpetas y subcarpetas (gracias al sistema recursivo de `PGNManager`) y empezará a procesar juego por juego.

## 3. Monitoreo de Aprendizaje
Mientras la IA entrena, puedes abrir otra ventana de comandos y:
1. Ejecutar `JUGAR.bat`.
2. Elegir la **Opción 14: VER GRÁFICAS DE ENTRENAMIENTO**.
3. Verás la evolución del *Accuracy* (qué tan bien predice los movimientos de los maestros) y el *Loss* (cuánto error está cometiendo).

## 4. Preguntas Frecuentes
- **¿Puedo entrenar solo con una categoría?**
  Si quieres entrenar solo con aperturas, por ejemplo, puedes mover temporalmente las otras carpetas fuera de `Partidas` o modificar el `pgn_dir` en `distill_trainer_ultra.py` a `Partidas/pgnmentor/aperturas`.
- **¿El entrenamiento es infinito?**
  Sí, el script entrará en "Infinity Mode", volviendo a empezar desde el primer archivo una vez termine los 481, refinando su conocimiento en cada ciclo.

¡Disfruta viendo a tu IA convertirse en un Gran Maestro!
