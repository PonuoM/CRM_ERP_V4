import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Title change
pattern_title = r"(<h3 className=\"text-xl font-bold text-gray-800\"\>.*?)\(Distribution Report\)(\<\/h3\>)"
# Replace the Thai text before "(Distribution Report)" as well.
pattern_title_full = r"<h3 className=\"text-xl font-bold text-gray-800\"\>.*?\<\/h3\>"
replacement_title_full = r'<h3 className="text-xl font-bold text-gray-800">ประวัติการแจกงานและดึงคืน (Distribution & Reclaim Report)</h3>'
content = re.sub(pattern_title_full, replacement_title_full, content, count=1)


# 2. Tag change
pattern_tag = r"(\<span className=\"text-xs px-2 py-0\.5 bg-blue-100 text-blue-700 rounded-full\"\>\s*\{session\.distribution_mode\}\s*\<\/span\>)"
replacement_tag = r"""{(() => {
                                                      const isReclaim = session.distribution_mode?.includes('Reclaim') || session.distribution_mode?.includes('Transfer');
                                                      const tagText = isReclaim ? `ดึงคืน (${session.distribution_mode})` : `แจก (${session.distribution_mode})`;
                                                      const tagColor = isReclaim ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';
                                                      return (
                                                          <span className={`text-xs px-2 py-0.5 rounded-full border ${tagColor}`}>
                                                              {tagText}
                                                          </span>
                                                      );
                                                  })()}"""
content = re.sub(pattern_tag, replacement_tag, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Title and tags patched successfully")
