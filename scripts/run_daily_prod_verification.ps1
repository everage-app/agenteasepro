param(
  [string]$LogDir = 'logs/production-verification',
  [switch]$RunEmailDispatchChecks
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedLogDir = if ([System.IO.Path]::IsPathRooted($LogDir)) {
  $LogDir
} else {
  Join-Path $repoRoot $LogDir
}

if (-not (Test-Path $resolvedLogDir)) {
  New-Item -ItemType Directory -Path $resolvedLogDir | Out-Null
}

$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dayStamp = Get-Date -Format 'yyyy-MM-dd'
$logFile = Join-Path $resolvedLogDir ("prod-verification-$dayStamp.log")

function Invoke-VerificationCheck {
  param(
    [string]$Name,
    [string]$Script,
    [string[]]$Arguments
  )

  $outFile = Join-Path $resolvedLogDir ("$runStamp-" + ($Name -replace '[^a-zA-Z0-9]+', '_') + '.log')
  & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments *> $outFile
  $exitCode = $LASTEXITCODE
  $status = if ($exitCode -eq 0) { 'PASS' } else { 'FAIL' }

  $item = [pscustomobject]@{
    Check = $Name
    Status = $status
    ExitCode = $exitCode
    OutputFile = $outFile
  }

  Add-Content -Path $logFile -Value ("[{0}] {1} (exit={2}) -> {3}" -f $status, $Name, $exitCode, $outFile)
  return $item
}

$testEmail = $env:AEP_TEST_EMAIL
$testPassword = $env:AEP_TEST_PASSWORD
if ([string]::IsNullOrWhiteSpace($testEmail) -or [string]::IsNullOrWhiteSpace($testPassword)) {
  throw 'Set AEP_TEST_EMAIL and AEP_TEST_PASSWORD environment variables before running production verification.'
}

$summary = @()
Add-Content -Path $logFile -Value "`n===== PROD VERIFICATION RUN $runStamp ====="
Add-Content -Path $logFile -Value ("[INFO] Email dispatch checks manualOnly=true runRequested={0}" -f $RunEmailDispatchChecks.IsPresent)

$readonlyScript = Join-Path $repoRoot 'scripts\\prod_readonly_sanity.ps1'
$marketingScript = Join-Path $repoRoot 'scripts\\prod_full_flow_marketing_smoke.ps1'
$esignScript = Join-Path $repoRoot 'scripts\\prod_esign_full_flow_smoke.ps1'

$summary += Invoke-VerificationCheck -Name 'ReadOnly Sanity' -Script $readonlyScript -Arguments @(
  '-Email', $testEmail,
  '-Password', $testPassword
)

$summary += Invoke-VerificationCheck -Name 'Full Flow + Marketing (silent)' -Script $marketingScript -Arguments @(
  '-Email', $testEmail,
  '-Password', $testPassword,
  '-RecipientEmail', $testEmail,
  '-SkipMarketingSend'
)

$summary += Invoke-VerificationCheck -Name 'ESign Full Flow (silent)' -Script $esignScript -Arguments @(
  '-Email', $testEmail,
  '-Password', $testPassword,
  '-BuyerEmail', $testEmail,
  '-SellerEmail', $testEmail,
  '-SuppressEmailDispatch',
  '-SignerCount', '2'
)

if ($RunEmailDispatchChecks.IsPresent) {
  $summary += Invoke-VerificationCheck -Name 'ESign Full Flow (email cadence)' -Script $esignScript -Arguments @(
    '-Email', $testEmail,
    '-Password', $testPassword,
    '-BuyerEmail', $testEmail,
    '-SellerEmail', $testEmail,
    '-SignerCount', '1'
  )
} else {
  $summary += [pscustomobject]@{
    Check = 'Email Dispatch Checks'
    Status = 'PASS'
    ExitCode = 0
    OutputFile = 'skipped (manual-only mode)'
  }
  Add-Content -Path $logFile -Value '[PASS] Email Dispatch Checks skipped (manual-only mode)'
}

$summaryText = $summary | Format-Table -AutoSize | Out-String
Write-Output $summaryText

$hasFail = @($summary | Where-Object { $_.Status -eq 'FAIL' }).Count -gt 0
if ($hasFail) { exit 1 }
exit 0
