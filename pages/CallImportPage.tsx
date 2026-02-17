import React, { useState, useEffect, useCallback } from "react";
import {
    Upload,
    FileUp,
    AlertTriangle,
    CheckCircle,
    Loader2,
    Search,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Trash2,
    Eye,
    Phone,
    User as UserIcon,
    X,
    BarChart2,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";

interface CallImportPageProps {
    currentUser: { id: number; companyId: number };
}

interface BatchInfo {
    id: number;
    file_name: string;
    total_rows: number;
    matched_rows: number;
    duplicate_rows: number;
    created_at: string;
    first_name?: string;
    last_name?: string;
    start_date?: string;
    end_date?: string;
}

interface LogRecord {
    id: number;
    batch_id: number;
    record_id: string;
    business_group_name: string;
    call_date: string;
    call_origination: string;
    display_number: string;
    call_termination: string;
    status: number;
    start_time: string;
    ringing_duration: string;
    answered_time: string;
    terminated_time: string;
    terminated_reason: string;
    reason_change: string;
    final_number: string;
    duration: string;
    rec_type: number;
    charging_group: string;
    agent_phone: string | null;
    matched_user_id: number | null;
    matched_first_name: string | null;
    matched_last_name: string | null;
    matched_user_phone: string | null;
    file_name: string;
}

type ViewMode = "upload" | "batches" | "logs" | "report";

interface UserReport {
    matched_user_id: number;
    first_name: string;
    last_name: string;
    user_phone: string;
    agent_phone: string;
    total_calls: number;
    answered_calls: number;
    missed_calls: number;
    total_duration_sec: number;
    avg_duration_sec: number;
    first_call_date: string;
    last_call_date: string;
}

interface ReportSummary {
    totalUsers: number;
    totalCalls: number;
    totalAnswered: number;
    totalMissed: number;
    totalDurationSec: number;
}

const CallImportPage: React.FC<CallImportPageProps> = ({ currentUser }) => {
    const apiBase = resolveApiBasePath();

    // ── State ──
    const [viewMode, setViewMode] = useState<ViewMode>("upload");
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewRows, setPreviewRows] = useState<string[][]>([]);
    const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
    const [importStartDate, setImportStartDate] = useState("");
    const [importEndDate, setImportEndDate] = useState("");

    // Duplicate check
    const [isChecking, setIsChecking] = useState(false);
    const [duplicateInfo, setDuplicateInfo] = useState<{
        totalRows: number;
        duplicateCount: number;
        newRows: number;
    } | null>(null);
    const [duplicatePhones, setDuplicatePhones] = useState<
        { phone9: string; user_names: string; cnt: number }[]
    >([]);

    // Import
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        batchId: number;
        totalRows: number;
        insertedRows: number;
        matchedRows: number;
        duplicateRows: number;
    } | null>(null);

    // Batches list
    const [batches, setBatches] = useState<BatchInfo[]>([]);
    const [batchPage, setBatchPage] = useState(1);
    const [batchTotal, setBatchTotal] = useState(0);
    const [isBatchLoading, setIsBatchLoading] = useState(false);

    // Logs list
    const [logs, setLogs] = useState<LogRecord[]>([]);
    const [logPage, setLogPage] = useState(1);
    const [logTotal, setLogTotal] = useState(0);
    const [logTotalPages, setLogTotalPages] = useState(0);
    const [isLogLoading, setIsLogLoading] = useState(false);
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Report
    const [reportData, setReportData] = useState<UserReport[]>([]);
    const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [reportDateFrom, setReportDateFrom] = useState("");
    const [reportDateTo, setReportDateTo] = useState("");

    // ── CSV Preview ──
    const parseCSVPreview = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter((l) => l.trim());
            if (lines.length === 0) return;

            // Parse header
            const headers = lines[0]
                .replace(/^\uFEFF/, "")
                .split(",")
                .map((h) => h.replace(/^"|"$/g, "").trim());
            setPreviewHeaders(headers);

            // Parse first 5 data rows
            const rows: string[][] = [];
            for (let i = 1; i < Math.min(6, lines.length); i++) {
                const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
                rows.push(cols);
            }
            setPreviewRows(rows);
        };
        reader.readAsText(file);
    };

    // ── File handlers ──
    const handleFile = useCallback((file: File) => {
        if (!file.name.endsWith(".csv")) {
            alert("กรุณาเลือกไฟล์ CSV เท่านั้น");
            return;
        }
        setSelectedFile(file);
        setDuplicateInfo(null);
        setImportResult(null);
        parseCSVPreview(file);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        },
        [handleFile]
    );

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]);
    };

    // ── Check Duplicates ──
    const checkDuplicates = async () => {
        if (!selectedFile) return;
        setIsChecking(true);
        setDuplicatePhones([]);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("company_id", String(currentUser.companyId));
            const res = await fetch(`${apiBase}/Onecall_DB/check_call_duplicates.php`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setDuplicateInfo({
                    totalRows: data.totalRows,
                    duplicateCount: data.duplicateCount,
                    newRows: data.newRows,
                });
                if (data.duplicatePhones && data.duplicatePhones.length > 0) {
                    setDuplicatePhones(data.duplicatePhones);
                }
            } else {
                alert("ตรวจสอบไม่สำเร็จ: " + data.error);
            }
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการตรวจสอบ");
        } finally {
            setIsChecking(false);
        }
    };

    // ── Import ──
    const doImport = async () => {
        if (!selectedFile) return;
        setIsImporting(true);
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("company_id", String(currentUser.companyId));
            formData.append("created_by", String(currentUser.id));
            formData.append("start_date", importStartDate);
            formData.append("end_date", importEndDate);
            const res = await fetch(`${apiBase}/Onecall_DB/import_call_records.php`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setImportResult({
                    batchId: data.batchId,
                    totalRows: data.totalRows,
                    insertedRows: data.insertedRows,
                    matchedRows: data.matchedRows,
                    duplicateRows: data.duplicateRows,
                });
            } else {
                alert("Import ไม่สำเร็จ: " + data.error);
            }
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการ Import");
        } finally {
            setIsImporting(false);
        }
    };

    // ── Fetch Batches ──
    const fetchBatches = useCallback(async (page = 1) => {
        setIsBatchLoading(true);
        try {
            const res = await fetch(
                `${apiBase}/Onecall_DB/get_call_imports.php?mode=batches&company_id=${currentUser.companyId}&page=${page}&limit=10`
            );
            const data = await res.json();
            if (data.success) {
                setBatches(data.data);
                setBatchTotal(data.pagination.total);
                setBatchPage(page);
            }
        } catch (err) {
            console.error("Fetch batches error:", err);
        } finally {
            setIsBatchLoading(false);
        }
    }, [apiBase, currentUser.companyId]);

    // ── Delete Batch ──
    const deleteBatch = async (batchId: number, fileName: string) => {
        if (!confirm(`ต้องการลบ Batch #${batchId} (${fileName}) และข้อมูลทั้งหมดในชุดนี้?`)) return;
        try {
            const res = await fetch(`${apiBase}/Onecall_DB/delete_call_batch.php`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ batch_id: batchId, company_id: currentUser.companyId }),
            });
            const data = await res.json();
            if (data.success) {
                fetchBatches(batchPage);
            } else {
                alert("ลบไม่สำเร็จ: " + data.error);
            }
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการลบ");
        }
    };

    // ── Fetch Logs ──
    const fetchLogs = useCallback(
        async (page = 1) => {
            setIsLogLoading(true);
            try {
                let url = `${apiBase}/Onecall_DB/get_call_imports.php?mode=logs&page=${page}&limit=50`;
                if (selectedBatchId) url += `&batch_id=${selectedBatchId}`;
                if (dateFrom) url += `&date_from=${dateFrom}`;
                if (dateTo) url += `&date_to=${dateTo}`;
                if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

                const res = await fetch(url);
                const data = await res.json();
                if (data.success) {
                    setLogs(data.data);
                    setLogTotal(data.pagination.total);
                    setLogTotalPages(data.pagination.totalPages);
                    setLogPage(page);
                }
            } catch (err) {
                console.error("Fetch logs error:", err);
            } finally {
                setIsLogLoading(false);
            }
        },
        [apiBase, selectedBatchId, dateFrom, dateTo, searchTerm]
    );

    // ── Fetch Report ──
    const fetchReport = useCallback(async () => {
        setIsReportLoading(true);
        try {
            let url = `${apiBase}/Onecall_DB/get_call_imports.php?mode=report&company_id=${currentUser.companyId}`;
            if (reportDateFrom) url += `&date_from=${reportDateFrom}`;
            if (reportDateTo) url += `&date_to=${reportDateTo}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setReportData(data.data);
                setReportSummary(data.summary);
            }
        } catch (err) {
            console.error("Fetch report error:", err);
        } finally {
            setIsReportLoading(false);
        }
    }, [apiBase, currentUser.companyId, reportDateFrom, reportDateTo]);

    // Helper: format seconds to HH:MM:SS
    const formatDuration = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    // Load when switching tabs
    useEffect(() => {
        if (viewMode === "batches") fetchBatches(1);
        if (viewMode === "logs") fetchLogs(1);
        if (viewMode === "report") fetchReport();
    }, [viewMode]);

    // ── Reset upload state ──
    const resetUpload = () => {
        setSelectedFile(null);
        setPreviewRows([]);
        setPreviewHeaders([]);
        setDuplicateInfo(null);
        setImportResult(null);
        setImportStartDate("");
        setImportEndDate("");
        setDuplicatePhones([]);
    };

    // ═════════════════════════════════
    // RENDER
    // ═════════════════════════════════
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileUp className="w-7 h-7 text-emerald-600" />
                    นำเข้าข้อมูลโทร
                </h1>
                <p className="text-gray-500 mt-1">Import CSV ข้อมูลการโทรเข้าสู่ระบบ</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm p-1 w-fit">
                {[
                    { key: "upload" as const, label: "อัพโหลด CSV", icon: Upload },
                    { key: "batches" as const, label: "ประวัติ Import", icon: Eye },
                    { key: "logs" as const, label: "ข้อมูลทั้งหมด", icon: Phone },
                    { key: "report" as const, label: "รายงาน", icon: BarChart2 },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setViewMode(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${viewMode === tab.key
                            ? "bg-emerald-600 text-white shadow"
                            : "text-gray-600 hover:bg-gray-50"
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ UPLOAD TAB ═══ */}
            {viewMode === "upload" && (
                <div className="space-y-6">
                    {/* Drop zone */}
                    {!selectedFile && (
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragActive(true);
                            }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${dragActive
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/30"
                                }`}
                        >
                            <Upload
                                className={`w-16 h-16 mx-auto mb-4 ${dragActive ? "text-emerald-500" : "text-gray-400"
                                    }`}
                            />
                            <p className="text-lg font-medium text-gray-700 mb-2">
                                ลากไฟล์ CSV มาวางที่นี่
                            </p>
                            <p className="text-sm text-gray-500 mb-4">หรือ</p>
                            <label className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 transition-colors shadow">
                                <FileUp className="w-4 h-4" />
                                เลือกไฟล์
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileInput}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    )}

                    {/* File selected — Preview + Actions */}
                    {selectedFile && !importResult && (
                        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-5">
                            {/* File info header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <FileUp className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">{selectedFile.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {(selectedFile.size / 1024).toFixed(1)} KB · {previewRows.length} rows previewed
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={resetUpload}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="ลบไฟล์"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Preview table */}
                            {previewHeaders.length > 0 && (
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                {previewHeaders.map((h, i) => (
                                                    <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((row, ri) => (
                                                <tr key={ri} className="border-t hover:bg-gray-50">
                                                    {row.map((cell, ci) => (
                                                        <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                                                            {cell || <span className="text-gray-300">-</span>}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Date Range Selection */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    ช่วงวันที่ของข้อมูล
                                </p>
                                <div className="flex gap-4">
                                    <div>
                                        <label className="text-xs text-blue-600 mb-1 block">วันเริ่มต้น *</label>
                                        <input
                                            type="date"
                                            value={importStartDate}
                                            onChange={(e) => setImportStartDate(e.target.value)}
                                            className="border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-blue-600 mb-1 block">วันสิ้นสุด *</label>
                                        <input
                                            type="date"
                                            value={importEndDate}
                                            onChange={(e) => setImportEndDate(e.target.value)}
                                            className="border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                {!importStartDate || !importEndDate ? (
                                    <p className="text-xs text-blue-500 mt-2">กรุณาเลือกวันที่ก่อนดำเนินการ</p>
                                ) : null}
                            </div>

                            {/* Duplicate check result */}
                            {duplicateInfo && (
                                <div
                                    className={`p-4 rounded-lg border ${duplicateInfo.duplicateCount > 0
                                        ? "bg-amber-50 border-amber-200"
                                        : "bg-green-50 border-green-200"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {duplicateInfo.duplicateCount > 0 ? (
                                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div className="text-sm">
                                            <p className="font-medium text-gray-800">
                                                {duplicateInfo.duplicateCount > 0
                                                    ? `พบข้อมูลซ้ำ ${duplicateInfo.duplicateCount} รายการ`
                                                    : "ไม่พบข้อมูลซ้ำ"}
                                            </p>
                                            <p className="text-gray-600 mt-1">
                                                ทั้งหมด {duplicateInfo.totalRows} rows · ใหม่ {duplicateInfo.newRows} rows
                                                {duplicateInfo.duplicateCount > 0 && ` · ซ้ำ ${duplicateInfo.duplicateCount} rows (จะข้าม)`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Duplicate phone warning */}
                            {duplicatePhones.length > 0 && (
                                <div className="p-4 rounded-lg border bg-red-50 border-red-300">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div className="text-sm">
                                            <p className="font-bold text-red-700">
                                                ⚠️ พบเบอร์โทรซ้ำกันในตาราง users! กรุณาแก้ไขก่อน Import
                                            </p>
                                            <p className="text-red-600 mt-1">
                                                1 เบอร์โทรควรมีแค่ 1 คนเท่านั้น แต่พบว่ามีเบอร์ที่ซ้ำกันอยู่:
                                            </p>
                                            <div className="mt-2 space-y-1">
                                                {duplicatePhones.map((dp, idx) => (
                                                    <div key={idx} className="bg-red-100 rounded px-3 py-1.5 text-red-800">
                                                        <span className="font-mono font-medium">***{dp.phone9}</span>
                                                        <span className="mx-2">→</span>
                                                        <span>{dp.user_names}</span>
                                                        <span className="text-red-500 ml-1">({dp.cnt} คน)</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3">
                                {!duplicateInfo && (
                                    <button
                                        onClick={checkDuplicates}
                                        disabled={isChecking || !importStartDate || !importEndDate}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        {isChecking ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Search className="w-4 h-4" />
                                        )}
                                        ตรวจสอบข้อมูลซ้ำ
                                    </button>
                                )}
                                {duplicateInfo && (
                                    <button
                                        onClick={doImport}
                                        disabled={isImporting || duplicateInfo.newRows === 0 || duplicatePhones.length > 0}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        {isImporting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <FileUp className="w-4 h-4" />
                                        )}
                                        {duplicateInfo.newRows === 0 ? "ไม่มีข้อมูลใหม่" : `Import ${duplicateInfo.newRows} รายการ`}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Import Result */}
                    {importResult && (
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Import สำเร็จ!</h3>
                                    <p className="text-sm text-gray-500">Batch #{importResult.batchId}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-gray-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-gray-800">{importResult.totalRows}</p>
                                    <p className="text-xs text-gray-500 mt-1">Total Rows</p>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-emerald-600">{importResult.insertedRows}</p>
                                    <p className="text-xs text-gray-500 mt-1">Inserted</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-blue-600">{importResult.matchedRows}</p>
                                    <p className="text-xs text-gray-500 mt-1">Agent Matched</p>
                                </div>
                                <div className="bg-amber-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-amber-600">{importResult.duplicateRows}</p>
                                    <p className="text-xs text-gray-500 mt-1">Duplicates Skipped</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        resetUpload();
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                                >
                                    อัพโหลดไฟล์ใหม่
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedBatchId(importResult.batchId);
                                        setViewMode("logs");
                                    }}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                                >
                                    ดูข้อมูลที่ Import
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ BATCHES TAB ═══ */}
            {viewMode === "batches" && (
                <div className="bg-white rounded-2xl shadow-sm border">
                    <div className="p-5 border-b">
                        <h2 className="text-lg font-semibold text-gray-800">ประวัติการ Import</h2>
                    </div>
                    {isBatchLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                        </div>
                    ) : batches.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <FileUp className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p>ยังไม่มีประวัติ Import</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600">
                                            <th className="px-4 py-3 text-left font-medium">Batch #</th>
                                            <th className="px-4 py-3 text-left font-medium">ชื่อไฟล์</th>
                                            <th className="px-4 py-3 text-left font-medium">ช่วงวันที่</th>
                                            <th className="px-4 py-3 text-center font-medium">Total</th>
                                            <th className="px-4 py-3 text-center font-medium">Matched</th>
                                            <th className="px-4 py-3 text-center font-medium">Duplicates</th>
                                            <th className="px-4 py-3 text-left font-medium">Import โดย</th>
                                            <th className="px-4 py-3 text-left font-medium">วันที่ Import</th>
                                            <th className="px-4 py-3 text-center font-medium">จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batches.map((b) => (
                                            <tr key={b.id} className="border-t hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-gray-600">#{b.id}</td>
                                                <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{b.file_name}</td>
                                                <td className="px-4 py-3 text-xs text-gray-600">
                                                    {b.start_date && b.end_date
                                                        ? `${b.start_date} - ${b.end_date}`
                                                        : <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center font-semibold">{b.total_rows}</td>
                                                <td className="px-4 py-3 text-center text-blue-600 font-semibold">{b.matched_rows}</td>
                                                <td className="px-4 py-3 text-center text-amber-600 font-semibold">{b.duplicate_rows}</td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {b.first_name ? `${b.first_name} ${b.last_name || ""}` : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">
                                                    {new Date(b.created_at).toLocaleString("th-TH")}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBatchId(b.id);
                                                                setViewMode("logs");
                                                            }}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                            title="ดูรายละเอียด"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteBatch(b.id, b.file_name)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="ลบ Batch"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Batch pagination */}
                            {batchTotal > 10 && (
                                <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-gray-600">
                                    <span>ทั้งหมด {batchTotal} batches</span>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={batchPage <= 1}
                                            onClick={() => fetchBatches(batchPage - 1)}
                                            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="px-2 py-1">หน้า {batchPage}</span>
                                        <button
                                            disabled={batchPage * 10 >= batchTotal}
                                            onClick={() => fetchBatches(batchPage + 1)}
                                            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ═══ LOGS TAB ═══ */}
            {viewMode === "logs" && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-end">
                        {selectedBatchId && (
                            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-sm">
                                <span>Batch #{selectedBatchId}</span>
                                <button
                                    onClick={() => {
                                        setSelectedBatchId(null);
                                        setLogPage(1);
                                    }}
                                    className="p-0.5 hover:bg-emerald-100 rounded"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">จากวันที่</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">ถึงวันที่</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">ค้นหา</label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="เบอร์โทร, ชื่อ..."
                                    className="border rounded-lg pl-9 pr-3 py-2 text-sm w-56"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => fetchLogs(1)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
                        >
                            ค้นหา
                        </button>
                    </div>

                    {/* Logs table */}
                    <div className="bg-white rounded-2xl shadow-sm border">
                        {isLogLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <Phone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                <p>ไม่พบข้อมูล</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-600">
                                                <th className="px-3 py-2.5 text-left font-medium">Record ID</th>
                                                <th className="px-3 py-2.5 text-left font-medium">วันที่โทร</th>
                                                <th className="px-3 py-2.5 text-left font-medium">เวลาเริ่ม</th>
                                                <th className="px-3 py-2.5 text-left font-medium">CallOrigination</th>
                                                <th className="px-3 py-2.5 text-left font-medium">DisplayNumber</th>
                                                <th className="px-3 py-2.5 text-left font-medium">CallTermination</th>
                                                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                                                <th className="px-3 py-2.5 text-left font-medium">Duration</th>
                                                <th className="px-3 py-2.5 text-left font-medium">Agent Phone</th>
                                                <th className="px-3 py-2.5 text-left font-medium">Matched User</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map((log) => (
                                                <tr key={log.id} className="border-t hover:bg-gray-50 transition-colors">
                                                    <td className="px-3 py-2 font-mono text-gray-500">{log.record_id}</td>
                                                    <td className="px-3 py-2 text-gray-700">{log.call_date}</td>
                                                    <td className="px-3 py-2 text-gray-700">{log.start_time}</td>
                                                    <td className="px-3 py-2 text-gray-700">{log.call_origination || "-"}</td>
                                                    <td className="px-3 py-2 text-gray-700">{log.display_number || "-"}</td>
                                                    <td className="px-3 py-2 text-gray-700">{log.call_termination || "-"}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 1
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-red-100 text-red-700"
                                                                }`}
                                                        >
                                                            {log.status === 1 ? "รับสาย" : "ไม่รับ"}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-700">{log.duration || "00:00:00"}</td>
                                                    <td className="px-3 py-2">
                                                        {log.agent_phone ? (
                                                            <span className="text-blue-600 font-medium">{log.agent_phone}</span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {log.matched_first_name ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-700">
                                                                <UserIcon className="w-3.5 h-3.5" />
                                                                {log.matched_first_name} {log.matched_last_name || ""}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Logs pagination */}
                                <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-gray-600">
                                    <span>
                                        แสดง {(logPage - 1) * 50 + 1}-{Math.min(logPage * 50, logTotal)} จาก {logTotal} รายการ
                                    </span>
                                    <div className="flex gap-2 items-center">
                                        <button
                                            disabled={logPage <= 1}
                                            onClick={() => fetchLogs(logPage - 1)}
                                            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="px-2">
                                            หน้า {logPage}/{logTotalPages}
                                        </span>
                                        <button
                                            disabled={logPage >= logTotalPages}
                                            onClick={() => fetchLogs(logPage + 1)}
                                            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ REPORT TAB ═══ */}
            {viewMode === "report" && (
                <div className="space-y-4">
                    {/* Report Filters */}
                    <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">จากวันที่</label>
                            <input
                                type="date"
                                value={reportDateFrom}
                                onChange={(e) => setReportDateFrom(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">ถึงวันที่</label>
                            <input
                                type="date"
                                value={reportDateTo}
                                onChange={(e) => setReportDateTo(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <button
                            onClick={fetchReport}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
                        >
                            แสดงรายงาน
                        </button>
                    </div>

                    {/* Summary Cards */}
                    {reportSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                                <p className="text-2xl font-bold text-gray-800">{reportSummary.totalUsers}</p>
                                <p className="text-xs text-gray-500 mt-1">จำนวนผู้ใช้</p>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                                <p className="text-2xl font-bold text-blue-600">{reportSummary.totalCalls.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-1">โทรทั้งหมด</p>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                                <p className="text-2xl font-bold text-emerald-600">{reportSummary.totalAnswered.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-1">รับสาย</p>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                                <p className="text-2xl font-bold text-red-500">{reportSummary.totalMissed.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-1">ไม่รับสาย</p>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                                <p className="text-2xl font-bold text-purple-600">{formatDuration(reportSummary.totalDurationSec)}</p>
                                <p className="text-xs text-gray-500 mt-1">เวลาโทรรวม</p>
                            </div>
                        </div>
                    )}

                    {/* User Breakdown Table */}
                    <div className="bg-white rounded-2xl shadow-sm border">
                        <div className="p-5 border-b">
                            <h2 className="text-lg font-semibold text-gray-800">รายงานตามผู้ใช้</h2>
                        </div>
                        {isReportLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                            </div>
                        ) : reportData.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                <p>ไม่พบข้อมูลที่ match กับผู้ใช้</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600">
                                            <th className="px-4 py-3 text-left font-medium">ผู้ใช้</th>
                                            <th className="px-4 py-3 text-left font-medium">เบอร์โทร Agent</th>
                                            <th className="px-4 py-3 text-center font-medium">โทรทั้งหมด</th>
                                            <th className="px-4 py-3 text-center font-medium">รับสาย</th>
                                            <th className="px-4 py-3 text-center font-medium">ไม่รับ</th>
                                            <th className="px-4 py-3 text-center font-medium">% รับสาย</th>
                                            <th className="px-4 py-3 text-center font-medium">เวลาโทรรวม</th>
                                            <th className="px-4 py-3 text-center font-medium">เฉลี่ย/สาย</th>
                                            <th className="px-4 py-3 text-left font-medium">ช่วงวันที่</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.map((r) => (
                                            <tr key={r.matched_user_id} className="border-t hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                            <UserIcon className="w-4 h-4 text-emerald-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-800">{r.first_name} {r.last_name || ""}</p>
                                                            <p className="text-xs text-gray-400">{r.user_phone}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-blue-600 font-mono text-xs">{r.agent_phone || "-"}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-800">{r.total_calls}</td>
                                                <td className="px-4 py-3 text-center text-emerald-600 font-semibold">{r.answered_calls}</td>
                                                <td className="px-4 py-3 text-center text-red-500 font-semibold">{r.missed_calls}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.total_calls > 0 && (r.answered_calls / r.total_calls) >= 0.7
                                                        ? "bg-green-100 text-green-700"
                                                        : r.total_calls > 0 && (r.answered_calls / r.total_calls) >= 0.4
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-red-100 text-red-700"
                                                        }`}>
                                                        {r.total_calls > 0 ? `${Math.round((r.answered_calls / r.total_calls) * 100)}%` : "0%"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center font-mono text-xs">{formatDuration(r.total_duration_sec)}</td>
                                                <td className="px-4 py-3 text-center font-mono text-xs">{formatDuration(r.avg_duration_sec)}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    {r.first_call_date} - {r.last_call_date}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CallImportPage;
