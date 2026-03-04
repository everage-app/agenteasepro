param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [Parameter(Mandatory = $true)]
  [string]$LeadSearch,

  [string]$BaseUrl = 'https://app.agenteasepro.com',
  [switch]$CcAgent = $true
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

$apiBase = "$BaseUrl/api"

Write-Step "Logging in as $Email"
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/login" -ContentType 'application/json' -Body $loginBody
if (-not $login.token) {
  throw 'Login succeeded but no token was returned.'
}

$headers = @{ Authorization = "Bearer $($login.token)" }

Write-Step "Searching leads for '$LeadSearch'"
$encodedSearch = [uri]::EscapeDataString($LeadSearch)
$leadResults = Invoke-RestMethod -Method Get -Uri "$apiBase/leads?search=$encodedSearch" -Headers $headers

$lead = $leadResults | Where-Object { $_.email } | Select-Object -First 1
if (-not $lead) {
  throw "No lead with an email was found for search term '$LeadSearch'."
}

Write-Host "Lead selected: $($lead.firstName) $($lead.lastName) <$($lead.email)>" -ForegroundColor Yellow

$subject = "Contact email smoke test $(Get-Date -Format s)"
$body = "This is a production smoke test for /api/contact-email/send and /api/contact-email/history."

$sendPayload = @{
  contactType = 'lead'
  contactId   = $lead.id
  subject     = $subject
  body        = $body
  ccAgent     = [bool]$CcAgent
} | ConvertTo-Json

Write-Step 'Sending contact email'
try {
  $send = Invoke-RestMethod -Method Post -Uri "$apiBase/contact-email/send" -Headers $headers -ContentType 'application/json' -Body $sendPayload
} catch {
  $message = $_.ErrorDetails.Message
  if ($message -and $message -match 'Cannot POST /api/contact-email/send') {
    throw 'Endpoint /api/contact-email/send is not deployed on production yet.'
  }
  throw
}

Start-Sleep -Seconds 3

Write-Step 'Fetching contact email history'
$history = Invoke-RestMethod -Method Get -Uri "$apiBase/contact-email/history?contactType=lead&contactId=$($lead.id)" -Headers $headers

$top = @($history.items | Select-Object -First 5)

Write-Host "`nSmoke Result" -ForegroundColor Green
Write-Host "send.ok      : $($send.ok)"
Write-Host "messageId    : $($send.messageId)"
Write-Host "sentAt       : $($send.sentAt)"
Write-Host "historyCount : $(@($history.items).Count)"

if ($top.Count -gt 0) {
  Write-Host "Top history items:" -ForegroundColor Green
  foreach ($item in $top) {
    Write-Host " - $($item.kind) | $($item.eventType) | $($item.source) | $($item.at)"
  }
}
