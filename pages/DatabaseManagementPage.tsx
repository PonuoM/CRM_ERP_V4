import React, { useState, useEffect, useMemo } from 'react';
import { Database, Table, Download, Play, RefreshCw, Search, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, Loader2, Copy, FileDown, Upload } from 'lucide-react';
import { apiFetch } from '../services/api';
import resolveApiBasePath from '../utils/apiBasePath';

interface TableInfo {
    name: string;
    engine: string;
    rows: number;
    data_size: number;
    auto_increment: number | null;
    collation: string;
    created: string;
    updated: string | null;
}

interface ColumnInfo {
    field: string;
    type: string;
    null: string;
    key: string;
    default: string | null;
    extra: string;
    comment: string;
}

interface SqlResult {
    sql: string;
    success: boolean;
    affected_rows?: number;
    error?: string;
}

interface ImportError {
    line: number;
    sql: string;
    error: string;
}

type TabType = 'tables' | 'export_schema' | 'export_data' | 'import_sql' | 'run_sql';

const DatabaseManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('tables');
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Table detail
    const [expandedTable, setExpandedTable] = useState<string | null>(null);
    const [tableColumns, setTableColumns] = useState<Record<string, ColumnInfo[]>>({});
    const [tableCreateSql, setTableCreateSql] = useState<Record<string, string>>({});

    // Export
    const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
    const [exportLoading, setExportLoading] = useState(false);
    const [exportResult, setExportResult] = useState<string | null>(null);
    const [dataLimit, setDataLimit] = useState(0);

    // Import
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ success: boolean; message: string; success_count: number; error_count: number; errors: ImportError[] } | null>(null);

    // Run SQL
    const [sqlInput, setSqlInput] = useState('');
    const [sqlRunning, setSqlRunning] = useState(false);
    const [sqlResults, setSqlResults] = useState<SqlResult[]>([]);
    const [sqlMessage, setSqlMessage] = useState<string | null>(null);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTables = useMemo(() => {
        if (!searchTerm) return tables;
        const q = searchTerm.toLowerCase();
        return tables.filter(t => t.name.toLowerCase().includes(q));
    }, [tables, searchTerm]);

    // ─── Helper: Build API URL for direct fetch ───
    const buildDirectUrl = (path: string) => {
        const apiBase = resolveApiBasePath().replace(/\/$/, '');
        return `${apiBase}/${path}`;
    };

    // ─── Fetch Tables ───
    const fetchTables = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('Database/db_manager.php?action=list_tables');
            if (res.success) {
                setTables(res.tables);
            } else {
                setError(res.error || 'Failed to fetch tables');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTables(); }, []);

    // ─── Fetch Table Detail ───
    const fetchTableDetail = async (tableName: string) => {
        if (tableColumns[tableName]) {
            setExpandedTable(expandedTable === tableName ? null : tableName);
            return;
        }
        try {
            const res = await apiFetch(`Database/db_manager.php?action=table_info&table=${encodeURIComponent(tableName)}`);
            if (res.success) {
                setTableColumns(prev => ({ ...prev, [tableName]: res.columns }));
                setTableCreateSql(prev => ({ ...prev, [tableName]: res.create_sql }));
                setExpandedTable(tableName);
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    // ─── Export Schema ───
    const handleExportSchema = async () => {
        setExportLoading(true);
        setExportResult(null);
        try {
            const tablesParam = selectedTables.size > 0 ? Array.from(selectedTables).join(',') : '';
            const res = await apiFetch(`Database/db_manager.php?action=export_schema${tablesParam ? `&tables=${encodeURIComponent(tablesParam)}` : ''}`);
            if (res.success) {
                setExportResult(res.sql);
            } else {
                alert(res.error || 'Export failed');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setExportLoading(false);
        }
    };

    // ─── Export Data (ZIP download) ───
    const handleExportData = async () => {
        if (selectedTables.size === 0) {
            alert('กรุณาเลือกตารางอย่างน้อย 1 ตาราง');
            return;
        }
        setExportLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const url = buildDirectUrl('Database/db_manager.php?action=export_data');

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ tables: Array.from(selectedTables), limit: dataLimit }),
            });

            if (!res.ok) {
                const text = await res.text();
                let msg = `HTTP ${res.status}`;
                try { msg = JSON.parse(text).error || msg; } catch { }
                alert('Export failed: ' + msg);
                return;
            }

            const blob = await res.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `data_export_${new Date().toISOString().slice(0, 10)}.zip`;
            a.click();
            URL.revokeObjectURL(downloadUrl);
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setExportLoading(false);
        }
    };

    // ─── Import SQL (ZIP/SQL file upload) ───
    const handleImportSql = async () => {
        if (!importFile) {
            alert('กรุณาเลือกไฟล์ .sql หรือ .zip');
            return;
        }
        const ext = importFile.name.split('.').pop()?.toLowerCase();
        if (ext !== 'sql' && ext !== 'zip') {
            alert('รองรับเฉพาะไฟล์ .sql หรือ .zip เท่านั้น');
            return;
        }
        if (!window.confirm(`⚠️ ยืนยัน Import ไฟล์ "${importFile.name}" (${(importFile.size / 1024 / 1024).toFixed(1)} MB)?\n\nSQL จะถูก execute ทีละ statement (autocommit)\nFK checks จะถูกปิดระหว่าง import`)) {
            return;
        }

        setImportLoading(true);
        setImportResult(null);
        try {
            const token = localStorage.getItem('authToken');
            // In dev mode, Vite proxy doesn't handle multipart file uploads well
            // Send directly to Apache instead
            const isDev = window.location.port === '5173';
            const url = isDev
                ? `http://localhost/CRM_ERP_V4/api/Database/db_manager.php?action=import_sql`
                : buildDirectUrl('Database/db_manager.php?action=import_sql');

            const formData = new FormData();
            formData.append('file', importFile);

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            const data = await res.json();
            setImportResult(data);
            if (data.success) {
                fetchTables();
            }
        } catch (err: any) {
            setImportResult({
                success: false,
                message: 'Network error: ' + err.message,
                success_count: 0,
                error_count: 1,
                errors: [{ line: 0, sql: '', error: err.message }],
            });
        } finally {
            setImportLoading(false);
        }
    };

    // ─── Run SQL ───
    const handleRunSql = async () => {
        if (!sqlInput.trim()) {
            alert('กรุณาใส่ SQL');
            return;
        }
        if (!window.confirm('⚠️ ยืนยันรัน SQL?\n\nSQL จะถูก execute ใน transaction (rollback ถ้า error)')) return;

        setSqlRunning(true);
        setSqlResults([]);
        setSqlMessage(null);
        try {
            const res = await apiFetch('Database/db_manager.php?action=run_sql', {
                method: 'POST',
                body: JSON.stringify({ sql: sqlInput }),
            });
            setSqlResults(res.results || []);
            setSqlMessage(res.message || '');
            if (res.success) {
                fetchTables();
            }
        } catch (err: any) {
            setSqlMessage('Error: ' + err.message);
        } finally {
            setSqlRunning(false);
        }
    };

    // ─── Download SQL as file ───
    const downloadSql = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/sql;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── Toggle table selection ───
    const toggleTable = (name: string) => {
        setSelectedTables(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedTables.size === filteredTables.length) {
            setSelectedTables(new Set());
        } else {
            setSelectedTables(new Set(filteredTables.map(t => t.name)));
        }
    };

    const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
        { key: 'tables', label: 'Tables', icon: <Table size={16} /> },
        { key: 'export_schema', label: 'Export Schema', icon: <Download size={16} /> },
        { key: 'export_data', label: 'Export Data', icon: <FileDown size={16} /> },
        { key: 'import_sql', label: 'Import SQL', icon: <Upload size={16} /> },
        { key: 'run_sql', label: 'Run SQL', icon: <Play size={16} /> },
    ];

    const totalRows = tables.reduce((s, t) => s + t.rows, 0);
    const totalSize = tables.reduce((s, t) => s + t.data_size, 0);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Database className="text-indigo-600" size={28} />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Database Management</h1>
                            <p className="text-sm text-gray-500">
                                {tables.length} tables · {totalRows.toLocaleString()} rows · {(totalSize / 1024).toFixed(1)} MB
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchTables}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-6">
                <div className="flex gap-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => { setActiveTab(tab.key); setExportResult(null); }}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="p-6">
                {/* ─── Tables Tab ─── */}
                {activeTab === 'tables' && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                            <Search size={16} className="text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="ค้นหาตาราง..."
                                className="flex-1 text-sm border-none outline-none"
                            />
                        </div>
                        <div className="overflow-auto max-h-[70vh]">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Table</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Rows</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-600">Size (KB)</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Engine</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-600">Updated</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTables.map(t => (
                                        <React.Fragment key={t.name}>
                                            <tr
                                                className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                                                onClick={() => fetchTableDetail(t.name)}
                                            >
                                                <td className="px-4 py-3 font-mono text-indigo-700 flex items-center gap-2">
                                                    {expandedTable === t.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    {t.name}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-700">{t.rows.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-gray-500">{t.data_size.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-gray-500">{t.engine}</td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">{t.updated || '-'}</td>
                                            </tr>
                                            {expandedTable === t.name && tableColumns[t.name] && (
                                                <tr>
                                                    <td colSpan={5} className="bg-gray-50 px-6 py-4">
                                                        <div className="flex gap-4">
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-xs text-gray-500 uppercase mb-2">Columns</h4>
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="text-gray-500">
                                                                            <th className="text-left py-1 px-2">Field</th>
                                                                            <th className="text-left py-1 px-2">Type</th>
                                                                            <th className="text-left py-1 px-2">Null</th>
                                                                            <th className="text-left py-1 px-2">Key</th>
                                                                            <th className="text-left py-1 px-2">Default</th>
                                                                            <th className="text-left py-1 px-2">Extra</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {tableColumns[t.name].map(col => (
                                                                            <tr key={col.field} className="border-t border-gray-200">
                                                                                <td className="py-1 px-2 font-mono text-indigo-700">{col.field}</td>
                                                                                <td className="py-1 px-2 text-gray-600">{col.type}</td>
                                                                                <td className="py-1 px-2">{col.null === 'YES' ? <span className="text-yellow-600">YES</span> : 'NO'}</td>
                                                                                <td className="py-1 px-2">{col.key && <span className={`px-1 rounded text-xs ${col.key === 'PRI' ? 'bg-yellow-100 text-yellow-800' : col.key === 'UNI' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{col.key}</span>}</td>
                                                                                <td className="py-1 px-2 text-gray-400">{col.default ?? 'NULL'}</td>
                                                                                <td className="py-1 px-2 text-gray-400">{col.extra}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                        {tableCreateSql[t.name] && (
                                                            <div className="mt-3">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <h4 className="font-semibold text-xs text-gray-500 uppercase">CREATE TABLE</h4>
                                                                    <button
                                                                        onClick={() => navigator.clipboard.writeText(tableCreateSql[t.name])}
                                                                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                                    >
                                                                        <Copy size={12} /> Copy
                                                                    </button>
                                                                </div>
                                                                <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto max-h-48">{tableCreateSql[t.name]}</pre>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── Export Schema / Data Tab ─── */}
                {(activeTab === 'export_schema' || activeTab === 'export_data') && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-semibold text-gray-800">
                                        {activeTab === 'export_schema' ? '📤 Export Schema (CREATE TABLE)' : '💾 Export Data → ZIP'}
                                    </h3>
                                    <span className="text-xs text-gray-400">เลือก {selectedTables.size}/{tables.length} ตาราง</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activeTab === 'export_data' && (
                                        <div className="flex items-center gap-2 mr-4">
                                            <label className="text-xs text-gray-500">Limit rows:</label>
                                            <input
                                                type="number"
                                                value={dataLimit || ''}
                                                onChange={e => setDataLimit(parseInt(e.target.value) || 0)}
                                                placeholder="0 = all"
                                                className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
                                            />
                                        </div>
                                    )}
                                    <button onClick={selectAll} className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1">
                                        {selectedTables.size === filteredTables.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <button
                                        onClick={activeTab === 'export_schema' ? handleExportSchema : handleExportData}
                                        disabled={exportLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
                                    >
                                        {exportLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                        {activeTab === 'export_data' ? 'Export ZIP' : 'Export'}
                                    </button>
                                </div>
                            </div>

                            {activeTab === 'export_data' && (
                                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                                    💡 Export Data จะ download เป็นไฟล์ <strong>.zip</strong> (บีบอัด SQL) — สามารถ Import กลับได้ผ่าน tab "Import SQL"
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-60 overflow-auto">
                                {filteredTables.map(t => (
                                    <label
                                        key={t.name}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${selectedTables.has(t.name)
                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedTables.has(t.name)}
                                            onChange={() => toggleTable(t.name)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="truncate font-mono">{t.name}</span>
                                        <span className="text-gray-400 ml-auto">{t.rows}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {exportResult && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                                    <span className="text-sm font-medium text-gray-700">📋 SQL Output ({(exportResult.length / 1024).toFixed(1)} KB)</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigator.clipboard.writeText(exportResult)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            <Copy size={12} /> Copy
                                        </button>
                                        <button
                                            onClick={() => downloadSql(exportResult, `schema_${new Date().toISOString().slice(0, 10)}.sql`)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                        >
                                            <Download size={12} /> Download .sql
                                        </button>
                                    </div>
                                </div>
                                <pre className="bg-gray-900 text-green-400 text-xs p-4 overflow-auto max-h-[50vh] whitespace-pre-wrap">{exportResult}</pre>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Import SQL Tab ─── */}
                {activeTab === 'import_sql' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <h3 className="font-semibold text-gray-800 mb-1">📥 Import SQL File</h3>
                            <p className="text-xs text-gray-500 mb-4">
                                รองรับไฟล์ <strong>.zip</strong> (ที่ export จากหน้านี้) หรือ <strong>.sql</strong> — Execute ทีละ statement แบบ autocommit
                            </p>

                            <div className="flex items-center gap-4">
                                <label className="flex-1">
                                    <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${importFile ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                                        }`}>
                                        <Upload size={32} className={`mx-auto mb-2 ${importFile ? 'text-indigo-500' : 'text-gray-400'}`} />
                                        {importFile ? (
                                            <div>
                                                <p className="font-medium text-indigo-700">{importFile.name}</p>
                                                <p className="text-xs text-gray-500 mt-1">{(importFile.size / 1024 / 1024).toFixed(1)} MB</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-sm text-gray-600">คลิกเพื่อเลือกไฟล์ หรือลากมาวาง</p>
                                                <p className="text-xs text-gray-400 mt-1">.sql หรือ .zip</p>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept=".sql,.zip"
                                        className="hidden"
                                        onChange={e => setImportFile(e.target.files?.[0] || null)}
                                    />
                                </label>
                            </div>

                            {/* Loading overlay */}
                            {importLoading && (
                                <div className="mt-4 p-6 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                                    <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-3" />
                                    <p className="font-semibold text-indigo-800 text-lg">กำลัง Import...</p>
                                    <p className="text-sm text-indigo-600 mt-1">{importFile?.name} ({((importFile?.size || 0) / 1024 / 1024).toFixed(1)} MB)</p>
                                    <p className="text-xs text-gray-500 mt-2">อาจใช้เวลานานสำหรับไฟล์ขนาดใหญ่ กรุณาอย่าปิดหน้านี้</p>
                                </div>
                            )}

                            <div className="mt-4 flex items-center gap-3">
                                <button
                                    onClick={handleImportSql}
                                    disabled={importLoading || !importFile}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
                                >
                                    {importLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                    {importLoading ? 'กำลัง Import...' : 'Import'}
                                </button>
                                {importFile && !importLoading && (
                                    <button
                                        onClick={() => { setImportFile(null); setImportResult(null); }}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        ลบไฟล์
                                    </button>
                                )}
                            </div>
                        </div>

                        {importResult && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className={`p-4 flex items-center gap-3 ${importResult.success ? 'bg-green-50' : 'bg-red-50'
                                    }`}>
                                    {importResult.success ? (
                                        <CheckCircle size={20} className="text-green-600" />
                                    ) : (
                                        <AlertTriangle size={20} className="text-red-600" />
                                    )}
                                    <div>
                                        <p className={`font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                            {importResult.message}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            ✅ สำเร็จ: {importResult.success_count} · ❌ ผิดพลาด: {importResult.error_count}
                                        </p>
                                    </div>
                                </div>

                                {importResult.errors && importResult.errors.length > 0 && (
                                    <div className="border-t border-gray-200">
                                        <div className="p-3 bg-gray-50 text-xs font-medium text-gray-600">
                                            Errors (แสดง {importResult.errors.length} รายการแรก)
                                        </div>
                                        <div className="divide-y divide-gray-100 max-h-60 overflow-auto">
                                            {importResult.errors.map((e, i) => (
                                                <div key={i} className="px-4 py-2 text-xs">
                                                    <div className="flex items-center gap-2 text-red-600">
                                                        <XCircle size={12} />
                                                        <span>Line {e.line}: {e.error}</span>
                                                    </div>
                                                    <pre className="text-gray-400 mt-1 truncate font-mono">{e.sql}</pre>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Run SQL Tab ─── */}
                {activeTab === 'run_sql' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                                <span className="text-sm font-medium text-gray-700">▶️ Execute SQL</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSqlInput('')}
                                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={handleRunSql}
                                        disabled={sqlRunning || !sqlInput.trim()}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
                                    >
                                        {sqlRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                        Execute
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={sqlInput}
                                onChange={e => setSqlInput(e.target.value)}
                                placeholder="-- Paste your SQL here (ALTER TABLE, INSERT INTO, etc.)\n-- Multiple statements separated by ;\n-- Executed in a transaction (auto rollback on error)"
                                className="w-full h-64 p-4 font-mono text-sm bg-gray-900 text-green-400 resize-y outline-none"
                                spellCheck={false}
                            />
                        </div>

                        {sqlMessage && (
                            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${sqlResults.some(r => !r.success)
                                ? 'bg-red-50 border border-red-200 text-red-700'
                                : 'bg-green-50 border border-green-200 text-green-700'
                                }`}>
                                {sqlResults.some(r => !r.success) ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                {sqlMessage}
                            </div>
                        )}

                        {sqlResults.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="p-3 border-b border-gray-100 bg-gray-50">
                                    <span className="text-sm font-medium text-gray-700">Results ({sqlResults.length} statements)</span>
                                </div>
                                <div className="divide-y divide-gray-100 max-h-80 overflow-auto">
                                    {sqlResults.map((r, i) => (
                                        <div key={i} className="px-4 py-2 flex items-start gap-3 text-xs">
                                            {r.success ? (
                                                <CheckCircle size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                                            ) : (
                                                <XCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <pre className="font-mono text-gray-600 truncate">{r.sql}</pre>
                                                {r.success && <span className="text-green-600">Affected rows: {r.affected_rows}</span>}
                                                {r.error && <span className="text-red-600">{r.error}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DatabaseManagementPage;
