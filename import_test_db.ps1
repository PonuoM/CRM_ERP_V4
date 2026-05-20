$password="12345678"
$db="primacom_mini_erp_test"

Write-Host "Recreating database to start fresh..."
cmd.exe /c "mysql -u root -p$password -e `"DROP DATABASE IF EXISTS $db; CREATE DATABASE $db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`""

Write-Host "Importing schema migrations..."
Get-ChildItem -Path "api\migrations" -Filter "0*.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "Importing $($_.Name)..."
    cmd.exe /c "mysql -u root -p$password -f $db < `"$($_.FullName)`""
}

Write-Host "Importing reduced data (2.7GB, this will take some time)..."
cmd.exe /c "mysql -u root -p$password --init-command=`"SET FOREIGN_KEY_CHECKS=0;`" -f $db < `"api\migrations\primacom_mini_erp_test_reduced.sql`""

Write-Host "Import Complete."
