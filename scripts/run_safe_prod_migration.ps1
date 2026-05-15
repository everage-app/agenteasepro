param(
  [string]$App = 'agenteasepro'
)

$ErrorActionPreference = 'Stop'

Write-Output "[1/4] Capturing Heroku Postgres backup for $App..."
heroku pg:backups:capture --app $App
if ($LASTEXITCODE -ne 0) { throw 'Backup capture failed.' }

Write-Output "[2/4] Waiting 5 seconds to ensure backup registration..."
Start-Sleep -Seconds 5

Write-Output "[3/4] Applying Prisma migrations via release dyno..."
heroku run --app $App "cd server; npx prisma migrate deploy"
if ($LASTEXITCODE -ne 0) { throw 'Prisma migrate deploy failed.' }

Write-Output "[4/4] Recent releases for verification:"
heroku releases --app $App --num 5

Write-Output 'Safe production migration flow completed.'
