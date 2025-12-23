
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus, User } from '../types';
import { validateTrackingBulk } from '../services/api';
import { UploadCloud, CheckCircle, XCircle, AlertTriangle, Plus, Trash2, Loader2 } from 'lucide-react';

type ValidationStatus = 'valid' | 'duplicate' | 'error' | 'unchecked';
interface RowData {
  id: number;
  orderId: string;
  trackingNumber: string;
  status: ValidationStatus;
  message: string;
  normalizedOrderId?: string;
  boxNumber?: number;
}

interface BulkTrackingPageProps {
  currentUser?: User | null; // Make optional if conflicting
  onBulkUpdateTracking: (updates: { orderId: string; trackingNumber: string; boxNumber: number }[]) => Promise<void>;
  orders?: Order[]; // Optional for backward compatibility
}

const createEmptyRow = (id: number): RowData => ({
  id,
  orderId: '',
  trackingNumber: '',
  status: 'unchecked',
  message: '',
  normalizedOrderId: undefined,
  boxNumber: undefined,
});

const detectShippingProvider = (trackingNumber: string): string => {
  const trimmed = trackingNumber.trim().toUpperCase();
  if (!trimmed) return '-';
  if (/^TH[0-9A-Z]{10,}$/.test(trimmed)) return 'Flash Express';
  if (/^\d{12}$/.test(trimmed)) return 'J&T Express';
  if (/^(KER|KEA|KEX|KBK|JST)[0-9A-Z]+$/.test(trimmed)) return 'Kerry Express';
  if (/^[A-Z]{2}\d{9}TH$/.test(trimmed)) return 'Thailand Post';
  return 'Aiport';
};

const BulkTrackingPage: React.FC<BulkTrackingPageProps> = ({ orders: propsOrders, onBulkUpdateTracking, currentUser }) => {
  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  const [isVerified, setIsVerified] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleInputChange = (index: number, field: 'orderId' | 'trackingNumber', value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    newRows[index].status = 'unchecked';
    newRows[index].message = '';
    newRows[index].normalizedOrderId = undefined;
    newRows[index].boxNumber = undefined;
    setRows(newRows);
    setIsVerified(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const pastedRows = pasteData.split('\n').filter(r => r.trim() !== '');

    if (pastedRows.length === 0) return;

    const target = e.target as HTMLInputElement;
    const rowIndex = parseInt(target.dataset.index || '0', 10);

    const newRows = [...rows];
    pastedRows.forEach((pastedRow, i) => {
      const [orderId, trackingNumber] = pastedRow.split(/[\t,]/);
      const currentRowIndex = rowIndex + i;
      if (currentRowIndex < newRows.length) {
        newRows[currentRowIndex] = {
          ...newRows[currentRowIndex],
          orderId: orderId?.trim() || '',
          trackingNumber: trackingNumber?.trim() || '',
          status: 'unchecked',
          message: '',
          normalizedOrderId: undefined,
          boxNumber: undefined,
        };
      } else {
        newRows.push({
          id: newRows.length + 1,
          orderId: orderId?.trim() || '',
          trackingNumber: trackingNumber?.trim() || '',
          status: 'unchecked',
          message: '',
          normalizedOrderId: undefined,
          boxNumber: undefined,
        });
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

  const handleValidate = async () => {
    setValidating(true);
    try {
      // 1. Prepare items for validation
      // Filter non-empty rows
      const itemsToValidate = rows
        .map((r, index) => ({ index, orderId: r.orderId, trackingNumber: r.trackingNumber }))
        .filter(r => r.orderId && r.trackingNumber);

      if (itemsToValidate.length === 0) {
        setValidating(false);
        return;
      }

      // 2. Call API
      const response = await validateTrackingBulk(itemsToValidate.map(i => ({
        orderId: i.orderId,
        trackingNumber: i.trackingNumber
      })));

      const newRows = [...rows];
      let allValid = true;

      // Reset statuses for rows being validated
      itemsToValidate.forEach(item => {
        newRows[item.index].status = 'unchecked';
        newRows[item.index].message = 'Validating...';
      });

      if (response.ok && response.results) {
        response.results.forEach((res: any, idx: number) => {
          const originalRowIndex = itemsToValidate[idx].index;
          const row = newRows[originalRowIndex];

          if (res.isValid) {
            row.status = 'valid';
            row.message = 'Ready to sync';
            row.normalizedOrderId = res.foundOrderId; // Resolved ID from DB
            row.boxNumber = res.boxNumber;
          } else {
            allValid = false;
            row.status = res.status === 'duplicate' ? 'duplicate' : 'error';
            row.message = res.message;
          }
        });
      } else {
        allValid = false;
        // Mark all as error if API fail
        itemsToValidate.forEach(item => {
          newRows[item.index].status = 'error';
          newRows[item.index].message = 'Validation API Failed';
        });
      }

      // Check for batch-local duplicates (client-side check strictly for the text input)
      // Although API could do this, client check gives instant feedback on the input set itself
      const seenTracking = new Map<string, number[]>();
      newRows.forEach((r, idx) => {
        if (!r.trackingNumber) return;
        const t = r.trackingNumber.trim();
        if (!seenTracking.has(t)) seenTracking.set(t, []);
        seenTracking.get(t)?.push(idx);
      });

      seenTracking.forEach((indices, t) => {
        if (indices.length > 1) {
          indices.forEach(idx => {
            newRows[idx].status = 'duplicate';
            newRows[idx].message = 'Duplicate in this batch';
            allValid = false; // Invalidate batch
          });
        }
      });

      setRows(newRows);
      setIsVerified(allValid);
    } catch (error) {
      console.error("Validation failed", error);
      alert("Validation failed: " + error);
    } finally {
      setValidating(false);
    }
  };

  const { validCount, duplicateCount, errorCount } = useMemo(() => {
    return rows.reduce((acc, row) => {
      if (row.status === 'valid') acc.validCount++;
      if (row.status === 'duplicate') acc.duplicateCount++;
      if (row.status === 'error') acc.errorCount++;
      return acc;
    }, { validCount: 0, duplicateCount: 0, errorCount: 0 });
  }, [rows]);

  const handleImport = async () => {
    const updates = rows
      .filter(row => row.status === 'valid')
      .map(({ normalizedOrderId, orderId, trackingNumber, boxNumber }) => ({
        orderId: (normalizedOrderId || orderId).trim(),
        trackingNumber,
        boxNumber: boxNumber ?? 1,
      }));

    if (updates.length > 0) {
      if (window.confirm(`คุณต้องการนำเข้าเลข Tracking จำนวน ${updates.length} รายการใช่หรือไม่?`)) {
        try {
          // Update tracking numbers via callback
          await onBulkUpdateTracking(updates);

          alert("นำเข้าข้อมูลเรียบร้อยแล้ว");
          // Reset
          setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
          setIsVerified(false);
        } catch (error) {
          console.error("Import failed", error);
          alert("เกิดข้อผิดพลาดในการนำเข้า");
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <UploadCloud size={20} className="text-blue-600" />
            นำเข้า Tracking Number (Bulk)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            รองรับการ Copy & Paste จาก Excel (คอลัมน์ A: Order ID, คอลัมน์ B: Tracking Number)
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex gap-4 text-sm mr-4 items-center">
            <span className="flex items-center gap-1 text-green-600"><CheckCircle size={16} /> {validCount} ผ่าน</span>
            <span className="flex items-center gap-1 text-yellow-600"><AlertTriangle size={16} /> {duplicateCount} ซ้ำ</span>
            <span className="flex items-center gap-1 text-red-600"><XCircle size={16} /> {errorCount} ผิดพลาด</span>
          </div>

          <button
            onClick={handleValidate}
            disabled={validating}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${validating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
              }`}
          >
            {validating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
            {validating ? 'กำลังตรวจสอบ...' : 'ตรวจสอบข้อมูล'}
          </button>

          <button
            onClick={handleImport}
            disabled={!isVerified || validCount === 0 || validating}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${!isVerified || validCount === 0 || validating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
              }`}
          >
            <UploadCloud size={18} />
            นำเข้าข้อมูล ({validCount})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  #
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Order ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Tracking Number
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                  Shipping Provider
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.orderId}
                      onChange={(e) => handleInputChange(index, 'orderId', e.target.value)}
                      onPaste={handlePaste}
                      data-index={index}
                      placeholder="e.g. ORD-1234"
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${row.status === 'error' ? 'border-red-300 bg-red-50' : ''
                        }`}
                    />
                    {row.normalizedOrderId && row.normalizedOrderId !== row.orderId && (
                      <span className="text-xs text-green-600 block mt-1">Matched: {row.normalizedOrderId} (Box {row.boxNumber})</span>
                    )}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.trackingNumber}
                      onChange={(e) => handleInputChange(index, 'trackingNumber', e.target.value)}
                      placeholder="Tracking No."
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${row.status === 'duplicate' ? 'border-yellow-300 bg-yellow-50' : ''
                        }`}
                    />
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {row.trackingNumber ? detectShippingProvider(row.trackingNumber) : '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      {row.status === 'valid' && (
                        <span className="flex items-center text-green-600 text-sm">
                          <CheckCircle size={16} className="mr-1.5" />
                          {row.message || 'พร้อมนำเข้า'}
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="flex items-center text-red-600 text-sm">
                          <XCircle size={16} className="mr-1.5" />
                          {row.message || 'ข้อมูลไม่ถูกต้อง'}
                        </span>
                      )}
                      {row.status === 'duplicate' && (
                        <span className="flex items-center text-yellow-600 text-sm">
                          <AlertTriangle size={16} className="mr-1.5" />
                          {row.message || 'ข้อมูลซ้ำ'}
                        </span>
                      )}
                      {row.status === 'unchecked' && row.orderId && row.trackingNumber && (
                        <span className="text-gray-400 text-sm italic">รอตรวจสอบ...</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => removeRow(index)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                      title="ลบแถว"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-center pb-4">
          <button
            onClick={addRow}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors"
          >
            <Plus size={18} />
            เพิ่มแถว
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkTrackingPage;
