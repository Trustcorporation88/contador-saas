# Copia automacao-xml para dentro de backend/ antes do docker build (Railway).
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Split-Path -Parent $ScriptDir
$RepoRoot = Split-Path -Parent $Backend
$Source = Join-Path $RepoRoot 'automacao-xml'
$Dest = Join-Path $Backend 'automacao-xml'

if (-not (Test-Path $Source)) {
  throw "Pasta nao encontrada: $Source"
}

if (Test-Path $Dest) {
  Remove-Item $Dest -Recurse -Force
}

Copy-Item $Source $Dest -Recurse -Exclude @('.venv', 'xmls', 'sync.db', '__pycache__', '.env')
Write-Host "OK automacao-xml copiado para $Dest" -ForegroundColor Green
