@echo off
rem Startet workshop.ps1, ohne die Ausfuehrungsrichtlinie des Systems zu aendern.
rem Aufruf: workshop.bat start [-Anzahl 30] / stop / reset
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0workshop.ps1" %*
