@echo off
setlocal EnableExtensions
title Fix Agent FORCE Dashboard
rem Double-click repair for a stale local copy of Agent FORCE Dashboard.
rem Older desktop launchers always cd into the OneDrive folder below and build it, so this
rem replaces that folder with a fresh clone of main (the old one is kept as a dated backup)
rem and carries over the local settings files. Existing shortcuts keep working unchanged.

set "APP=%USERPROFILE%\OneDrive\Documents\Agent.FORCE.Dashboard"
if not exist "%APP%\package.json" if exist "%USERPROFILE%\Documents\Agent.FORCE.Dashboard\package.json" set "APP=%USERPROFILE%\Documents\Agent.FORCE.Dashboard"
set "REPO=https://github.com/recaliendo/Agent.FORCE.Dashboard"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%i"
set "NEWDIR=%APP%.new-%STAMP%"
set "BACKUP=%APP%.old-%STAMP%"

echo.
echo  Agent FORCE repair
echo  Folder: %APP%
echo.
echo  Close every Agent FORCE window, including black build windows, then press a key.
pause >nul

where git >nul 2>nul
if errorlevel 1 goto nogit

set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"
set "PNPM=pnpm"
where pnpm >nul 2>nul
if not errorlevel 1 goto havepnpm
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" (
  set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  set PNPM="%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"
  goto havepnpm
)
where corepack >nul 2>nul
if not errorlevel 1 (
  set "PNPM=corepack pnpm"
  goto havepnpm
)
where npx >nul 2>nul
if errorlevel 1 goto nonode
set "PNPM=npx --yes pnpm@10"
:havepnpm

echo [1/5] Downloading the latest Agent FORCE from GitHub...
echo       If a GitHub sign-in window opens, sign in as recaliendo.
git clone "%REPO%" "%NEWDIR%"
if errorlevel 1 goto clonefailed
if not exist "%NEWDIR%\src\OfwPanel.tsx" goto clonefailed

echo [2/5] Swapping in the new copy; the old one is kept as a backup...
if exist "%APP%" (
  move "%APP%" "%BACKUP%" >nul
  if errorlevel 1 goto locked
)
move "%NEWDIR%" "%APP%" >nul
if errorlevel 1 goto swapfailed

echo [3/5] Carrying over local settings...
for %%f in (.env ofw.local.json) do (
  if exist "%BACKUP%\%%f" (
    copy /y "%BACKUP%\%%f" "%APP%\%%f" >nul
    echo       copied %%f
  )
)

cd /d "%APP%"
echo [4/5] Installing packages - this can take a few minutes...
call %PNPM% install --frozen-lockfile
if errorlevel 1 goto buildfailed

echo [5/5] Building...
call %PNPM% run build
if errorlevel 1 goto buildfailed

echo.
echo  FIXED. Agent FORCE is up to date. Opening it now; your desktop shortcut works too.
if exist "%BACKUP%" echo  Old copy kept at: %BACKUP%  - delete it once you are happy.
start "" "%APP%\launch-agent-force-dashboard.cmd"
goto end

:nogit
echo [X] Git is not installed. Install it from https://git-scm.com, then double-click this file again.
goto end
:nonode
echo [X] Node.js is not installed. Install the LTS version from https://nodejs.org, then double-click this file again.
goto end
:clonefailed
echo [X] Could not download from GitHub. Check your internet connection and GitHub sign-in, then try again.
echo     Nothing was changed.
if exist "%NEWDIR%" rmdir /s /q "%NEWDIR%"
goto end
:locked
echo [X] The old folder is in use. Close all Agent FORCE windows and File Explorer windows showing it,
echo     or restart the PC, then double-click this file again. Nothing was changed.
if exist "%NEWDIR%" rmdir /s /q "%NEWDIR%"
goto end
:swapfailed
echo [X] Could not move the new copy into place. Restoring the old folder.
if exist "%BACKUP%" move "%BACKUP%" "%APP%" >nul
goto end
:buildfailed
echo.
echo [X] The new copy is in place but did not build. Copy everything in this window and paste it to Claude.
goto end

:end
echo.
echo Press any key to close.
pause >nul
