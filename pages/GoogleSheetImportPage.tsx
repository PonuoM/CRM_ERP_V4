import React, { useState } from 'react';
import { Download, Upload, AlertCircle, CheckCircle2, RefreshCw, Eye, Save, FileUp, FileSpreadsheet, Calendar, XCircle } from 'lucide-react';

interface GoogleSheetImportPageProps {
    apiBaseUrl: string;
    authToken: string;
}

interface ShippingRecord {
    system_created_time: string;
    order_number: string;
    delivery_date: string | null;
    delivery_status: string | null;
    row_index: number;
    action: 'insert' | 'update' | 'skip';
    changes?: {
        delivery_date?: { old: string; new: string };
        delivery_status?: { old: string; new: string };
    };
}

interface PreviewData {
    new: ShippingRecord[];
    changed: ShippingRecord[];
    unchanged: ShippingRecord[];
}

const GoogleSheetImportPage: React.FC<GoogleSheetImportPageProps> = ({ apiBaseUrl, authToken }) => {
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [summary, setSummary] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any>(null);
    const [selectedRecords, setSelectedRecords] = useState<ShippingRecord[]>([]);

    // Filter States
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [changesOnly, setChangesOnly] = useState(false);

    // Clear preview when filters change
    React.useEffect(() => {
        setPreviewData(null);
        setSummary(null);
        setImportResult(null);
        setSelectedRecords([]);
        setError(null);
    }, [selectedMonth, selectedYear, startDate, endDate, changesOnly]);

    // Helper function to update date range from month/year selection
    const updateDatesFromMonthYear = (month: string, year: string) => {
        if (month && year) {
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            const firstDay = new Date(yearNum, monthNum - 1, 1);
            const lastDay = new Date(yearNum, monthNum, 0);

            const formatDate = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            setStartDate(formatDate(firstDay));
            setEndDate(formatDate(lastDay));
            setChangesOnly(false);
        }
    };

    const handlePreview = async () => {
        setLoading(true);
        setError(null);
        setPreviewData(null);
        setSummary(null);
        setImportResult(null);

        try {
            const queryParams = new URLSearchParams();
            if (startDate) queryParams.append('start_date', startDate);
            if (endDate) queryParams.append('end_date', endDate);
            if (changesOnly) queryParams.append('changes_only', 'true');

            const response = await fetch(`${apiBaseUrl}/google_sheet_import.php?token=${authToken}&${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
            });

            const data = await response.json();

            if (data.ok) {
                setPreviewData(data.preview);
                setSummary(data.summary);
                // Auto-select records based on view
                if (changesOnly) {
                    setSelectedRecords([...data.preview.changed]);
                } else {
                    setSelectedRecords([...data.preview.new, ...data.preview.changed]);
                }
            } else {
                setError(data.message || data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
            }
        } catch (err: any) {
            setError(err.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (selectedRecords.length === 0) {
            setError('กรุณาเลือกข้อมูลที่ต้องการนำเข้า');
            return;
        }

        setImporting(true);
        setError(null);

        try {
            const response = await fetch(`${apiBaseUrl}/google_sheet_import.php?token=${authToken}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ records: selectedRecords }),
            });

            const data = await response.json();

            if (data.ok) {
                setImportResult(data);
                setPreviewData(null);
                setSelectedRecords([]);
            } else {
                setError(data.message || data.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
            }
        } catch (err: any) {
            setError(err.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์');
        } finally {
            setImporting(false);
        }
    };

    const toggleRecordSelection = (record: ShippingRecord) => {
        setSelectedRecords(prev => {
            const exists = prev.find(r =>
                r.order_number === record.order_number &&
                r.system_created_time === record.system_created_time
            );
            if (exists) {
                return prev.filter(r =>
                    r.order_number !== record.order_number ||
                    r.system_created_time !== record.system_created_time
                );
            } else {
                return [...prev, record];
            }
        });
    };

    const isRecordSelected = (record: ShippingRecord) => {
        return selectedRecords.some(r =>
            r.order_number === record.order_number &&
            r.system_created_time === record.system_created_time
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 font-primary">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-green-100 p-2.5 rounded-lg">
                            <FileSpreadsheet className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">อัพสถานะ Aiport (From Google Sheet)</h2>
                            <p className="text-sm text-gray-500">ดึงข้อมูลการจัดส่งจาก Google Sheet และบันทึกลงฐานข้อมูล</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                        <div className="flex flex-wrap items-end gap-4">
                            {/* Month/Year Selection */}
                            <div className="flex gap-3">
                                <div className="min-w-[160px]">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        เดือน
                                    </label>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => {
                                            setSelectedMonth(e.target.value);
                                            updateDatesFromMonthYear(e.target.value, selectedYear);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                        disabled={changesOnly}
                                    >
                                        <option value="">-- เลือกเดือน --</option>
                                        <option value="1">มกราคม</option>
                                        <option value="2">กุมภาพันธ์</option>
                                        <option value="3">มีนาคม</option>
                                        <option value="4">เมษายน</option>
                                        <option value="5">พฤษภาคม</option>
                                        <option value="6">มิถุนายน</option>
                                        <option value="7">กรกฎาคม</option>
                                        <option value="8">สิงหาคม</option>
                                        <option value="9">กันยายน</option>
                                        <option value="10">ตุลาคม</option>
                                        <option value="11">พฤศจิกายน</option>
                                        <option value="12">ธันวาคม</option>
                                    </select>
                                </div>
                                <div className="min-w-[120px]">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        ปี
                                    </label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => {
                                            setSelectedYear(e.target.value);
                                            updateDatesFromMonthYear(selectedMonth, e.target.value);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                        disabled={changesOnly}
                                    >
                                        <option value="">-- เลือกปี --</option>
                                        {[
                                            new Date().getFullYear(),
                                            new Date().getFullYear() - 1,
                                            new Date().getFullYear() - 2,
                                        ].map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 min-w-[300px]">
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    หรือเลือกช่วงวันที่แบบละเอียด
                                </label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => {
                                                setStartDate(e.target.value);
                                                if (e.target.value) setChangesOnly(false);
                                            }}
                                            className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                                            disabled={changesOnly}
                                        />
                                    </div>
                                    <span className="text-gray-400 font-medium">-</span>
                                    <div className="relative flex-1">
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => {
                                                setEndDate(e.target.value);
                                                if (e.target.value) setChangesOnly(false);
                                            }}
                                            className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                                            disabled={changesOnly}
                                        />
                                    </div>
                                </div>
                            </div>

                            {(startDate || endDate || changesOnly || selectedMonth || selectedYear) && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setChangesOnly(false);
                                        setSelectedMonth('');
                                        setSelectedYear('');
                                    }}
                                    className="text-gray-500 hover:text-red-500 transition-colors text-sm font-medium flex items-center gap-1 h-[38px]"
                                    title="ล้างค่าตัวกรอง"
                                >
                                    <XCircle className="w-4 h-4" />
                                    ล้างค่า
                                </button>
                            )}

                            {/* Action buttons on the same row */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handlePreview}
                                    disabled={loading || importing}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm shadow-sm h-[38px] ${loading
                                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100'
                                        }`}
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            กำลังโหลด...
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="w-4 h-4 text-gray-500" />
                                            ดูข้อมูล Preview
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleConfirmImport}
                                    disabled={importing || !previewData || selectedRecords.length === 0}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-sm shadow-sm h-[38px] ${importing || !previewData || selectedRecords.length === 0
                                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                        : 'bg-blue-600 text-white border border-transparent hover:bg-blue-700 active:bg-blue-800 shadow-blue-100'
                                        }`}
                                >
                                    {importing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            บันทึก ({selectedRecords.length})
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="flex items-center gap-2 cursor-pointer select-none w-fit group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={changesOnly}
                                        onChange={(e) => {
                                            setChangesOnly(e.target.checked);
                                            if (e.target.checked) {
                                                setStartDate('');
                                                setEndDate('');
                                            }
                                        }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors"></div>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-white absolute top-[3px] left-[3px] opacity-0 peer-checked:opacity-100 transition-opacity" />
                                </div>
                                <span className={`text-sm font-medium transition-colors ${changesOnly ? 'text-blue-700' : 'text-gray-600 group-hover:text-gray-800'}`}>
                                    แสดงเฉพาะข้อมูลที่มีการเปลี่ยนแปลง
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {summary && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <p className="text-sm text-gray-600 font-medium">ทั้งหมด</p>
                        <p className="text-3xl font-bold text-gray-900">{summary.total_rows}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-4">
                        <p className="text-sm text-green-700 font-medium">ข้อมูลใหม่</p>
                        <p className="text-3xl font-bold text-green-900">{summary.new_count}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-4">
                        <p className="text-sm text-yellow-700 font-medium">มีการเปลี่ยนแปลง</p>
                        <p className="text-3xl font-bold text-yellow-900">{summary.changed_count}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4">
                        <p className="text-sm text-gray-600 font-medium">ไม่เปลี่ยนแปลง</p>
                        <p className="text-3xl font-bold text-gray-900">{summary.unchanged_count}</p>
                    </div>
                </div>
            )}

            {previewData && (
                <div className="space-y-6">
                    {previewData.new.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6">
                            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                                <FileUp className="w-5 h-5" />
                                ข้อมูลใหม่ ({previewData.new.length} รายการ)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-green-50">
                                        <tr>
                                            <th className="p-2 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={previewData.new.every(r => isRecordSelected(r))}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedRecords(prev => [...prev, ...previewData.new.filter(r => !isRecordSelected(r))]);
                                                        } else {
                                                            setSelectedRecords(prev => prev.filter(sr => !previewData.new.some(nr =>
                                                                nr.order_number === sr.order_number && nr.system_created_time === sr.system_created_time
                                                            )));
                                                        }
                                                    }}
                                                />
                                            </th>
                                            <th className="p-2 text-left font-semibold text-green-900">หมายเลขคำสั่งซื้อ</th>
                                            <th className="p-2 text-left font-semibold text-green-900">เวลาที่ระบบสร้าง</th>
                                            <th className="p-2 text-left font-semibold text-green-900">วันที่จัดส่ง</th>
                                            <th className="p-2 text-left font-semibold text-green-900">สถานะจัดส่ง</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.new.map((record, idx) => (
                                            <tr key={idx} className="border-t border-green-100 hover:bg-green-50">
                                                <td className="p-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isRecordSelected(record)}
                                                        onChange={() => toggleRecordSelection(record)}
                                                    />
                                                </td>
                                                <td className="p-2 font-mono text-blue-600">{record.order_number}</td>
                                                <td className="p-2 text-gray-600">{record.system_created_time}</td>
                                                <td className="p-2 text-gray-900">{record.delivery_date || '-'}</td>
                                                <td className="p-2">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                        {record.delivery_status || '-'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {previewData.changed.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-6">
                            <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
                                <RefreshCw className="w-5 h-5" />
                                มีการเปลี่ยนแปลง ({previewData.changed.length} รายการ)
                            </h3>
                            <div className="space-y-3">
                                {previewData.changed.map((record, idx) => (
                                    <div key={idx} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isRecordSelected(record)}
                                                onChange={() => toggleRecordSelection(record)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-mono text-blue-600 font-semibold mb-2">{record.order_number}</div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    {record.changes?.delivery_date && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">วันที่จัดส่ง:</span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="line-through text-red-600">{record.changes.delivery_date.old}</span>
                                                                <span>→</span>
                                                                <span className="text-green-600 font-semibold">{record.changes.delivery_date.new}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {record.changes?.delivery_status && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">สถานะจัดส่ง:</span>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="line-through text-red-600">{record.changes.delivery_status.old}</span>
                                                                <span>→</span>
                                                                <span className="text-green-600 font-semibold">{record.changes.delivery_status.new}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedRecords.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-blue-900">เลือกทั้งหมด: {selectedRecords.length} รายการ</p>
                                    <p className="text-sm text-blue-700">
                                        ใหม่: {selectedRecords.filter(r => r.action === 'insert').length} |
                                        อัพเดท: {selectedRecords.filter(r => r.action === 'update').length}
                                    </p>
                                </div>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={importing}
                                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg disabled:opacity-70 font-medium flex items-center gap-2"
                                >
                                    {importing ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            ยืนยันนำเข้าข้อมูล
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {importResult && importResult.ok && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-900 mb-2">นำเข้าข้อมูลสำเร็จ!</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-green-700 font-medium">เพิ่มใหม่</p>
                                    <p className="text-2xl font-bold text-green-900">{importResult.inserted || 0}</p>
                                </div>
                                <div>
                                    <p className="text-green-700 font-medium">อัพเดท</p>
                                    <p className="text-2xl font-bold text-green-900">{importResult.updated || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-lg font-semibold text-red-900 mb-2">เกิดข้อผิดพลาด</h3>
                            <p className="text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleSheetImportPage;
