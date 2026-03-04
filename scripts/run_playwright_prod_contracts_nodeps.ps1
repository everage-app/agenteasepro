$ErrorActionPreference = 'Stop'
$env:PW_BASE_URL = 'https://app.agenteasepro.com'
$logPath = '..\\playwright-contracts-prod-nodeps.log'
Push-Location 'web'
try {
  if (Test-Path $logPath) { Remove-Item $logPath -Force }
  npx playwright test tests/contracts-templates.spec.ts --project=chromium --no-deps --reporter=line *>&1 | Tee-Object -FilePath $logPath
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
