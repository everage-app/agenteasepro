$ErrorActionPreference = 'Stop'

$baseUrl = 'http://127.0.0.1:3001'
$email = 'demo@agentease.com'
$formCode = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { 'REPC' }
$out = Join-Path $env:TEMP ("$formCode.pdf")

$loginBody = @{ email = $email } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post "$baseUrl/api/auth/dev-login" -ContentType 'application/json' -Body $loginBody
$token = $login.token
if (-not $token) { throw 'Missing token from dev-login' }

Invoke-WebRequest -UseBasicParsing "$baseUrl/api/forms/definitions/$formCode/pdf" -Headers @{ Authorization = "Bearer $token" } -OutFile $out
$len = (Get-Item $out).Length
Write-Output "Downloaded to $out ($len bytes)"
