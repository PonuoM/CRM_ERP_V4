import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix modeText in Summary Export
pattern_summary = r"(let modeText = row\.distribution_mode;\s*if \(row\.distribution_mode === 'Performance'\) modeText \+\= ` \(>= \$\{row\.min_call_minutes\} นาที\)`;)"
replacement_summary = r"""let isReclaimOrTransfer = row.distribution_mode?.includes('Reclaim') || row.distribution_mode?.includes('Transfer');
                        let modeText = isReclaimOrTransfer ? `ดึงคืน (${row.distribution_mode})` : `แจก (${row.distribution_mode})`;
                        if (row.distribution_mode === 'Performance') modeText += ` (>= ${row.min_call_minutes} นาที)`;"""
content = re.sub(pattern_summary, replacement_summary, content, count=1)

# Fix modeText in Detailed Export
pattern_detailed = r"(let isReclaimOrTransfer = row\.distribution_mode\?\.includes\('Reclaim'\) \|\| row\.distribution_mode\?\.includes\('Transfer'\);\s*let modeText = row\.distribution_mode;\s*if \(row\.distribution_mode === 'Performance'\) modeText \+\= ` \(>= \$\{row\.min_call_minutes\} นาที\)`;)"
replacement_detailed = r"""let isReclaimOrTransfer = row.distribution_mode?.includes('Reclaim') || row.distribution_mode?.includes('Transfer');
                        let modeText = isReclaimOrTransfer ? `ดึงคืน (${row.distribution_mode})` : `แจก (${row.distribution_mode})`;
                        if (row.distribution_mode === 'Performance') modeText += ` (>= ${row.min_call_minutes} นาที)`;"""
content = re.sub(pattern_detailed, replacement_detailed, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Export modeText patched successfully")
