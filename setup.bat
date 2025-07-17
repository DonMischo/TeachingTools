@echo off
setlocal

REM ------------------------------------------------------------
REM  In das Verzeichnis wechseln, in dem das Skript liegt
REM ------------------------------------------------------------
pushd "%~dp0"

set "VENV_DIR=.venv"

REM ------------------------------------------------------------
REM  Optionales Neuaufsetzen (setup.bat --rebuild)
REM ------------------------------------------------------------
if /I "%1"=="--rebuild" (
    echo [INFO] Entferne bestehendes virtuelles Environment "%VENV_DIR%" ...
    if exist "%VENV_DIR%" rmdir /s /q "%VENV_DIR%"
)

REM ------------------------------------------------------------
REM  Virtuelle Umgebung anlegen (falls nicht vorhanden)
REM  Versuche zuerst 'py -3', sonst 'python'
REM ------------------------------------------------------------
if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo [INFO] Erstelle virtuelles Environment ...
    where py >nul 2>nul && (py -3 -m venv "%VENV_DIR%") || (python -m venv "%VENV_DIR%")
    if errorlevel 1 (
        echo [ERROR] Konnte virtuelles Environment nicht erstellen.
        popd & endlocal & exit /b 1
    )
)

REM ------------------------------------------------------------
REM  Aktivieren
REM ------------------------------------------------------------
call "%VENV_DIR%\Scripts\activate.bat" || (
    echo [ERROR] Aktivierung der virtuellen Umgebung fehlgeschlagen.
    popd & endlocal & exit /b 1
)

REM ------------------------------------------------------------
REM  Pakete installieren
REM ------------------------------------------------------------
echo [INFO] Aktualisiere pip ...
python -m pip install --upgrade pip

echo [INFO] Installiere Requirements ...
pip install -r requirements.txt || goto :pip_error

REM ------------------------------------------------------------
REM  Datenverzeichnis & Beispiel-CSV
REM ------------------------------------------------------------
if not exist data mkdir data
if not exist data\teachers.csv (
    echo [INFO] Erstelle Beispiel-Datei data\teachers.csv ...
    >data\teachers.csv echo first_name,last_name,active
    >>data\teachers.csv echo Minerva,McGonagall,1
    >>data\teachers.csv echo Severus,Snape,1
    >>data\teachers.csv echo Remus,Lupin,1
    >>data\teachers.csv echo Gilderoy,Lockhart,0
    >>data\teachers.csv echo Pomona,Sprout,1
    >>data\teachers.csv echo Filius,Flitwick,1
)

REM ------------------------------------------------------------
REM  Streamlit-App starten
REM ------------------------------------------------------------
echo [INFO] Starte Streamlit-App ...
streamlit run app.py
REM streamlit run app.py --logger.level=debug

:done
popd
endlocal
exit /b 0

:pip_error
echo [ERROR] Installation der Python-Abhaengigkeiten fehlgeschlagen.
goto :done
