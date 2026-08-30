import { useEffect, useState } from "react";
import { fetchTransferPolicy } from "../services/api";

/**
 * บริษัทของผู้ใช้คนนี้ต้องขออนุมัติก่อนโอนลูกค้าหรือไม่
 *
 * แคชไว้ต่อหนึ่ง session เหมือน usePhonePolicy นโยบายเปลี่ยนก็ต่อเมื่อมีคนไปแก้ในหน้าตั้งค่า
 * หรือเปลี่ยนคนล็อกอิน การยิงซ้ำทุกหน้าจึงเป็นภาระเปล่า ๆ กับหน้าที่ยิง API ถี่อยู่แล้ว
 */
let cached: boolean | null = null;
let inFlight: Promise<boolean> | null = null;

/** ล้างแคช เรียกตอน sign-out ไม่ให้คนถัดไปได้นโยบายของคนก่อน */
export function resetTransferPolicy(): void {
  cached = null;
  inFlight = null;
}

function load(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = fetchTransferPolicy().then((p) => {
      cached = p.approvalRequired;
      inFlight = null;
      return cached;
    });
  }
  return inFlight;
}

/**
 * เริ่มจาก false โดยตั้งใจ
 *
 * ระหว่างรอคำตอบ หน้าจอจะแสดงแบบเดิมคือปุ่มเปลี่ยนผู้ดูแล ถ้าเดาผิดทางนี้ผลคือกดแล้วเซิร์ฟเวอร์
 * ปฏิเสธ ซึ่งเห็นได้ชัดและแก้ง่าย ส่วนการเริ่มจาก true จะซ่อนปุ่มที่ควรมีให้บริษัทที่ไม่ได้เปิด
 * นโยบายนี้เลย ซึ่งดูเหมือนระบบพัง
 */
export function useTransferApprovalRequired(): boolean {
  const [required, setRequired] = useState<boolean>(cached ?? false);

  useEffect(() => {
    let alive = true;
    load().then((v) => {
      if (alive) setRequired(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  return required;
}
