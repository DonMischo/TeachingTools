@echo off
rem TT - Teaching Tools installer for Windows: runs install.ps1 without changing
rem the system's execution policy. Installs Docker Desktop if needed, writes a
rem random SECRET_KEY and database password to .env, then builds and starts TT.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
