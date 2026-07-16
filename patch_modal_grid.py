import re

file_path = r"c:\laragon\www\CRM_ERP_V4\components\DistributionV2\DistributionReportModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add states
pattern_states = r"(const \[batchExportMode, setBatchExportMode\] = useState<'detailed' \| 'summary'\>\('detailed'\);\s*const \[isBatchExporting, setIsBatchExporting\] = useState\(false\);\s*)"
replacement_states = r"\1\n    const [filterBasket, setFilterBasket] = useState<string>('all');\n    const [filterTag, setFilterTag] = useState<string>('all');\n    const [baskets, setBaskets] = useState<any[]>([]);\n    const [tags, setTags] = useState<string[]>([]);\n"
content = re.sub(pattern_states, replacement_states, content)

# 2. Update useEffect
pattern_useeffect = r"(useEffect\(\(\) =\> \{\s*if \(isOpen\) \{\s*fetchSessions\(\);\s*if \(isSuperAdmin && companies\.length === 0\) \{\s*fetchCompanies\(\);\s*\}\s*)\}"
replacement_useeffect = r"\1fetchOptions();\n        }"
content = re.sub(pattern_useeffect, replacement_useeffect, content)

pattern_deps = r"(\}, \[isOpen, selectedCompany, batchStartDate, batchEndDate, batchType)(\]);"
replacement_deps = r"\1, filterBasket, filterTag\2;"
content = re.sub(pattern_deps, replacement_deps, content)

# 3. Add fetchOptions
pattern_fetch_companies = r"(const fetchCompanies = async \(\) =\> \{)"
replacement_fetch_companies = r"""const fetchOptions = async () => {
        try {
            const tagData = await apiFetch(`Distribution/index.php?action=get_session_tags&companyId=${selectedCompany}`);
            if (tagData.ok) setTags(tagData.tags || []);
            
            const basketData = await apiFetch(`Distribution/index.php?action=get_basket_options&companyId=${selectedCompany}`);
            if (basketData.ok) setBaskets(basketData.baskets || []);
        } catch (error) {
            console.error(error);
        }
    };

    \1"""
content = re.sub(pattern_fetch_companies, replacement_fetch_companies, content)

# 4. Update fetchSessions
pattern_fetch_sessions = r"(const data = await apiFetch\(`Distribution/index\.php\?action=get_sessions&companyId=\$\{selectedCompany\}&startDate=\$\{batchStartDate\}&endDate=\$\{batchEndDate\}&type=\$\{batchType\}`\);)"
replacement_fetch_sessions = r"const data = await apiFetch(`Distribution/index.php?action=get_sessions&companyId=${selectedCompany}&startDate=${batchStartDate}&endDate=${batchEndDate}&type=${batchType}&basket_key=${filterBasket}&session_tag=${filterTag}`);"
content = re.sub(pattern_fetch_sessions, replacement_fetch_sessions, content)

# 5. Update handleBatchExport
pattern_batch_export = r"(const data = await apiFetch\(`Distribution/index\.php\?action=batch_export&companyId=\$\{selectedCompany\}&startDate=\$\{batchStartDate\}&endDate=\$\{batchEndDate\}&type=\$\{batchType\}`\);)"
replacement_batch_export = r"const data = await apiFetch(`Distribution/index.php?action=batch_export&companyId=${selectedCompany}&startDate=${batchStartDate}&endDate=${batchEndDate}&type=${batchType}&basket_key=${filterBasket}&session_tag=${filterTag}`);"
content = re.sub(pattern_batch_export, replacement_batch_export, content)

# 6. Update UI
pattern_ui = r"(\{\/\* Batch Export & Company Filter \*\/\}\s*\<div className=\"px-6 py-4 border-b bg-white flex flex-wrap gap-4 items-center justify-between\"\>).*?(?=\<div className=\"p-6 overflow-y-auto flex-1 bg-gray-50/50\"\>)"
replacement_ui = r"""{/* Filter Grid UI */}
                <div className="px-6 py-4 border-b bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-semibold text-blue-800">ตัวกรอง / ดาวน์โหลด (Filter / Batch)</span>
                        {isSuperAdmin && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-700">เลือกบริษัท:</span>
                                <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="p-1.5 border rounded text-sm w-48 bg-gray-50">
                                    <option value="all">ทุกบริษัท (All)</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">วันที่เริ่มต้น</span>
                            <input type="date" className="p-1.5 border rounded text-sm bg-gray-50" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">วันที่สิ้นสุด</span>
                            <input type="date" className="p-1.5 border rounded text-sm bg-gray-50" value={batchEndDate} onChange={(e) => setBatchEndDate(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">ประเภท</span>
                            <select className="p-1.5 border rounded text-sm bg-gray-50" value={batchType} onChange={(e) => setBatchType(e.target.value)}>
                                <option value="all">ทุกประเภท</option>
                                <option value="distribution">แจกจ่ายลูกค้า</option>
                                <option value="reclaim">ดึงคืน / โอนย้าย</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">ตะกร้าต้นทาง</span>
                            <select className="p-1.5 border rounded text-sm bg-gray-50" value={filterBasket} onChange={(e) => setFilterBasket(e.target.value)}>
                                <option value="all">ทุกตะกร้า</option>
                                {baskets.map(b => <option key={b.id} value={b.basket_key}>{b.basket_name} ({b.basket_key})</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 font-medium">Session Tag</span>
                            <select className="p-1.5 border rounded text-sm bg-gray-50" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
                                <option value="all">ทุกแท็ก</option>
                                {tags.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-4 justify-end">
                        <select className="p-1.5 border rounded text-sm w-48 bg-blue-50 text-blue-800" value={batchExportMode} onChange={(e) => setBatchExportMode(e.target.value as 'detailed' | 'summary')}>
                            <option value="detailed">แบบละเอียด (Detailed)</option>
                            <option value="summary">แบบสรุปย่อ (Summary)</option>
                        </select>
                        <button onClick={handleBatchExport} disabled={isBatchExporting} className={`px-4 py-1.5 rounded text-sm text-white flex items-center ${isBatchExporting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                            {isBatchExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} ส่งออกไฟล์
                        </button>
                    </div>
                </div>

                """
content = re.sub(pattern_ui, replacement_ui, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("DistributionReportModal patched successfully")
