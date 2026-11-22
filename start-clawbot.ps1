<#
.SYNOPSIS
    Launches ClawBot WALL-E Twin (OpenClaw Gateway + Backend API + 3D Sim-to-Real Frontend).
.DESCRIPTION
    Checks and starts OpenClaw Gateway on 127.0.0.1:18789, starts the Express SSE
    robot brain server on 127.0.0.1:4320, starts the Three.js + React Mission Control UI
    on 127.0.0.1:5174, and opens http://127.0.0.1:5174 in your default browser.
#>
[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$GatewayUrl  = if ($env:OPENCLAW_GATEWAY_URL) { $env:OPENCLAW_GATEWAY_URL.TrimEnd('/') } else { 'http://127.0.0.1:18789' }
$BackendUrl  = 'http://127.0.0.1:4320'
$FrontendUrl = 'http://127.0.0.1:5174'
$OpenClawCfg = Join-Path $env:USERPROFILE '.openclaw\openclaw.json'

function Write-Step([string]$Message) {
    Write-Host "[ClawBot WALL-E] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "  OK  $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host " WARN $Message" -ForegroundColor Yellow
}

function Get-GatewayToken {
    if ($env:OPENCLAW_GATEWAY_TOKEN) {
        return $env:OPENCLAW_GATEWAY_TOKEN.Trim()
    }
    if (Test-Path $OpenClawCfg) {
        try {
            $cfg = Get-Content $OpenClawCfg -Raw | ConvertFrom-Json
            if ($cfg.gateway -and $cfg.gateway.auth -and $cfg.gateway.auth.token) {
                return [string]$cfg.gateway.auth.token
            }
        } catch {
            return $null
        }
    }
    return $null
}

function Test-HttpReady([string]$Url, [hashtable]$Headers = @{}) {
    try {
        $resp = Invoke-WebRequest -Uri $Url -Headers $Headers -Method Get -TimeoutSec 2 -UseBasicParsing
        return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Wait-HttpReady([string]$Name, [string]$Url, [hashtable]$Headers = @{}, [int]$TimeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpReady -Url $Url -Headers $Headers) {
            Write-Ok "$Name is ready ($Url)"
            return $true
        }
        Start-Sleep -Milliseconds 750
    }
    Write-Warn "$Name did not respond within ${TimeoutSeconds}s ($Url)"
    return $false
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host "   CLAWBOT WALL-E TWIN  |  OpenClaw Agent x Cerebras Sim-to-Real  " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Verify required CLIs
foreach ($cmd in @('node', 'npm', 'openclaw')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Required command '$cmd' was not found on PATH."
    }
}
Write-Ok "Prerequisites verified (node, npm, openclaw)"

# 2. Install workspace dependencies if needed
if (-not $SkipInstall) {
    if (-not (Test-Path (Join-Path $ProjectRoot 'server\node_modules'))) {
        Write-Step "Installing server dependencies..."
        Push-Location (Join-Path $ProjectRoot 'server')
        npm install
        Pop-Location
    }
    if (-not (Test-Path (Join-Path $ProjectRoot 'client\node_modules'))) {
        Write-Step "Installing client dependencies..."
        Push-Location (Join-Path $ProjectRoot 'client')
        npm install
        Pop-Location
    }
}

# 3. Check or start OpenClaw Gateway (18789)
$gwHeaders = @{}
$gwToken = Get-GatewayToken
if ($gwToken) {
    $gwHeaders['Authorization'] = "Bearer $gwToken"
}

if (Test-HttpReady -Url "$GatewayUrl/v1/models" -Headers $gwHeaders) {
    Write-Ok "OpenClaw Gateway already running ($GatewayUrl)"
} else {
    Write-Step "Starting OpenClaw Gateway on $GatewayUrl ..."
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoExit',
        '-Command',
        'openclaw gateway run --port 18789 --bind loopback'
    ) -WindowStyle Minimized | Out-Null

    if (-not (Wait-HttpReady -Name 'OpenClaw Gateway' -Url "$GatewayUrl/v1/models" -Headers $gwHeaders -TimeoutSeconds 35)) {
        throw "OpenClaw Gateway failed to start. Run 'openclaw gateway status' to inspect."
    }
}

# 4. Check or start ClawBot Backend (4320)
if (Test-HttpReady -Url "$BackendUrl/api/health") {
    Write-Ok "ClawBot Backend already running ($BackendUrl)"
} else {
    Write-Step "Starting ClawBot Backend ($BackendUrl) ..."
    $serverDir = Join-Path $ProjectRoot 'server'
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoExit',
        '-Command',
        "Set-Location '$serverDir'; npm run dev"
    ) -WindowStyle Minimized | Out-Null

    Wait-HttpReady -Name 'ClawBot Backend' -Url "$BackendUrl/api/health" -TimeoutSeconds 25 | Out-Null
}

# 5. Check or start ClawBot 3D Frontend (5174)
if (Test-HttpReady -Url $FrontendUrl) {
    Write-Ok "ClawBot 3D Frontend already running ($FrontendUrl)"
} else {
    Write-Step "Starting ClawBot 3D Frontend ($FrontendUrl) ..."
    $clientDir = Join-Path $ProjectRoot 'client'
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoExit',
        '-Command',
        "Set-Location '$clientDir'; npm run dev"
    ) -WindowStyle Minimized | Out-Null

    Wait-HttpReady -Name 'ClawBot 3D Frontend' -Url $FrontendUrl -TimeoutSeconds 25 | Out-Null
}

Write-Host ""
Write-Host "ClawBot WALL-E Twin is live:" -ForegroundColor Green
Write-Host "  3D Mission Control : $FrontendUrl"
Write-Host "  Robot Brain API    : $BackendUrl/api/health"
Write-Host "  ESP32 Firmware     : $BackendUrl/api/firmware"
Write-Host "  OpenClaw Gateway   : $GatewayUrl/v1/models"
Write-Host ""

if (-not $NoBrowser) {
    Start-Process $FrontendUrl | Out-Null
}
