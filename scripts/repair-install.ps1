<#
.SYNOPSIS
  Repairs a broken Agent FORCE Dashboard install from this clean clone.

.DESCRIPTION
  Run from a fresh clone of recaliendo/Agent.FORCE.Dashboard. It:
    1. Brings this clone up to date with origin/main (never discards local edits).
    2. Copies your local, untracked settings (.env, ofw.local.json) from an older
       copy of the dashboard, if one is found and this clone has none.
    3. Installs dependencies and builds.
    4. Turns each older copy's launcher into a forwarder to this clone (original kept
       as .bak) and re-points Agent FORCE shortcuts, including ones that run the
       launcher through cmd.exe or Windows Terminal, so nothing builds the old folder.

  Nothing else in the old folder is changed.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\repair-install.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\repair-install.ps1 -OldPath "C:\Users\Richa\OneDrive\Documents\Agent.FORCE.Dashboard"
#>
[CmdletBinding()]
param(
  [string]$OldPath,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Step($message) { Write-Host "`n==> $message" -ForegroundColor Cyan }
function Note($message) { Write-Host "    $message" }

function Resolve-Pnpm {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) { return @('pnpm') }
  $codexBin = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
  $codexPnpm = Join-Path $codexBin 'bin\pnpm.cmd'
  if (Test-Path -LiteralPath $codexPnpm) {
    $env:PATH = (Join-Path $codexBin 'node\bin') + ';' + $env:PATH
    return @($codexPnpm)
  }
  if (Get-Command corepack -ErrorAction SilentlyContinue) { return @('corepack', 'pnpm') }
  throw 'pnpm was not found. Install Node.js 22+ from https://nodejs.org, then run: corepack enable'
}

function Invoke-Pnpm([string[]]$pnpm, [string[]]$arguments) {
  $exe = $pnpm[0]
  $rest = @()
  if ($pnpm.Count -gt 1) { $rest = $pnpm[1..($pnpm.Count - 1)] }
  & $exe @rest @arguments
  if ($LASTEXITCODE -ne 0) { throw "pnpm $($arguments -join ' ') failed (exit $LASTEXITCODE)." }
}

function Test-DashboardFolder([string]$path) {
  $manifest = Join-Path $path 'package.json'
  if (-not (Test-Path -LiteralPath $manifest)) { return $false }
  try { return ((Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).name -eq 'agent-force-dashboard') } catch { return $false }
}

function Find-OldCopies {
  $roots = @(
    (Join-Path $env:USERPROFILE 'OneDrive\Documents'),
    (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
    (Join-Path $env:USERPROFILE 'OneDrive'),
    (Join-Path $env:USERPROFILE 'Documents'),
    (Join-Path $env:USERPROFILE 'Desktop'),
    $env:USERPROFILE
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  $self = (Resolve-Path -LiteralPath $repoRoot).Path
  $found = @()
  foreach ($root in $roots) {
    foreach ($dir in Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue) {
      if ($dir.Name -eq 'node_modules') { continue }
      if ($dir.FullName -ne $self -and (Test-DashboardFolder $dir.FullName)) { $found += $dir.FullName }
    }
  }
  return $found | Select-Object -Unique
}

# 1. Up to date with origin/main --------------------------------------------
Step 'Checking this clone'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git was not found. Install Git for Windows from https://git-scm.com.' }
$remote = (git remote get-url origin).Trim()
Note "origin: $remote"
if ($remote -notmatch 'recaliendo/Agent\.FORCE\.Dashboard') {
  throw "This clone's origin is $remote. Clone https://github.com/recaliendo/Agent.FORCE.Dashboard into a new folder and run this script from there."
}
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed. Check your network and GitHub sign-in, then retry.' }
$dirty = git status --porcelain --untracked-files=no
if ($dirty) {
  Note 'This clone has local edits, so it was not updated automatically:'
  $dirty | ForEach-Object { Note "  $_" }
} else {
  if ((git rev-parse --abbrev-ref HEAD).Trim() -ne 'main') { git checkout main }
  git merge --ff-only origin/main
  if ($LASTEXITCODE -ne 0) { throw 'Could not fast-forward to origin/main. Run: git status' }
}
Note ("At commit: " + (git log -1 --format='%h %s'))

# 2. Local settings from an older copy ---------------------------------------
Step 'Carrying over local settings'
$candidates = @()
if ($OldPath) {
  if (-not (Test-DashboardFolder $OldPath)) { throw "-OldPath $OldPath is not an Agent FORCE Dashboard folder." }
  $candidates = @($OldPath)
} else {
  $candidates = @(Find-OldCopies)
}
$legacy = Join-Path $env:USERPROFILE 'OneDrive\Documents\Agent.FORCE.Dashboard'
if ((Test-DashboardFolder $legacy) -and ($candidates -notcontains $legacy) -and ((Resolve-Path -LiteralPath $legacy).Path -ne (Resolve-Path -LiteralPath $repoRoot).Path)) { $candidates += $legacy }
if (-not $candidates.Count) { Note 'No older copy found; nothing to carry over.' }
foreach ($old in $candidates) { Note "Found older copy: $old" }
foreach ($file in @('.env', 'ofw.local.json')) {
  $target = Join-Path $repoRoot $file
  if (Test-Path -LiteralPath $target) { Note "$file already present; kept."; continue }
  $source = $candidates | ForEach-Object { Join-Path $_ $file } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($source) { Copy-Item -LiteralPath $source -Destination $target; Note "Copied $file from $source" }
  else { Note "$file not found in older copies (fine if you never created one)." }
}

# 3. Install and build -------------------------------------------------------
Step 'Installing dependencies and building'
$pnpm = Resolve-Pnpm
Invoke-Pnpm $pnpm @('install', '--frozen-lockfile')
Invoke-Pnpm $pnpm @('run', 'build')
Note 'Build succeeded.'

# 4. Old launchers and shortcuts ---------------------------------------------
Step 'Pointing every launcher and shortcut at this copy'
$launcher = Join-Path $repoRoot 'launch-agent-force-dashboard.cmd'
$icon = Join-Path $repoRoot 'assets\agent-force-command-icon.ico'

# An older copy's launcher may cd into its own (stale) folder, so any shortcut or
# terminal profile that still runs it would keep failing. Replace it with a
# forwarder to this copy, keeping the original beside it as .bak.
foreach ($old in $candidates) {
  $oldLauncher = Join-Path $old 'launch-agent-force-dashboard.cmd'
  if (-not (Test-Path -LiteralPath $oldLauncher)) { continue }
  if ((Get-Content -LiteralPath $oldLauncher -Raw) -match [regex]::Escape($launcher)) { Note "$oldLauncher already forwards here."; continue }
  Copy-Item -LiteralPath $oldLauncher -Destination "$oldLauncher.bak" -Force
  $forwarder = "@echo off`r`nrem Forwarded by scripts\repair-install.ps1; the original is beside this file as .bak.`r`ncall `"$launcher`" %*`r`n"
  [IO.File]::WriteAllText($oldLauncher, $forwarder, [Text.Encoding]::ASCII)
  Note "Forwarded $oldLauncher -> $launcher (original saved as .bak)"
}

# Shortcuts may run the launcher directly or through cmd.exe / Windows Terminal,
# so match the launcher name in the target or the arguments.
$shell = New-Object -ComObject WScript.Shell
$folders = @(
  [Environment]::GetFolderPath('Desktop'),
  [Environment]::GetFolderPath('CommonDesktopDirectory'),
  (Join-Path $env:USERPROFILE 'Desktop'),
  (Join-Path $env:USERPROFILE 'OneDrive\Desktop'),
  [Environment]::GetFolderPath('Programs'),
  (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique
$updated = @()
foreach ($folder in $folders) {
  foreach ($lnk in Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue) {
    $shortcut = $shell.CreateShortcut($lnk.FullName)
    $runs = "$($shortcut.TargetPath) $($shortcut.Arguments)"
    if ($runs -notmatch 'launch-agent-force-dashboard\.cmd' -and $lnk.BaseName -notmatch '^Agent ?FORCE') { continue }
    if ($shortcut.TargetPath -eq $launcher) { $updated += $lnk.FullName; continue }
    try {
      Note "Re-pointing $($lnk.FullName) (was: $runs)"
      $shortcut.TargetPath = $launcher
      $shortcut.Arguments = ''
      $shortcut.WorkingDirectory = $repoRoot
      $shortcut.IconLocation = $icon
      $shortcut.Save()
      $updated += $lnk.FullName
    } catch {
      Note "Could not update $($lnk.FullName): $($_.Exception.Message). The forwarded launcher still covers it."
    }
  }
}
if (-not $updated.Count) {
  $path = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Agent FORCE Dashboard.lnk'
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $launcher
  $shortcut.WorkingDirectory = $repoRoot
  $shortcut.IconLocation = $icon
  $shortcut.Save()
  Note "Created $path"
}

Step 'Done'
Note "Agent FORCE Dashboard now runs from: $repoRoot"
if ($candidates.Count) { Note 'Older copies now forward to this one. Delete them once you are happy with it.' }
if (-not $NoLaunch) { Start-Process -FilePath $launcher -WorkingDirectory $repoRoot }
