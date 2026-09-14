# Windows PowerShell 2+; this script changes no machine-wide setting.
$ErrorActionPreference = 'Stop'
try {
    $tools = Split-Path -Parent $MyInvocation.MyCommand.Path
    $root = Split-Path -Parent $tools
    Add-Type -Path (Join-Path $tools 'LocalGameServer.cs')
    [RailEmpireLocalServer]::Run($root, 8765, $true)
} catch {
    Write-Host ('Lancement impossible : ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Extraire tout le ZIP. Fermer un ancien lanceur utilisant le port 8765.'
    exit 1
}
