param(
	[string]$BaseUrl = 'http://127.0.0.1:3001',
	[string]$Email,
	[string]$Password
)

$ErrorActionPreference = 'Stop'

$isLocal = $BaseUrl -match '^https?://(127\.0\.0\.1|localhost)(:\d+)?$'

if ($isLocal) {
	$email = if ($Email) { $Email } else { 'qa+' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '@agentease.com' }
	$loginBody = @{ email = $email } | ConvertTo-Json
	$login = Invoke-RestMethod -Method Post "$BaseUrl/api/auth/dev-login" -ContentType 'application/json' -Body $loginBody
	if (-not $login.token) { throw 'Missing token from dev-login' }
	$headers = @{ Authorization = ('Bearer ' + $login.token) }
	Write-Output ("Auth OK (dev-login): {0}" -f $email)
} else {
	if (-not $Email -or -not $Password) {
		throw 'For non-local BaseUrl, provide -Email and -Password.'
	}
	$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
	$login = Invoke-RestMethod -Method Post "$BaseUrl/api/auth/login" -ContentType 'application/json' -Body $loginBody
	if (-not $login.token) { throw 'Missing token from login' }
	$headers = @{ Authorization = ('Bearer ' + $login.token) }
	Write-Output ("Auth OK (prod login): {0}" -f $Email)
}

$sub = Invoke-RestMethod -Method Get "$BaseUrl/api/billing/subscription" -Headers $headers
$trialEnd = if ($null -eq $sub.trialEnd) { 'null' } else { [string]$sub.trialEnd }
Write-Output ("Billing: status={0} trialEnd={1} accessBlocked={2}" -f $sub.status, $trialEnd, $sub.accessBlocked)

$pm = Invoke-RestMethod -Method Get "$BaseUrl/api/billing/payment-method" -Headers $headers
Write-Output ("Payment method present: {0}" -f [bool]$pm)

$invoices = Invoke-RestMethod -Method Get "$BaseUrl/api/billing/invoices" -Headers $headers
$invoiceCount = if ($null -ne $invoices) { @($invoices).Count } else { 0 }
Write-Output ("Invoices count: {0}" -f $invoiceCount)

$defs = Invoke-RestMethod -Method Get "$BaseUrl/api/forms/definitions" -Headers $headers
Write-Output ("Form definitions count: {0}" -f @($defs).Count)

$pdfOut = Join-Path $env:TEMP 'repc-smoke.pdf'
Invoke-WebRequest -UseBasicParsing "$BaseUrl/api/forms/definitions/REPC/pdf" -Headers $headers -OutFile $pdfOut
$pdfLen = (Get-Item $pdfOut).Length
Write-Output ("REPC PDF bytes: {0}" -f $pdfLen)

try {
	$setup = Invoke-RestMethod -Method Post "$BaseUrl/api/billing/create-setup-session" -Headers $headers -ContentType 'application/json' -Body '{}'
	Write-Output ("Setup session URL present: {0}" -f [bool]$setup.url)
} catch {
	$setupError = $_.ErrorDetails.Message
	if ($setupError -match 'Billing disabled') {
		Write-Output 'Setup session skipped: account billing mode is FREE.'
	} elseif ($isLocal -and $setupError -match 'Stripe not configured') {
		Write-Output 'Setup session skipped: local environment does not have Stripe configured.'
	} else {
		throw
	}
}

try {
	$checkout = Invoke-RestMethod -Method Post "$BaseUrl/api/billing/create-checkout-session" -Headers $headers -ContentType 'application/json' -Body '{}'
	Write-Output ("Checkout session URL present: {0}" -f [bool]$checkout.url)
} catch {
	$checkoutError = $_.ErrorDetails.Message
	if ($checkoutError -match 'Billing disabled') {
		Write-Output 'Checkout session skipped: account billing mode is FREE.'
	} elseif ($isLocal -and $checkoutError -match 'Stripe not configured') {
		Write-Output 'Checkout session skipped: local environment does not have Stripe configured.'
	} else {
		throw
	}
}

try {
	$portal = Invoke-RestMethod -Method Post "$BaseUrl/api/billing/create-portal-session" -Headers $headers -ContentType 'application/json' -Body '{}'
	Write-Output ("Portal session URL present: {0}" -f [bool]$portal.url)
} catch {
	$portalError = $_.ErrorDetails.Message
	if ($portalError -match 'Billing disabled') {
		Write-Output 'Portal session skipped: account billing mode is FREE.'
	} elseif ($isLocal -and $portalError -match 'Stripe not configured') {
		Write-Output 'Portal session skipped: local environment does not have Stripe configured.'
	} else {
		throw
	}
}

Write-Output 'Billing + forms smoke passed.'
