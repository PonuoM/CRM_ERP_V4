import React, { useState } from "react";
import { User } from "../types";
import { CheckCircle, Trash2, Plus, History, Eye, XCircle } from "lucide-react";
import Modal from "@/components/Modal";

interface StatementManagementPageProps {
  user: User;
  orders: any[];
  customers: any[];
  users: User[];
  onOrdersPaidUpdate?: any;
}

interface RowData {
  id: number;
  date: string;
  time: string;
  amount: string;
  channel: string;
  description: string;
}

interface BatchSummary {
  batch: number;
  row_count: number;
  transfer_from?: string | null;
  transfer_to?: string | null;
  first_at: string | null;
  last_at: string | null;
}

interface BatchRow {
  id: number;
  entry_date: string;
  entry_time: string;
  amount: number;
  channel: string | null;
  description: string | null;
  company_id: number;
  user_id: number | null;
  created_at: string;
}

const createEmptyRow = (id: number): RowData => ({
  id,
  date: "",
  time: "",
  amount: "",
  channel: "",
  description: "",
});

const StatementManagementPage: React.FC<StatementManagementPageProps> = ({
  user,
}) => {
  const [rows, setRows] = useState<RowData[]>(
    Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchSummary[]>([]);

  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchRowsLoading, setBatchRowsLoading] = useState(false);

  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<number | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleInputChange = (
    index: number,
    field: keyof RowData,
    value: string,
  ) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text");
    const pastedRows = pasteData
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r !== "");

    if (!pastedRows.length) return;

    const target = e.target as HTMLInputElement;
    const rowIndex = parseInt(target.dataset.index || "0", 10);

    const newRows = [...rows];

    pastedRows.forEach((pastedRow, i) => {
      const [date, time, amount, channel, description] =
        pastedRow.split(/[\t,]/);
      const currentRowIndex = rowIndex + i;

      if (currentRowIndex < newRows.length) {
        newRows[currentRowIndex] = {
          ...newRows[currentRowIndex],
          date: date?.trim() || "",
          time: time?.trim() || "",
          amount: amount?.trim() || "",
          channel: channel?.trim() || "",
          description: description?.trim() || "",
        };
      } else {
        newRows.push({
          ...createEmptyRow(newRows.length + 1),
          date: date?.trim() || "",
          time: time?.trim() || "",
          amount: amount?.trim() || "",
          channel: channel?.trim() || "",
          description: description?.trim() || "",
        });
      }
    });

    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, createEmptyRow(rows.length + 1)]);
  };

  const clearRows = () => {
    setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  };

  const removeRow = (index: number) => {
    setRows(
      rows
        .filter((_, i) => i !== index)
        .map((row, i) => ({ ...row, id: i + 1 })),
    );
  };

  const handleSave = async () => {
    const validRows = rows
      .filter(
        (r) =>
          r.date.trim() &&
          r.time.trim() &&
          r.amount.trim() &&
          !Number.isNaN(Number(r.amount)),
      )
      .map((r) => ({
        date: r.date.trim(),
        time: r.time.trim(),
        amount: Number(r.amount),
        channel: r.channel.trim(),
        description: r.description.trim(),
      }));

    if (!validRows.length) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("api/Statement_DB/save_statement.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: user.companyId,
          user_id: user.id,
          rows: validRows,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg =
          data?.detail ||
          data?.error ||
          "เกิดข้อผิดพลาดระหว่างบันทึกข้อมูล Statement";
        setErrorMessage(msg);
        return;
      }
      clearRows();
      setShowSuccess(true);
    } catch (e) {
      console.error("Failed to save statement logs", e);
      setErrorMessage("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("api/Statement_DB/list_batches.php", {
        method: "GET",
      });
      const data = await res.json();
      if (!data.ok) {
        setHistoryError(data.error || "ไม่สามารถโหลดประวัติการใส่ข้อมูลได้");
      } else {
        setBatches(Array.isArray(data.batches) ? data.batches : []);
      }
    } catch {
      setHistoryError("ไม่สามารถโหลดประวัติการใส่ข้อมูลได้");
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadBatchDetails = async (batch: number) => {
    setSelectedBatch(batch);
    setBatchRows([]);
    setBatchRowsLoading(true);
    try {
      const res = await fetch(
        `api/Statement_DB/get_batch.php?batch=${encodeURIComponent(
          String(batch),
        )}`,
        {
          method: "GET",
        },
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.rows)) {
        setBatchRows(data.rows);
      } else {
        setBatchRows([]);
      }
    } catch {
      setBatchRows([]);
    } finally {
      setBatchRowsLoading(false);
    }
  };

  const handleDeleteBatch = async (batch: number) => {
    setDeleteLoading(true);
    try {
      await fetch("api/Statement_DB/delete_batch.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch }),
      });
      await loadHistory();
    } catch {
      // ignore
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteBatch(null);
    }
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Statement Management</h1>
          <p className="text-sm text-gray-500">
            วางข้อมูลจาก Excel ลงในตารางด้านล่าง โดยเรียงคอลัมน์เป็น
            วันที่, เวลา, จำนวนเงิน, ช่องทาง, รายละเอียด แล้วกดบันทึกเพื่อเก็บข้อมูล
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearRows}
            className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm shadow-sm hover:bg-gray-50"
          >
            ล้างข้อมูลตาราง
          </button>
          <button
            onClick={addRow}
            className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm shadow-sm hover:bg-gray-50"
          >
            <Plus className="w-4 h-4 mr-1" />
            เพิ่มแถว
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center px-3 py-2 bg-green-600 text-white border rounded-md text-sm shadow-sm hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </button>
          <button
            type="button"
            onClick={async () => {
              setShowHistory(true);
              await loadHistory();
            }}
            className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm shadow-sm hover:bg-gray-50"
          >
            <History className="w-4 h-4 mr-1" />
            ประวัติการใส่ข้อมูล
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              ตารางใส่ข้อมูล Statement
            </span>
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1 text-left font-medium text-gray-500">
                #
              </th>
              <th className="px-2 py-1 text-left font-medium text-gray-500">
                วันที่
              </th>
              <th className="px-2 py-1 text-left font-medium text-gray-500">
                เวลา
              </th>
              <th className="px-2 py-1 text-right font-medium text-gray-500">
                จำนวนเงิน
              </th>
              <th className="px-2 py-1 text-left font-medium text-gray-500">
                ช่องทาง
              </th>
              <th className="px-2 py-1 text-left font-medium text-gray-500">
                รายละเอียด
              </th>
              <th className="px-2 py-1 text-center font-medium text-gray-500">
                ลบ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="px-2 py-1 text-xs text-gray-500">{row.id}</td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={row.date}
                    data-index={index}
                    onChange={(e) =>
                      handleInputChange(index, "date", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-xs"
                    placeholder="YYYY-MM-DD"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={row.time}
                    data-index={index}
                    onChange={(e) =>
                      handleInputChange(index, "time", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-xs"
                    placeholder="HH:MM"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="text"
                    value={row.amount}
                    data-index={index}
                    onChange={(e) =>
                      handleInputChange(index, "amount", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-right text-xs"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={row.channel}
                    data-index={index}
                    onChange={(e) =>
                      handleInputChange(index, "channel", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-xs"
                    placeholder="ช่องทาง"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={row.description}
                    data-index={index}
                    onChange={(e) =>
                      handleInputChange(index, "description", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-xs"
                    placeholder="รายละเอียด"
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showSuccess && (
        <Modal title="บันทึกข้อมูลสำเร็จ" onClose={() => setShowSuccess(false)}>
          <div className="p-4 flex flex-col items-center gap-3">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <div className="text-sm text-center">
              บันทึกข้อมูล Statement เรียบร้อยแล้ว
            </div>
            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              className="mt-2 px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
            >
              ปิด
            </button>
          </div>
        </Modal>
      )}

      {errorMessage && (
        <Modal title="เกิดข้อผิดพลาด" onClose={() => setErrorMessage(null)}>
          <div className="p-4 flex flex-col items-center gap-3">
            <XCircle className="w-10 h-10 text-red-500" />
            <div className="text-sm text-center text-red-700 whitespace-pre-line">
              {errorMessage}
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="mt-2 px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              ปิด
            </button>
          </div>
        </Modal>
      )}

      {showHistory && (
        <Modal
          title="ประวัติการใส่ข้อมูล Statement (ตาม Batch)"
          onClose={() => setShowHistory(false)}
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                ประวัติการใส่ข้อมูล Statement แบ่งตามรอบการบันทึก (Batch)
              </div>
              <button
                type="button"
                onClick={loadHistory}
                className="text-xs px-2 py-1 border rounded-md hover:bg-gray-50"
              >
                โหลดใหม่
              </button>
            </div>
            {historyLoading && (
              <div className="text-xs text-gray-500">
                กำลังโหลดประวัติการใส่ข้อมูล...
              </div>
            )}
            {historyError && (
              <div className="text-xs text-red-600">{historyError}</div>
            )}
            {!historyLoading && !historyError && batches.length === 0 && (
              <div className="text-xs text-gray-500">
                ยังไม่มีประวัติการใส่ข้อมูล Statement
              </div>
            )}
            {batches.length > 0 && (
              <table className="w-full text-xs border border-gray-200 rounded-md overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Batch
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      วันที่สร้าง
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      ช่วงเวลาที่โอน
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600">
                      จำนวนรายการ
                    </th>
                    <th className="px-2 py-1 text-center font-medium text-gray-600">
                      การจัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.batch} className="border-t border-gray-200">
                      <td className="px-2 py-1 text-sm">Batch {b.batch}</td>
                      <td className="px-2 py-1 text-xs text-gray-500">
                        {formatDateTime(b.first_at)}
                      </td>
                      <td className="px-2 py-1 text-xs text-gray-500">
                        {b.transfer_from && b.transfer_to
                          ? `${formatDateTime(
                              b.transfer_from,
                            )} - ${formatDateTime(b.transfer_to)}`
                          : "-"}
                      </td>
                      <td className="px-2 py-1 text-sm text-right">
                        {b.row_count}
                      </td>
                      <td className="px-2 py-1 text-center space-x-2">
                        <button
                          type="button"
                          onClick={() => loadBatchDetails(b.batch)}
                          className="inline-flex items-center px-2 py-1 text-xs border rounded-md hover:bg-gray-50"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          ดูรายละเอียด
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteBatch(b.batch)}
                          className="inline-flex items-center px-2 py-1 text-xs border border-red-300 text-red-700 rounded-md hover:bg-red-50"
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          ลบทั้ง batch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {selectedBatch !== null && (
        <Modal
          title={`รายละเอียด Batch ${selectedBatch}`}
          onClose={() => {
            setSelectedBatch(null);
            setBatchRows([]);
          }}
        >
          <div className="p-4 space-y-3">
            {batchRowsLoading && (
              <div className="text-xs text-gray-500">
                กำลังโหลดข้อมูลใน Batch...
              </div>
            )}
            {!batchRowsLoading && batchRows.length === 0 && (
              <div className="text-xs text-gray-500">
                ไม่พบข้อมูลใน Batch นี้
              </div>
            )}
            {batchRows.length > 0 && (
              <table className="w-full text-xs border border-gray-200 rounded-md overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      วันที่
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      เวลา
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600">
                      จำนวนเงิน
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      ช่องทาง
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      รายละเอียด
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-200">
                      <td className="px-2 py-1">
                        {r.entry_date?.toString().substring(0, 10)}
                      </td>
                      <td className="px-2 py-1">
                        {r.entry_time?.toString().substring(0, 8)}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {r.amount.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-2 py-1">
                        {r.channel ?? "-"}
                      </td>
                      <td className="px-2 py-1">
                        {r.description ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {confirmDeleteBatch !== null && (
        <Modal
          title={`ลบ Batch ${confirmDeleteBatch}`}
          onClose={() => setConfirmDeleteBatch(null)}
        >
          <div className="p-4 space-y-4">
            <div className="text-sm text-gray-700">
              ต้องการลบข้อมูลทั้งหมดของ Batch {confirmDeleteBatch} ใช่หรือไม่?
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteBatch(null)}
                className="px-4 py-2 text-sm rounded-md border hover:bg-gray-50"
                disabled={deleteLoading}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmDeleteBatch !== null &&
                  handleDeleteBatch(confirmDeleteBatch)
                }
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleteLoading}
              >
                {deleteLoading ? "กำลังลบ..." : "ลบทั้ง batch"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StatementManagementPage;
