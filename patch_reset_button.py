import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add resetFilters function before return
pattern_return = r"(\s+return \(\s*\<div className=\"fixed inset-0 z-50 flex items-center justify-center bg-black\/50 backdrop-blur-sm\"\>)"
replacement_return = r"""
    const resetFilters = () => {
        setBatchStartDate('');
        setBatchEndDate('');
        setBatchType('all');
        setFilterBasket('all');
        setFilterTag('all');
        if (isSuperAdmin) {
            setSelectedCompany('all');
        }
    };
\1"""
content = re.sub(pattern_return, replacement_return, content)

# Add Reset button to UI next to the Export button
pattern_buttons = r"(\<div className=\"flex items-center gap-3 mt-4 justify-end\"\>)"
replacement_buttons = r"""\1
                        <button onClick={resetFilters} className="px-4 py-1.5 rounded text-sm text-gray-700 bg-gray-200 hover:bg-gray-300 flex items-center transition-colors">
                            รีเซ็ตตัวกรอง
                        </button>"""
content = re.sub(pattern_buttons, replacement_buttons, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Added Reset Filters button successfully")
