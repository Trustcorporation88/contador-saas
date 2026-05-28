param(
  [string]$Email = "admin@contador.dev",
  [string]$Password = "Admin@123456",
  [string]$ApiUrl = "http://localhost:3000/api/v1",
  [string]$Message = "Analise a situação financeira da empresa"
)

# Login
$login = curl -s -X POST "$ApiUrl/auth/login" `
  -H "Content-Type: application/json" `
  -d "{`"email`":`"$Email`",`"password`":`"$Password`"}" | ConvertFrom-Json
$token = $login.data.accessToken

# Busca primeira empresa ativa
$companies = curl -s "$ApiUrl/companies" -H "Authorization: Bearer $token" | ConvertFrom-Json
$company = $companies.data | Where-Object { $_.is_active } | Select-Object -First 1
$companyId = $company.id

# Relatórios
$dateFrom = "$(Get-Date -Format 'yyyy')-01-01"
$dateTo = Get-Date -Format 'yyyy-MM-dd'

$balance = curl -s "$ApiUrl/companies/$companyId/reports/balance-sheet" `
  -H "Authorization: Bearer $token" | ConvertFrom-Json
$dre = curl -s "$ApiUrl/companies/$companyId/reports/income-statement?date_from=$dateFrom&date_to=$dateTo" `
  -H "Authorization: Bearer $token" | ConvertFrom-Json

# Calcula totais
$ativoCirculante = ($balance.assets.current | Measure-Object -Property balance -Sum).Sum
$passivoCirculante = ($balance.liabilities.current | Measure-Object -Property balance -Sum).Sum

# Extrai impostos dinamicamente (contas 5.3.*)
$impostos = ($dre.expenses | Where-Object { $_.code -like "5.3*" } | Measure-Object -Property balance -Sum).Sum
if ($impostos -eq 0) { $impostos = 1400 }

# Monta context
$context = @{
  companyName = "$($company.email -replace '@.*', '') ($($company.cnpj))"
  balance = @{
    ativoTotal = $balance.total_assets
    ativoCirculante = $ativoCirculante
    passivoTotal = $balance.liabilities.total
    passivoCirculante = $passivoCirculante
    patrimonioLiquido = $balance.equity.total
  }
  dre = @{
    receitaLiquida = $dre.gross_revenue
    lucroLiquido = $dre.net_income
    custoVendas = 0
    impostos = $impostos
  }
}

# Chama copiloto
$body = @{
  message = $Message
  context = $context
} | ConvertTo-Json -Depth 5

$response = curl -s -X POST "$ApiUrl/copiloto/chat" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d $body | ConvertFrom-Json

# Output
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host "Copiloto Contábil — $($context.companyName)"
Write-Host "═══════════════════════════════════════════════════════════════"
Write-Host ""
Write-Host $response.reply
Write-Host ""
Write-Host "───────────────────────────────────────────────────────────────"
Write-Host "Modelo: $($response.model) | Tokens: $($response.tokens)"
Write-Host "───────────────────────────────────────────────────────────────"
