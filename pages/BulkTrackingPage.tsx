
import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { UploadCloud, CheckCircle, XCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';

type ValidationStatus = 'valid' | 'duplicate' | 'error' | 'unchecked';
interface RowData {
  id: number;
  orderId: string;
  trackingNumber: string;
  status: ValidationStatus;
  message: string;
}

interface BulkTrackingPageProps {
  orders: Order[];
  onBulkUpdateTracking: (updates: { orderId: string, trackingNumber: string }[]) => void;
}

const createEmptyRow = (id: number): RowData => ({
  id,
  orderId: '',
  trackingNumber: '',
  status: 'unchecked',
  message: '',
});

const BulkTrackingPage: React.FC<BulkTrackingPageProps> = ({ orders, onBulkUpdateTracking }) => {
  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  const [isVerified, setIsVerified] = useState(false);

  const handleInputChange = (index: number, field: 'orderId' | 'trackingNumber', value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    // Reset status on change
    newRows[index].status = 'unchecked';
    newRows[index].message = '';
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
        const [orderId, trackingNumber] = pastedRow.split(/[\t,]/); // Split by tab or comma
        const currentRowIndex = rowIndex + i;
        if (currentRowIndex < newRows.length) {
            newRows[currentRowIndex] = {
                ...newRows[currentRowIndex],
                orderId: orderId?.trim() || '',
                trackingNumber: trackingNumber?.trim() || '',
                status: 'unchecked',
                message: ''
            };
        } else {
            newRows.push({
                id: newRows.length + 1,
                orderId: orderId?.trim() || '',
                trackingNumber: trackingNumber?.trim() || '',
                status: 'unchecked',
                message: ''
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

  const handleValidate = () => {
    const validatedRows = rows.map(row => {
        if (!row.orderId.trim() && !row.trackingNumber.trim()) {
            return { ...row, status: 'unchecked' as ValidationStatus, message: '' };
        }
        if (!row.orderId.trim() || !row.trackingNumber.trim()) {
            return { ...row, status: 'error' as ValidationStatus, message: 'ข้อมูลไม่ครบถ้วน' };
        }
        
        const order = orders.find(o => o.id.toLowerCase() === row.orderId.toLowerCase());
        if (!order) {
            return { ...row, status: 'error' as ValidationStatus, message: 'ไม่พบออเดอร์' };
        }

        if (order.trackingNumbers.includes(row.trackingNumber)) {
            return { ...row, status: 'duplicate' as ValidationStatus, message: 'เลข tracking นี้มีอยู่แล้ว' };
        }

        return { ...row, status: 'valid' as ValidationStatus, message: 'พร้อมนำเข้า' };
    });
    setRows(validatedRows);
    setIsVerified(true);
  };

  const { validCount, duplicateCount, errorCount } = useMemo(() => {
    return rows.reduce((acc, row) => {
        if (row.status === 'valid') acc.validCount++;
        if (row.status === 'duplicate') acc.duplicateCount++;
        if (row.status === 'error') acc.errorCount++;
        return acc;
    }, { validCount: 0, duplicateCount: 0, errorCount: 0 });
  }, [rows]);

  const handleImport = () => {
    const updates = rows
      .filter(row => row.status === 'valid')
      .map(({ orderId, trackingNumber }) => ({ orderId, trackingNumber }));

    if (updates.length > 0) {
      if (window.confirm(`คุณต้องการนำเข้าเลข Tracking จำนวน ${updates.length} รายการใช่หรือไม่?`)) {
        onBulkUpdateTracking(updates);
        setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
        setIsVerified(false);
        alert('นำเข้าข้อมูลสำเร็จ!');
      }
    } else {
      alert('ไม่มีข้อมูลที่พร้อมสำหรับนำเข้า');
    }
  };

  const getStatusIndicator = (status: ValidationStatus, message: string) => {
    switch (status) {
      case 'valid':
        return <div className="flex items-center text-green-600"><CheckCircle size={14} className="mr-1.5"/> {message}</div>;
      case 'duplicate':
        return <div className="flex items-center text-yellow-600"><AlertTriangle size={14} className="mr-1.5"/> {message}</div>;
      case 'error':
        return <div className="flex items-center text-red-600"><XCircle size={14} className="mr-1.5"/> {message}</div>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">นำเข้า Tracking Number</h2>
      <p className="text-gray-600 mb-6">คัดลอกข้อมูลจากไฟล์ Excel/CSV (2 คอลัมน์: Order ID, Tracking) แล้ววางลงในตารางด้านล่าง</p>
      
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center">
            {isVerified ? (
                 <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center text-green-600 font-medium"><CheckCircle size={16} className="mr-2"/>พร้อมนำเข้า: {validCount}</span>
                    <span className="flex items-center text-yellow-600"><AlertTriangle size={16} className="mr-2"/>ซ้ำซ้อน (จะถูกข้าม): {duplicateCount}</span>
                    <span className="flex items-center text-red-600"><XCircle size={16} className="mr-2"/>ผิดพลาด: {errorCount}</span>
                </div>
            ) : (
                <p className="text-sm text-gray-500">วางข้อมูลแล้วกด "ตรวจสอบข้อมูล" เพื่อดำเนินการต่อ</p>
            )}
            <div className="flex items-center space-x-2">
                <button onClick={handleValidate} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md py-2 px-3 hover:bg-gray-50">ตรวจสอบข้อมูล</button>
                <button onClick={handleImport} disabled={!isVerified || validCount === 0} className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed">
                    <UploadCloud size={16} className="mr-2"/>
                    ยืนยันการนำเข้า ({validCount})
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-20rem)]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-3 w-12 text-center">#</th>
              <th className="px-6 py-3">เลข Order (เช่น ORD-2024-XXX)</th>
              <th className="px-6 py-3">เลข Tracking</th>
              <th className="px-6 py-3">สถานะ</th>
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {rows.map((row, index) => (
              <tr key={row.id} className={`border-b ${row.status === 'valid' ? 'bg-green-50' : row.status === 'error' ? 'bg-red-50' : ''}`}>
                <td className="px-2 py-1 text-center text-gray-400">{index + 1}</td>
                <td className="px-6 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.orderId}
                    onChange={(e) => handleInputChange(index, 'orderId', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="ORD-..."
                  />
                </td>
                <td className="px-6 py-1">
                   <input
                    type="text"
                    data-index={index}
                    value={row.trackingNumber}
                    onChange={(e) => handleInputChange(index, 'trackingNumber', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="TH123..."
                  />
                </td>
                <td className="px-6 py-1 text-xs font-medium">
                    {getStatusIndicator(row.status, row.message)}
                </td>
                <td className="px-2 py-1 text-center">
                    <button onClick={() => removeRow(index)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 size={14}/>
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2">
            <button onClick={addRow} className="w-full text-sm flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 py-1.5 rounded-md">
                <Plus size={16} className="mr-1"/> เพิ่มแถว
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkTrackingPage;
