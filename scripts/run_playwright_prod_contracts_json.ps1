param(
	[Parameter(Mandatory = $true)][string]$Email,
	[Parameter(Mandatory = $true)][string]$Password,
	[string]$BaseUrl = 'https://app.agenteasepro.com'
)

$ErrorActionPreference = 'Stop'
$env:PW_BASE_URL = $BaseUrl
$env:PW_TEST_EMAIL = $Email
$env:PW_TEST_PASSWORD = $Password
$reportPath = 'web\\test-results\\contracts-prod-report.json'
if (Test-Path $reportPath) { Remove-Item $reportPath -Force }
Push-Location 'web'
try {
	npx playwright test tests/contracts-templates.spec.ts --project=chromium --reporter=json --output=test-results | Out-File -FilePath '..\\web\\test-results\\contracts-prod-report.json' -Encoding utf8
	if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
	Pop-Location
}
