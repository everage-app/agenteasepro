param(
  [string]$BaseUrl = 'https://app.agenteasepro.com/api',
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$RecipientEmail = '',
  [switch]$SkipMarketingSend
)

$ErrorActionPreference = 'Stop'

function Add-Result {
  param(
    [string]$Check,
    [string]$Status,
    [string]$Detail
  )
  $script:results += [pscustomobject]@{
    Check = $Check
    Status = $Status
    Detail = $Detail
  }
}

function Read-ErrorBody {
  param($ErrorRecord)
  $detail = $ErrorRecord.Exception.Message
  if ($ErrorRecord.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($ErrorRecord.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
      if (-not [string]::IsNullOrWhiteSpace($body)) {
        $detail = $body
      }
    } catch {
      # ignore read failures
    }
  }
  return $detail
}

$results = @()
$createdTaskId = $null
$createdClientId = $null
$createdDealId = $null
$createdBlastId = $null

$stamp = Get-Date -Format 'yyyyMMddHHmmss'
if ([string]::IsNullOrWhiteSpace($RecipientEmail)) {
  $RecipientEmail = $Email
}

try {
  $loginBody = @{
    email = $Email
    password = $Password
  } | ConvertTo-Json

  $login = Invoke-RestMethod -Method Post "$BaseUrl/auth/login" -ContentType 'application/json' -Body $loginBody -TimeoutSec 60
  if (-not $login.token) { throw 'Missing token from login response' }
  $headers = @{ Authorization = ('Bearer ' + $login.token) }
  Add-Result -Check 'auth.login' -Status 'PASS' -Detail $Email

  $me = Invoke-RestMethod -Method Get "$BaseUrl/agents/me" -Headers $headers -TimeoutSec 30
  Add-Result -Check 'agents.me' -Status 'PASS' -Detail ("agent=" + [string]$me.id)

  $clientBody = @{
    firstName = 'Prod'
    lastName = 'FlowSmoke'
    email = "client+$stamp@gmail.com"
    role = 'BUYER'
    stage = 'ACTIVE'
    notes = 'Temporary production smoke client'
  } | ConvertTo-Json
  $client = Invoke-RestMethod -Method Post "$BaseUrl/clients" -Headers $headers -ContentType 'application/json' -Body $clientBody -TimeoutSec 45
  $createdClientId = [string]$client.id
  Add-Result -Check 'clients.create' -Status 'PASS' -Detail ("clientId=" + $createdClientId)

  $taskBody = @{
    title = 'Prod full flow smoke task'
    category = 'CALL'
    priority = 'NORMAL'
    bucket = 'TODAY'
    clientId = $createdClientId
  } | ConvertTo-Json
  $task = Invoke-RestMethod -Method Post "$BaseUrl/tasks" -Headers $headers -ContentType 'application/json' -Body $taskBody -TimeoutSec 45
  $createdTaskId = [string]$task.id
  Add-Result -Check 'tasks.create' -Status 'PASS' -Detail ("taskId=" + $createdTaskId)

  Invoke-RestMethod -Method Patch "$BaseUrl/tasks/$createdTaskId" -Headers $headers -ContentType 'application/json' -Body '{"status":"DONE"}' -TimeoutSec 45 | Out-Null
  Add-Result -Check 'tasks.update' -Status 'PASS' -Detail 'status DONE'

  $dealBodyObj = @{
    title = "Prod Smoke Deal $stamp"
    property = @{
      street = '123 Smoke Test Ave'
      city = 'Salt Lake City'
      county = 'Salt Lake'
      state = 'UT'
      zip = '84101'
    }
    offerReferenceDate = (Get-Date).ToString('o')
    status = 'ACTIVE'
  }
  $dealBody = $dealBodyObj | ConvertTo-Json -Depth 8
  $deal = Invoke-RestMethod -Method Post "$BaseUrl/deals" -Headers $headers -ContentType 'application/json' -Body $dealBody -TimeoutSec 60
  $createdDealId = [string]$deal.id
  Add-Result -Check 'deals.create' -Status 'PASS' -Detail ("dealId=" + $createdDealId)

  $formBody = @{ formCode = 'REPC' } | ConvertTo-Json
  $form = Invoke-RestMethod -Method Post "$BaseUrl/forms/deals/$createdDealId/forms" -Headers $headers -ContentType 'application/json' -Body $formBody -TimeoutSec 60
  Add-Result -Check 'forms.create' -Status 'PASS' -Detail ("formId=" + [string]$form.id)

  $dealForms = Invoke-RestMethod -Method Get "$BaseUrl/forms/deals/$createdDealId/forms" -Headers $headers -TimeoutSec 45
  $formCount = if ($dealForms -is [System.Array]) { $dealForms.Count } elseif ($null -eq $dealForms) { 0 } else { 1 }
  Add-Result -Check 'forms.byDeal' -Status 'PASS' -Detail ("count=" + [string]$formCount)

  $previewBody = @{
    audienceType = 'CLIENTS_AND_LEADS'
    limit = 1
    recipientEmails = @($RecipientEmail)
  } | ConvertTo-Json -Depth 6
  $preview = Invoke-RestMethod -Method Post "$BaseUrl/marketing/email/preview" -Headers $headers -ContentType 'application/json' -Body $previewBody -TimeoutSec 60
  Add-Result -Check 'marketing.preview' -Status 'PASS' -Detail ("recipients=" + [string]$preview.recipientsCount)

  if ($SkipMarketingSend.IsPresent) {
    Add-Result -Check 'marketing.send' -Status 'PASS' -Detail 'skipped'
    Add-Result -Check 'marketing.blast.get' -Status 'PASS' -Detail 'skipped'
    Add-Result -Check 'marketing.deliveries' -Status 'PASS' -Detail 'skipped'
  } else {
    $sendBody = @{
      audienceType = 'CLIENTS_AND_LEADS'
      subject = "Prod Marketing Smoke $stamp"
      message = 'This is an automated production smoke test message.'
      limit = 1
      recipientEmails = @($RecipientEmail)
    } | ConvertTo-Json -Depth 6
    $send = Invoke-RestMethod -Method Post "$BaseUrl/marketing/email/send" -Headers $headers -ContentType 'application/json' -Body $sendBody -TimeoutSec 90
    $createdBlastId = [string]$send.blastId
    Add-Result -Check 'marketing.send' -Status 'PASS' -Detail ("blastId=" + $createdBlastId + '; recipients=' + [string]$send.recipientsCount)

    $blast = Invoke-RestMethod -Method Get "$BaseUrl/marketing/blasts/$createdBlastId" -Headers $headers -TimeoutSec 45
    Add-Result -Check 'marketing.blast.get' -Status 'PASS' -Detail ("status=" + [string]$blast.status)

    $deliveries = Invoke-RestMethod -Method Get "$BaseUrl/marketing/blasts/$createdBlastId/deliveries" -Headers $headers -TimeoutSec 45
    $deliveryCount = if ($deliveries -is [System.Array]) { $deliveries.Count } elseif ($null -eq $deliveries) { 0 } else { 1 }
    Add-Result -Check 'marketing.deliveries' -Status 'PASS' -Detail ("count=" + [string]$deliveryCount)
  }
}
catch {
  Add-Result -Check 'flow.runtime' -Status 'FAIL' -Detail (Read-ErrorBody -ErrorRecord $_)
}
finally {
  if ($createdTaskId) {
    try {
      Invoke-RestMethod -Method Delete "$BaseUrl/tasks/$createdTaskId" -Headers $headers -TimeoutSec 30 | Out-Null
      Add-Result -Check 'cleanup.task.delete' -Status 'PASS' -Detail $createdTaskId
    } catch {
      Add-Result -Check 'cleanup.task.delete' -Status 'WARN' -Detail (Read-ErrorBody -ErrorRecord $_)
    }
  }

  if ($createdDealId) {
    try {
      Invoke-RestMethod -Method Patch "$BaseUrl/deals/$createdDealId/archive" -Headers $headers -ContentType 'application/json' -Body '{"reason":"Temporary production smoke test archive"}' -TimeoutSec 45 | Out-Null
      Add-Result -Check 'cleanup.deal.archive' -Status 'PASS' -Detail $createdDealId
    } catch {
      Add-Result -Check 'cleanup.deal.archive' -Status 'WARN' -Detail (Read-ErrorBody -ErrorRecord $_)
    }
  }

  if ($createdClientId) {
    try {
      Invoke-RestMethod -Method Delete "$BaseUrl/clients/$createdClientId" -Headers $headers -TimeoutSec 30 | Out-Null
      Add-Result -Check 'cleanup.client.delete' -Status 'PASS' -Detail $createdClientId
    } catch {
      Add-Result -Check 'cleanup.client.delete' -Status 'WARN' -Detail (Read-ErrorBody -ErrorRecord $_)
    }
  }

  $results | Format-Table -AutoSize | Out-String

  $hasFail = @($results | Where-Object { $_.Status -eq 'FAIL' }).Count -gt 0
  if ($hasFail) { exit 1 }
  exit 0
}
