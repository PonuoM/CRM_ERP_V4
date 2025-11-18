import React, { useState, useMemo } from "react";
import { User, Order, PaymentMethod, PaymentStatus } from "../types";
import { Upload, FileText, CheckCircle, XCircle, Search, Download, UploadCloud, Plus, Trash2, AlertTriangle } from "lucide-react";
import { patchOrder } from "../services/api";

interface CODManagementPageProps {
  user: User;
  orders: Order[];
  customers: any[];
  users: User[];
}

interface CODRecord {
  id?: number;
  trackingNumber: string;
  codAmount: number;
  orderId?: string;
  orderAmount?: number;
  difference?: number;
  status?: "matched" | "unmatched" | "returned" | "pending" | "unchecked";
  returnCondition?: "ชำรุด" | "ปกติ";
  manualStatus?: "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์" | "";
  message?: string;
}

type ValidationStatus = 'matched' | 'unmatched' | 'returned' | 'pending' | 'unchecked';

interface RowData {
  id: number;
  trackingNumber: string;
  codAmount: string;
  status: ValidationStatus;
  message: string;
  orderId?: string;
  orderAmount?: number;
  difference?: number;
  returnCondition?: "ชำรุด" | "ปกติ";
  manualStatus?: "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์" | "";
}

const createEmptyRow = (id: number): RowData => ({
  id,
  trackingNumber: '',
  codAmount: '',
  status: 'unchecked',
  message: '',
});

const CODManagementPage: React.FC<CODManagementPageProps> = ({
  user,
  orders,
  customers,
  users,
}) => {
  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  const [isVerified, setIsVerified] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showReturnedOnly, setShowReturnedOnly] = useState(false);

  const handleInputChange = (index: number, field: 'trackingNumber' | 'codAmount', value: string) => {
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
        const [trackingNumber, codAmount] = pastedRow.split(/[\t,]/); // Split by tab or comma
        const currentRowIndex = rowIndex + i;
        if (currentRowIndex < newRows.length) {
            newRows[currentRowIndex] = {
                ...newRows[currentRowIndex],
                trackingNumber: trackingNumber?.trim() || '',
                codAmount: codAmount?.trim() || '',
                status: 'unchecked',
                message: ''
            };
        } else {
            newRows.push({
                ...createEmptyRow(newRows.length + 1),
                trackingNumber: trackingNumber?.trim() || '',
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
        if (isNaN(codAmount) || codAmount <= 0) {
            return { ...row, status: 'pending' as ValidationStatus, message: 'ยอดเงินไม่ถูกต้อง' };
        }

        // Find order by tracking number
        const matchedOrder = orders.find(
          (order) =>
            order.paymentMethod === PaymentMethod.COD &&
            order.trackingNumbers?.some((tn) =>
              tn.toLowerCase().includes(row.trackingNumber.toLowerCase())
            )
        );

        if (matchedOrder) {
          const orderCodAmount = matchedOrder.codAmount || matchedOrder.totalAmount;
          const difference = codAmount - orderCodAmount;
          return {
            ...row,
            codAmount: row.codAmount,
            orderId: matchedOrder.id,
            orderAmount: orderCodAmount,
            difference: difference,
            status: difference === 0 ? 'matched' as ValidationStatus : 'unmatched' as ValidationStatus,
            message: difference === 0 ? 'ตรงกัน' : `ส่วนต่าง: ${difference > 0 ? '+' : ''}฿${Math.abs(difference).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
          };
        }

        return { ...row, codAmount: row.codAmount, status: 'pending' as ValidationStatus, message: 'ไม่พบออเดอร์' };
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
        const [trackingNumber, codAmount] = line.split(/[\t,]/).map(c => c.trim().replace(/^"|"$/g, ""));
        if (trackingNumber && codAmount) {
          newRows.push({
            ...createEmptyRow(i + 1),
            trackingNumber: trackingNumber,
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

  const handleMarkReturned = (row: RowData, condition: "ชำรุด" | "ปกติ") => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, status: "returned" as ValidationStatus, returnCondition: condition, message: `ตีกลับ (${condition})` }
          : r
      )
    );
  };

  const handleSetManualStatus = (row: RowData, status: "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์") => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, manualStatus: status }
          : r
      )
    );
  };

  const handleApproveReturned = async (row: RowData) => {
    if (!row.orderId) return;

    try {
      await patchOrder(row.orderId, {
        orderStatus: "Returned",
        notes: `COD ตีกลับ - สภาพ: ${row.returnCondition || "ไม่ระบุ"}`,
      });

      alert("Approve ออเดอร์ที่ตีกลับเรียบร้อยแล้ว");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: "matched" as ValidationStatus, message: "Approve แล้ว" }
            : r
        )
      );
    } catch (error) {
      console.error("Error approving returned order:", error);
      alert("เกิดข้อผิดพลาดในการ Approve");
    }
  };

  const handleApproveManualStatus = async (row: RowData) => {
    if (!row.orderId) return;

    try {
      await patchOrder(row.orderId, {
        orderStatus: "Cancelled",
        notes: `COD ${row.manualStatus}`,
      });

      alert("Approve ออเดอร์เรียบร้อยแล้ว");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, status: "matched" as ValidationStatus, message: "Approve แล้ว" }
            : r
        )
      );
    } catch (error) {
      console.error("Error approving manual status:", error);
      alert("เกิดข้อผิดพลาดในการ Approve");
    }
  };

  const handleImport = () => {
    const validRows = rows.filter(row => row.status === 'matched' || row.status === 'unmatched');
    if (validRows.length > 0) {
      alert(`มีข้อมูลที่พร้อมใช้งาน ${validRows.length} รายการ`);
      // Reset rows after import
      setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
      setIsVerified(false);
    } else {
      alert('ไม่มีข้อมูลที่พร้อมสำหรับใช้งาน');
    }
  };

  // Filter records
  const filteredRows = useMemo(() => {
    let filtered = rows.filter(r => r.trackingNumber.trim() || r.codAmount.trim());

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.trackingNumber.toLowerCase().includes(term) ||
          r.orderId?.toLowerCase().includes(term)
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    if (showReturnedOnly) {
      filtered = filtered.filter((r) => r.status === "returned");
    }

    return filtered;
  }, [rows, searchTerm, filterStatus, showReturnedOnly]);

  // Statistics
  const { validCount, unmatchedCount, pendingCount, returnedCount } = useMemo(() => {
    return rows.reduce((acc, r) => {
        if (r.status === 'matched') acc.validCount++;
        if (r.status === 'unmatched') acc.unmatchedCount++;
        if (r.status === 'pending') acc.pendingCount++;
        if (r.status === 'returned') acc.returnedCount++;
        return acc;
    }, { validCount: 0, unmatchedCount: 0, pendingCount: 0, returnedCount: 0 });
  }, [rows]);

  const getStatusIndicator = (status: ValidationStatus, message: string) => {
    switch (status) {
      case 'matched':
        return <div className="flex items-center text-green-600"><CheckCircle size={14} className="mr-1.5"/> {message}</div>;
      case 'unmatched':
        return <div className="flex items-center text-yellow-600"><AlertTriangle size={14} className="mr-1.5"/> {message}</div>;
      case 'returned':
        return <div className="flex items-center text-red-600"><XCircle size={14} className="mr-1.5"/> {message}</div>;
      case 'pending':
        return <div className="flex items-center text-orange-600"><AlertTriangle size={14} className="mr-1.5"/> {message}</div>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">จัดการ COD</h2>
      <p className="text-gray-600 mb-6">คัดลอกข้อมูลจากไฟล์ Excel/CSV (2 คอลัมน์: Tracking Number, COD Amount) แล้ววางลงในตารางด้านล่าง</p>
      
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center">
            {isVerified ? (
                 <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center text-green-600 font-medium"><CheckCircle size={16} className="mr-2"/>ตรงกัน: {validCount}</span>
                    <span className="flex items-center text-yellow-600"><AlertTriangle size={16} className="mr-2"/>ไม่ตรงกัน: {unmatchedCount}</span>
                    <span className="flex items-center text-orange-600"><AlertTriangle size={16} className="mr-2"/>รอตรวจสอบ: {pendingCount}</span>
                    <span className="flex items-center text-red-600"><XCircle size={16} className="mr-2"/>ตีกลับ: {returnedCount}</span>
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
                <button onClick={handleImport} disabled={!isVerified || validCount + unmatchedCount === 0} className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed">
                    <UploadCloud size={16} className="mr-2"/>
                    ยืนยันการนำเข้า ({validCount + unmatchedCount})
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
              <th className="px-6 py-3">COD Amount</th>
              <th className="px-6 py-3">Order ID</th>
              <th className="px-6 py-3 text-right">COD จากออเดอร์</th>
              <th className="px-6 py-3 text-right">ส่วนต่าง</th>
              <th className="px-6 py-3">สถานะ</th>
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {rows.map((row, index) => (
              <tr key={row.id} className={`border-b ${row.status === 'matched' ? 'bg-green-50' : row.status === 'unmatched' ? 'bg-yellow-50' : row.status === 'pending' ? 'bg-orange-50' : row.status === 'returned' ? 'bg-red-50' : ''}`}>
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
                    type="text"
                    data-index={index}
                    value={row.codAmount}
                    onChange={(e) => handleInputChange(index, 'codAmount', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-6 py-1 text-sm">
                  {row.orderId ? (
                    <span className="text-blue-600">{row.orderId}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-1 text-sm text-right">
                  {row.orderAmount ? (
                    <span>฿{row.orderAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
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

      {/* Action buttons for matched/unmatched rows */}
      {isVerified && filteredRows.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {filteredRows.filter(r => r.status === 'unmatched').map((row) => (
              <div key={row.id} className="flex items-center gap-2 p-2 border rounded">
                <span className="text-sm">{row.trackingNumber}</span>
                <button
                  onClick={() => handleMarkReturned(row, "ชำรุด")}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                >
                  ตีกลับ (ชำรุด)
                </button>
                <button
                  onClick={() => handleMarkReturned(row, "ปกติ")}
                  className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                >
                  ตีกลับ (ปกติ)
                </button>
                {row.status === "returned" && (
                  <button
                    onClick={() => handleApproveReturned(row)}
                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                  >
                    Approve
                  </button>
                )}
                {!row.orderId && (
                  <>
                    <select
                      value={row.manualStatus || ""}
                      onChange={(e) =>
                        handleSetManualStatus(
                          row,
                          e.target.value as "ศูนย์หาย" | "ไม่สำเร็จ" | "หายศูนย์"
                        )
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="">เลือกสถานะ</option>
                      <option value="ศูนย์หาย">ศูนย์หาย</option>
                      <option value="ไม่สำเร็จ">ไม่สำเร็จ</option>
                      <option value="หายศูนย์">หายศูนย์</option>
                    </select>
                    {row.manualStatus && (
                      <button
                        onClick={() => handleApproveManualStatus(row)}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Approve
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CODManagementPage;

