@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale Node.js antes de ativar a inicializacao automatica.
 pause
 exit /b 1
)
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "INICIAR-OCULTO-WINDOWS.vbs" "%STARTUP%\NetPulse.vbs" >nul
REM Atalho VBS precisa usar o caminho absoluto do projeto.
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%STARTUP%\NetPulse.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments='""%~dp0INICIAR-OCULTO-WINDOWS.vbs""'; $s.WorkingDirectory='%~dp0'; $s.Save()"
del /q "%STARTUP%\NetPulse.vbs" >nul 2>nul
echo Inicializacao configurada no Startup do usuario. Remova NetPulse.lnk dessa pasta para desativar.
pause
