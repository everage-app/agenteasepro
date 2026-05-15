param(
  [string]$BaseUrl = 'https://app.agenteasepro.com/api',
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$BuyerEmail = '',
  [string]$SellerEmail = '',
  [switch]$SuppressEmailDispatch,
  [switch]$SendReminder,
  [ValidateSet(1,2)][int]$SignerCount = 2
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
      # ignore
    }
  }
  return $detail
}

$results = @()
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
if ([string]::IsNullOrWhiteSpace($BuyerEmail)) {
  $BuyerEmail = $Email
}
if ([string]::IsNullOrWhiteSpace($SellerEmail)) {
  $SellerEmail = $Email
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

  $dealBody = @{
    title = "Prod ESign Deal $stamp"
    property = @{
      street = '456 Signature Loop'
      city = 'Salt Lake City'
      county = 'Salt Lake'
      state = 'UT'
      zip = '84101'
    }
    buyer = @{
      role = 'BUYER'
      firstName = 'Buyer'
      lastName = 'Smoke'
      email = $BuyerEmail
      phone = '3855550101'
    }
    seller = @{
      role = 'SELLER'
      firstName = 'Seller'
      lastName = 'Smoke'
      email = $SellerEmail
      phone = '3855550102'
    }
    offerReferenceDate = (Get-Date).ToString('o')
    status = 'ACTIVE'
  } | ConvertTo-Json -Depth 8

  $deal = Invoke-RestMethod -Method Post "$BaseUrl/deals" -Headers $headers -ContentType 'application/json' -Body $dealBody -TimeoutSec 60
  if (-not $deal.id) { throw 'Failed to create deal for e-sign flow' }
  $dealId = [string]$deal.id
  Add-Result -Check 'deals.create' -Status 'PASS' -Detail ("dealId=" + $dealId)

  $addendumBody = @{
    dealId = $dealId
    type = 'ADDENDUM'
    title = "Smoke Addendum $stamp"
    body = 'Temporary production e-sign smoke addendum content.'
    offerReferenceDate = (Get-Date).ToString('o')
    buyerLabel = 'Buyer Smoke'
    sellerLabel = 'Seller Smoke'
    propertySummary = '456 Signature Loop, Salt Lake City, UT 84101'
  } | ConvertTo-Json -Depth 8

  $addendum = Invoke-RestMethod -Method Post "$BaseUrl/addendums" -Headers $headers -ContentType 'application/json' -Body $addendumBody -TimeoutSec 60
  Add-Result -Check 'addendum.create' -Status 'PASS' -Detail ("addendumId=" + [string]$addendum.id)

  $signers = @(
    @{ role = 'BUYER'; name = 'Buyer Smoke'; email = $BuyerEmail }
  )
  if ($SignerCount -eq 2) {
    $signers += @{ role = 'SELLER'; name = 'Seller Smoke'; email = $SellerEmail }
  }

  $envelopeBody = @{
    dealId = $dealId
    type = 'ADDENDUM'
    signers = $signers
    subject = "Prod ESign Smoke $stamp"
    message = 'Production smoke test signature packet.'
    sendEmails = (-not $SuppressEmailDispatch.IsPresent)
  } | ConvertTo-Json -Depth 8

  $createEnvelope = Invoke-RestMethod -Method Post "$BaseUrl/esign/envelopes" -Headers $headers -ContentType 'application/json' -Body $envelopeBody -TimeoutSec 90
  $envelope = $createEnvelope.envelope
  if (-not $envelope.id) { throw 'Envelope creation failed' }
  $envelopeId = [string]$envelope.id
  Add-Result -Check 'esign.envelope.create' -Status 'PASS' -Detail ("envelopeId=" + $envelopeId)

  $emailDispatchMode = if ($SuppressEmailDispatch.IsPresent) { 'suppressed' } else { 'enabled' }
  $sentCount = if ($createEnvelope.emailStatus) { [string]$createEnvelope.emailStatus.sent } else { '0' }
  $failedCount = if ($createEnvelope.emailStatus) { [string]$createEnvelope.emailStatus.failed } else { '0' }
  Add-Result -Check 'esign.email.dispatch' -Status 'PASS' -Detail ("mode=" + $emailDispatchMode + '; sent=' + $sentCount + '; failed=' + $failedCount)

  if ($SendReminder.IsPresent) {
    $reminder = Invoke-RestMethod -Method Post "$BaseUrl/esign/envelopes/$envelopeId/remind" -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 60
    Add-Result -Check 'esign.reminder' -Status 'PASS' -Detail ("reminded=" + [string]$reminder.reminded)
  } else {
    Add-Result -Check 'esign.reminder' -Status 'PASS' -Detail 'skipped'
  }

  $orderedSigners = @($envelope.signers)
  if ($orderedSigners.Count -eq 0) { throw 'Envelope has no signers' }

  $firstSignerId = [string]$orderedSigners[0].id
  $firstLink = $createEnvelope.links | Where-Object { $_.signerId -eq $firstSignerId } | Select-Object -First 1
  if (-not $firstLink) { throw 'Missing signer link for first signer' }

  $firstParts = ([string]$firstLink.url).TrimEnd('/') -split '/'
  $firstToken = $firstParts[-1]
  $firstSignerIdFromLink = [string]$firstLink.signerId

  $publicEnvelope = Invoke-RestMethod -Method Get "$BaseUrl/esign-public/envelopes/$envelopeId/$firstSignerIdFromLink/$firstToken" -TimeoutSec 45
  Add-Result -Check 'esign.public.envelope' -Status 'PASS' -Detail ("signer=" + [string]$publicEnvelope.signer.id)

  $packetPdfPath = Join-Path $env:TEMP ("esign-packet-$stamp.pdf")
  Invoke-WebRequest -UseBasicParsing "$BaseUrl/esign-public/envelopes/$envelopeId/$firstSignerIdFromLink/$firstToken/pdf" -OutFile $packetPdfPath -TimeoutSec 60
  $packetPdfBytes = (Get-Item $packetPdfPath).Length
  Add-Result -Check 'esign.public.packet.pdf' -Status 'PASS' -Detail ("bytes=" + [string]$packetPdfBytes)

  for ($i = 0; $i -lt $orderedSigners.Count; $i++) {
    $signer = $orderedSigners[$i]
    $link = $createEnvelope.links | Where-Object { $_.signerId -eq $signer.id } | Select-Object -First 1
    if (-not $link) { throw ("Missing signer link for signerId=" + [string]$signer.id) }

    $parts = ([string]$link.url).TrimEnd('/') -split '/'
    $token = $parts[-1]
    $signerName = if ([string]::IsNullOrWhiteSpace([string]$signer.name)) { 'Signer Smoke' } else { [string]$signer.name }
    $initials = if ($signerName.Length -ge 2) { $signerName.Substring(0, 2).ToUpper() } else { 'SG' }

    $signBody = @{
      name = $signerName
      signatureType = 'TYPED'
      signatureData = @{ typedSignature = $signerName; initials = $initials; rulesAcknowledged = $true }
      acceptedEsignRules = $true
      completedFields = @()
    } | ConvertTo-Json -Depth 8

    $signResponse = Invoke-RestMethod -Method Post "$BaseUrl/esign-public/sign/$envelopeId/$($signer.id)/$token" -ContentType 'application/json' -Body $signBody -TimeoutSec 60
    $checkName = 'esign.public.sign.' + ([string]$signer.role).ToLower()
    $detail = if ($signResponse.envelopeCompletedAt) { 'completedAt=' + [string]$signResponse.envelopeCompletedAt } else { 'signed' }
    Add-Result -Check $checkName -Status 'PASS' -Detail $detail
  }

  $allEnvelopes = Invoke-RestMethod -Method Get "$BaseUrl/esign/envelopes" -Headers $headers -TimeoutSec 60
  $targetEnvelope = $allEnvelopes | Where-Object { $_.id -eq $envelopeId } | Select-Object -First 1
  if (-not $targetEnvelope) { throw 'Envelope not found in /esign/envelopes list' }
  $signedCount = @($targetEnvelope.signers | Where-Object { $_.signedAt }).Count
  if ($signedCount -lt $orderedSigners.Count) { throw 'Envelope not fully signed after sign operations' }
  Add-Result -Check 'esign.envelope.completed' -Status 'PASS' -Detail ("signedCount=" + [string]$signedCount)

  $finalPdfPath = Join-Path $env:TEMP ("esign-final-$stamp.pdf")
  Invoke-WebRequest -UseBasicParsing "$BaseUrl/esign/envelopes/$envelopeId/pdf?download=1" -Headers $headers -OutFile $finalPdfPath -TimeoutSec 60
  $finalPdfBytes = (Get-Item $finalPdfPath).Length
  Add-Result -Check 'esign.final.pdf' -Status 'PASS' -Detail ("bytes=" + [string]$finalPdfBytes)
}
catch {
  Add-Result -Check 'esign.flow.runtime' -Status 'FAIL' -Detail (Read-ErrorBody -ErrorRecord $_)
}
finally {
  $results | Format-Table -AutoSize | Out-String
  $hasFail = @($results | Where-Object { $_.Status -eq 'FAIL' }).Count -gt 0
  if ($hasFail) { exit 1 }
  exit 0
}
