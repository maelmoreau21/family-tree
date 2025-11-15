param(
    [switch]$Delete,
    [switch]$ListOnly
)

$ErrorActionPreference = 'Continue'

Write-Host "Cleanup script started. Delete mode: $Delete; ListOnly: $ListOnly"

$cwd = Get-Location
$targets = @()

# Directories and files to consider
$targets += Get-ChildItem -Path $cwd -Recurse -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
$targets += Get-ChildItem -Path $cwd -Recurse -File -Include '*.pyc' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DirectoryName | Select-Object -Unique
if (Test-Path (Join-Path $cwd 'node_modules')) { $targets += (Join-Path $cwd 'node_modules') }
foreach ($d in '.vitest','.nyc_output','coverage','.cache') { if (Test-Path (Join-Path $cwd $d)) { $targets += (Join-Path $cwd $d) } }
$logFiles = Get-ChildItem -Path $cwd -Recurse -File -Include '*.log','*.tmp' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
$targets += $logFiles
if (Test-Path (Join-Path $cwd 'data\postgres')) { $targets += (Join-Path $cwd 'data\postgres') }

$targets = $targets | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

if (-not $targets) {
    Write-Host "No matching temporary items found."
    exit 0
}

$totalBytes = 0

Write-Host "Items that match the cleanup patterns (path - size MB):"
foreach ($t in $targets) {
    try {
        if (Test-Path $t) {
            $bytes = 0
            if ((Get-Item $t).PSIsContainer) {
                $bytes = (Get-ChildItem -LiteralPath $t -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer } | Measure-Object -Property Length -Sum).Sum
            } else {
                $bytes = (Get-Item -LiteralPath $t -Force).Length
            }
            $totalBytes += $bytes
            Write-Host "$t - $([math]::Round($bytes / 1MB, 2)) MB"
        }
    } catch {
        Write-Host ("Failed to measure size for {0}: {1}" -f $t, $_)
    }
}
Write-Host "Total size: $([math]::Round($totalBytes / 1MB, 2)) MB"

if ($Delete -and -not $ListOnly) {
    Write-Host "Proceeding to delete items..."
    foreach ($t in $targets) {
        try {
            if (Test-Path $t) {
                Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "Deleted: $t"
            } else {
                Write-Host "Already missing: $t"
            }
        } catch {
            Write-Host ("Failed to delete {0}: {1}" -f $t, $_)
        }
    }
    Write-Host "Deletion complete."
} else {
    Write-Host "List-only mode: no deletions performed. To delete, re-run this script with -Delete."
}
