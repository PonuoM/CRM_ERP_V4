import React, { useEffect, useState } from "react";
import { ShoppingCart, Check, X, RefreshCw, User, AlertTriangle } from "lucide-react";
import {
  listPendingOrders,
  cancelPendingOrder,
  openPendingOrder,
  type PendingOrder,
} from "../services/api";

/**
 * ออเดอร์รอเปิด — รายการที่เทเลบันทึก "ขายได้ที่บ้าน" ผ่านมือถือ รอมาเปิดที่บริษัท
 *
 * กด "เปิดเป็นออเดอร์" → ไปหน้าสร้างออเดอร์ พร้อมข้อมูลลูกค้า + สินค้าที่เตรียมไว้ (onOpen)
 * เมนูนี้โผล่เฉพาะตอนเปิดใช้ปิดเบอร์ (คุมที่ Sidebar)
 */
interface PendingOrdersPageProps {
  onOpen: (po: PendingOrder) => void | Promise<void>;
  currentUserId: number;
  canProxySale: boolean;
}

const fmtQty = (q: number) => (Number.isInteger(q) ? String(q) : String(q));

export const PendingOrdersPage: React.FC<PendingOrdersPageProps> = ({ onOpen, currentUserId, canProxySale }) => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPendingOrders();
      setOrders(res.orders || []);
    } catch (e: any) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDone = async (po: PendingOrder) => {
    setBusyId(po.id);
    try {
      await openPendingOrder(po.id);
      setOrders((prev) => prev.filter((o) => o.id !== po.id));
    } catch (e: any) {
      setError(e?.message || "ทำรายการไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (po: PendingOrder) => {
    if (!window.confirm(`ยกเลิกออเดอร์รอเปิดของ ${po.customer_name}?`)) return;
    setBusyId(po.id);
    try {
      await cancelPendingOrder(po.id);
      setOrders((prev) => prev.filter((o) => o.id !== po.id));
    } catch (e: any) {
      setError(e?.message || "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingCart size={22} className="text-green-600" />
            ออเดอร์รอเปิด
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            รายการที่พนักงานบันทึก "ขายได้" ผ่านมือถือ รอมาเปิดเป็นออเดอร์ที่บริษัท
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-2"
        >
          <RefreshCw size={15} /> รีเฟรช
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-16">กำลังโหลด…</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-400 py-16 border border-dashed border-gray-200 rounded-xl">
          ไม่มีออเดอร์รอเปิด
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((po) => {
            // ลูกค้าคนเดียวกันมีหลายใบ / หลายคนขาย → เตือนซ้ำให้เด่น
            const sameCustomer = orders.filter((o) => o.customer_id === po.customer_id);
            const dupCount = sameCustomer.length;
            const multiAgent = new Set(sameCustomer.map((o) => o.agent_user_id)).size > 1;
            const isDup = dupCount > 1;

            // เหตุผลที่ล็อกปุ่มเปิด (ตามที่ตกลง)
            let lock: string | null = null;
            if (po.owner_conflict) {
              lock = `ลูกค้ามีเจ้าของอื่น${po.owner_name ? ` (${po.owner_name})` : ""} — ต้องโอน/ประสานงานให้จบก่อน`;
            } else if (po.agent_user_id !== currentUserId && !canProxySale) {
              lock = "ต้องมีสิทธิ์ “ขายแทน” จึงจะเปิดแทนคนขายได้";
            }

            return (
              <div
                key={po.id}
                className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 ${
                  isDup ? "border-amber-300" : "border-gray-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{po.customer_name}</span>
                    <span className="text-xs text-gray-400 font-mono">#{po.customer_id}</span>
                    {po.agent_name && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User size={12} /> {po.agent_name}
                      </span>
                    )}
                    {po.open_mode === "self" && (
                      <span className="text-[11px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">เปิดเอง</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {po.created_at?.replace("T", " ").slice(0, 16)}
                    </span>
                  </div>

                  {isDup && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                      <AlertTriangle size={13} />
                      ลูกค้ารายนี้มี {dupCount} ใบรอเปิด{multiAgent ? " · หลายคนขาย" : ""} — ตรวจก่อนเปิด กันซ้ำ
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {po.items.map((it, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-sm bg-green-50 text-green-800 border border-green-100 rounded-lg px-2.5 py-1"
                      >
                        {it.name}
                        <span className="font-mono font-semibold">×{fmtQty(it.qty)}</span>
                        {it.unit && <span className="text-green-500 text-xs">{it.unit}</span>}
                      </span>
                    ))}
                  </div>

                  {po.note && <div className="mt-2 text-sm text-gray-500">โน้ต: {po.note}</div>}
                  {lock && (
                    <div className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                      <AlertTriangle size={13} /> {lock}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={busyId === po.id || !!lock}
                    onClick={() => onOpen(po)}
                    title={lock || ""}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg px-4 py-2.5"
                  >
                    เปิดเป็นออเดอร์
                  </button>
                  <button
                    disabled={busyId === po.id}
                    onClick={() => handleDone(po)}
                    title="ทำเสร็จแล้ว (เอาออกจากคิว)"
                    className="text-green-600 hover:bg-green-50 disabled:opacity-50 border border-green-200 rounded-lg p-2.5"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    disabled={busyId === po.id}
                    onClick={() => handleCancel(po)}
                    title="ยกเลิก"
                    className="text-red-500 hover:bg-red-50 disabled:opacity-50 border border-red-200 rounded-lg p-2.5"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PendingOrdersPage;
