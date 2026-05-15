param(
  [string]$BaseUrl = 'https://app.agenteasepro.com/api',
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password
)

$ErrorActionPreference = 'Stop'

$result = @()

$loginBody = @{
  email = $Email
  password = $Password
} | ConvertTo-Json

try {
  $login = Invoke-RestMethod -Method Post "$BaseUrl/auth/login" -ContentType 'application/json' -Body $loginBody -TimeoutSec 45
  if (-not $login.token) { throw 'Login returned no token' }
  $headers = @{ Authorization = ('Bearer ' + $login.token) }
  $result += [pscustomobject]@{ Check = 'auth.login'; Status = 'PASS'; Detail = $Email }
} catch {
  $detail = $_.Exception.Message
  if ($_.Exception.Response) {
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
      if (-not [string]::IsNullOrWhiteSpace($body)) { $detail = $body }
    } catch {
      # ignore
    }
  }
  $result += [pscustomobject]@{ Check = 'auth.login'; Status = 'FAIL'; Detail = $detail }
  $result | Format-Table -AutoSize | Out-String
  exit 1
}

$checks = @(
  @{ Name = 'agents.me'; Url = "$BaseUrl/agents/me" },
  @{ Name = 'tasks.list'; Url = "$BaseUrl/tasks" },
  @{ Name = 'clients.list'; Url = "$BaseUrl/clients" },
  @{ Name = 'deals.list'; Url = "$BaseUrl/deals" },
  @{ Name = 'forms.definitions'; Url = "$BaseUrl/forms/definitions" },
  @{ Name = 'billing.subscription'; Url = "$BaseUrl/billing/subscription" }
)

$dealsData = $null
foreach ($c in $checks) {
  try {
    $data = Invoke-RestMethod -Method Get $c.Url -Headers $headers -TimeoutSec 45
    if ($c.Name -eq 'deals.list') { $dealsData = $data }
    $count = if ($data -is [System.Array]) { $data.Count } elseif ($null -eq $data) { 0 } else { 1 }
    $result += [pscustomobject]@{ Check = $c.Name; Status = 'PASS'; Detail = ("ok count=" + $count) }
  } catch {
    $detail = $_.Exception.Message
    if ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        if (-not [string]::IsNullOrWhiteSpace($body)) { $detail = $body }
      } catch {
        # ignore
      }
    }
    $result += [pscustomobject]@{ Check = $c.Name; Status = 'FAIL'; Detail = $detail }
  }
}

if ($dealsData -is [System.Array] -and $dealsData.Count -gt 0) {
  $dealId = $dealsData[0].id
  try {
    $forms = Invoke-RestMethod -Method Get "$BaseUrl/forms/deals/$dealId/forms" -Headers $headers -TimeoutSec 45
    $count = if ($forms -is [System.Array]) { $forms.Count } elseif ($null -eq $forms) { 0 } else { 1 }
    $result += [pscustomobject]@{ Check = 'forms.byDeal'; Status = 'PASS'; Detail = ("deal=" + $dealId + " count=" + $count) }
  } catch {
    $detail = $_.Exception.Message
    if ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        if (-not [string]::IsNullOrWhiteSpace($body)) { $detail = $body }
      } catch {
        # ignore
      }
    }
    $result += [pscustomobject]@{ Check = 'forms.byDeal'; Status = 'FAIL'; Detail = $detail }
  }
} else {
  $result += [pscustomobject]@{ Check = 'forms.byDeal'; Status = 'SKIP'; Detail = 'no deals available for account' }
}

$result | Format-Table -AutoSize | Out-String
