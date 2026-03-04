param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$BaseUrl = 'https://app.agenteasepro.com'
)

$ErrorActionPreference = 'Stop'
$env:PW_BASE_URL = $BaseUrl
$env:PW_TEST_EMAIL = $Email
$env:PW_TEST_PASSWORD = $Password
$logPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\\playwright-contracts-ui.log'))

Push-Location 'web'
try {
  if (Test-Path $logPath) { Remove-Item $logPath -Force }
  npx playwright test tests/contracts-templates.spec.ts -g "UI: can open preview modal for each template" --project=chromium --reporter=list *>&1 | Tee-Object -FilePath $logPath
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
