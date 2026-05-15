param(
  [string]$BaseUrl = 'https://app.agenteasepro.com',
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][string]$Password
)

$ErrorActionPreference = 'Stop'

Write-Output '[1/4] Running readonly sanity checks...'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\prod_readonly_sanity.ps1 -BaseUrl ($BaseUrl + '/api') -Email $Email -Password $Password
if ($LASTEXITCODE -ne 0) { throw 'prod_readonly_sanity.ps1 failed.' }

Write-Output '[2/4] Running billing + forms smoke...'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke_test_billing_and_forms.ps1 -BaseUrl $BaseUrl -Email $Email -Password $Password
if ($LASTEXITCODE -ne 0) { throw 'smoke_test_billing_and_forms.ps1 failed.' }

Write-Output '[3/4] Running Playwright setup...'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_playwright_prod_setup.ps1 -Email $Email -Password $Password -BaseUrl $BaseUrl
if ($LASTEXITCODE -ne 0) { throw 'run_playwright_prod_setup.ps1 failed.' }

Write-Output '[4/4] Running contracts UI smoke...'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_playwright_prod_contracts_ui.ps1 -Email $Email -Password $Password
if ($LASTEXITCODE -ne 0) { throw 'run_playwright_prod_contracts_ui.ps1 failed.' }

Write-Output 'Safe production verification flow completed.'
