import React, { useState } from "react";
import { User } from "../types";
import { CheckCircle, Trash2, Plus } from "lucide-react";
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
      await fetch("api/Statement_DB/save_statement.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: user.companyId,
          user_id: user.id,
          rows: validRows,
        }),
      });
      clearRows();
      setShowSuccess(true);
    } catch (e) {
      console.error("Failed to save statement logs", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Statement Management</h1>
          <p className="text-sm text-gray-500">
            ตารางสำหรับกรอก / วางข้อมูลจาก Excel: วันที่ เวลา จำนวนเงิน ช่องทาง
            และรายละเอียด แล้วบันทึกลงฐานข้อมูล
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearRows}
            className="inline-flex items-center px-3 py-2 bg-white border rounded-md text-sm shadow-sm hover:bg-gray-50"
          >
            ล้างตาราง
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
            {isSaving ? "กำลังบันทึก..." : "บันทึกลงฐานข้อมูล"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              ตารางบันทึกรายการ Statement
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
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-2 py-1 text-gray-400 text-center">
                  {row.id}
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.date}
                    onChange={(e) =>
                      handleInputChange(index, "date", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="YYYY-MM-DD"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.time}
                    onChange={(e) =>
                      handleInputChange(index, "time", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="HH:MM"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <input
                    type="text"
                    data-index={index}
                    value={row.amount}
                    onChange={(e) =>
                      handleInputChange(index, "amount", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.channel}
                    onChange={(e) =>
                      handleInputChange(index, "channel", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="เช่น โอน, COD, PromptPay"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.description}
                    onChange={(e) =>
                      handleInputChange(index, "description", e.target.value)
                    }
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="รายละเอียดเพิ่มเติม"
                  />
                </td>
                <td className="px-2 py-1 text-center">
                  <button
                    onClick={() => removeRow(index)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showSuccess && (
        <Modal title="เพิ่มข้อมูลสำเร็จ" onClose={() => setShowSuccess(false)}>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-800">
                  บันทึกข้อมูล Statement เรียบร้อยแล้ว
                </div>
                <div className="text-xs text-gray-500">
                  แถวที่กรอกครบถูกส่งไปบันทึกในฐานข้อมูลแล้ว
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSuccess(false)}
                className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StatementManagementPage;
