import React, { useState } from "react";
import Modal from "./Modal";
import { Customer, User } from "../types";
import { createTransferRequest } from "../services/api";

interface TransferRequestModalProps {
  customer: Customer;
  /** ชื่อเจ้าของปัจจุบัน ส่งมาจากหน้าเรียกเพราะมันคำนวณไว้แล้ว ไม่ต้องหาซ้ำ */
  currentOwnerName: string;
  user: User;
  onClose: () => void;
  onSubmitted?: () => void;
}

/**
 * ยื่นคำขอโอนลูกค้ามาดูแล
 *
 * แทนที่การคุยกันในไลน์แล้วยื่นเรื่องให้ไอทีแก้ให้ ซึ่งไม่เหลือร่องรอยว่าใครขออะไรกับใคร
 * ด้วยเหตุผลอะไร เหตุผลที่กรอกตรงนี้คือสิ่งที่แอดมินใช้ตัดสิน จึงบังคับให้กรอก
 */
const TransferRequestModal: React.FC<TransferRequestModalProps> = ({
  customer,
  currentOwnerName,
  user,
  onClose,
  onSubmitted,
}) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MIN_REASON = 10;
  const reasonOk = reason.trim().length >= MIN_REASON;

  const handleSubmit = async () => {
    if (!reasonOk || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createTransferRequest({
        customerId: String(customer.customerId ?? customer.id),
        reason: reason.trim(),
      });
      onSubmitted?.();
      onClose();
    } catch (e: any) {
      // ข้อความจากเซิร์ฟเวอร์อธิบายเคสได้ตรงกว่า เช่น มีใบที่รออนุมัติอยู่แล้ว
      setError(e?.message || "ส่งคำขอไม่สำเร็จ กรุณาลองใหม่");
      setSaving(false);
    }
  };

  return (
    <Modal title="ขอโอนลูกค้ามาดูแล" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">ลูกค้า</span>
            <span className="font-medium text-gray-800 text-right">
              {customer.firstName} {customer.lastName}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">รหัสลูกค้า</span>
            <span className="font-medium text-gray-800">
              #{customer.customerId ?? customer.id}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">ผู้ดูแลปัจจุบัน</span>
            <span className="font-medium text-gray-800 text-right">
              {currentOwnerName}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">ขอมาเป็นของ</span>
            <span className="font-medium text-gray-800 text-right">
              {user.firstName} {user.lastName}
            </span>
          </div>
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">
            เหตุผลที่ขอโอน <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={saving}
            rows={4}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
            placeholder="เช่น ลูกค้าติดต่อกลับมาหาเราเอง คุยกันมาตลอด และเจ้าของเดิมไม่ได้ติดตามแล้ว"
            style={{ colorScheme: "light" }}
          />
          <p
            className={`mt-1 text-xs ${
              reasonOk ? "text-green-700" : "text-gray-500"
            }`}
          >
            {reasonOk
              ? "✓ แอดมินจะเห็นข้อความนี้ตอนพิจารณา"
              : `ต้องอย่างน้อย ${MIN_REASON} ตัวอักษร — เหตุผลคือสิ่งที่แอดมินใช้ตัดสิน`}
          </p>
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          คำขอนี้ยังไม่โอนลูกค้าให้ทันที ต้องรอแอดมินอนุมัติก่อน
          และลูกค้าหนึ่งรายมีคำขอที่รออนุมัติได้ครั้งละหนึ่งใบ
        </p>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reasonOk || saving}
            className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "กำลังส่ง..." : "ส่งคำขอ"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TransferRequestModal;
