import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(r"\$sourceBasketKey", "$sourceBasketKey")
content = content.replace(r"\$linkedKey", "$linkedKey")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Unescaped $ characters successfully")
