param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$LeadSearch = '@',
  [string]$BaseUrl = 'https://app.agenteasepro.com'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

function Get-Config([string]$key) {
  $v = (heroku config:get $key -a agenteasepro) 2>$null
  return [string]($v | Out-String).Trim()
}

function New-ReplyToken([string]$AgentId, [string]$ContactId, [string]$Secret) {
  $payload = @{ a = $AgentId; t = 'lead'; c = $ContactId; iat = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() } | ConvertTo-Json -Compress
  $payloadB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload)).TrimEnd('=').Replace('+', '-').Replace('/', '_')

  $hmac = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList (,([Text.Encoding]::UTF8.GetBytes($Secret)))
  $sig = [Convert]::ToBase64String($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payloadB64))).TrimEnd('=').Replace('+', '-').Replace('/', '_')

  return "$payloadB64.$sig"
}

$api = "$($BaseUrl.TrimEnd('/'))/api"

Write-Host "==> Login" -ForegroundColor Cyan
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (@{ email = $Email; password = $Password } | ConvertTo-Json)
if (-not $login.token) { throw 'Login failed: missing token' }
$auth = @{ Authorization = "Bearer $($login.token)" }
$agentId = [string]$login.agent.id
if (-not $agentId) { throw 'Could not resolve agent ID from login response' }

Write-Host "==> Load agent + lead" -ForegroundColor Cyan
$leads = Invoke-RestMethod -Method Get -Uri "$api/leads?search=$([uri]::EscapeDataString($LeadSearch))" -Headers $auth
$lead = @($leads | Where-Object { $_.email } | Select-Object -First 1)[0]
if (-not $lead) { throw 'No lead with email found for inbound smoke test' }

$replyDomain = Get-Config 'SENDGRID_INBOUND_REPLY_DOMAIN'
$replySecret = Get-Config 'SENDGRID_REPLY_TOKEN_SECRET'
$inboundSecret = Get-Config 'SENDGRID_INBOUND_PARSE_SECRET'
if (-not $replyDomain -or -not $replySecret -or -not $inboundSecret) {
  throw 'Missing SENDGRID inbound/reply config vars'
}

$token = New-ReplyToken -AgentId $agentId -ContactId $lead.id -Secret $replySecret
$toAddress = "reply+$token@$replyDomain"
$messageId = "inbound-smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@agenteasepro.com"

Write-Host "==> POST inbound webhook" -ForegroundColor Cyan
$client = New-Object System.Net.Http.HttpClient
$req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, "$api/integrations/sendgrid/inbound")
$req.Headers.Add('x-agentease-webhook-secret', $inboundSecret)

$form = New-Object System.Net.Http.MultipartFormDataContent
$form.Add((New-Object System.Net.Http.StringContent($toAddress)), 'to')
$form.Add((New-Object System.Net.Http.StringContent($lead.email)), 'from')
$form.Add((New-Object System.Net.Http.StringContent('Inbound reply smoke test')), 'subject')
$form.Add((New-Object System.Net.Http.StringContent('Hi agent, this is an inbound reply smoke test from production.')), 'text')
$form.Add((New-Object System.Net.Http.StringContent("Message-ID: <$messageId>`nFrom: $($lead.email)`nTo: $toAddress")), 'headers')
$req.Content = $form

$resp = $client.SendAsync($req).Result
$respBody = $resp.Content.ReadAsStringAsync().Result
Write-Host "Inbound status: $($resp.StatusCode)"
Write-Host "Inbound body: $respBody"

Start-Sleep -Seconds 2

Write-Host "==> Verify contact history includes reply" -ForegroundColor Cyan
$history = Invoke-RestMethod -Method Get -Uri "$api/contact-email/history?contactType=lead&contactId=$($lead.id)" -Headers $auth
$reply = @($history.items | Where-Object { $_.kind -eq 'reply' } | Select-Object -First 1)[0]

Write-Host "`nInbound Reply Smoke Result" -ForegroundColor Green
Write-Host "lead        : $($lead.firstName) $($lead.lastName) <$($lead.email)>"
Write-Host "replyFound  : $([bool]$reply)"
if ($reply) {
  Write-Host "replyAt     : $($reply.at)"
  Write-Host "subject     : $($reply.subject)"
  Write-Host "fromEmail   : $($reply.fromEmail)"
  Write-Host "snippet     : $($reply.snippet)"
}
