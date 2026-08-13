[CmdletBinding()]
param([switch]$WaitForReady)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Missing .env. Run npm run qwen:setup first.' }

foreach ($rawLine in Get-Content -LiteralPath $envFile) {
  $line = $rawLine.Trim()
  if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) { continue }
  $name, $value = $line -split '=', 2
  Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim().Trim('"').Trim("'")
}

if (-not (Test-Path -LiteralPath $env:LLAMA_SERVER_PATH)) { throw "Missing llama-server.exe at $env:LLAMA_SERVER_PATH" }
if (-not (Test-Path -LiteralPath $env:LLAMA_MODEL_PATH)) { throw "Missing Qwen model at $env:LLAMA_MODEL_PATH" }

$endpoint = [uri]$env:LLM_BASE_URL
$args = @(
  '--model', $env:LLAMA_MODEL_PATH,
  '--host', '127.0.0.1',
  '--port', $endpoint.Port,
  '--alias', $env:LLM_MODEL_NAME,
  '--ctx-size', $env:LLAMA_CONTEXT_SIZE,
  '--n-gpu-layers', $env:LLAMA_GPU_LAYERS,
  '--parallel', '1',
  '--flash-attn', 'on',
  '--cache-type-k', 'q8_0',
  '--cache-type-v', 'q8_0',
  '--jinja',
  '--api-key-file', $env:LLAMA_API_KEY_FILE
)

if ($WaitForReady) {
  & $env:LLAMA_SERVER_PATH @args
  exit $LASTEXITCODE
}

$logDir = Join-Path $env:LLAMA_RUNTIME_ROOT 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir 'llama-server.stdout.log'
$stderr = Join-Path $logDir 'llama-server.stderr.log'
$process = Start-Process -FilePath $env:LLAMA_SERVER_PATH -ArgumentList $args -WorkingDirectory (Split-Path -Parent $env:LLAMA_SERVER_PATH) -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
Write-Host "Started llama-server (PID $($process.Id)) at $env:LLM_BASE_URL"
Write-Host "Logs: $logDir"
