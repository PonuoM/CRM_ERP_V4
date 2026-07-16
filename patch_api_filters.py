import os
import re

file_path = r"c:\laragon\www\CRM_ERP_V4\api\Distribution\index.php"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# PATCH 1: handleGetSessions
# Find where variables are fetched:
pattern1 = r"(\$startDate = \$_GET\['startDate'\] \?\? null;\s*\$endDate = \$_GET\['endDate'\] \?\? null;\s*\$type = \$_GET\['type'\] \?\? 'all';)"
replacement1 = r"\1\n    $basketKey = $_GET['basket_key'] ?? '';\n    $sessionTag = $_GET['session_tag'] ?? '';"

content = re.sub(pattern1, replacement1, content, count=1)

# Find where whereClauses are appended:
pattern2 = r"(if \(\$type === 'distribution'\) \{[^\}]+} else if \(\$type === 'reclaim'\) \{[^\}]+\})"
replacement2 = r"""\1

    if ($basketKey && $basketKey !== 'all') {
        $whereClauses[] = "EXISTS (SELECT 1 FROM distribution_session_details dsd WHERE dsd.session_id = ds.id AND dsd.previous_basket_key = ?)";
        $params[] = $basketKey;
    }

    if ($sessionTag && $sessionTag !== 'all') {
        $whereClauses[] = "ds.session_tag = ?";
        $params[] = $sessionTag;
    }"""

# We need to make sure we replace inside handleGetSessions and handleBatchExport
# Actually, pattern1 and pattern2 will apply to the FIRST occurrence if we use count=1.
# But they both look almost identical in handleGetSessions and handleBatchExport!
# Wait, handleGetSessions and handleBatchExport are similar. Let's do a more robust replacement.

# Let's replace the whole chunk inside handleGetSessions
match_getsessions = re.search(r"function handleGetSessions.*?\n    \$sql = \"", content, re.DOTALL)
if match_getsessions:
    get_sessions_body = match_getsessions.group(0)
    
    # Add variables
    get_sessions_body = get_sessions_body.replace(
        "$type = $_GET['type'] ?? 'all';",
        "$type = $_GET['type'] ?? 'all';\n    $basketKey = $_GET['basket_key'] ?? 'all';\n    $sessionTag = $_GET['session_tag'] ?? 'all';"
    )
    
    # Add clauses
    get_sessions_body = get_sessions_body.replace(
        "    $whereSql = \"\";",
        """    if ($basketKey && $basketKey !== 'all') {
        $whereClauses[] = "EXISTS (SELECT 1 FROM distribution_session_details dsd WHERE dsd.session_id = ds.id AND dsd.previous_basket_key = ?)";
        $params[] = $basketKey;
    }

    if ($sessionTag && $sessionTag !== 'all') {
        $whereClauses[] = "ds.session_tag = ?";
        $params[] = $sessionTag;
    }

    $whereSql = "";"""
    )
    
    content = content[:match_getsessions.start()] + get_sessions_body + content[match_getsessions.end():]


# PATCH 2: handleBatchExport
match_batchexport = re.search(r"function handleBatchExport.*?\n    \$sql = \"", content, re.DOTALL)
if match_batchexport:
    batch_export_body = match_batchexport.group(0)
    
    # Add variables
    batch_export_body = batch_export_body.replace(
        "$type = $_GET['type'] ?? 'all';",
        "$type = $_GET['type'] ?? 'all';\n    $basketKey = $_GET['basket_key'] ?? 'all';\n    $sessionTag = $_GET['session_tag'] ?? 'all';"
    )
    
    # Add clauses (In handleBatchExport, it uses $typeFilter and $companyFilter strings instead of an array.
    # We will just append to $typeFilter)
    batch_export_body = batch_export_body.replace(
        "    $sql = \"",
        """    if ($basketKey && $basketKey !== 'all') {
        $typeFilter .= " AND EXISTS (SELECT 1 FROM distribution_session_details _dsd WHERE _dsd.session_id = ds.id AND _dsd.previous_basket_key = ?) ";
        $params[] = $basketKey;
    }

    if ($sessionTag && $sessionTag !== 'all') {
        $typeFilter .= " AND ds.session_tag = ? ";
        $params[] = $sessionTag;
    }

    $sql = \""""
    )
    
    content = content[:match_batchexport.start()] + batch_export_body + content[match_batchexport.end():]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Backend APIs patched successfully")
