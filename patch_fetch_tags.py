import re

file_path = r"c:\laragon\www\CRM_ERP_V4\pages\CustomerDistributionV2.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add fetchSessionTags() to handleExecuteDistribution success block
pattern_dist = r"(Swal\.fire\(\{\s*icon: 'success',\s*title: 'แจกจ่ายรายชื่อสำเร็จ',\s*text: [^}]+\s*\}\);)"
replacement_dist = r"\1\n            fetchSessionTags();"
content = re.sub(pattern_dist, replacement_dist, content)

# 2. Add fetchSessionTags() to handleExecuteBulkAction success block
pattern_bulk = r"(setBulkResultMode\('success'\);\s*setBulkResultModalOpen\(true\);\s*await fetchBasketCounts\(\);)"
replacement_bulk = r"\1\n            fetchSessionTags();"
content = re.sub(pattern_bulk, replacement_bulk, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Added fetchSessionTags() after actions")
