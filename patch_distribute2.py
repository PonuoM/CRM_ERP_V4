import os

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """            // 3. Log with assigned_to_old and assigned_to_new
            $finalTargetKey = $resolvedTargetKey ?: $oldBasketKey;
            $logStmt->execute([$customerId, $oldBasketKey, $finalTargetKey, $oldAssignedTo, $agentId, 'distribute', $triggeredBy, 'Distributed from Distribution V2']);"""

replacement = """            // 3. Log with assigned_to_old and assigned_to_new
            $finalTargetKey = $resolvedTargetKey ?: ($oldBasketKey ?: 'Unknown');
            $safeOldBasketKey = $oldBasketKey ?: 'Unknown';
            $logStmt->execute([$customerId, $safeOldBasketKey, $finalTargetKey, $oldAssignedTo, $agentId, 'distribute', $triggeredBy, 'Distributed from Distribution V2']);"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched handleDistribute successfully")
else:
    print("Target not found")
