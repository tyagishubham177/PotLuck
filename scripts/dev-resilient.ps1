[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$ForceKillPorts,
  [int]$WebPort = 3000,
  [int]$ServerPort = 3001,
  [int]$StartupTimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateDir = Join-Path $repoRoot ".local-dev"
$webPidFile = Join-Path $stateDir "web.pid"
$serverPidFile = Join-Path $stateDir "server.pid"
$serverHealthUrl = "http://127.0.0.1:$ServerPort/health"
$webHealthUrl = "http://127.0.0.1:$WebPort"
$pnpmShellCommand = "corepack pnpm"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Note([string]$Message) {
  Write-Host $Message -ForegroundColor DarkCyan
}

function Ensure-Command([string]$CommandName, [string]$InstallHint) {
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Missing required command '$CommandName'. $InstallHint"
  }
}

function Invoke-Pnpm([string]$Arguments) {
  Push-Location $repoRoot
  try {
    $command = "$pnpmShellCommand $Arguments"
    cmd.exe /d /c $command
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed: $command"
    }
  } finally {
    Pop-Location
  }
}

function Test-HttpOk([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Test-NodeVersion {
  $rawVersion = [string](node --version)
  $majorVersion = 0

  if ($rawVersion -match "^v(\d+)") {
    $majorVersion = [int]$matches[1]
  }

  if ($majorVersion -ne 22) {
    Write-Warning "PotLuck targets Node.js 22.x. Current version is $rawVersion. Local dev may still run, but switch to Node 22 if you hit odd behavior."
  } else {
    Write-Note "Using supported Node.js version $rawVersion"
  }
}

function Get-PortProcesses([int]$Port) {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    return @()
  }

  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  $results = @()

  foreach ($processId in $processIds) {
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      $results += $process
    } catch {
      continue
    }
  }

  return $results
}

function Stop-PortProcesses([int]$Port) {
  $processes = Get-PortProcesses -Port $Port
  foreach ($process in $processes) {
    Write-Host "Stopping PID $($process.Id) ($($process.ProcessName)) on port $Port" -ForegroundColor Yellow
    Stop-Process -Id $process.Id -Force
  }
}

function Ensure-EnvFile([string]$TargetPath, [string]$ExamplePath) {
  if (Test-Path $TargetPath) {
    return
  }

  Copy-Item -Path $ExamplePath -Destination $TargetPath
  Write-Host "Created $(Split-Path -Leaf $TargetPath) from example template." -ForegroundColor Yellow
}

function Wait-ForUrl([string]$Url, [int]$TimeoutSeconds, [string]$Name) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    if (Test-HttpOk -Url $Url) {
      Write-Host "$Name is responding at $Url" -ForegroundColor Green
      return
    }

    Start-Sleep -Seconds 2
  }

  throw "$Name did not become healthy at $Url within $TimeoutSeconds seconds."
}

function Start-WorkspaceProcess(
  [string]$Name,
  [string]$WorkingDirectory,
  [string]$Command,
  [string]$PidFile
) {
  $process = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @(
      "-NoExit",
      "-ExecutionPolicy", "Bypass",
      "-Command", "Set-Location '$WorkingDirectory'; cmd.exe /d /c '$Command'"
    ) `
    -WorkingDirectory $WorkingDirectory `
    -PassThru

  Set-Content -Path $PidFile -Value $process.Id
  Write-Host "$Name started with PID $($process.Id)" -ForegroundColor Green
}

Write-Step "Checking required commands"
Ensure-Command -CommandName "corepack" -InstallHint "Install Node.js 22.x so Corepack is available."
Ensure-Command -CommandName "node" -InstallHint "Install Node.js 22.x."
Test-NodeVersion

Write-Step "Preparing local state"
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

$serverEnvPath = Join-Path $repoRoot "apps\server\.env"
$serverEnvExamplePath = Join-Path $repoRoot "apps\server\.env.example"
$webEnvPath = Join-Path $repoRoot "apps\web\.env.local"
$webEnvExamplePath = Join-Path $repoRoot "apps\web\.env.example"

Ensure-EnvFile -TargetPath $serverEnvPath -ExamplePath $serverEnvExamplePath
Ensure-EnvFile -TargetPath $webEnvPath -ExamplePath $webEnvExamplePath

Write-Step "Checking ports"
$webInUse = @(Get-PortProcesses -Port $WebPort)
$serverInUse = @(Get-PortProcesses -Port $ServerPort)

if ($ForceKillPorts) {
  if ($webInUse.Count -gt 0) {
    Stop-PortProcesses -Port $WebPort
  }
  if ($serverInUse.Count -gt 0) {
    Stop-PortProcesses -Port $ServerPort
  }
} else {
  if ($webInUse.Count -gt 0 -and -not (Test-HttpOk -Url $webHealthUrl)) {
    Write-Host "Port $WebPort is occupied by a non-healthy process. Clearing it for local dev." -ForegroundColor Yellow
    Stop-PortProcesses -Port $WebPort
  }

  if ($serverInUse.Count -gt 0 -and -not (Test-HttpOk -Url $serverHealthUrl)) {
    Write-Host "Port $ServerPort is occupied by a non-healthy process. Clearing it for local dev." -ForegroundColor Yellow
    Stop-PortProcesses -Port $ServerPort
  }
}

if (-not $SkipInstall) {
  Write-Step "Installing workspace dependencies"
  Invoke-Pnpm "install --frozen-lockfile"
}

if (-not (Test-HttpOk -Url $serverHealthUrl)) {
  Write-Step "Starting server dev process"
  Start-WorkspaceProcess `
    -Name "Server" `
    -WorkingDirectory $repoRoot `
    -Command "$pnpmShellCommand --filter @potluck/server dev" `
    -PidFile $serverPidFile
} else {
  Write-Host "Server already healthy on port $ServerPort, reusing it." -ForegroundColor Yellow
}

if (-not (Test-HttpOk -Url $webHealthUrl)) {
  Write-Step "Starting web dev process"
  Start-WorkspaceProcess `
    -Name "Web" `
    -WorkingDirectory $repoRoot `
    -Command "$pnpmShellCommand --filter @potluck/web dev" `
    -PidFile $webPidFile
} else {
  Write-Host "Web app already responding on port $WebPort, reusing it." -ForegroundColor Yellow
}

Write-Step "Waiting for health checks"
Wait-ForUrl -Url $serverHealthUrl -TimeoutSeconds $StartupTimeoutSeconds -Name "Server"
Wait-ForUrl -Url $webHealthUrl -TimeoutSeconds $StartupTimeoutSeconds -Name "Web app"

Write-Step "Ready"
Write-Host "Web:    $webHealthUrl" -ForegroundColor Green
Write-Host "Server: $serverHealthUrl" -ForegroundColor Green
Write-Host ""
Write-Host "To stop local dev later, run:" -ForegroundColor Cyan
Write-Host "corepack pnpm dev:stop"
