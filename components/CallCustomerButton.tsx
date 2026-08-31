import React, { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2, Check } from "lucide-react";
import {
  cancelCall,
  dialCustomer,
  fetchCallStatus,
  fetchCallableNumbers,
  type CallSession,
  type CallableNumber,
} from "../services/api";
import { usePhonePolicy } from "../hooks/usePhonePolicy";

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

const LIVE_STATES: CallSession["status"][] = ["queued", "dispatched", "ringing", "answered"];

const STATUS_TEXT: Record<CallSession["status"], string> = {
  queued: "กำลังส่งไปที่มือถือ…",
  dispatched: "มือถือรับงานแล้ว…",
  ringing: "กำลังโทรออก",
  answered: "กำลังสนทนา",
  ended: "วางสายแล้ว",
  failed: "โทรไม่สำเร็จ",
  cancelled: "ยกเลิกแล้ว",
};

/**
 * Rings a customer from the agent's handset.
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
  const [numbers, setNumbers] = useState<CallableNumber[]>([]);
  const [picking, setPicking] = useState(false);
  const [session, setSession] = useState<CallSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [talkSeconds, setTalkSeconds] = useState(0);

  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const stopTimers = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  const beginPolling = useCallback(
    (sessionId: number) => {
      stopTimers();
      pollRef.current = window.setInterval(async () => {
        const s = await fetchCallStatus(sessionId).catch(() => null);
        if (!s) return;
        setSession(s);

        if (s.status === "answered" && !tickRef.current) {
          // Count locally while the call runs; the server's duration is authoritative at the end.
          tickRef.current = window.setInterval(() => setTalkSeconds((n) => n + 1), 1000);
        }
        if (!LIVE_STATES.includes(s.status)) {
          stopTimers();
          onCallEnded?.(s);
        }
      }, 1500);
    },
    [onCallEnded, stopTimers],
  );

  const start = useCallback(
    async (phoneIndex: number) => {
      setPicking(false);
      setStarting(true);
      setError(null);
      setTalkSeconds(0);
      try {
        const res = await dialCustomer(customerId, phoneIndex);
        if (!res?.ok) {
          setError(res?.message || "เริ่มการโทรไม่สำเร็จ");
          return;
        }
        setSession({
          id: res.session_id,
          status: res.status ?? "queued",
          answered_at: null,
          ended_at: null,
          duration_sec: null,
          failure_reason: null,
        });
        beginPolling(res.session_id);
      } catch {
        setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
      } finally {
        setStarting(false);
      }
    },
    [customerId, beginPolling],
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

  const handleHangUp = useCallback(async () => {
    if (!session) return;
    await cancelCall(session.id).catch(() => undefined);
    stopTimers();
    const ended: CallSession = { ...session, status: "cancelled" };
    setSession(ended);
    onCallEnded?.(ended);
  }, [session, stopTimers, onCallEnded]);

  // A company that has not rolled out handsets should see no trace of this feature.
  if (!policy.can_click_to_call) return null;

  const live = session && LIVE_STATES.includes(session.status);

  if (live) {
    const mm = String(Math.floor(talkSeconds / 60)).padStart(2, "0");
    const ss = String(talkSeconds % 60).padStart(2, "0");
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          {STATUS_TEXT[session!.status]}
          {session!.status === "answered" && (
            <span className="font-mono tabular-nums">
              {mm}:{ss}
            </span>
          )}
        </span>
        <button
          onClick={handleHangUp}
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
  if (session && !live) {
    const answered = !!session.answered_at;
    const mm = String(Math.floor(talkSeconds / 60)).padStart(2, "0");
    const ss = String(talkSeconds % 60).padStart(2, "0");
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            answered
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {answered ? <Check className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
          {answered ? "โทรแล้ว" : "ไม่ได้รับสาย"}
          {answered && talkSeconds > 0 && (
            <span className="font-mono tabular-nums">
              {mm}:{ss}
            </span>
          )}
        </span>
        <button
          onClick={() => {
            setSession(null);
            setTalkSeconds(0);
            setError(null);
          }}
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
        disabled={starting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
        โทรออกหาลูกค้า
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
      {session && !live && (
        <p className="mt-1 text-xs text-gray-500">
          {STATUS_TEXT[session.status]}
          {session.duration_sec != null && session.duration_sec > 0 && ` · ${session.duration_sec} วินาที`}
        </p>
      )}
    </div>
  );
};

export default CallCustomerButton;
