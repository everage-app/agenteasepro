param(
  [string]$BaseUrl = "https://agenteasepro-3cf0df357839.herokuapp.com",
  [string]$BuyerEmail = "bephomes@gmail.com",
  [string]$SellerEmail = "",
  [string]$OutDir = "logs"
)

$ErrorActionPreference = 'Stop'

function Get-Token {
  param([string]$Base)

  if ($Base -like 'https://*') {
    $resp = Invoke-RestMethod -Method Post ($Base + '/api/auth/demo-login') -ContentType 'application/json' -Body '{}'
    if (-not $resp.token) { throw 'Missing token from /api/auth/demo-login' }
    return $resp.token
  }

  $resp = Invoke-RestMethod -Method Post ($Base + '/api/auth/dev-login') -ContentType 'application/json' -Body (@{ email = 'demo@agentease.com' } | ConvertTo-Json)
  if (-not $resp.token) { throw 'Missing token from /api/auth/dev-login' }
  return $resp.token
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (-not $SellerEmail) {
  $SellerEmail = "demo-seller+$stamp@agentease.com"
}

$token = Get-Token -Base $BaseUrl
$headers = @{ Authorization = ('Bearer ' + $token) }

$deals = Invoke-RestMethod -Method Get ($BaseUrl + '/api/deals') -Headers $headers
$deal = $deals | Where-Object { $_.repc -ne $null } | Select-Object -First 1
if (-not $deal) { throw 'No REPC-backed deal found. Create/save a REPC deal first.' }

$buyerName = if ($deal.buyer) { ($deal.buyer.firstName + ' ' + $deal.buyer.lastName).Trim() } else { 'Demo Buyer' }
$sellerName = if ($deal.seller) { ($deal.seller.firstName + ' ' + $deal.seller.lastName).Trim() } else { 'Demo Seller' }

$envelopeBody = @{
  dealId = $deal.id
  type = 'REPC'
  signers = @(
    @{ role = 'BUYER'; name = $buyerName; email = $BuyerEmail },
    @{ role = 'SELLER'; name = $sellerName; email = $SellerEmail }
  )
  subject = "Client Demo: Please review and sign - $($deal.property.street)"
  message = 'Demo packet for signing UX walkthrough.'
} | ConvertTo-Json -Depth 6

$resp = Invoke-RestMethod -Method Post ($BaseUrl + '/api/esign/envelopes') -Headers $headers -ContentType 'application/json' -Body $envelopeBody

$links = @()
foreach ($l in $resp.links) {
  $pdfUrl = ($BaseUrl + '/api/esign-public/envelopes/' + $resp.envelope.id + '/' + $l.signerId + '/' + ($l.url.Split('/')[-1]) + '/pdf')
  $links += [ordered]@{
    signerId = $l.signerId
    signingUrl = $l.url
    packetPdfUrl = $pdfUrl
  }
}

$result = [ordered]@{
  generatedAt = (Get-Date).ToString('s')
  baseUrl = $BaseUrl
  dealId = $deal.id
  dealTitle = $deal.title
  propertyStreet = $deal.property.street
  envelopeId = $resp.envelope.id
  signerLinks = $links
  emailStatus = $resp.emailStatus
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}
$outFile = Join-Path $OutDir ("demo-signing-links-$stamp.json")
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $outFile -Encoding UTF8

Write-Output ("Saved: {0}" -f $outFile)
$result | ConvertTo-Json -Depth 8
