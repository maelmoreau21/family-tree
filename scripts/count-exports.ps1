foreach (zoomTo in Get-Content export_names.txt) {
     = zoomTo.Trim()
    if ( -ne '') {
         = '\\b' + [regex]::Escape() + '\\b'
        0 = (Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern  -AllMatches | Measure-Object).Count
        Write-Output ( + ':' + 0)
    }
}
