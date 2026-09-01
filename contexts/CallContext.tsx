import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  cancelCall,
  dialCustomer,
  fetchCallStatus,
  type CallSession,
} from "../services/api";

/**
 * สถานะการโทรระดับทั้งแอป
 *
 * เดิม CallCustomerButton เก็บ state การโทร (session/timer/polling) ไว้ในตัวเอง พอสลับหน้า
 * component ถูก unmount → state หายหมด กลับมาเลยขึ้น "โทรออก" ใหม่ ทั้งที่มือถือยังโทรอยู่จริง
 *
 * ยก state ขึ้นมาไว้ที่ Provider เดียวที่ root (ไม่ unmount ตอนสลับหน้า) แล้ว:
 *  - ปุ่มโทร (ทุกที่) อ่านสถานะสายจากที่นี่ → กลับเข้าหน้าเดิมยังเห็นว่ากำลังโทร
 *  - ปุ่มลอยมุมขวาล่าง (FloatingCallWidget) โชว์ว่ากำลังทำงานอยู่ทุกหน้า
 *  - รีเฟรชหน้าเว็บก็ยังจำได้ (เก็บ session id ไว้ใน localStorage แล้ว re-sync จาก server)
 *
 * การวางสายจริงทำที่มือถือ (สาย GSM อยู่บนเครื่อง) — ปุ่ม "วางสาย" บนเว็บสั่งยกเลิก session
 * ที่ server เพื่อเคลียร์สถานะฝั่งเว็บ
 */

const LIVE_STATES: CallSession["status"][] = ["queued", "dispatched", "ringing", "answered"];
export const isLiveCallStatus = (s: CallSession["status"]) => LIVE_STATES.includes(s);

export const CALL_STATUS_TEXT: Record<CallSession["status"], string> = {
  queued: "กำลังส่งไปที่มือถือ…",
  dispatched: "มือถือรับงานแล้ว…",
  ringing: "กำลังโทรออก",
  answered: "กำลังสนทนา",
  ended: "วางสายแล้ว",
  failed: "โทรไม่สำเร็จ",
  cancelled: "ยกเลิกแล้ว",
};

export interface ActiveCall {
  customerId: string;
  customerName: string;
  session: CallSession;
  /** เวลาที่ฝั่งเว็บเห็นว่าสาย "รับแล้ว" ครั้งแรก (client clock) — ใช้เดินนาฬิกาโดยไม่ต้องแปลง TZ */
  answeredAtMs: number | null;
  talkSeconds: number;
}

interface StartResult {
  ok: boolean;
  message?: string;
}

interface CallContextValue {
  active: ActiveCall | null;
  /** มีสายที่ยังไม่จบ (queued/dispatched/ringing/answered) */
  isLive: boolean;
  /** customerId ของสายที่กำลังโทรอยู่ (ไว้ให้ปุ่มของลูกค้าคนอื่นรู้ว่า "ไม่ว่าง") */
  callingCustomerId: string | null;
  startCall: (customerId: number | string, customerName: string, phoneIndex: number) => Promise<StartResult>;
  hangUp: () => Promise<void>;
  dismiss: () => void;
  error: string | null;
  clearError: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const STORAGE_KEY = "primacom_active_call";

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const graceRef = useRef<number | null>(null);
  const activeRef = useRef<ActiveCall | null>(null);
  activeRef.current = active;

  const stopTimers = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
  }, []);

  const persist = useCallback((a: ActiveCall | null) => {
    try {
      if (a && isLiveCallStatus(a.session.status)) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ sessionId: a.session.id, customerId: a.customerId, customerName: a.customerName }),
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* localStorage อาจถูกปิด — ไม่เป็นไร แค่เสียความจำข้าม reload */
    }
  }, []);

  const startTick = useCallback(() => {
    if (tickRef.current) return;
    tickRef.current = window.setInterval(() => {
      setActive((prev) => {
        if (!prev || !prev.answeredAtMs) return prev;
        return { ...prev, talkSeconds: Math.max(0, Math.floor((Date.now() - prev.answeredAtMs) / 1000)) };
      });
    }, 1000);
  }, []);

  const beginPolling = useCallback(
    (sessionId: number) => {
      stopTimers();
      pollRef.current = window.setInterval(async () => {
        const s = await fetchCallStatus(sessionId).catch(() => null);
        if (!s) return;
        setActive((prev) => {
          if (!prev || prev.session.id !== sessionId) return prev;
          const answeredAtMs = prev.answeredAtMs ?? (s.status === "answered" ? Date.now() : null);
          const talkSeconds = answeredAtMs ? Math.max(0, Math.floor((Date.now() - answeredAtMs) / 1000)) : prev.talkSeconds;
          return { ...prev, session: s, answeredAtMs, talkSeconds };
        });
        if (s.status === "answered") startTick();
        if (!isLiveCallStatus(s.status)) {
          stopTimers();
          persist(null);
          // เก็บสถานะ "จบแล้ว" ไว้แป๊บนึงให้ปุ่มที่ยัง mount อยู่จับไปเปิดฟอร์มบันทึกการโทร
          // แล้วเคลียร์เองกันค้าง (ถ้าเข้าหน้าลูกค้าคนนี้ทีหลังจะได้ไม่เด้งฟอร์มเก่า)
          if (graceRef.current) window.clearTimeout(graceRef.current);
          graceRef.current = window.setTimeout(() => {
            setActive((prev) => (prev && !isLiveCallStatus(prev.session.status) ? null : prev));
          }, 45000);
        }
      }, 1500);
    },
    [persist, startTick, stopTimers],
  );

  const startCall = useCallback(
    async (customerId: number | string, customerName: string, phoneIndex: number): Promise<StartResult> => {
      const cur = activeRef.current;
      if (cur && isLiveCallStatus(cur.session.status)) {
        return { ok: false, message: "กำลังมีสายอื่นอยู่ วางสายก่อน" };
      }
      if (graceRef.current) window.clearTimeout(graceRef.current);
      setError(null);
      try {
        const res = await dialCustomer(customerId, phoneIndex);
        if (!res?.ok) {
          setError(res?.message || "เริ่มการโทรไม่สำเร็จ");
          return { ok: false, message: res?.message };
        }
        const session: CallSession = {
          id: res.session_id,
          status: res.status ?? "queued",
          answered_at: null,
          ended_at: null,
          duration_sec: null,
          failure_reason: null,
        };
        const a: ActiveCall = {
          customerId: String(customerId),
          customerName,
          session,
          answeredAtMs: null,
          talkSeconds: 0,
        };
        setActive(a);
        persist(a);
        beginPolling(res.session_id);
        return { ok: true };
      } catch {
        setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
        return { ok: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" };
      }
    },
    [beginPolling, persist],
  );

  const hangUp = useCallback(async () => {
    const a = activeRef.current;
    if (!a) return;
    await cancelCall(a.session.id).catch(() => undefined);
    stopTimers();
    persist(null);
    setActive((prev) => (prev ? { ...prev, session: { ...prev.session, status: "cancelled" } } : prev));
    if (graceRef.current) window.clearTimeout(graceRef.current);
    graceRef.current = window.setTimeout(() => {
      setActive((prev) => (prev && !isLiveCallStatus(prev.session.status) ? null : prev));
    }, 8000);
  }, [persist, stopTimers]);

  const dismiss = useCallback(() => {
    stopTimers();
    if (graceRef.current) window.clearTimeout(graceRef.current);
    persist(null);
    setActive(null);
  }, [persist, stopTimers]);

  // กลับมา/รีเฟรชหน้าเว็บ → ถ้ามี session ค้างใน localStorage ให้ re-sync จาก server
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.sessionId) {
          fetchCallStatus(saved.sessionId)
            .then((s) => {
              if (cancelled) return;
              if (!s || !isLiveCallStatus(s.status)) {
                try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
                return;
              }
              setActive({
                customerId: String(saved.customerId ?? ""),
                customerName: saved.customerName ?? "",
                session: s,
                answeredAtMs: s.status === "answered" ? Date.now() : null,
                talkSeconds: 0,
              });
              beginPolling(saved.sessionId);
            })
            .catch(() => undefined);
        }
      }
    } catch {
      /* noop */
    }
    return () => {
      cancelled = true;
      stopTimers();
      if (graceRef.current) window.clearTimeout(graceRef.current);
    };
    // รันครั้งเดียวตอน mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLive = !!active && isLiveCallStatus(active.session.status);
  const value: CallContextValue = {
    active,
    isLive,
    callingCustomerId: isLive ? active!.customerId : null,
    startCall,
    hangUp,
    dismiss,
    error,
    clearError: () => setError(null),
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall ต้องอยู่ภายใน <CallProvider>");
  return ctx;
}
