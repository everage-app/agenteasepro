param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$BaseUrl = 'https://app.agenteasepro.com'
)

$ErrorActionPreference = 'Stop'
$env:PW_BASE_URL = $BaseUrl
$env:PW_TEST_EMAIL = $Email
$env:PW_TEST_PASSWORD = $Password

$reportPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\playwright-prod-all-browsers.json'))

Push-Location 'web'
try {
  if (Test-Path $reportPath) { Remove-Item $reportPath -Force }
  npx playwright test tests/contracts-templates.spec.ts tests/repc.spec.ts tests/esign.spec.ts --reporter=json *> $reportPath
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

if (-not (Test-Path $reportPath)) {
  throw "Playwright report file not created: $reportPath"
}

$jsonRaw = Get-Content $reportPath -Raw
$report = $jsonRaw | ConvertFrom-Json
$stats = $report.stats

Write-Output ("PW_EXPECTED={0}" -f $stats.expected)
Write-Output ("PW_UNEXPECTED={0}" -f $stats.unexpected)
Write-Output ("PW_FLAKY={0}" -f $stats.flaky)
Write-Output ("PW_SKIPPED={0}" -f $stats.skipped)
Write-Output ("PW_DIDNOTRUN={0}" -f $stats.didNotRun)

exit $exitCode
