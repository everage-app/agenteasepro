param(
  [string]$BaseUrl = "http://127.0.0.1:3001"
)

$ErrorActionPreference = 'Stop'

function Get-Token {
  param([string]$Base)
  Write-Host "Authenticating..."
  $resp = Invoke-RestMethod -Method Post ($Base + '/api/auth/dev-login') -ContentType 'application/json' -Body (@{ email = 'demo@agentease.com' } | ConvertTo-Json)
  if (-not $resp.token) { throw 'Missing token from /api/auth/dev-login' }
  return $resp.token
}

try {
    $token = Get-Token -Base $BaseUrl
    $headers = @{ Authorization = ('Bearer ' + $token) }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $email = "test-features+$stamp@example.com"

    Write-Host "1. Creating Client with Temperature=HOT and Address..."
    $createBody = @{ 
      firstName = 'Feature'
      lastName = 'Tester'
      email = $email
      phone = '555-0199'
      role = 'BUYER'
      stage = 'ACTIVE'
      temperature = 'HOT'
      mailingAddress = '123 Main St'
      mailingCity = 'Salt Lake City'
      mailingState = 'UT'
      mailingZip = '84111'
    } | ConvertTo-Json

    $client = Invoke-RestMethod -Method Post ($BaseUrl + '/api/clients') -ContentType 'application/json' -Headers $headers -Body $createBody

    if ($client.temperature -ne 'HOT') { throw "Failed: Temperature should be HOT, got $($client.temperature)" }
    if ($client.mailingAddress -ne '123 Main St') { throw "Failed: Address mismatch" }
    Write-Host "   SUCCESS: Client created with ID $($client.id) and correct extended fields."

    Write-Host "2. Updating Client to Temperature=COLD and New Address..."
    $updateBody = @{
        temperature = 'COLD'
        mailingAddress = '456 Second Ave'
        mailingZip = '84000'
    } | ConvertTo-Json

    $updatedClient = Invoke-RestMethod -Method Put ($BaseUrl + "/api/clients/$($client.id)") -ContentType 'application/json' -Headers $headers -Body $updateBody

    if ($updatedClient.temperature -ne 'COLD') { throw "Failed: Temperature should be COLD, got $($updatedClient.temperature)" }
    if ($updatedClient.mailingAddress -ne '456 Second Ave') { throw "Failed: Address mismatch on update" }
    Write-Host "   SUCCESS: Client updated correctly."

    Write-Host "3. Verifying Persistence (GET request)..."
    $fetchedClient = Invoke-RestMethod -Method Get ($BaseUrl + "/api/clients/$($client.id)") -Headers $headers
    # Note: GET /clients/:id returns object with 'client' property
    $c = $fetchedClient.client 
    if ($c.temperature -ne 'COLD') { throw "Failed: Persisted temperature incorrect" }
    if ($c.mailingAddress -ne '456 Second Ave') { throw "Failed: Persisted address incorrect" }
    Write-Host "   SUCCESS: Data persisted correctly in DB."

    Write-Host "4. Cleaning up (Deleting Client)..."
    Invoke-RestMethod -Method Delete ($BaseUrl + "/api/clients/$($client.id)") -Headers $headers | Out-Null
    Write-Host "   SUCCESS: Test client deleted."

    Write-Host "SMOKE TEST PASSED: ALL NEW FEATURES WORKING CORRECTLY." -ForegroundColor Green
}
catch {
    Write-Error "SMOKE TEST FAILED: $_"
    exit 1
}
