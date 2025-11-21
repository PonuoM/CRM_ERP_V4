import React, { useState, useMemo } from "react";
import {
  User,
  Order,
  PaymentMethod,
  PaymentStatus,
} from "../types";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Search,
  Download,
  UploadCloud,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { patchOrder, apiFetch } from "../services/api";

interface StatementManagementPageProps {
  user: User;
  orders: Order[];
  customers: any[];
  users: User[];
  onOrdersPaidUpdate?: (
    updates: Record<
      string,
      {
        amountPaid: number;
        paymentStatus: PaymentStatus;
      }
    >,
  ) => void;
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
  returnCondition?: "?????" | "????";
  manualStatus?: "????????" | "?????????" | "????????" | "";
}

const createEmptyRow = (id: number): RowData => ({
  id,
  trackingNumber: '',
  codAmount: '',
  status: 'unchecked',
  message: '',
});

const normalizeTrackingNumber = (value: string) =>
  value.replace(/\s+/g, "").toLowerCase();

const formatCurrency = (amount: number) =>
  `?${amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getBaseOrderId = (orderId?: string) => {
  if (!orderId) {
    return undefined;
  }
  const match = orderId.match(/^(.+)-(\d+)$/);
  return match ? match[1] : orderId;
};

const StatementManagementPage: React.FC<StatementManagementPageProps> = ({
  user,
  orders,
  customers,
  users,
  onOrdersPaidUpdate,
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
      const [trackingNumber, codAmount] = pastedRow.split(/[\t,]/);
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
        return { ...row, status: 'pending' as ValidationStatus, message: '????????????????' };
      }

      const codAmount = parseFloat(row.codAmount.replace(/[^\d.-]/g, ''));
      if (isNaN(codAmount) || codAmount <= 0) {
        return { ...row, status: 'pending' as ValidationStatus, message: '?????????????????' };
      }

      const normalizedTrackingNumber = normalizeTrackingNumber(row.trackingNumber);
      const matchingOrder = orders.find(order =>
        order.order_tracking_numbers?.some((tn) =>
          normalizeTrackingNumber(tn.tracking_number || "") === normalizedTrackingNumber,
        ),
      );

      if (!matchingOrder) {
        return {
          ...row,
          status: 'unmatched' as ValidationStatus,
          message: '???????????????',
        };
      }

      const baseOrderId = getBaseOrderId(matchingOrder.id);
      const relatedOrders = orders.filter(order => getBaseOrderId(order.id) === baseOrderId);
      const totalOrderAmount = relatedOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

      const difference = codAmount - totalOrderAmount;

      let status: ValidationStatus = 'matched';
      let message = '???????';

      if (difference !== 0) {
        status = 'unmatched';
        message = difference > 0 ? '???????????????' : '??????????????';
      }

      return {
        ...row,
        status,
        message,
        orderId: matchingOrder.id,
        orderAmount: totalOrderAmount,
        difference,
      };
    });

    setRows(validatedRows);
    setIsVerified(true);
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim() !== "");

    const newRows: RowData[] = [];
    let idCounter = 1;

    for (const line of lines) {
      const [trackingNumber, codAmount] = line.split(/[\t,]/);
      if (trackingNumber && codAmount) {
        newRows.push({
          id: idCounter++,
          trackingNumber: trackingNumber.trim(),
          codAmount: codAmount.trim(),
          status: "unchecked",
          message: "",
        });
      }
    }

    while (newRows.length < 15) {
      newRows.push(createEmptyRow(newRows.length + 1));
    }

    setRows(newRows);
    setIsVerified(false);
  };

  const handleClear = () => {
    setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
    setIsVerified(false);
    setUploadedFile(null);
    setSearchTerm("");
    setFilterStatus("all");
    setShowReturnedOnly(false);
  };

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (showReturnedOnly && row.status !== 'returned') return false;
      if (filterStatus !== 'all' && row.status !== filterStatus) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase();
      return (
        row.trackingNumber.toLowerCase().includes(term) ||
        (row.orderId && row.orderId.toLowerCase().includes(term))
      );
    });
  }, [rows, searchTerm, filterStatus, showReturnedOnly]);

  const summary = useMemo(() => {
    const matched = rows.filter(r => r.status === 'matched');
    const unmatched = rows.filter(r => r.status === 'unmatched');
    const pending = rows.filter(r => r.status === 'pending');
    const returned = rows.filter(r => r.status === 'returned');

    const totalAmount = rows.reduce((sum, r) => {
      const value = parseFloat(r.codAmount.replace(/[^\d.-]/g, ''));
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    const matchedAmount = matched.reduce((sum, r) => {
      const value = parseFloat(r.codAmount.replace(/[^\d.-]/g, ''));
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    return {
      total: rows.filter(r => r.trackingNumber.trim() && r.codAmount.trim()).length,
      matched: matched.length,
      unmatched: unmatched.length,
      pending: pending.length,
      returned: returned.length,
      totalAmount,
      matchedAmount,
    };
  }, [rows]);

  const getStatusBadgeColor = (status: ValidationStatus) => {
    switch (status) {
      case 'matched':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'unmatched':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'returned':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'unchecked':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: ValidationStatus) => {
    switch (status) {
      case 'matched':
        return 'ตรงยอด';
      case 'unmatched':
        return 'ไม่ตรงยอด';
      case 'returned':
        return 'ส่งคืน';
      case 'pending':
        return 'ข้อมูลไม่ครบ';
      case 'unchecked':
      default:
        return 'ยังไม่ตรวจ';
    }
  };

  const getStatusIndicator = (status: ValidationStatus, message?: string) => {
    const colorClass = getStatusBadgeColor(status);
    const label = getStatusLabel(status);

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${colorClass}`}>
        {status === 'matched' && <CheckCircle className="w-3 h-3" />}
        {status === 'unmatched' && <XCircle className="w-3 h-3" />}
        {status === 'returned' && <UploadCloud className="w-3 h-3" />}
        {status === 'pending' && <AlertTriangle className="w-3 h-3" />}
        {status === 'unchecked' && <FileText className="w-3 h-3" />}
        <span>{label}</span>
        {message && <span className="text-[10px] text-gray-500">- {message}</span>}
      </div>
    );
  };

  const handleMarkReturned = async (row: RowData, condition: "?????" | "????") => {
    setRows(prevRows =>
      prevRows.map(r =>
        r.id === row.id ? { ...r, status: "returned", returnCondition: condition, message: "รอตรวจสอบส่งคืน" } : r,
      ),
    );
  };

  const handleApproveReturned = async (row: RowData) => {
    setRows(prevRows =>
      prevRows.map(r =>
        r.id === row.id ? { ...r, message: "อนุมัติส่งคืนแล้ว" } : r,
      ),
    );
  };

  const handleSetManualStatus = async (
    row: RowData,
    status: "????????" | "?????????" | "????????",
  ) => {
    setRows(prevRows =>
      prevRows.map(r =>
        r.id === row.id ? { ...r, manualStatus: status, message: "ตั้งสถานะมือแล้ว" } : r,
      ),
    );
  };

  const handleApproveManualStatus = async (row: RowData) => {
    setRows(prevRows =>
      prevRows.map(r =>
        r.id === row.id ? { ...r, message: "อนุมัติสถานะมือแล้ว" } : r,
      ),
    );
  };

  const handleApplyToOrders = async () => {
    const matchedRows = rows.filter(r => r.status === "matched" && r.orderId);
    if (matchedRows.length === 0) return;

    try {
      const updates: Record<
        string,
        {
          amountPaid: number;
          paymentStatus: PaymentStatus;
        }
      > = {};

      for (const row of matchedRows) {
        if (!row.orderId || row.orderAmount === undefined) continue;

        const order = orders.find(o => o.id === row.orderId);
        if (!order) continue;

        const newAmountPaid = (order.amount_paid || 0) + (row.orderAmount || 0);
        const newPaymentStatus: PaymentStatus =
          newAmountPaid >= (order.total_amount || 0) ? "Paid" : "Partial";

        await patchOrder(order.id, {
          amount_paid: newAmountPaid,
          payment_status: newPaymentStatus,
        });

        updates[order.id] = {
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
        };
      }

      if (onOrdersPaidUpdate) {
        onOrdersPaidUpdate(updates);
      }
    } catch (error) {
      console.error("Failed to apply COD to orders", error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">COD Statement Management</h1>
          <p className="text-sm text-gray-500">
            จัดการรายการ COD จากสลิป/ไฟล์ นำเข้า ตรวจสอบ และผูกกับคำสั่งซื้อ
          </p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center px-3 py-2 bg-white border rounded-md cursor-pointer text-sm shadow-sm hover:bg-gray-50">
            <Upload className="w-4 h-4 mr-2" />
            นำเข้าจากไฟล์
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleUploadFile}
            />
          </label>
          <button
            onClick={handleClear}
            className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm shadow-sm hover:bg-gray-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            ล้างข้อมูล
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">สรุปสถานะ</h2>
            <span className="text-xs text-gray-500">
              แถวที่มีข้อมูล: {summary.total}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>ตรงยอด</span>
              <span className="font-medium text-green-600">
                {summary.matched} แถว ({formatCurrency(summary.matchedAmount)})
              </span>
            </div>
            <div className="flex justify-between">
              <span>ไม่ตรงยอด</span>
              <span className="font-medium text-red-600">
                {summary.unmatched} แถว
              </span>
            </div>
            <div className="flex justify-between">
              <span>ข้อมูลไม่ครบ</span>
              <span className="font-medium text-orange-600">
                {summary.pending} แถว
              </span>
            </div>
            <div className="flex justify_between">
              <span>ส่งคืน</span>
              <span className="font-medium text-yellow-600">
                {summary.returned} แถว
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span>ยอด COD รวม</span>
              <span className="font-semibold">
                {formatCurrency(summary.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow space-y-3">
          <h2 className="text-sm font-medium">ตัวกรอง</h2>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาด้วยเลขพัสดุหรือเลขออเดอร์"
                className="w-full pl-8 pr-2 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "ทั้งหมด" },
                { key: "matched", label: "ตรงยอด" },
                { key: "unmatched", label: "ไม่ตรงยอด" },
                { key: "pending", label: "ข้อมูลไม่ครบ" },
                { key: "returned", label: "ส่งคืน" },
                { key: "unchecked", label: "ยังไม่ตรวจ" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setFilterStatus(option.key)}
                  className={`px-2 py-1 rounded-full text-xs border ${
                    filterStatus === option.key
                      ? "bg-blue-50 border-blue-400 text-blue-700"
                      : "bg-white border-gray-300 text-gray-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center text-xs text-gray-600">
              <input
                type="checkbox"
                className="mr-2"
                checked={showReturnedOnly}
                onChange={(e) => setShowReturnedOnly(e.target.checked)}
              />
              แสดงเฉพาะรายการที่ส่งคืน
            </label>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow space-y-3">
          <h2 className="text-sm font-medium">การดำเนินการ</h2>
          <div className="space-y-2 text-sm">
            <button
              onClick={handleValidate}
              className="w-full inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              ตรวจสอบรายการ COD
            </button>
            <button
              onClick={handleApplyToOrders}
              disabled={!isVerified}
              className="w_full inline-flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              บันทึกยอดชำระเข้าออเดอร์ที่ตรงยอด
            </button>
            <p className="text-xs text-gray-500">
              ระบบจะอัปเดตยอดชำระและสถานะการชำระเงินของคำสั่งซื้อที่ตรงยอดเท่านั้น
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">
              รายการ COD จากไฟล์ / กรอกเอง
            </span>
          </div>
          {uploadedFile && (
            <span className="text-xs text_gray-500">
              ไฟล์: {uploadedFile.name}
            </span>
          )}
        </div>

        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1 text-left font-medium text-gray-500">#</th>
              <th className="px-2 py-1 text-left font-medium text-gray-500">
                เลขพัสดุ
              </th>
              <th className="px-2 py-1 text-right font-medium text-gray-500">
                ยอด COD
              </th>
              <th className="px-2 py-1 text_left font-medium text-gray-500">
                เลขออเดอร์
              </th>
              <th className="px-2 py-1 text-right font-medium text-gray-500">
                ยอดออเดอร์รวม
              </th>
              <th className="px-2 py-1 text-right font-medium text-gray-500">
                ส่วนต่าง
              </th>
              <th className="px-2 py-1 text-left font-medium text-gray-500">
                สถานะ
              </th>
              <th className="px-2 py-1 text-center font-medium text-gray-500">
                ลบ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredRows.map((row, index) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-2 py-1 text-gray-400 text-center">
                  {row.id}
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.trackingNumber}
                    onChange={(e) => handleInputChange(index, "trackingNumber", e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="กรอกเลขพัสดุ"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="text"
                    data-index={index}
                    value={row.codAmount}
                    onChange={(e) => handleInputChange(index, "codAmount", e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border_none focus:ring-0 focus:outline-none text-right"
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
                    <span>?{row.orderAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-1 text-sm text-right">
                  {row.difference !== undefined ? (
                    <span className={row.difference === 0 ? "text-green-600" : row.difference > 0 ? "text-orange-600" : "text-red-600"}>
                      {row.difference > 0 ? "+" : ""}?{Math.abs(row.difference).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
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
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2">
          <button onClick={addRow} className="w-full text-sm flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 py-1.5 rounded-md">
            <Plus size={16} className="mr-1" /> เพิ่มแถว
          </button>
        </div>
      </div>

      {isVerified && filteredRows.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {filteredRows.filter(r => r.status === 'unmatched').map((row) => (
              <div key={row.id} className="flex items-center gap-2 p-2 border rounded">
                <span className="text-sm">{row.trackingNumber}</span>
                <button
                  onClick={() => handleMarkReturned(row, "?????")}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                >
                  ส่งคืน (เสียหาย)
                </button>
                <button
                  onClick={() => handleMarkReturned(row, "????")}
                  className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                >
                  ส่งคืน (อื่นๆ)
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
                          e.target.value as "????????" | "?????????" | "????????"
                        )
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="">เลือกสถานะ</option>
                      <option value="????????">ยังไม่โอน</option>
                      <option value="?????????">โอนไม่ครบ</option>
                      <option value="????????">โอนผิดลูกค้า</option>
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

export default StatementManagementPage;

