param(
  [string]$BaseUrl = "https://agenteasepro-3cf0df357839.herokuapp.com"
)

$ErrorActionPreference = 'Stop'

function Get-Token {
  param([string]$Base)

  $resp = Invoke-RestMethod -Method Post ($Base + '/api/auth/demo-login') -ContentType 'application/json' -Body '{}'
  if (-not $resp.token) { throw 'Missing token from /api/auth/demo-login' }
  return $resp.token
}

try {
  $token = Get-Token -Base $BaseUrl
  $headers = @{ Authorization = ('Bearer ' + $token) }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $email = "prod-smoke+$stamp@agentease.com"

  Write-Host "1. Creating Client with Temperature=WARM and Address..."
  $createBody = @{ 
    firstName = 'Prod'
    lastName = 'Smoke'
    email = $email
    role = 'BUYER'
    stage = 'ACTIVE'
    temperature = 'WARM'
    mailingAddress = '789 Market St'
    mailingCity = 'Salt Lake City'
    mailingState = 'UT'
    mailingZip = '84101'
  } | ConvertTo-Json

  $client = Invoke-RestMethod -Method Post ($BaseUrl + '/api/clients') -ContentType 'application/json' -Headers $headers -Body $createBody

  if ($client.temperature -ne 'WARM') { throw "Failed: Temperature should be WARM, got $($client.temperature)" }
  if ($client.mailingAddress -ne '789 Market St') { throw "Failed: Address mismatch" }
  Write-Host "   SUCCESS: Client created with ID $($client.id) and correct extended fields."

  Write-Host "2. Verifying Persistence (GET request)..."
  $fetched = Invoke-RestMethod -Method Get ($BaseUrl + "/api/clients/$($client.id)") -Headers $headers
  $c = $fetched.client
  if ($c.temperature -ne 'WARM') { throw "Failed: Persisted temperature incorrect" }
  if ($c.mailingAddress -ne '789 Market St') { throw "Failed: Persisted address incorrect" }
  Write-Host "   SUCCESS: Data persisted correctly in DB."

  Write-Host "3. Cleaning up (Deleting Client)..."
  Invoke-RestMethod -Method Delete ($BaseUrl + "/api/clients/$($client.id)") -Headers $headers | Out-Null
  Write-Host "   SUCCESS: Test client deleted."

  Write-Host "PROD SMOKE TEST PASSED" -ForegroundColor Green
}
catch {
  Write-Error "PROD SMOKE TEST FAILED: $_"
  exit 1
}
