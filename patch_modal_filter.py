import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update useEffect dependencies
pattern_useeffect = r"(\s+}, \[isOpen, selectedCompany)(\]);\s+"
replacement_useeffect = r"\1, batchStartDate, batchEndDate, batchType\2;\n\n"
content = re.sub(pattern_useeffect, replacement_useeffect, content)

# 2. Update fetchSessions URL
pattern_fetch = r"const data = await apiFetch\(`Distribution/index\.php\?action=get_sessions&companyId=\$\{selectedCompany\}`\);"
replacement_fetch = r"const data = await apiFetch(`Distribution/index.php?action=get_sessions&companyId=${selectedCompany}&startDate=${batchStartDate}&endDate=${batchEndDate}&type=${batchType}`);"
content = content.replace(pattern_fetch, replacement_fetch)

# 3. Update the UI text for the filter
pattern_ui = r"(\<span className=\"text-sm font-semibold text-blue-800\"\>.*?)\(Batch\)( \:\</span\>)"
replacement_ui = r"\1(Filter / Batch)\2"
content = re.sub(pattern_ui, replacement_ui, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Frontend Modal patched successfully.")
