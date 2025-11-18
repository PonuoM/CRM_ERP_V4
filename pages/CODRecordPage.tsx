import React, { useState, useMemo } from "react";
import { User } from "../types";
import { Upload, FileText, Calendar, DollarSign, Search, UploadCloud, Plus, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { apiFetch } from "../services/api";

interface CODRecordPageProps {
  user: User;
}

type ValidationStatus = 'pending' | 'received' | 'partial' | 'missing' | 'unchecked';

interface RowData {
  id: number;
  trackingNumber: string;
  deliveryStartDate: string;
  deliveryEndDate: string;
  codAmount: string;
  receivedAmount: string;
  difference?: number;
  status: ValidationStatus;
  message: string;
}

const createEmptyRow = (id: number): RowData => ({
  id,
  trackingNumber: '',
  deliveryStartDate: '',
  deliveryEndDate: '',
  codAmount: '',
  receivedAmount: '',
  status: 'unchecked',
  message: '',
});

const CODRecordPage: React.FC<CODRecordPageProps> = ({ user }) => {
  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  const [isVerified, setIsVerified] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleInputChange = (index: number, field: 'trackingNumber' | 'deliveryStartDate' | 'deliveryEndDate' | 'codAmount' | 'receivedAmount', value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    
    // Auto-calculate difference if both amounts are present
    if (field === 'codAmount' || field === 'receivedAmount') {
      const codAmount = parseFloat(newRows[index].codAmount.replace(/[^\d.-]/g, '')) || 0;
      const receivedAmount = parseFloat(newRows[index].receivedAmount.replace(/[^\d.-]/g, '')) || 0;
      newRows[index].difference = codAmount - receivedAmount;
      
      if (codAmount > 0 && receivedAmount > 0) {
        if (receivedAmount === codAmount) {
          newRows[index].status = 'received';
          newRows[index].message = 'รับครบ';
        } else if (receivedAmount > 0) {
          newRows[index].status = 'partial';
          newRows[index].message = 'รับไม่ครบ';
        } else {
          newRows[index].status = 'missing';
          newRows[index].message = 'ไม่ได้รับ';
        }
      } else {
        newRows[index].status = 'unchecked';
        newRows[index].message = '';
      }
    } else {
      newRows[index].status = 'unchecked';
      newRows[index].message = '';
    }
    
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
        const [trackingNumber, startDate, endDate, codAmount] = pastedRow.split(/[\t,]/);
        const currentRowIndex = rowIndex + i;
        if (currentRowIndex < newRows.length) {
            newRows[currentRowIndex] = {
                ...newRows[currentRowIndex],
                trackingNumber: trackingNumber?.trim() || '',
                deliveryStartDate: startDate?.trim() || '',
                deliveryEndDate: endDate?.trim() || '',
                codAmount: codAmount?.trim() || '',
                status: 'unchecked',
                message: ''
            };
        } else {
            newRows.push({
                ...createEmptyRow(newRows.length + 1),
                trackingNumber: trackingNumber?.trim() || '',
                deliveryStartDate: startDate?.trim() || '',
                deliveryEndDate: endDate?.trim() || '',
                codAmount: codAmount?.trim() || '',
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
      setRows(rows.filter((_, i) => i !== index).map((row, i) => ({ ...row, id: i + 1 })));
  };

  const handleValidate = () => {
    const validatedRows = rows.map(row => {
        if (!row.trackingNumber.trim() && !row.codAmount.trim()) {
            return { ...row, status: 'unchecked' as ValidationStatus, message: '' };
        }
        if (!row.trackingNumber.trim() || !row.codAmount.trim()) {
            return { ...row, status: 'pending' as ValidationStatus, message: 'ข้อมูลไม่ครบถ้วน' };
        }
        
        const codAmount = parseFloat(row.codAmount.replace(/[^\d.-]/g, ''));
        const receivedAmount = parseFloat(row.receivedAmount.replace(/[^\d.-]/g, '')) || 0;
        
        if (isNaN(codAmount) || codAmount <= 0) {
            return { ...row, status: 'pending' as ValidationStatus, message: 'ยอด COD ไม่ถูกต้อง' };
        }

        const difference = codAmount - receivedAmount;
        let status: ValidationStatus = 'pending';
        let message = 'รอตรวจสอบ';

        if (receivedAmount === 0) {
          status = 'missing';
          message = 'ไม่ได้รับ';
        } else if (receivedAmount === codAmount) {
          status = 'received';
          message = 'รับครบ';
        } else if (receivedAmount > 0) {
          status = 'partial';
          message = 'รับไม่ครบ';
        }

        return {
          ...row,
          codAmount: row.codAmount,
          receivedAmount: row.receivedAmount,
          difference: difference,
          status: status,
          message: message,
        };
    });
    setRows(validatedRows);
    setIsVerified(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        alert("ไฟล์ไม่มีข้อมูล");
        return;
      }

      // Skip header if exists
      const dataLines = lines.slice(1);
      const newRows: RowData[] = [];
      
      dataLines.forEach((line, i) => {
        const [trackingNumber, startDate, endDate, codAmount] = line.split(/[\t,]/).map(c => c.trim().replace(/^"|"$/g, ""));
        if (trackingNumber && codAmount) {
          newRows.push({
            ...createEmptyRow(i + 1),
            trackingNumber: trackingNumber,
            deliveryStartDate: startDate || '',
            deliveryEndDate: endDate || '',
            codAmount: codAmount,
          });
        }
      });

      if (newRows.length > 0) {
        setRows([...newRows, ...Array.from({ length: Math.max(0, 15 - newRows.length) }, (_, i) => createEmptyRow(newRows.length + i + 1))]);
      }
    } catch (error) {
      console.error("Error parsing CSV:", error);
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์");
    }
  };

  const handleSaveRecord = async (row: RowData) => {
    try {
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        alert("ไม่พบข้อมูลผู้ใช้");
        return;
      }

      const userData = JSON.parse(sessionUser);
      const companyId = userData.company_id;

      const codAmount = parseFloat(row.codAmount.replace(/[^\d.-]/g, '')) || 0;
      const receivedAmount = parseFloat(row.receivedAmount.replace(/[^\d.-]/g, '')) || 0;

      if (!row.trackingNumber.trim() || codAmount <= 0) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
      }

      // Save COD record to database
      await apiFetch("cod_records", {
        method: "POST",
        body: JSON.stringify({
          tracking_number: row.trackingNumber,
          delivery_start_date: row.deliveryStartDate || null,
          delivery_end_date: row.deliveryEndDate || null,
          cod_amount: codAmount,
          received_amount: receivedAmount,
          company_id: companyId,
        }),
      });

      alert("บันทึกข้อมูล COD เรียบร้อยแล้ว");
      // Update local state
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: "received" as ValidationStatus, message: "บันทึกแล้ว" }
            : r
        )
      );
    } catch (error) {
      console.error("Error saving COD record:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleImport = async () => {
    const validRows = rows.filter(row => 
      row.trackingNumber.trim() && 
      row.codAmount.trim() && 
      (row.status === 'received' || row.status === 'partial' || row.status === 'missing')
    );
    
    if (validRows.length === 0) {
      alert('ไม่มีข้อมูลที่พร้อมสำหรับบันทึก');
      return;
    }

    if (window.confirm(`คุณต้องการบันทึกข้อมูล COD จำนวน ${validRows.length} รายการใช่หรือไม่?`)) {
      try {
        await Promise.all(validRows.map(row => handleSaveRecord(row)));
        alert(`บันทึกข้อมูล COD เรียบร้อยแล้ว ${validRows.length} รายการ`);
        setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
        setIsVerified(false);
      } catch (error) {
        console.error("Error importing records:", error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    }
  };

  // Statistics
  const { receivedCount, partialCount, missingCount, pendingCount } = useMemo(() => {
    return rows.reduce((acc, r) => {
        if (r.status === 'received') acc.receivedCount++;
        if (r.status === 'partial') acc.partialCount++;
        if (r.status === 'missing') acc.missingCount++;
        if (r.status === 'pending') acc.pendingCount++;
        return acc;
    }, { receivedCount: 0, partialCount: 0, missingCount: 0, pendingCount: 0 });
  }, [rows]);

  const getStatusIndicator = (status: ValidationStatus, message: string) => {
    switch (status) {
      case 'received':
        return <div className="flex items-center text-green-600"><CheckCircle size={14} className="mr-1.5"/> {message}</div>;
      case 'partial':
        return <div className="flex items-center text-yellow-600"><AlertTriangle size={14} className="mr-1.5"/> {message}</div>;
      case 'missing':
        return <div className="flex items-center text-red-600"><XCircle size={14} className="mr-1.5"/> {message}</div>;
      case 'pending':
        return <div className="flex items-center text-orange-600"><AlertTriangle size={14} className="mr-1.5"/> {message}</div>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">บันทึกข้อมูลรับเงิน COD</h2>
      <p className="text-gray-600 mb-6">คัดลอกข้อมูลจากไฟล์ Excel/CSV (4 คอลัมน์: Tracking Number, วันที่เริ่มต้น, วันที่สิ้นสุด, COD Amount) แล้ววางลงในตารางด้านล่าง</p>
      
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center">
            {isVerified ? (
                 <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center text-green-600 font-medium"><CheckCircle size={16} className="mr-2"/>รับครบ: {receivedCount}</span>
                    <span className="flex items-center text-yellow-600"><AlertTriangle size={16} className="mr-2"/>รับไม่ครบ: {partialCount}</span>
                    <span className="flex items-center text-red-600"><XCircle size={16} className="mr-2"/>ไม่ได้รับ: {missingCount}</span>
                    <span className="flex items-center text-orange-600"><AlertTriangle size={16} className="mr-2"/>รอตรวจสอบ: {pendingCount}</span>
                </div>
            ) : (
                <p className="text-sm text-gray-500">วางข้อมูลแล้วกด "ตรวจสอบข้อมูล" เพื่อดำเนินการต่อ</p>
            )}
            <div className="flex items-center space-x-2">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50">
                    <Upload size={16} />
                    <span>อัปโหลดไฟล์</span>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <button onClick={handleValidate} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md py-2 px-3 hover:bg-gray-50">ตรวจสอบข้อมูล</button>
                <button onClick={handleImport} disabled={!isVerified || receivedCount + partialCount + missingCount === 0} className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed">
                    <UploadCloud size={16} className="mr-2"/>
                    ยืนยันการบันทึก ({receivedCount + partialCount + missingCount})
                </button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-20rem)]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-3 w-12 text-center">#</th>
              <th className="px-6 py-3">เลข Tracking</th>
              <th className="px-6 py-3">วันที่จัดส่งเริ่มต้น</th>
              <th className="px-6 py-3">วันที่จัดส่งสิ้นสุด</th>
              <th className="px-6 py-3 text-right">COD Amount</th>
              <th className="px-6 py-3 text-right">เงินที่รับจริง</th>
              <th className="px-6 py-3 text-right">ส่วนต่าง</th>
              <th className="px-6 py-3">สถานะ</th>
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {rows.map((row, index) => (
              <tr key={row.id} className={`border-b ${row.status === 'received' ? 'bg-green-50' : row.status === 'partial' ? 'bg-yellow-50' : row.status === 'missing' ? 'bg-red-50' : row.status === 'pending' ? 'bg-orange-50' : ''}`}>
                <td className="px-2 py-1 text-center text-gray-400">{index + 1}</td>
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
                <td className="px-6 py-1">
                  <input
                    type="date"
                    data-index={index}
                    value={row.deliveryStartDate}
                    onChange={(e) => handleInputChange(index, 'deliveryStartDate', e.target.value)}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                  />
                </td>
                <td className="px-6 py-1">
                  <input
                    type="date"
                    data-index={index}
                    value={row.deliveryEndDate}
                    onChange={(e) => handleInputChange(index, 'deliveryEndDate', e.target.value)}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                  />
                </td>
                <td className="px-6 py-1">
                   <input
                    type="text"
                    data-index={index}
                    value={row.codAmount}
                    onChange={(e) => handleInputChange(index, 'codAmount', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-6 py-1">
                   <input
                    type="text"
                    data-index={index}
                    value={row.receivedAmount}
                    onChange={(e) => handleInputChange(index, 'receivedAmount', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-6 py-1 text-sm text-right">
                  {row.difference !== undefined ? (
                    <span className={row.difference === 0 ? "text-green-600" : row.difference > 0 ? "text-orange-600" : "text-red-600"}>
                      {row.difference > 0 ? "+" : ""}฿{Math.abs(row.difference).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
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

export default CODRecordPage;
