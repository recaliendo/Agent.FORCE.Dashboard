@echo off
setlocal
rem Agent FORCE Dashboard desktop launcher.
rem Rebuilds from this folder's source, then opens Electron, so a stale build never opens a blank window.
cd /d "%~dp0"

set "PNPM=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
    set PNPM="%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"
  ) else (
    set "PNPM=corepack pnpm"
  )
)

if not exist "src\OfwPanel.tsx" goto stale
if not exist "src\components\OneontaRankingsPanel.tsx" goto stale

if not exist "node_modules" (
  echo Installing dependencies...
  call %PNPM% install --frozen-lockfile || goto failed
)

echo Building Agent FORCE Dashboard...
call %PNPM% run build || goto failed
call "node_modules\.bin\electron.cmd" .
exit /b %errorlevel%

:stale
echo.
echo This folder is an out-of-date copy of Agent FORCE Dashboard: source files are missing.
echo   Folder: %CD%
echo Repair it with scripts\repair-install.ps1 from a fresh clone (see README "Repair a broken install").
echo.
pause
exit /b 1

:failed
echo.
echo Failed to build Agent FORCE Dashboard.
echo If the error names a missing file, this copy is out of date: see README "Repair a broken install".
echo.
pause
exit /b 1
