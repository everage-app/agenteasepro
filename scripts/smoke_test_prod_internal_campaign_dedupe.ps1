param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$RecipientEmail = '',
  [string]$BaseUrl = 'https://app.agenteasepro.com/api'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RecipientEmail)) {
  $RecipientEmail = $Email
}

function Write-Kv([string]$k, [object]$v) {
  Write-Output ("{0}={1}" -f $k, [string]$v)
}

function Invoke-JsonPost {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][hashtable]$Headers,
    [Parameter(Mandatory = $true)][object]$BodyObj
  )

  $body = $BodyObj | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Method Post $Url -Headers $Headers -ContentType 'application/json' -Body $body
}

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

Write-Kv 'STEP' 'LOGIN'
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post "$BaseUrl/auth/login" -ContentType 'application/json' -Body $loginBody
if (-not $login.token) { throw 'Missing token from login response' }
Write-Kv 'LOGIN_OK' 1

$headers = @{ Authorization = ('Bearer ' + $login.token) }

$payload = @{
  campaignName = "Prod Verify Dedup $stamp"
  subject = "AEP Dedup Verify $stamp"
  htmlTemplate = "<html><body><h2>Dedup Verification $stamp</h2><p>If this sends twice, dedupe failed.</p></body></html>"
  recipientsRaw = $RecipientEmail
  fromName = 'AgentEasePro Sales'
  replyTo = 'sales@agenteasepro.com'
  batchSize = 25
  throttleMs = 0
  dryRun = $false
  utmCampaign = "prod-dedup-$stamp"
}

Write-Kv 'STEP' 'PREVIEW'
try {
  $preview = Invoke-JsonPost -Url "$BaseUrl/internal/campaigns/preview" -Headers $headers -BodyObj $payload
  Write-Kv 'PREVIEW_OK' 1
  Write-Kv 'PREVIEW_TOTAL_PARSED' $preview.totalParsed
  Write-Kv 'PREVIEW_DELIVERABLE' $preview.deliverableCount
  Write-Kv 'PREVIEW_SUPPRESSED' $preview.suppressedCount
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 403) {
    Write-Kv 'OWNER_FORBIDDEN' 1
    Write-Output 'RESULT=FAIL_NOT_OWNER'
    exit 3
  }
  throw
}

Write-Kv 'STEP' 'SEND_FIRST'
$send1 = Invoke-JsonPost -Url "$BaseUrl/internal/campaigns/send" -Headers $headers -BodyObj $payload
if (-not $send1.campaignId) { throw 'First send did not return campaignId' }
$campaignId = [string]$send1.campaignId
Write-Kv 'SEND1_CAMPAIGN_ID' $campaignId
Write-Kv 'SEND1_QUEUED' $send1.queued

Write-Kv 'STEP' 'SEND_SECOND_IDENTICAL'
$send2 = Invoke-JsonPost -Url "$BaseUrl/internal/campaigns/send" -Headers $headers -BodyObj $payload
Write-Kv 'SEND2_CAMPAIGN_ID' $send2.campaignId
Write-Kv 'SEND2_DEDUP' $send2.deduplicated
Write-Kv 'SEND2_QUEUED' $send2.queued

if ([string]$send2.campaignId -ne $campaignId) {
  Write-Output 'RESULT=FAIL_DEDUP_CAMPAIGN_MISMATCH'
  exit 4
}
if (-not $send2.deduplicated) {
  Write-Output 'RESULT=FAIL_DEDUP_FLAG_FALSE'
  exit 5
}

Write-Kv 'STEP' 'POLL_STATUS'
$completed = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 2
  $status = Invoke-RestMethod -Method Get "$BaseUrl/internal/campaigns/$campaignId/status" -Headers $headers
  $runtimeStatus = if ($status.runtime) { [string]$status.runtime.status } else { 'null' }
  $sent = if ($status.aggregate) { [int]$status.aggregate.sentRecipients } else { 0 }
  $failed = if ($status.aggregate) { [int]$status.aggregate.failedRecipients } else { 0 }
  Write-Kv ("POLL_{0}" -f $i) ("runtime:{0};blast:{1};sent:{2};failed:{3}" -f $runtimeStatus, $status.blastStatus, $sent, $failed)
  if ($runtimeStatus -eq 'completed' -or $runtimeStatus -eq 'failed') {
    $completed = $true
    break
  }
}

if (-not $completed) {
  Write-Output 'RESULT=WARN_TIMEOUT_WAITING_STATUS'
  exit 6
}

Write-Output 'RESULT=PASS_DEDUP_VERIFIED'
exit 0
