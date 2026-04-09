@echo off
setlocal
title AlphaZero Chess - CONTROL CENTER

:menu
cls
echo ========================================
echo   ALPHAZERO CHESS - CONTROL CENTER
echo ========================================
echo.
echo [1] Jugar Ajedrez (Interfaz Local)
echo [2] Desplegar API (Solo Web/App)
echo [3] ENTRENAR IA (Submenu)
echo [4] Salir
echo.
set /p op_main="Elige una opcion (1-4): "

if "%op_main%"=="1" ( set SCRIPT=main.py & goto run )
if "%op_main%"=="2" ( set SCRIPT=web_app.py & goto run )
if "%op_main%"=="3" goto train_menu
if "%op_main%"=="4" goto exit
goto menu

:train_menu
cls
echo ========================================
echo   ENTRENAR IA - SELECCION DE MODELO
echo ========================================
echo.
echo [1] MASTER-GEN (40x256 - Estable)
echo [2] MEGA-GEN   (60x320 - Test Ultra)
echo [3] DUELO: Master-Gen vs Mega-Gen (Visual)
echo [4] Volver al menu principal
echo.
set /p op_train="Elige una opcion (1-4): "

if "%op_train%"=="1" goto master_menu
if "%op_train%"=="2" goto mega_menu
if "%op_train%"=="3" ( set SCRIPT=benchmark_visual.py & goto run )
if "%op_train%"=="4" goto menu
goto train_menu

:master_menu
cls
echo ========================================
echo   ENTRENAMIENTO - MASTER-GEN (40x256)
echo ========================================
echo.
echo -- REFUERZO --
echo [1]  RL ALPHA-ZERO (Headless)
echo [2]  RL VISUAL DASHBOARD
echo -- IMITACION (PGN) --
echo [3]  PGN Distillation (TODO - ultra)
echo [4]  PGN Mentor (Especializado)
echo [5]  GM Clasicos (Historico)
echo [6]  Jugadores / Aperturas (PGNM)
echo -- SIMULACION vs OTROS --
echo [7]  vs Maestro (Level 7)
echo [8]  vs Dios (Lichess L8)
echo -- MISC --
echo [9]  Ver Graficas (Master-Gen)
echo [10] Volver
echo.
set /p op_master="Elige una opcion (1-10): "

if "%op_master%"=="1"  set SCRIPT=train_rl.py
if "%op_master%"=="2"  set SCRIPT=visual_train_rl.py
if "%op_master%"=="3"  set SCRIPT=distill_trainer_ultra.py --dir Partidas
if "%op_master%"=="4"  set SCRIPT=distill_trainer_ultra.py --dir Partidas/pgnmentor
if "%op_master%"=="5"  set SCRIPT=distill_trainer_ultra.py --dir Partidas/clasicos
if "%op_master%"=="6"  set SCRIPT=distill_trainer_ultra.py --dir Partidas/pgnmentor/jugadores
if "%op_master%"=="7"  set SCRIPT=train_ai.py --level level_7
if "%op_master%"=="8"  set SCRIPT=train_ai.py --level level_8
if "%op_master%"=="9"  set SCRIPT=plot_metrics.py
if "%op_master%"=="10" goto train_menu
if defined SCRIPT goto run
goto master_menu

:mega_menu
cls
echo ========================================
echo   ENTRENAMIENTO - MEGA-GEN (60x320)
echo ========================================
echo.
echo [1] ENTRENAR MEGA-GEN (Symmetry OPT)
echo [2] VER GRAFICAS EN VIVO (Live Plot)
echo [3] Volver
echo.
set /p op_mega="Elige una opcion (1-3): "

if "%op_mega%"=="1" set SCRIPT=distill_trainer_mega.py
if "%op_mega%"=="2" set SCRIPT=plot_live.py
if "%op_mega%"=="3" goto train_menu
if defined SCRIPT goto run
goto mega_menu

:run
echo [INFO] Iniciando %SCRIPT%...
if "%SCRIPT%"=="plot_metrics.py" (
    C:\Python313\python.exe plot_metrics.py
) else (
    call venv_ajedrez\Scripts\activate.bat
    python %SCRIPT%
)
pause
set SCRIPT=
goto menu

:exit
exit /b
