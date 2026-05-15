param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$Email = "demo@agentease.com"
)

$ErrorActionPreference = "Stop"

$body = @{ email = $Email } | ConvertTo-Json
$resp = Invoke-WebRequest -UseBasicParsing -Method Post ("$BaseUrl/api/auth/dev-login") -ContentType "application/json" -Body $body

Write-Output ("status={0}" -f $resp.StatusCode)

$content = $resp.Content
if ($null -ne $content -and $content.Length -gt 400) {
  $content = $content.Substring(0, 400)
}
Write-Output $content
