#Requires -Version 5.1
param(
  [ValidateSet('all', 'nfe', 'nfse')]
  [string]$Tipo = 'all',
  [string]$CompanyId = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $Root '.env'

if (-not (Test-Path $envFile)) {
  Write-Host "Arquivo .env nao encontrado. Execute .\setup-local.ps1 primeiro." -ForegroundColor Red
  exit 1
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $pair = $_ -split '=', 2
  if ($pair.Count -eq 2) {
    [System.Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim(), 'Process')
  }
}

$python = $env:PYTHON_BIN
if (-not $python) { $python = 'python' }

$args = @('scheduler.py', '--tipo', $Tipo)
if ($CompanyId) {
  $args += @('--company-id', $CompanyId)
}

Push-Location $Root
try {
  & $python @args
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
