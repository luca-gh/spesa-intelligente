$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $portable = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $portable) { throw 'Installa Node.js 22.12+ oppure aggiungilo al PATH.' }
    $env:Path = "$($portable.FullName);$env:Path"
}
& npm.cmd run dev
exit $LASTEXITCODE
