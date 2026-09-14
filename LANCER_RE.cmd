@echo off
setlocal
cd /d "%~dp0"
echo Rail Empire - lancement HTTP local
echo Exportez votre sauvegarde depuis l'ancienne version avant le premier lancement.
echo L'adresse du jeu reste http://127.0.0.1:8765/ ; ne changez pas le port.
echo Fermez cette fenetre pour arreter le serveur local.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Start-RailEmpire.ps1"
if errorlevel 1 pause
endlocal
