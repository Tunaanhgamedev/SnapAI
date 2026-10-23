@echo off
setlocal enabledelayedexpansion
title SnapAI - Launcher
color 0B

echo ========================================================
echo               SnapAI - One-Click Launcher
echo ========================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: 2. Check if Backend is already running
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Backend is already running on port 5000.
) else (
    echo [1/3] Starting Backend Server (Port 5000)...
    start "SnapAI Backend" /min cmd /c "cd /d "%ROOT_DIR%backend" && node server.js"
)

:: 3. Check if Frontend is already running
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Frontend is already running on port 5173.
) else (
    echo [2/3] Starting Frontend Server (Port 5173)...
    start "SnapAI Frontend" /min cmd /c "cd /d "%ROOT_DIR%frontend" && npm run dev"
)

:: 4. Wait for Frontend to be ready and open browser
echo [3/3] Launching web app in default browser...
timeout /t 3 /nobreak >nul

start http://localhost:5173

echo.
echo ========================================================
echo   SnapAI is now running!
echo   Web URL:    http://localhost:5173
echo   API Health: http://localhost:5000/api/health
echo.
echo   To stop all servers, run: stop.bat
echo ========================================================
echo.
timeout /t 5 >nul
exit
