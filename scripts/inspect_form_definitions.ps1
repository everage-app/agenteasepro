param(
  [string]$BaseUrl = "http://127.0.0.1:3001",
  [string]$Email = "demo@agentease.com"
)

$ErrorActionPreference = "Stop"

$login = Invoke-RestMethod -Method Post ("$BaseUrl/api/auth/dev-login") -ContentType "application/json" -Body (@{ email = $Email } | ConvertTo-Json)
$token = $login.token
if (-not $token) { throw "Missing token from dev-login" }

$defs = Invoke-RestMethod -Method Get ("$BaseUrl/api/forms/definitions") -Headers @{ Authorization = ("Bearer " + $token) }

Write-Output ("count={0}" -f $defs.Count)
Write-Output (($defs | Select-Object -ExpandProperty code) -join ", ")
