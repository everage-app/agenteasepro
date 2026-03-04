$ErrorActionPreference = 'Stop'

$baseUrl = 'http://127.0.0.1:3001'
$email = 'demo@agentease.com'

$loginBody = @{ email = $email } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post "$baseUrl/api/auth/dev-login" -ContentType 'application/json' -Body $loginBody
$token = $login.token
if (-not $token) { throw 'Missing token from dev-login' }

$defs = Invoke-RestMethod -Method Get "$baseUrl/api/forms/definitions" -Headers @{ Authorization = "Bearer $token" }
if (-not $defs) { throw 'No form definitions returned' }

Write-Output ("Definitions returned: {0}" -f $defs.Count)
Write-Output ("Codes: {0}" -f (($defs | Select-Object -ExpandProperty code) -join ', '))
Write-Output ""

$failures = @()
foreach ($d in $defs) {
  $code = $d.code
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Method Head "$baseUrl/api/forms/definitions/$code/pdf" -Headers @{ Authorization = "Bearer $token" }
    Write-Output ("OK  {0}  ({1})" -f $code, $d.displayName)
  } catch {
    $failures += [PSCustomObject]@{ code = $code; name = $d.displayName; error = ($_.Exception.Message) }
    Write-Output ("FAIL {0}  ({1})" -f $code, $d.displayName)
  }
}

if ($failures.Count -gt 0) {
  Write-Output ""
  Write-Output "Failures:"
  $failures | Format-Table -AutoSize | Out-String | Write-Output
  exit 1
}

Write-Output "All templates OK"
