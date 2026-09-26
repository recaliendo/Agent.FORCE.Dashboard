@echo off
setlocal
cd /d "C:\Users\Richa\OneDrive\Documents\Agent.FORCE.Dashboard"
set "PATH=C:\Users\Richa\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
if not exist "node_modules\.bin\electron.cmd" (
  echo Electron dependencies are missing. Run pnpm install in this project first.
  pause
  exit /b 1
)
call node_modules\.bin\tsc.cmd || goto :error
call node_modules\.bin\vite.cmd build || goto :error
call node_modules\.bin\tsc.cmd -p tsconfig.node.json || goto :error
call node_modules\.bin\electron.cmd .
exit /b %ERRORLEVEL%
:error
echo Failed to build Agent FORCE Dashboard.
pause
exit /b 1
