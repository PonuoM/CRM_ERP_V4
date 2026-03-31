
import React, { useState, useMemo } from 'react';
import { UploadCloud, CheckCircle, XCircle, AlertTriangle, Plus, Trash2, Loader2, Clipboard } from 'lucide-react';
import { validateReturnCandidates } from '../services/api';

type ValidationStatus = 'valid' | 'duplicate' | 'error' | 'unchecked' | 'warning' | 'cod_warning';

interface RowData {
    id: number;
    trackingNumber: string;
    note: string; // Column B: หมายเหตุ (ทุก mode)
    extraValue: string; // Column C: return_complete (good) or return_claim (damaged/lost)
    status: ValidationStatus;
    message: string;
    subOrderId?: string;
    foundStatus?: string;
    hasCodRecord?: boolean;
    codMessage?: string;
    codOverride?: boolean; // User acknowledged COD warning via checkbox
}

interface BulkReturnImportProps {
    mode: 'returning' | 'returned' | 'good' | 'damaged' | 'lost';
    onImport: (items: { tracking_number: string; sub_order_id?: string; status: string; note: string; return_complete?: number; return_claim?: number | null }[]) => Promise<void>;
}

const createEmptyRow = (id: number): RowData => ({
    id,
    trackingNumber: '',
    note: '',
    extraValue: '',
    status: 'unchecked',
    message: '',
});

// Parse return_complete from various formats
const parseReturnComplete = (val: string): boolean => {
    const v = val.trim().toLowerCase();
    return ['1', 'true', 'yes', 'จบ', 'จบเคส', 'y'].includes(v);
};

const detectShippingProvider = (trackingNumber: string): string => {
    const trimmed = trackingNumber.trim().toUpperCase();
    if (!trimmed) return '-';
    if (/^TH[0-9A-Z]{10,}$/.test(trimmed)) return 'Flash Express';
    if (/^\d{12}$/.test(trimmed)) return 'J&T Express';
    if (/^(KER|KEA|KEX|KBK|JST)[0-9A-Z]+$/.test(trimmed)) return 'Kerry Express';
    if (/^[A-Z]{2}\d{9}TH$/.test(trimmed)) return 'Thailand Post';
    return 'Aiport';
};

const BulkReturnImport: React.FC<BulkReturnImportProps> = ({ mode, onImport }) => {
    const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
    const [isVerified, setIsVerified] = useState(false);
    const [validating, setValidating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [validateError, setValidateError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<ValidationStatus | 'all'>('all');

    const toggleFilter = (status: ValidationStatus | 'all') => {
        setStatusFilter(prev => prev === status ? 'all' : status);
    };

    const handleInputChange = (index: number, field: 'trackingNumber' | 'note' | 'extraValue', value: string) => {
        const newRows = [...rows];
        if (field === 'trackingNumber') {
            newRows[index].trackingNumber = value;
            newRows[index].status = 'unchecked';
            newRows[index].message = '';
            newRows[index].subOrderId = undefined;
            newRows[index].hasCodRecord = undefined;
            newRows[index].codMessage = undefined;
            newRows[index].codOverride = undefined;
        } else if (field === 'note') {
            newRows[index].note = value;
        } else {
            newRows[index].extraValue = value;
        }
        setRows(newRows);
        setIsVerified(false);
    };

    // Whether this mode needs an extra column
    const hasExtraColumn = mode === 'good' || mode === 'damaged' || mode === 'lost';
    const extraColumnLabel = mode === 'good' ? 'จบเคส (1/0)' : 'จำนวนเงินเคลม';

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text');
        const pastedLines = pasteData.split(/\r?\n/).filter(r => r.trim() !== '');

        if (pastedLines.length === 0) return;

        const target = e.target as HTMLInputElement;
        const rowIndex = parseInt(target.dataset.index || '0', 10);

        const newRows = [...rows];
        pastedLines.forEach((line, i) => {
            const parts = line.split(/[\t,]/);
            const tracking = parts[0].trim();
            // Column B = หมายเหตุ (note) — ทุก mode
            const note = parts.length > 1 ? parts[1].trim() : '';
            // Column C = extra value (return_complete or return_claim) — เฉพาะ good/damaged/lost
            const extra = parts.length > 2 && hasExtraColumn ? parts[2].trim() : '';

            const currentRowIndex = rowIndex + i;
            const rowData: RowData = {
                id: currentRowIndex < newRows.length ? newRows[currentRowIndex].id : newRows.length + 1,
                trackingNumber: tracking,
                note,
                extraValue: extra,
                status: 'unchecked',
                message: '',
                subOrderId: undefined
            };

            if (currentRowIndex < newRows.length) {
                newRows[currentRowIndex] = rowData;
            } else {
                newRows.push(rowData);
            }
        });

        setRows(newRows);
        setIsVerified(false);
    };

    const addRow = () => {
        setRows([...rows, createEmptyRow(rows.length + 1)]);
    };

    const removeRow = (index: number) => {
        setRows(rows.filter((_, i) => i !== index));
    }

    const handleCodOverride = (index: number, checked: boolean) => {
        const newRows = [...rows];
        newRows[index].codOverride = checked;
        // If override is checked, treat as importable (change status from cod_warning to valid/warning)
        if (checked && newRows[index].status === 'cod_warning') {
            // Keep the COD info but allow import
            // Check if it also had a return_status warning
            if (newRows[index].foundStatus) {
                newRows[index].status = 'warning';
            } else {
                newRows[index].status = 'valid';
            }
        } else if (!checked && newRows[index].hasCodRecord) {
            // Re-apply cod_warning
            newRows[index].status = 'cod_warning';
        }
        setRows(newRows);
        // Re-evaluate isVerified
        const filledRows = newRows.filter(r => r.trackingNumber);
        const allImportable = filledRows.every(r => r.status === 'valid' || r.status === 'warning');
        setIsVerified(allImportable);
    };

    const handleValidate = async () => {
        setValidating(true);
        try {
            const candidates = rows
                .map((r, index) => ({ index, trackingNumber: r.trackingNumber }))
                .filter(r => r.trackingNumber); // Filter empty

            if (candidates.length === 0) {
                setValidating(false);
                return;
            }

            const response = await validateReturnCandidates(candidates, mode);

            const newRows = [...rows];
            let allValid = true;

            // Reset for current batch
            candidates.forEach(c => {
                newRows[c.index].status = 'unchecked'; // temporarily unused but clear old
            });

            if (response && response.results) {
                response.results.forEach((res: any) => {
                    const row = newRows[res.index];
                    if (res.valid) {
                        if (res.isWarning) {
                            row.status = 'warning';
                        } else {
                            row.status = 'valid';
                        }
                        row.message = res.message;
                        row.subOrderId = res.subOrderId;
                        row.foundStatus = res.foundStatus;
                    } else {
                        allValid = false;
                        // Distinguish duplicate vs error?
                        if (res.message.toLowerCase().includes('duplicate') || res.message.toLowerCase().includes('already')) {
                            row.status = 'duplicate';
                        } else {
                            row.status = 'error';
                        }
                        row.message = res.message;
                        row.foundStatus = res.foundStatus;
                    }

                    // COD record check — override status to cod_warning if applicable
                    if (res.hasCodRecord && res.isCodWarning) {
                        row.hasCodRecord = true;
                        row.codMessage = res.codMessage || 'ออเดอร์นี้มียอด COD แล้ว';
                        // Only block if row was valid/warning (don't override existing errors)
                        if (row.status === 'valid' || row.status === 'warning') {
                            row.status = 'cod_warning';
                            row.codOverride = false;
                            allValid = false;
                        }
                    } else {
                        row.hasCodRecord = false;
                        row.codOverride = undefined;
                    }
                });
            } else {
                allValid = false;
                candidates.forEach(c => {
                    newRows[c.index].status = 'error';
                    newRows[c.index].message = 'เกิดข้อผิดพลาด API';
                });
            }

            // Client side duplicate check
            const seen = new Map<string, number[]>();
            newRows.forEach((r, idx) => {
                if (!r.trackingNumber) return;
                const t = r.trackingNumber.trim();
                if (!seen.has(t)) seen.set(t, []);
                seen.get(t)?.push(idx);
            });

            seen.forEach((indices) => {
                if (indices.length > 1) {
                    allValid = false;
                    indices.forEach(idx => {
                        newRows[idx].status = 'duplicate';
                        newRows[idx].message = 'ซ้ำในชุดนี้';
                    });
                }
            });

            setRows(newRows);
            setIsVerified(allValid);

        } catch (error) {
            console.error(error);
            setValidateError('ตรวจสอบไม่สำเร็จ');
            setTimeout(() => setValidateError(null), 4000);
        } finally {
            setValidating(false);
        }
    };

    const { validCount, warningCount, duplicateCount, errorCount, codWarningCount } = useMemo(() => {
        return rows.reduce((acc, row) => {
            if (row.trackingNumber) {
                if (row.status === 'valid') acc.validCount++;
                if (row.status === 'warning') acc.warningCount++;
                if (row.status === 'duplicate') acc.duplicateCount++;
                if (row.status === 'error') acc.errorCount++;
                if (row.status === 'cod_warning') acc.codWarningCount++;
            }
            return acc;
        }, { validCount: 0, warningCount: 0, duplicateCount: 0, errorCount: 0, codWarningCount: 0 });
    }, [rows]);

    // Can import if verified OR all cod_warnings have been overridden
    const importableCount = validCount + warningCount;
    const canImport = (isVerified || (codWarningCount === 0 && errorCount === 0 && duplicateCount === 0)) && importableCount > 0;

    const handleRequestImport = () => {
        if (!canImport) return;
        setShowConfirmModal(true);
    };

    const handleExecuteImport = async () => {
        setShowConfirmModal(false);
        if (!canImport) return;

        setImporting(true);
        try {
            const itemsToImport = rows
                .filter(r => r.status === 'valid' || r.status === 'warning')
                .map(r => {
                    const item: any = {
                        tracking_number: r.trackingNumber,
                        sub_order_id: r.subOrderId,
                        status: mode,
                        note: r.note || '',
                    };
                    if (mode === 'good') {
                        item.return_complete = parseReturnComplete(r.extraValue) ? 1 : 0;
                    } else if (mode === 'damaged' || mode === 'lost') {
                        const claimVal = parseFloat(r.extraValue);
                        item.return_claim = !isNaN(claimVal) && claimVal > 0 ? claimVal : null;
                    }
                    return item;
                });

            await onImport(itemsToImport);
            // Success handled by parent usually, but we can clear here
            setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
            setIsVerified(false);
        } catch (err) {
            console.error(err);
            // Alert handled by parent?
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-200 flex flex-wrap justify-between items-center bg-gray-50 gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Clipboard className="text-blue-600" size={20} />
                        นำเข้าข้อมูล ({
                            mode === 'returning' ? 'กำลังตีกลับ' :
                                mode === 'returned' ? 'เข้าคลังแล้ว' :
                                    mode === 'good' ? 'สภาพดี' :
                                        mode === 'damaged' ? 'เสียหาย' :
                                            'สูญหาย'
                        })
                    </h3>
                    <p className="text-sm text-gray-500">
                        วางเลข Tracking (บรรทัดละ 1 เลข) | คอลัมน์ B: หมายเหตุ{hasExtraColumn && <span className="ml-1">| คอลัมน์ C: {extraColumnLabel}</span>}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex gap-1 text-sm mr-2">
                        <button
                            onClick={() => toggleFilter('valid')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer hover:bg-green-50 ${statusFilter === 'valid' ? 'bg-green-100 ring-2 ring-green-400' : ''} text-green-600`}
                            title="แสดงเฉพาะพร้อมนำเข้า"
                        >
                            <CheckCircle size={16} /> {validCount}
                        </button>
                        {warningCount > 0 && (
                            <button
                                onClick={() => toggleFilter('warning')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer hover:bg-yellow-50 ${statusFilter === 'warning' ? 'bg-yellow-100 ring-2 ring-yellow-400' : ''} text-yellow-600`}
                                title="แสดงเฉพาะมีสถานะซ้ำ"
                            >
                                <AlertTriangle size={16} /> {warningCount}
                            </button>
                        )}
                        <button
                            onClick={() => toggleFilter('duplicate')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer hover:bg-orange-50 ${statusFilter === 'duplicate' ? 'bg-orange-100 ring-2 ring-orange-400' : ''} text-orange-500`}
                            title="แสดงเฉพาะซ้ำ"
                        >
                            <AlertTriangle size={16} /> {duplicateCount}
                        </button>
                        <button
                            onClick={() => toggleFilter('error')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer hover:bg-red-50 ${statusFilter === 'error' || statusFilter === 'cod_warning' ? 'bg-red-100 ring-2 ring-red-400' : ''} text-red-600`}
                            title="แสดงเฉพาะ Error / COD"
                        >
                            <XCircle size={16} /> {errorCount + codWarningCount}
                        </button>
                        {statusFilter !== 'all' && (
                            <button
                                onClick={() => setStatusFilter('all')}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-500 hover:bg-gray-100 transition-all text-xs"
                                title="ล้างตัวกรอง"
                            >
                                ✕ ล้าง
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleValidate}
                        disabled={validating || importing}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${validating ? 'bg-gray-300 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                    >
                        {validating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                        ตรวจสอบ
                    </button>

                    <button
                        onClick={handleRequestImport}
                        disabled={!canImport || importing || validating}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${!canImport ? 'bg-gray-300 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                    >
                        {importing ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                        {importing ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">เลข Tracking</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40">หมายเหตุ</th>
                            {hasExtraColumn && (
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-36">{extraColumnLabel}</th>
                            )}
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ขนส่ง</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ออเดอร์ที่พบ</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                            <th className="px-4 py-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {rows.map((row, index) => {
                            // Apply status filter
                            if (statusFilter !== 'all') {
                                if (statusFilter === 'error') {
                                    // Error filter includes both 'error' and 'cod_warning'
                                    if (row.status !== 'error' && row.status !== 'cod_warning') return null;
                                } else if (row.status !== statusFilter) {
                                    return null;
                                }
                            }
                            return (
                            <tr key={row.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} ${row.status === 'cod_warning' ? '!bg-red-50/60' : ''}`}>
                                <td className="px-4 py-2 text-sm text-gray-500">{index + 1}</td>
                                <td className="px-4 py-2">
                                    <input
                                        type="text"
                                        value={row.trackingNumber}
                                        onChange={(e) => handleInputChange(index, 'trackingNumber', e.target.value)}
                                        onPaste={handlePaste}
                                        data-index={index}
                                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${row.status === 'error' || row.status === 'cod_warning' ? 'bg-red-50 border-red-300' :
                                            row.status === 'duplicate' ? 'bg-yellow-50 border-yellow-300' : ''
                                            }`}
                                        placeholder="เลข Tracking"
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <input
                                        type="text"
                                        value={row.note}
                                        onChange={(e) => handleInputChange(index, 'note', e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="หมายเหตุ"
                                    />
                                </td>
                                {hasExtraColumn && (
                                    <td className="px-4 py-2">
                                        {mode === 'good' ? (
                                            <select
                                                value={row.extraValue || '0'}
                                                onChange={(e) => handleInputChange(index, 'extraValue', e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                                            >
                                                <option value="0">ยังไม่จบ</option>
                                                <option value="1">จบเคส ✅</option>
                                            </select>
                                        ) : (
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={row.extraValue}
                                                onChange={(e) => handleInputChange(index, 'extraValue', e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
                                                placeholder="฿ เคลม"
                                            />
                                        )}
                                    </td>
                                )}
                                <td className="px-4 py-2 text-sm text-gray-500">
                                    {detectShippingProvider(row.trackingNumber)}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600 font-mono">
                                    {row.subOrderId || '-'}
                                </td>
                                <td className="px-4 py-2">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center text-sm">
                                            {row.status === 'valid' && (
                                                <span className="text-green-600 flex items-center gap-1">
                                                    <CheckCircle size={14} /> พร้อมนำเข้า
                                                </span>
                                            )}
                                            {row.status === 'warning' && (
                                                <span className="text-yellow-600 flex items-center gap-1">
                                                    <AlertTriangle size={14} /> {row.message}
                                                </span>
                                            )}
                                            {row.status === 'error' && (
                                                <span className="text-red-600 flex items-center gap-1">
                                                    <XCircle size={14} /> {row.message}
                                                </span>
                                            )}
                                            {row.status === 'cod_warning' && (
                                                <span className="text-red-600 flex items-center gap-1">
                                                    <XCircle size={14} /> {row.codMessage || 'ออเดอร์นี้มียอด COD แล้ว'}
                                                </span>
                                            )}
                                            {row.status === 'duplicate' && (
                                                <span className="text-orange-600 flex items-center gap-1">
                                                    <AlertTriangle size={14} /> {row.message}
                                                </span>
                                            )}
                                            {row.status === 'unchecked' && row.trackingNumber && (
                                                <span className="text-gray-400 italic">รอตรวจสอบ</span>
                                            )}
                                        </div>
                                        {/* COD override checkbox — shown for cod_warning OR valid/warning rows that had COD */}
                                        {row.hasCodRecord && (row.status === 'cod_warning' || row.codOverride) && (
                                            <label className="flex items-center gap-1.5 cursor-pointer group mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={row.codOverride || false}
                                                    onChange={(e) => handleCodOverride(index, e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                                />
                                                <span className="text-[11px] text-red-500 group-hover:text-red-700 select-none">
                                                    ดำเนินการอัปเดตเป็นตีกลับต่อ
                                                </span>
                                            </label>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <button
                                        onClick={() => removeRow(index)}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors"
                    >
                        <Plus size={18} /> เพิ่มแถว
                    </button>
                </div>
            </div>

            {/* Validate error toast */}
            {validateError && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-pulse z-50">
                    <XCircle size={16} /> {validateError}
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]" onClick={() => setShowConfirmModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <UploadCloud className="text-green-600" size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">ยืนยันนำเข้าข้อมูล</h3>
                                <p className="text-sm text-gray-500">กรุณาตรวจสอบข้อมูลก่อนดำเนินการ</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">โหมด</span>
                                <span className="font-medium text-gray-800">
                                    {mode === 'returning' ? 'กำลังตีกลับ' : mode === 'returned' ? 'เข้าคลังแล้ว' : mode === 'good' ? 'สภาพดี' : mode === 'damaged' ? 'เสียหาย' : 'สูญหาย'}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">จำนวนที่จะนำเข้า</span>
                                <span className="font-semibold text-green-600">{importableCount} รายการ</span>
                            </div>
                            {warningCount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">มีสถานะซ้ำ (จะ overwrite)</span>
                                    <span className="font-medium text-yellow-600">{warningCount} รายการ</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleExecuteImport}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <UploadCloud size={18} />
                                ยืนยันนำเข้า
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkReturnImport;
