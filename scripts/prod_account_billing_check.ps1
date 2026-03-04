param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$BaseUrl = 'https://app.agenteasepro.com/api'
)

$ErrorActionPreference = 'Stop'

$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json

try {
  $login = Invoke-RestMethod -Method Post "$BaseUrl/auth/login" -ContentType 'application/json' -Body $loginBody
} catch {
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Output ("LOGIN_HTTP_ERROR_BODY={0}" -f $body)
  }
  throw
}

if (-not $login.token) { throw 'Missing token from login' }

$headers = @{ Authorization = ('Bearer ' + $login.token) }
$sub = Invoke-RestMethod -Method Get "$BaseUrl/billing/subscription" -Headers $headers
$trialEnd = if ($null -eq $sub.trialEnd) { 'null' } else { [string]$sub.trialEnd }
$invoices = Invoke-RestMethod -Method Get "$BaseUrl/billing/invoices" -Headers $headers
$invoiceCount = if ($null -ne $invoices) { @($invoices).Count } else { 0 }

Write-Output 'LOGIN_OK=1'
Write-Output ('BILLING_STATUS=' + $sub.status)
Write-Output ('ACCESS_BLOCKED=' + [string]$sub.accessBlocked)
Write-Output ('TRIAL_END=' + $trialEnd)
Write-Output ('INVOICE_COUNT=' + $invoiceCount)
