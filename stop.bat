@echo off
title SnapAI - Stop Servers
color 0C

echo ========================================================
echo               SnapAI - Stopping Servers
echo ========================================================
echo.

echo Stopping processes on port 5000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo Killing process PID %%a...
    taskkill /f /pid %%a >nul 2>nul
)

echo Stopping processes on port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Killing process PID %%a...
    taskkill /f /pid %%a >nul 2>nul
)

echo.
echo [DONE] All SnapAI servers have been stopped successfully.
echo.
timeout /t 3 >nul
exit
