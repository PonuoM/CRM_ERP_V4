import React, { useState, useMemo } from 'react';
import { UploadCloud, CheckCircle, XCircle, AlertTriangle, Plus, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { apiFetch } from '../services/api';

type ValidationStatus = 'valid' | 'duplicate' | 'error' | 'unchecked';

interface RowData {
  id: number;
  orderId: string;
  statusText: string;
  username: string;
  orderDate: string;
  skuReference: string;
  variationName: string;
  totalAmount: string;
  couponCodes: string;
  status: ValidationStatus;
  message: string;
}

const createEmptyRow = (id: number): RowData => ({
  id,
  orderId: '',
  statusText: '',
  username: '',
  orderDate: '',
  skuReference: '',
  variationName: '',
  totalAmount: '',
  couponCodes: '',
  status: 'unchecked',
  message: '',
});

const ShopeeLoyaltyImport: React.FC = () => {
  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  const [isVerified, setIsVerified] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<{ imported: number; coupons: number } | null>(null);

  const handleInputChange = (index: number, field: keyof RowData, value: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value, status: 'unchecked', message: '' };
    setRows(newRows);
    setIsVerified(false);
    setSuccessMsg(null);
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
      // Typically pasting from Excel gives tab separated values
      const cols = pastedRow.split('\t');
      
      const orderId = cols[0] || '';
      const statusText = cols[1] || '';
      const username = cols[2] || '';
      const orderDate = cols[3] || '';
      const skuReference = cols[4] || '';
      const variationName = cols[5] || '';
      const totalAmount = cols[6] || '';
      const couponCodes = cols[7] || '';

      const currentRowIndex = rowIndex + i;
      const rowData = {
        orderId: orderId.trim(),
        statusText: statusText.trim(),
        username: username.trim(),
        orderDate: orderDate.trim(),
        skuReference: skuReference.trim(),
        variationName: variationName.trim(),
        totalAmount: totalAmount.trim(),
        couponCodes: couponCodes.trim(),
        status: 'unchecked' as ValidationStatus,
        message: '',
      };

      if (currentRowIndex < newRows.length) {
        newRows[currentRowIndex] = { ...newRows[currentRowIndex], ...rowData };
      } else {
        newRows.push({
          id: newRows.length + 1,
          ...rowData
        });
      }
    });

    setRows(newRows);
    setIsVerified(false);
    setSuccessMsg(null);
  };

  const addRow = () => {
    setRows([...rows, createEmptyRow(rows.length + 1)]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  }

  const handleValidate = () => {
    setValidating(true);
    setSuccessMsg(null);
    
    // Check locally since we don't have a validate API
    const newRows = [...rows];
    let allValid = true;
    let hasDataToValidate = false;
    const seenOrders = new Set<string>();

    newRows.forEach((row, i) => {
      // skip empty rows completely
      if (!row.orderId && !row.username && !row.totalAmount && !row.statusText && !row.orderDate) {
        row.status = 'unchecked';
        row.message = '';
        return;
      }

      hasDataToValidate = true;

      if (!row.orderId) {
        row.status = 'error';
        row.message = 'ไม่มี Order ID';
        allValid = false;
      } else if (!row.statusText) {
        row.status = 'error';
        row.message = 'ไม่มีสถานะ';
        allValid = false;
      } else if (!row.username) {
        row.status = 'error';
        row.message = 'ไม่มี Username';
        allValid = false;
      } else {
        // No duplicate check blocking. If seen before, it's a multi-item order. Both are valid.
        if (seenOrders.has(row.orderId)) {
          row.status = 'valid';
          row.message = 'สินค้าหลายรายการ';
        } else {
          seenOrders.add(row.orderId);
          row.status = 'valid';
          row.message = 'พร้อมนำเข้า';
        }
      }
    });

    setRows(newRows);
    setIsVerified(allValid && hasDataToValidate);
    setValidating(false);
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
    const validRows = rows.filter(r => r.status === 'valid');
    if (validRows.length === 0) return;

    if (!window.confirm(`คุณต้องการนำเข้าข้อมูลจำนวน ${validRows.length} รายการใช่หรือไม่?`)) {
      return;
    }

    setLoading(true);

    try {
      const payload = validRows.map(r => ({
        order_id: r.orderId,
        status: r.statusText,
        username: r.username,
        order_date: r.orderDate,
        sku_reference: r.skuReference,
        variation_name: r.variationName,
        coupon_codes: r.couponCodes,
        total_amount: parseFloat(r.totalAmount.replace(/,/g, '')) || 0,
      }));

      const response = await apiFetch('shopee_loyalty?action=import', {
        method: 'POST',
        body: JSON.stringify({ orders: payload })
      });

      if (response && response.ok) {
        setSuccessMsg({
          imported: response.imported,
          coupons: response.couponsGenerated
        });
        // Clear valid rows
        setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
        setIsVerified(false);
      } else {
        alert(response.message || 'เกิดข้อผิดพลาดในการนำเข้า');
      }
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-100px)]">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <UploadCloud size={20} className="text-blue-600" />
              นำเข้าข้อมูล Shopee (Bulk)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              รองรับการ Copy & Paste จาก Excel (ลำดับคอลัมน์: Order ID, สถานะ, Username, วันที่สั่งซื้อ, เลขอ้างอิง SKU, ชื่อตัวเลือก, ยอดเงิน, รหัสคูปอง)
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
              disabled={!isVerified || validCount === 0 || loading}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${!isVerified || validCount === 0 || loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                }`}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
              นำเข้าข้อมูล ({validCount})
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="m-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-start space-x-3 border border-green-100">
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-green-500" />
            <div>
              <p className="font-medium text-green-900">นำเข้าข้อมูลสำเร็จ!</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>ออเดอร์ที่ถูกบันทึก/สะสมแต้มใหม่: <strong>{successMsg.imported}</strong> รายการ</li>
                <li>สร้างคูปองส่วนลดอัตโนมัติ: <strong>{successMsg.coupons}</strong> ใบ</li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Order ID</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">สถานะ</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Username</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">วันที่สั่งซื้อ</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">SKU Reference</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">Variation Name</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">ยอดเงิน</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">รหัสคูปอง</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">ตรวจสอบ</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.orderId}
                        onChange={(e) => handleInputChange(index, 'orderId', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="Order ID"
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${row.status === 'error' && !row.orderId ? 'border-red-300 bg-red-50' : ''}`}
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.statusText}
                        onChange={(e) => handleInputChange(index, 'statusText', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="สำเร็จแล้ว"
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${row.status === 'error' && !row.statusText ? 'border-red-300 bg-red-50' : ''}`}
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.username}
                        onChange={(e) => handleInputChange(index, 'username', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="Username"
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${row.status === 'error' && !row.username ? 'border-red-300 bg-red-50' : ''}`}
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.orderDate}
                        onChange={(e) => handleInputChange(index, 'orderDate', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="YYYY-MM-DD HH:mm"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.skuReference}
                        onChange={(e) => handleInputChange(index, 'skuReference', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="SKU"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.variationName}
                        onChange={(e) => handleInputChange(index, 'variationName', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="Variation"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.totalAmount}
                        onChange={(e) => handleInputChange(index, 'totalAmount', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="ยอดเงิน"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.couponCodes}
                        onChange={(e) => handleInputChange(index, 'couponCodes', e.target.value)}
                        onPaste={handlePaste}
                        data-index={index}
                        placeholder="Coupon Codes"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        {row.status === 'valid' && (
                          <span className="flex items-center text-green-600 text-sm"><CheckCircle size={16} className="mr-1.5" />พร้อมนำเข้า</span>
                        )}
                        {row.status === 'error' && (
                          <span className="flex items-center text-red-600 text-sm"><XCircle size={16} className="mr-1.5" />{row.message}</span>
                        )}
                        {row.status === 'duplicate' && (
                          <span className="flex items-center text-yellow-600 text-sm"><AlertTriangle size={16} className="mr-1.5" />{row.message}</span>
                        )}
                        {row.status === 'unchecked' && (row.orderId || row.username || row.totalAmount) && (
                          <span className="text-gray-400 text-sm italic">รอตรวจสอบ...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => removeRow(index)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="ลบแถว">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-center pb-4">
            <button onClick={addRow} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors">
              <Plus size={18} />เพิ่มแถว
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopeeLoyaltyImport;
