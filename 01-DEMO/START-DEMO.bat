@echo off
title GEOTECH HR Portal - Demo
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on this machine.
  echo.
  echo   Either install Node.js from https://nodejs.org
  echo   or just open index.html in your browser instead.
  echo.
  pause
  exit /b 1
)

node serve.mjs
pause
