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

if (-not $env:LLAMA_RUNTIME_ROOT) { $env:LLAMA_RUNTIME_ROOT = Join-Path $env:LOCALAPPDATA 'AgentFORCE' }
if (-not $env:LLAMA_SERVER_PATH) { $env:LLAMA_SERVER_PATH = Join-Path $env:LLAMA_RUNTIME_ROOT 'llama.cpp\llama-server.exe' }
if (-not $env:LLAMA_MODEL_PATH) { $env:LLAMA_MODEL_PATH = Join-Path $env:LLAMA_RUNTIME_ROOT 'models\Qwen3.6-35B-A3B-UD-Q4_K_M.gguf' }
if (-not $env:LLAMA_API_KEY_FILE) { $env:LLAMA_API_KEY_FILE = Join-Path $env:LLAMA_RUNTIME_ROOT 'secrets\api-key.txt' }
if (-not $env:LLM_BASE_URL) { $env:LLM_BASE_URL = 'http://127.0.0.1:8080/v1' }
if (-not $env:LLM_MODEL_NAME) { $env:LLM_MODEL_NAME = 'Qwen/Qwen3.6-35B-A3B' }
$contextSize = if ($env:LLAMA_CONTEXT_SIZE) { $env:LLAMA_CONTEXT_SIZE } else { '8192' }

if (-not (Test-Path -LiteralPath $env:LLAMA_SERVER_PATH)) { throw "Missing llama-server.exe at $env:LLAMA_SERVER_PATH" }
if (-not (Test-Path -LiteralPath $env:LLAMA_MODEL_PATH)) { throw "Missing Qwen model at $env:LLAMA_MODEL_PATH" }

$endpoint = [uri]$env:LLM_BASE_URL
$gpuLayers = if ($env:LLAMA_GPU_LAYERS) { $env:LLAMA_GPU_LAYERS } else { 'all' }
$cpuMoeLayers = if ($env:LLAMA_CPU_MOE_LAYERS) { $env:LLAMA_CPU_MOE_LAYERS } else { '32' }
$loadMode = if ($env:LLAMA_LOAD_MODE) { $env:LLAMA_LOAD_MODE } else { 'none' }
$serverArgs = @(
  '--model', $env:LLAMA_MODEL_PATH,
  '--host', '127.0.0.1',
  '--port', $endpoint.Port,
  '--alias', $env:LLM_MODEL_NAME,
  '--ctx-size', $contextSize,
  '--n-gpu-layers', $gpuLayers,
  '--n-cpu-moe', $cpuMoeLayers,
  '--parallel', '1',
  '--flash-attn', 'on',
  '--cache-type-k', 'q8_0',
  '--cache-type-v', 'q8_0',
  '--load-mode', $loadMode,
  '--jinja'
)
if (Test-Path -LiteralPath $env:LLAMA_API_KEY_FILE) { $serverArgs += @('--api-key-file', $env:LLAMA_API_KEY_FILE) }

if ($env:LLAMA_SPEC_TYPE -and $env:LLAMA_SPEC_TYPE -ne 'none') {
  $draftMax = if ($env:LLAMA_SPEC_DRAFT_N_MAX) { $env:LLAMA_SPEC_DRAFT_N_MAX } else { '2' }
  $serverArgs += @('--spec-type', $env:LLAMA_SPEC_TYPE, '--spec-draft-n-max', $draftMax)
}

if ($WaitForReady) {
  & $env:LLAMA_SERVER_PATH @serverArgs
  exit $LASTEXITCODE
}

$logDir = Join-Path $env:LLAMA_RUNTIME_ROOT 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir 'llama-server.stdout.log'
$stderr = Join-Path $logDir 'llama-server.stderr.log'
# Start-Process joins -ArgumentList with spaces and does not quote, so any path
# containing a space (e.g. a Windows user name) would be split. Quote them.
$quotedArgs = $serverArgs | ForEach-Object { $s = [string]$_; if ($s -match '\s') { '"' + $s + '"' } else { $s } }
$process = Start-Process -FilePath $env:LLAMA_SERVER_PATH -ArgumentList $quotedArgs -WorkingDirectory (Split-Path -Parent $env:LLAMA_SERVER_PATH) -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
Write-Host "Started llama-server (PID $($process.Id)) at $env:LLM_BASE_URL"
Write-Host "Logs: $logDir"
