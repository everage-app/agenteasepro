param(
  [string]$BaseUrl = "http://127.0.0.1:3001",
  [string]$EmailPrefix = "demo-client"
)

$ErrorActionPreference = 'Stop'

function Get-Token {
  param([string]$Base)

  if ($Base -like 'https://*') {
    # Production-safe demo
    $resp = Invoke-RestMethod -Method Post ($Base + '/api/auth/demo-login') -ContentType 'application/json' -Body '{}'
    if (-not $resp.token) { throw 'Missing token from /api/auth/demo-login' }
    return $resp.token
  }

  # Local/dev
  $resp = Invoke-RestMethod -Method Post ($Base + '/api/auth/dev-login') -ContentType 'application/json' -Body (@{ email = 'demo@agentease.com' } | ConvertTo-Json)
  if (-not $resp.token) { throw 'Missing token from /api/auth/dev-login' }
  return $resp.token
}

$token = Get-Token -Base $BaseUrl

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$email = ("{0}+{1}@agentease.com" -f $EmailPrefix, $stamp)

$body = @{ 
  firstName = 'Test'
  lastName = 'Client'
  email = $email
  phone = '8015550123'
  role = 'BUYER'
  stage = 'NEW_LEAD'
  source = $null
  referralRank = 'C'
  notes = 'Smoke test'
} | ConvertTo-Json

$resp = Invoke-RestMethod -Method Post ($BaseUrl + '/api/clients') -ContentType 'application/json' -Headers @{ Authorization = ('Bearer ' + $token) } -Body $body
if (-not $resp.id) { throw 'Client create did not return an id' }

Write-Output ("OK created client id={0} email={1}" -f $resp.id, $email)
