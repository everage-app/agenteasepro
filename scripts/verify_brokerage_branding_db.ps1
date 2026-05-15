param(
  [string]$App = 'agenteasepro',
  [switch]$FixDefaults,
  [switch]$SyncAgentBrokerageName,
  [switch]$Local
)

$ErrorActionPreference = 'Stop'

$argsList = @('scripts/verify_brokerage_branding_db.js')
if ($FixDefaults.IsPresent) { $argsList += '--fix-defaults' }
if ($SyncAgentBrokerageName.IsPresent) { $argsList += '--sync-agent-brokerage-name' }

if ($Local.IsPresent) {
  node @argsList
  exit $LASTEXITCODE
}

$remoteCommand = 'node ' + ($argsList -join ' ')
Write-Output ("Running brokerage branding DB verification on Heroku app '{0}'..." -f $App)
heroku run --app $App $remoteCommand
exit $LASTEXITCODE