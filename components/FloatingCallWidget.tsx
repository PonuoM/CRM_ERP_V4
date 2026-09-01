import React from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useCall, CALL_STATUS_TEXT } from "../contexts/CallContext";

/**
 * ปุ่ม/การ์ดลอยมุมขวาล่าง — โชว์ทุกหน้าเมื่อกำลังมีสายอยู่
 *
 * แก้อาการ "กดโทรแล้วสลับหน้า สถานะหาย" — ตัวนี้ mount อยู่ที่ root ตลอด อ่านสถานะจาก CallContext
 * เห็นได้ทุกหน้าว่าระบบกำลังโทรใคร ค้างมานานแค่ไหน (วางสายจริงทำที่มือถือ)
 */
export const FloatingCallWidget: React.FC = () => {
  const { active, isLive, hangUp } = useCall();

  if (!active || !isLive) return null;

  const status = active.session.status;
  const answered = status === "answered";
  const mm = String(Math.floor(active.talkSeconds / 60)).padStart(2, "0");
  const ss = String(active.talkSeconds % 60).padStart(2, "0");

  return (
    <div className="fixed bottom-5 right-5 z-[70] w-[290px] max-w-[calc(100vw-2.5rem)] animate-[slideUp_0.25s_ease-out]">
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="rounded-2xl border border-emerald-100 bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        {/* แถบสถานะสด */}
        <div className="flex items-center gap-3 px-4 pt-4">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
            <Phone className="relative h-5 w-5 text-emerald-600" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-gray-800">
              {active.customerName || "กำลังโทร"}
            </p>
            <p className="text-xs text-emerald-700">{CALL_STATUS_TEXT[status]}</p>
          </div>
          {answered && (
            <span className="font-mono text-lg tabular-nums text-gray-800">
              {mm}:{ss}
            </span>
          )}
        </div>

        {/* คำอธิบาย + ปุ่มวางสาย */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-2.5">
          <span className="text-[11px] leading-tight text-gray-500">
            วางสายที่มือถือ<br />หรือกดปุ่มนี้เพื่อยกเลิก
          </span>
          <button
            onClick={hangUp}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <PhoneOff className="h-4 w-4" />
            วางสาย
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingCallWidget;
