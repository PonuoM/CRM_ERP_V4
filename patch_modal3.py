import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\ReclaimModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
if "AutocompleteInput" not in content:
    pattern_import = r"(import React.*?;\n)"
    replacement_import = r"\1import AutocompleteInput from './AutocompleteInput';\n"
    content = re.sub(pattern_import, replacement_import, content, count=1)

# 2. Replace input and datalist
pattern_input = r"(<input\s*type=\"text\"\s*id=\"reclaimSessionTag\"\s*className=\"[^\"]*\"\s*placeholder=\"[^\"]*\"\s*list=\"reclaimSessionTags\"\s*value=\{sessionTag\}\s*onChange=\{\(e\) => setSessionTag\(e\.target\.value\)\}\s*\/\>\s*<datalist id=\"reclaimSessionTags\">\s*\{sessionTagsList\.map\(tag => \(\s*<option key=\{tag\} value=\{tag\} \/>\s*\)\)\}\s*</datalist>)"

replacement_input = r"""<AutocompleteInput
                                value={sessionTag}
                                onChange={setSessionTag}
                                options={sessionTagsList}
                            />"""

content = re.sub(pattern_input, replacement_input, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched ReclaimModal")
