@echo off
echo ========================================
echo AI Essay Grading System - Launcher
echo ========================================
echo.
echo This will open two windows:
echo   1. API Server (port 3008)
echo   2. Worker (processes grading jobs)
echo.
echo Please keep BOTH windows open for the system to work.
echo.
pause

start "Homework AI - API Server" cmd /c "cd /d "%~dp0" && start-api.bat"
timeout /t 3 /nobreak > nul
start "Homework AI - Worker" cmd /c "cd /d "%~dp0" && start-worker.bat"

echo.
echo Both processes should now be starting in separate windows.
echo You can close this window.
echo.
pause
