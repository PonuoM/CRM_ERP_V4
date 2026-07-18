import re

filepath = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
if "import MultiSelectFilter" not in content:
    content = content.replace(
        "import SessionTagSelect from './SessionTagSelect';", 
        "import SessionTagSelect from './SessionTagSelect';\nimport MultiSelectFilter from '../MultiSelectFilter';"
    )

# 2. Change state type
content = content.replace(
    "const [filterTag, setFilterTag] = useState<number | 'all'>('all');",
    "const [filterTag, setFilterTag] = useState<number[]>([]);"
)

# 3. Update API calls to format filterTag
tag_format_code = "${filterTag.length > 0 ? filterTag.map(id => id === -1 ? 'none' : id).join(',') : 'all'}"

content = content.replace(
    "&session_tag=${filterTag}`",
    f"&session_tag={tag_format_code}`"
)

# 4. Update UI
ui_old = """<SessionTagSelect
                                value={filterTag === 'all' ? '' : filterTag}
                                onChange={(val) => setFilterTag(val === '' ? 'all' : val)}
                                options={tags}
                                className="w-full text-sm"
                                placeholder="-- ทุกรายการ --"
                            />"""

ui_new = """<div className="w-[200px]">
                                <MultiSelectFilter
                                    options={[{ id: -1, label: 'ไม่มี Tag' }, ...tags.map(t => ({ id: t.id, label: t.session_tag }))]}
                                    selectedIds={filterTag}
                                    onChange={setFilterTag}
                                    placeholder="ค้นหา..."
                                    emptyMeansAllLabel="ทุกรายการ"
                                    emptyHint="แสดงทั้งหมด"
                                />
                            </div>"""
content = content.replace(ui_old, ui_new)

# 5. Update resetFilters
content = content.replace(
    "setFilterTag('all');",
    "setFilterTag([]);"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched!")
