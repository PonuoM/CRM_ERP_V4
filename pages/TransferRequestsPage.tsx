import React, { useCallback, useEffect, useState } from "react";
import {
  TransferRequest,
  listTransferRequests,
  decideTransferRequest,
  cancelTransferRequest,
} from "../services/api";
import { formatThaiDateTime } from "../utils/time";

type StatusFilter = "pending" | "approved" | "rejected" | "cancelled" | "all";

const statusLabels: Record<TransferRequest["status"], string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  cancelled: "ถอนคำขอ",
};

const statusStyles: Record<TransferRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

/**
 * คิวคำขอโอนลูกค้า
 *
 * แอดมินเห็นทั้งบริษัทและกดตัดสินได้ คนอื่นเห็นเฉพาะใบที่ตัวเองยื่นหรือใบที่ขอให้ตัวเองเป็นผู้ดูแล
 * การกรองทำที่เซิร์ฟเวอร์ หน้านี้แค่แสดงตามที่ได้มา
 */
const TransferRequestsPage: React.FC = () => {
  const [rows, setRows] = useState<TransferRequest[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listTransferRequests(status);
      setRows(res.data);
      setCanApprove(res.canApprove);
    } catch (e: any) {
      setError(e?.message || "โหลดคำขอไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (
    row: TransferRequest,
    decision: "approved" | "rejected",
  ) => {
    const verb = decision === "approved" ? "อนุมัติ" : "ปฏิเสธ";
    const note = window.prompt(
      `หมายเหตุการ${verb} (ไม่บังคับ)\n\nลูกค้า: ${row.customer_name ?? row.customer_id}`,
      "",
    );
    // กด Cancel ใน prompt คือไม่ทำต่อ ส่วนกด OK ทั้งที่ว่างคือไม่มีหมายเหตุ
    if (note === null) return;

    setBusyId(row.id);
    try {
      await decideTransferRequest(row.id, decision, { note: note || undefined });
      await load();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      // เซิร์ฟเวอร์ปฏิเสธรอบแรกโดยตั้งใจเมื่อเจ้าของเปลี่ยนไประหว่างรออนุมัติ ให้คนกดรู้ตัวก่อน
      if (msg.includes("เจ้าของลูกค้าเปลี่ยนไป")) {
        const ok = window.confirm(
          `${msg}\n\nยืนยันว่าจะ${verb}ต่อไปหรือไม่?`,
        );
        if (ok) {
          try {
            await decideTransferRequest(row.id, decision, {
              note: note || undefined,
              confirmOwnerChanged: true,
            });
            await load();
          } catch (e2: any) {
            setError(e2?.message || `${verb}ไม่สำเร็จ`);
          }
        }
      } else {
        setError(msg || `${verb}ไม่สำเร็จ`);
      }
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (row: TransferRequest) => {
    if (!window.confirm("ถอนคำขอใบนี้?")) return;
    setBusyId(row.id);
    try {
      await cancelTransferRequest(row.id);
      await load();
    } catch (e: any) {
      setError(e?.message || "ถอนคำขอไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">คำขอโอนลูกค้า</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {canApprove
              ? "อนุมัติแล้วระบบจะเปลี่ยนผู้ดูแลให้ทันที พร้อมบันทึกลงประวัติลูกค้า"
              : "คำขอที่คุณยื่นไว้ รอแอดมินพิจารณา"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-800"
            style={{ colorScheme: "light" }}
          >
            <option value="pending">รออนุมัติ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ปฏิเสธ</option>
            <option value="cancelled">ถอนคำขอ</option>
            <option value="all">ทั้งหมด</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500 text-center py-10">
          กำลังโหลด...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-14 border border-dashed border-gray-300 rounded-lg">
          ไม่มีคำขอในสถานะนี้
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm text-left min-w-[860px]">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
              <tr>
                <th className="px-3 py-3 w-40">ยื่นเมื่อ</th>
                <th className="px-3 py-3">ลูกค้า</th>
                <th className="px-3 py-3 w-40">จาก</th>
                <th className="px-3 py-3 w-40">ไปหา</th>
                <th className="px-3 py-3">เหตุผล</th>
                <th className="px-3 py-3 w-28">สถานะ</th>
                <th className="px-3 py-3 w-40">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {formatThaiDateTime(r.created_at)}
                    <div className="text-gray-400">
                      โดย {r.requested_by_name || `ID ${r.requested_by}`}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-800">
                      {r.customer_name || "-"}
                    </div>
                    <div className="text-xs text-gray-500">
                      #{r.customer_id}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700">
                    {r.current_owner_name || "ไม่มีเจ้าของ"}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700">
                    {r.requested_owner_name || `ID ${r.requested_owner_id}`}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    {r.reason || <span className="text-gray-400">-</span>}
                    {r.decision_note && (
                      <div className="mt-1 text-gray-500 border-l-2 border-gray-200 pl-2">
                        หมายเหตุ: {r.decision_note}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[r.status]}`}
                    >
                      {statusLabels[r.status]}
                    </span>
                    {r.decided_by_name && (
                      <div className="text-[11px] text-gray-400 mt-1">
                        โดย {r.decided_by_name}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {r.status === "pending" && canApprove && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => decide(r, "approved")}
                          className="px-2.5 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          อนุมัติ
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => decide(r, "rejected")}
                          className="px-2.5 py-1 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          ปฏิเสธ
                        </button>
                      </div>
                    )}
                    {r.status === "pending" && !canApprove && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => withdraw(r)}
                        className="px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        ถอนคำขอ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransferRequestsPage;
