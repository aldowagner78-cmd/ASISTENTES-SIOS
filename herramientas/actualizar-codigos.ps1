# Regenera src/plantillas/codigos-elementos.js desde codigos-elementos.csv.
# Uso: powershell -ExecutionPolicy Bypass -File .\herramientas\actualizar-codigos.ps1
# Despues de ejecutarlo, recargar la extension en about:debugging.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$csvPath = Join-Path $root "codigos-elementos.csv"
$jsPath = Join-Path $root "src\plantillas\codigos-elementos.js"

if (-not (Test-Path $csvPath)) {
    Write-Error "No se encontro $csvPath"
}

$rows = Import-Csv -Path $csvPath -Delimiter ";" -Encoding UTF8
$clean = @()
$invalid = @()
$seen = @{}

foreach ($row in $rows) {
    $codigo = ("" + $row.codigo).Trim()
    $descripcion = ("" + $row.descripcion).Trim()
    $categoria = ("" + $row.categoria).Trim()

    if ($codigo -notmatch '^\d{6}$' -or -not $descripcion) {
        $invalid += "$codigo;$descripcion"
        continue
    }
    $key = "$codigo|$descripcion"
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    $clean += [pscustomobject]@{ codigo = $codigo; descripcion = $descripcion; categoria = $categoria }
}

if ($invalid.Count) {
    Write-Warning ("Filas descartadas (codigo debe tener 6 digitos y descripcion no vacia):`n" + ($invalid -join "`n"))
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$js = "(function () {`n  `"use strict`";`n`n  const SIOS = window.AsistenteSIOS = window.AsistenteSIOS || {};`n`n  // Codigario de elementos medicos IAPOS. Fuente editable: codigos-elementos.csv (regenerar con herramientas/actualizar-codigos.ps1).`n  SIOS.CODIGOS_ELEMENTOS = " + ($clean | ConvertTo-Json -Depth 3 -Compress) + ";`n})();`n"
[System.IO.File]::WriteAllText($jsPath, $js, $utf8)

Write-Host "OK: $($clean.Count) elementos escritos en:"
Write-Host "  $jsPath"
Write-Host "Recuerde recargar la extension en about:debugging."
