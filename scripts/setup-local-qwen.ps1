[CmdletBinding()]
param(
  [string]$RuntimeRoot = (Join-Path $env:LOCALAPPDATA 'AgentFORCE'),
  [string]$ModelFile = 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf',
  [switch]$SkipModelDownload,
  [switch]$RotateApiKey
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $RuntimeRoot 'llama.cpp'
$modelDir = Join-Path $RuntimeRoot 'models'
$downloadDir = Join-Path $RuntimeRoot 'downloads'
$secretDir = Join-Path $RuntimeRoot 'secrets'
$envFile = Join-Path $repoRoot '.env'
$apiKeyFile = Join-Path $secretDir 'api-key.txt'

function Invoke-Download([string]$Uri, [string]$Destination, [long]$ExpectedSize = 0) {
  if (Test-Path -LiteralPath $Destination) {
    $existingSize = (Get-Item -LiteralPath $Destination).Length
    if ($ExpectedSize -gt 0 -and $existingSize -eq $ExpectedSize) {
      Write-Host "Using complete download: $Destination"
      return
    }
    if ($ExpectedSize -gt 0 -and $existingSize -gt $ExpectedSize) {
      $invalidPath = "$Destination.invalid-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
      Move-Item -LiteralPath $Destination -Destination $invalidPath
      Write-Warning "Moved an oversized download to $invalidPath"
    } else {
      Write-Host "Resuming partial download: $Destination"
    }
  }
  Write-Host "Downloading $Uri"
  & curl.exe --fail --location --retry 5 --retry-delay 3 --continue-at - --output $Destination $Uri
  if ($LASTEXITCODE -ne 0) { throw "Download failed with curl exit code $LASTEXITCODE." }
  if ($ExpectedSize -gt 0 -and (Get-Item -LiteralPath $Destination).Length -ne $ExpectedSize) {
    throw "Downloaded file size does not match the expected $ExpectedSize bytes: $Destination"
  }
}

function New-LocalApiKey {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Read-DotEnvValue([string]$Name) {
  if (-not (Test-Path -LiteralPath $envFile)) { return $null }
  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -Last 1
  if (-not $line) { return $null }
  return ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

function Set-DotEnvValue([string]$Name, [string]$Value) {
  $lines = if (Test-Path -LiteralPath $envFile) { @(Get-Content -LiteralPath $envFile) } else { @() }
  $updated = $false
  $next = @(foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Name))=") {
      "$Name=$Value"
      $updated = $true
    } else {
      $line
    }
  })
  if (-not $updated) { $next += "$Name=$Value" }
  Set-Content -LiteralPath $envFile -Value $next -Encoding ASCII
}

New-Item -ItemType Directory -Force -Path $runtimeDir, $modelDir, $downloadDir, $secretDir | Out-Null

$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest' -Headers @{ 'User-Agent' = 'Agent-FORCE-setup' }
$assetNames = @(
  "llama-$($release.tag_name)-bin-win-cuda-12.4-x64.zip",
  'cudart-llama-bin-win-cuda-12.4-x64.zip'
)
$serverPath = Join-Path $runtimeDir 'llama-server.exe'
$installedVersion = ''
if (Test-Path -LiteralPath $serverPath) {
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $installedVersion = (& $serverPath --version 2>&1 | Out-String)
  $ErrorActionPreference = $previousErrorPreference
}
$requiredRuntimeFiles = @(
  $serverPath,
  (Join-Path $runtimeDir 'ggml-cuda.dll'),
  (Join-Path $runtimeDir 'cublas64_12.dll'),
  (Join-Path $runtimeDir 'cublasLt64_12.dll'),
  (Join-Path $runtimeDir 'cudart64_12.dll')
)
$runtimeCurrent = ($installedVersion -match ([regex]::Escape($release.tag_name.TrimStart('b')))) -and
  -not ($requiredRuntimeFiles | Where-Object { -not (Test-Path -LiteralPath $_) })

foreach ($assetName in $assetNames) {
  $asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1
  if (-not $asset) { throw "llama.cpp release $($release.tag_name) does not contain $assetName." }
  $zipPath = Join-Path $downloadDir $assetName
  Invoke-Download $asset.browser_download_url $zipPath $asset.size
  if ($asset.digest -match '^sha256:(.+)$') {
    $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $Matches[1].ToLowerInvariant()) { throw "Checksum mismatch for $assetName." }
  }
  if (-not $runtimeCurrent) {
    Expand-Archive -LiteralPath $zipPath -DestinationPath $runtimeDir -Force
  }
}
if ($runtimeCurrent) { Write-Host "llama.cpp $($release.tag_name) is already installed." }

$modelPath = Join-Path $modelDir $ModelFile
if (-not $SkipModelDownload) {
  $treeUri = 'https://huggingface.co/api/models/unsloth/Qwen3.6-35B-A3B-GGUF/tree/main?recursive=false&expand=true'
  $treeResponse = Invoke-RestMethod -Uri $treeUri -Headers @{ 'User-Agent' = 'Agent-FORCE-setup' }
  $modelMetadata = $null
  foreach ($entry in $treeResponse) {
    if ($entry.path -eq $ModelFile) {
      $modelMetadata = $entry
      break
    }
  }
  if (-not $modelMetadata) { throw "Model file $ModelFile was not found in the Hugging Face repository." }
  $modelExpectedSize = [long]$modelMetadata.size
  $modelExpectedHash = [string]$modelMetadata.lfs.oid
  $encodedFile = [uri]::EscapeDataString($ModelFile)
  $modelUri = "https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF/resolve/main/$encodedFile`?download=true"
  Invoke-Download $modelUri $modelPath $modelExpectedSize
  if ($modelExpectedHash) {
    Write-Host 'Verifying model SHA-256...'
    $modelHash = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($modelHash -ne $modelExpectedHash.ToLowerInvariant()) { throw 'Model SHA-256 verification failed.' }
  }
}

$apiKey = Read-DotEnvValue 'LLM_API_KEY'
if ($RotateApiKey -or [string]::IsNullOrWhiteSpace($apiKey)) { $apiKey = New-LocalApiKey }
Set-Content -LiteralPath $apiKeyFile -Value $apiKey -Encoding ASCII -NoNewline

Set-DotEnvValue 'LLM_BASE_URL' 'http://127.0.0.1:8080/v1'
Set-DotEnvValue 'LLM_MODEL_NAME' 'Qwen/Qwen3.6-35B-A3B'
Set-DotEnvValue 'LLM_API_KEY' $apiKey
Set-DotEnvValue 'LLM_TIMEOUT_SECONDS' '5'
Set-DotEnvValue 'LLM_AUTOSTART' 'true'
Set-DotEnvValue 'LLM_STARTUP_TIMEOUT_SECONDS' '180'
Set-DotEnvValue 'LLAMA_RUNTIME_ROOT' $RuntimeRoot
Set-DotEnvValue 'LLAMA_SERVER_PATH' $serverPath
Set-DotEnvValue 'LLAMA_MODEL_PATH' $modelPath
Set-DotEnvValue 'LLAMA_API_KEY_FILE' $apiKeyFile
Set-DotEnvValue 'LLAMA_GPU_LAYERS' '12'
Set-DotEnvValue 'LLAMA_CONTEXT_SIZE' '8192'

Write-Host ''
Write-Host 'Local Qwen runtime configured.'
Write-Host "Server: $serverPath"
Write-Host "Model:  $modelPath"
Write-Host "Config: $envFile"
Write-Host 'The API key was written to ignored local files and was not printed.'
