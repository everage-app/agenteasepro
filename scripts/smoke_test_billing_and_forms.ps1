$ErrorActionPreference = 'Stop'

$baseUrl = 'http://127.0.0.1:3001'
$email = ('qa+' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '@agentease.com')

$loginBody = @{ email = $email } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post "$baseUrl/api/auth/dev-login" -ContentType 'application/json' -Body $loginBody
if (-not $login.token) { throw 'Missing token from dev-login' }
$headers = @{ Authorization = ('Bearer ' + $login.token) }

Write-Output ("Auth OK: {0}" -f $email)

$sub = Invoke-RestMethod -Method Get "$baseUrl/api/billing/subscription" -Headers $headers
$trialEnd = if ($null -eq $sub.trialEnd) { 'null' } else { [string]$sub.trialEnd }
Write-Output ("Billing: status={0} trialEnd={1} accessBlocked={2}" -f $sub.status, $trialEnd, $sub.accessBlocked)

$pm = Invoke-RestMethod -Method Get "$baseUrl/api/billing/payment-method" -Headers $headers
Write-Output ("Payment method present: {0}" -f [bool]$pm)

$invoices = Invoke-RestMethod -Method Get "$baseUrl/api/billing/invoices" -Headers $headers
$invoiceCount = if ($null -ne $invoices) { @($invoices).Count } else { 0 }
Write-Output ("Invoices count: {0}" -f $invoiceCount)

$defs = Invoke-RestMethod -Method Get "$baseUrl/api/forms/definitions" -Headers $headers
Write-Output ("Form definitions count: {0}" -f @($defs).Count)

$pdfOut = Join-Path $env:TEMP 'repc-smoke.pdf'
Invoke-WebRequest -UseBasicParsing "$baseUrl/api/forms/definitions/REPC/pdf" -Headers $headers -OutFile $pdfOut
$pdfLen = (Get-Item $pdfOut).Length
Write-Output ("REPC PDF bytes: {0}" -f $pdfLen)

$setup = Invoke-RestMethod -Method Post "$baseUrl/api/billing/create-setup-session" -Headers $headers -ContentType 'application/json' -Body '{}'
Write-Output ("Setup session URL present: {0}" -f [bool]$setup.url)

$checkout = Invoke-RestMethod -Method Post "$baseUrl/api/billing/create-checkout-session" -Headers $headers -ContentType 'application/json' -Body '{}'
Write-Output ("Checkout session URL present: {0}" -f [bool]$checkout.url)

$portal = Invoke-RestMethod -Method Post "$baseUrl/api/billing/create-portal-session" -Headers $headers -ContentType 'application/json' -Body '{}'
Write-Output ("Portal session URL present: {0}" -f [bool]$portal.url)

Write-Output 'Billing + forms smoke passed.'
