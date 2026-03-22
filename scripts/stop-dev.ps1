[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDir = Join-Path $repoRoot ".local-dev"
$pidFiles = @(
  (Join-Path $stateDir "server.pid"),
  (Join-Path $stateDir "web.pid")
)

foreach ($pidFile in $pidFiles) {
  if (-not (Test-Path $pidFile)) {
    continue
  }

  $rawPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if (-not $rawPid) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    continue
  }

  $targetPid = [int]$rawPid

  try {
    $process = Get-Process -Id $targetPid -ErrorAction Stop
    Write-Host "Stopping PID $targetPid ($($process.ProcessName))" -ForegroundColor Yellow
    Stop-Process -Id $targetPid -Force
  } catch {
    Write-Host "PID $targetPid is already stopped." -ForegroundColor DarkYellow
  }

  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Local dev processes stopped." -ForegroundColor Green

