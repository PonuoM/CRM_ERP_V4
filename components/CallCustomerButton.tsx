import React, { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2, Check } from "lucide-react";
import {
  fetchCallableNumbers,
  type CallSession,
  type CallableNumber,
} from "../services/api";
import { usePhonePolicy } from "../hooks/usePhonePolicy";
import { useCall, CALL_STATUS_TEXT } from "../contexts/CallContext";

interface CallCustomerButtonProps {
  customerId: number | string;
  customerName?: string;
  /**
   * Called once the call is over, with what actually happened. The log form uses this to fill in a
   * real duration and to refuse "ได้คุย" on a call nobody answered.
   */
  onCallEnded?: (session: CallSession) => void;
  className?: string;
}

/**
 * Rings a customer from the agent's handset.
 *
 * สถานะสายอยู่ที่ CallContext (ระดับ App) ไม่ใช่ในปุ่มนี้ — สลับหน้าแล้วกลับมายังเห็นว่ากำลังโทร
 * และมีปุ่มลอยมุมขวาล่างคอยบอกทุกหน้า (FloatingCallWidget)
 *
 * Appears only for an agent who actually has a registered phone, so a company that has not adopted
 * the dialler sees nothing new — no setting to configure, no button that does nothing.
 */
export const CallCustomerButton: React.FC<CallCustomerButtonProps> = ({
  customerId,
  customerName,
  onCallEnded,
  className = "",
}) => {
  const policy = usePhonePolicy();
  const call = useCall();

  const [numbers, setNumbers] = useState<CallableNumber[]>([]);
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idStr = String(customerId);
  const mine = call.active && call.active.customerId === idStr ? call.active : null;
  const live = !!mine && call.isLive;
  const busyOther = call.isLive && call.callingCustomerId !== idStr;

  // เมื่อสายของลูกค้าคนนี้จบ → ยิง onCallEnded ครั้งเดียว (เปิดฟอร์มบันทึกการโทรพร้อม duration)
  const firedRef = useRef<number | null>(null);
  useEffect(() => {
    if (mine && !call.isLive && firedRef.current !== mine.session.id) {
      firedRef.current = mine.session.id;
      onCallEnded?.(mine.session);
    }
  }, [mine, call.isLive, onCallEnded]);

  const start = useCallback(
    async (phoneIndex: number) => {
      setPicking(false);
      setStarting(true);
      setError(null);
      const res = await call.startCall(customerId, customerName ?? "", phoneIndex);
      if (!res.ok) setError(res.message || "เริ่มการโทรไม่สำเร็จ");
      setStarting(false);
    },
    [call, customerId, customerName],
  );

  const handleClick = useCallback(async () => {
    setError(null);
    const list = numbers.length ? numbers : await fetchCallableNumbers(customerId).catch(() => []);
    setNumbers(list);

    if (list.length === 0) {
      setError("ลูกค้ารายนี้ไม่มีเบอร์โทรในระบบ");
      return;
    }
    // Only ask which number when there is genuinely a choice to make.
    if (list.length === 1) start(list[0].index);
    else setPicking(true);
  }, [customerId, numbers, start]);

  // A company that has not rolled out handsets should see no trace of this feature.
  if (!policy.can_click_to_call) return null;

  if (live && mine) {
    const secs = mine.talkSeconds;
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          {CALL_STATUS_TEXT[mine.session.status]}
          {mine.session.status === "answered" && (
            <span className="font-mono tabular-nums">
              {mm}:{ss}
            </span>
          )}
        </span>
        <button
          onClick={call.hangUp}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <PhoneOff className="h-4 w-4" />
          วางสาย
        </button>
      </div>
    );
  }

  // สายที่จบไปแล้วในรอบนี้ ไม่กลับไปเป็นปุ่มเขียวเต็มใบทันที
  //
  // ของเดิมพอวางสายแล้วปุ่ม "โทรออกหาลูกค้า" กลับมาเหมือนยังไม่เคยโทร ทั้งที่ฟอร์มบันทึกการโทร
  // เปิดค้างอยู่ตรงนั้นพอดี เผลอกดซ้ำแล้วลูกค้าโดนโทรซ้ำทันทีโดยไม่ได้ตั้งใจ
  // ตรงนี้จึงบอกผลของสายที่เพิ่งจบ แล้วให้กดโทรใหม่เป็นการตัดสินใจอีกครั้งหนึ่ง
  if (mine && !live) {
    const answered = !!mine.session.answered_at;
    const secs = mine.session.duration_sec ?? mine.talkSeconds;
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            answered ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {answered ? <Check className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
          {answered ? "โทรแล้ว" : "ไม่ได้รับสาย"}
          {answered && secs > 0 && (
            <span className="font-mono tabular-nums">
              {mm}:{ss}
            </span>
          )}
        </span>
        <button
          onClick={call.dismiss}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          โทรอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleClick}
        disabled={starting || busyOther}
        title={busyOther ? "กำลังมีสายอื่นอยู่" : undefined}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        {busyOther ? "กำลังโทรสายอื่นอยู่" : "โทรออกหาลูกค้า"}
      </button>

      {picking && (
        <div className="absolute z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs text-gray-500">เลือกเบอร์ที่จะโทร</p>
          {numbers.map((n) => (
            <button
              key={n.index}
              onClick={() => start(n.index)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span className="text-gray-700">{n.label}</span>
              <span className="font-mono text-gray-500">{n.display}</span>
            </button>
          ))}
          <button
            onClick={() => setPicking(false)}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default CallCustomerButton;
