import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
if "AutocompleteInput" not in content:
    pattern_import = r"(import React.*?;\n)"
    replacement_import = r"\1import AutocompleteInput from './AutocompleteInput';\n"
    content = re.sub(pattern_import, replacement_import, content, count=1)

# 2. Replace input and datalist
pattern_input = r"(<input\s*type=\"text\"\s*list=\"reportTagsList\"\s*className=\"[^\"]*\"\s*value=\{editTagValue\}\s*onChange=\{\(e\) => setEditTagValue\(e\.target\.value\)\}\s*placeholder=\"ระบุ Session Tag\"\s*autoFocus\s*\/\>\s*<datalist id=\"reportTagsList\">\s*\{tags\.map\(tag => \(\s*<option key=\{tag\} value=\{tag\} \/>\s*\)\)\}\s*</datalist>)"

replacement_input = r"""<AutocompleteInput
                                                              value={editTagValue}
                                                              onChange={setEditTagValue}
                                                              options={tags}
                                                              className="min-w-[200px]"
                                                              autoFocus
                                                          />"""

content = re.sub(pattern_input, replacement_input, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched DistributionReportModal")
