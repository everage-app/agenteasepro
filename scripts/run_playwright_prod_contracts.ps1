param(
	[Parameter(Mandatory = $true)][string]$Email,
	[Parameter(Mandatory = $true)][string]$Password,
	[string]$BaseUrl = 'https://app.agenteasepro.com'
)

$ErrorActionPreference = 'Stop'
$env:PW_BASE_URL = $BaseUrl
$env:PW_TEST_EMAIL = $Email
$env:PW_TEST_PASSWORD = $Password
npm --prefix web run test -- tests/contracts-templates.spec.ts --project=chromium --reporter=line
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
