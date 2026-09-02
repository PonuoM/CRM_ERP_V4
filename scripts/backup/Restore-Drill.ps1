# Restore drill: import the office gzip dump into a NEW local database.
# Never points at 202.183.192.218. Never uses company id 12 on prod (same DB as employees).
# Restore drill: import into a NEW local database. XAMPP root here has an empty password.
# Never points at 202.183.192.218. Never uses company id 12 on prod (same DB as employees).
param(
  [string]$Gz = 'C:\Users\User\Documents\prima_db_backups\primacom_mini_erp_20260831_102623.sql.gz',
  [string]$LocalDb = 'restore_drill_mini_erp',
  [string]$Mysql = 'C:\xampp\mysql\bin\mysql.exe',
  [string]$Gzip = 'C:\Program Files\Git\usr\bin\gzip.exe'
)
if (-not (Test-Path $Gz)) { throw "dump not found: $Gz" }
& $Mysql -u root -e "CREATE DATABASE IF NOT EXISTS ``$LocalDb`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
Write-Output "Importing into local $LocalDb — this can take a long time. Prod is not touched."
cmd /c "`"$Gzip`" -dc `"$Gz`" | `"$Mysql`" -u root --force $LocalDb"
Write-Output "COUNT customers:"
& $Mysql -u root -N $LocalDb -e "SELECT COUNT(*) FROM customers;"
