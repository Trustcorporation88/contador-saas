#Requires -Version 5.1
<#
.SYNOPSIS
  Configura .env e empresas.json para captura local conectada ao Postgres Railway.
.USAGE
  cd automacao-xml
  .\setup-local.ps1
#>
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path (Split-Path -Parent $Root) 'backend'

Write-Host '-> Buscando DATABASE_PUBLIC_URL no Railway...' -ForegroundColor Cyan

$dbPublic = $null
try {
  Push-Location $BackendDir
  $json = railway variables --service Postgres --json 2>&1 | Out-String
  Pop-Location
  if ($json -match '"DATABASE_PUBLIC_URL"\s*:\s*"([^"]+)"') {
    $dbPublic = $Matches[1]
  }
} catch {
  Pop-Location
}

if (-not $dbPublic) {
  Push-Location $BackendDir
  $text = railway variables --service Postgres 2>&1 | Out-String
  Pop-Location
  if ($text -match 'postgresql://postgres:[A-Za-z0-9]+@thomas\.proxy\.rlwy\.net:\d+/railway') {
    $dbPublic = $Matches[0].Trim()
  }
}

if (-not $dbPublic) {
  throw 'Nao foi possivel obter DATABASE_PUBLIC_URL. Rode railway login e link o projeto em backend/.'
}

$envContent = @"
DATABASE_URL=$dbPublic

FISCAL_AUTOMATION_DIR=$Root
FISCAL_XML_ROOT=$Root\xmls
FISCAL_CERTS_DIR=$Root\certs
FISCAL_SYNC_DB=$Root\sync.db

PYTHON_BIN=python
FISCAL_HOMOLOGACAO=false
NFSE_API_BASE=https://adn.nfse.gov.br/contribuintes
"@

$envPath = Join-Path $Root '.env'
Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "OK .env criado em $envPath" -ForegroundColor Green

Write-Host '-> Buscando empresas na API procontador...' -ForegroundColor Cyan
$loginBody = (@{ email = 'admin@procontador.com.br'; password = 'ProContador@2026' } | ConvertTo-Json -Compress)
$login = Invoke-RestMethod -Uri 'https://procontador.com.br/api/v1/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody
$token = $login.data.accessToken
$list = Invoke-RestMethod -Uri 'https://procontador.com.br/api/v1/companies?limit=100' -Headers @{ Authorization = "Bearer $token" }

$empresas = @()
foreach ($c in $list.data) {
  if ($c.cnpj -eq '00000000000000') { continue }
  $serpro = $c.tax_regime -eq 'simples_nacional'
  $empresas += [ordered]@{
    company_id   = $c.id
    cnpj         = $c.cnpj
    uf           = 'sp'
    pfx          = "./certs/$($c.cnpj).pfx"
    senha        = 'COLOQUE_SENHA_DO_CERTIFICADO'
    serpro_motor = $serpro
    nome         = $c.name
  }
}

$empresasPath = Join-Path $Root 'empresas.json'
$empresas | ConvertTo-Json -Depth 4 | Set-Content -Path $empresasPath -Encoding UTF8
Write-Host "OK empresas.json criado ($($empresas.Count) empresa(s))" -ForegroundColor Green

Write-Host ''
Write-Host 'Proximos passos:' -ForegroundColor Yellow
Write-Host '  1. Coloque cada .pfx em automacao-xml\certs\{cnpj}.pfx'
Write-Host '  2. Edite empresas.json e substitua COLOQUE_SENHA_DO_CERTIFICADO pela senha real'
Write-Host '  3. Ajuste UF se necessario (padrao: sp)'
Write-Host '  4. pip install -r requirements.txt'
Write-Host '  5. .\run-captura.ps1'
