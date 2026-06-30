$files = @('c:\RAMAN DUGGAL\JRMD SOFTWARE\studio\src\components\sales\customer-form.tsx', 'c:\RAMAN DUGGAL\JRMD SOFTWARE\studio\src\components\sales\simple-supplier-form-all-fields.tsx')
foreach ($file in $files) {
    $content = Get-Content -Path $file -Raw
    $content = $content -replace 'type=\"number\"', 'type="number" step="any"'
    Set-Content -Path $file -Value $content
}
