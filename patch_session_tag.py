import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """    $stmt = $pdo->prepare("UPDATE distribution_sessions SET session_tag = ? WHERE id = ? AND company_id = ?");
    $result = $stmt->execute([$sessionTag, $sessionId, $companyId]);"""

replacement = """    if ($companyId === 'all') {
        $stmt = $pdo->prepare("UPDATE distribution_sessions SET session_tag = ? WHERE id = ?");
        $result = $stmt->execute([$sessionTag, $sessionId]);
    } else {
        $stmt = $pdo->prepare("UPDATE distribution_sessions SET session_tag = ? WHERE id = ? AND company_id = ?");
        $result = $stmt->execute([$sessionTag, $sessionId, $companyId]);
    }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched handleUpdateSessionTag successfully")
else:
    print("Target not found")
