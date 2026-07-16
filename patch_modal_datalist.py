import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Pattern to find the input for editTagValue
pattern_input = r"(<input\s*type=\"text\"\s*className=\"text-xs border border-blue-300 rounded px-2 py-0\.5 outline-none focus:ring-1 focus:ring-blue-500 min-w-\[150px\]\"\s*value=\{editTagValue\}\s*onChange=\{\(e\) => setEditTagValue\(e\.target\.value\)\}\s*placeholder=\"\S*\s*Session Tag\"\s*autoFocus\s*\/\>)"

replacement_input = r"""<input 
                                                              type="text" 
                                                              list="reportTagsList"
                                                              className="text-xs border border-blue-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-500 min-w-[150px]"
                                                              value={editTagValue}
                                                              onChange={(e) => setEditTagValue(e.target.value)}
                                                              placeholder="ระบุ Session Tag"
                                                              autoFocus
                                                          />
                                                          <datalist id="reportTagsList">
                                                              {tags.map(tag => (
                                                                  <option key={tag} value={tag} />
                                                              ))}
                                                          </datalist>"""

content = re.sub(pattern_input, replacement_input, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Added datalist to DistributionReportModal")
