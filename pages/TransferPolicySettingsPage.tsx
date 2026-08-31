import React, { useEffect, useState } from "react";
import {
  TransferPolicySettings,
  TransferPolicySettingRow,
  fetchTransferPolicySettings,
  saveTransferPolicySettings,
} from "../services/api";
import { resetTransferPolicy } from "../hooks/useTransferPolicy";

type Stage = "on" | "off" | null;

/**
 * เปิดปิดนโยบาย "ต้องขออนุมัติก่อนโอนลูกค้า" รายบริษัท
 *
 * สิทธิ์ใน role_permissions เป็นค่ากลางทั้งระบบ ตัดที่นั่นอย่างเดียวจึงกระทบทุกบริษัทพร้อมกัน
 * หน้านี้คือสวิตช์ที่ทำให้เปิดทีละบริษัทได้ และปิดกลับไปเป็นพฤติกรรมเดิมได้ทันทีโดยไม่ต้อง deploy
 */
const TransferPolicySettingsPage: React.FC = () => {
  const [data, setData] = useState<TransferPolicySettings | null>(null);
  const [rows, setRows] = useState<TransferPolicySettingRow[]>([]);
  const [defaultStage, setDefaultStage] = useState<"on" | "off">("off");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchTransferPolicySettings()
      .then((res) => {
        if (!alive) return;
        setData(res);
        setRows(res.companies || []);
        setDefaultStage(res.default_stage === "on" ? "on" : "off");
      })
      .catch((e: any) => {
        if (alive) setError(e?.message || "โหลดนโยบายไม่สำเร็จ");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setCompanyStage = (companyId: number, stage: Stage) => {
    setRows((prev) =>
      prev.map((r) => (r.company_id === companyId ? { ...r, stage } : r)),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveTransferPolicySettings({
        default_stage: defaultStage,
        companies: rows.map((r) => ({
          company_id: r.company_id,
          stage: r.stage,
        })),
      });
      // แคชฝั่งหน้าเว็บถือค่าเดิมไว้ทั้ง session ถ้าไม่ล้าง คนที่เพิ่งกดบันทึกจะยังเห็นปุ่มแบบเก่า
      resetTransferPolicy();
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const effective = (r: TransferPolicySettingRow) =>
    r.stage === null ? defaultStage : r.stage;

  const onCount = rows.filter((r) => effective(r) === "on").length;

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500">กำลังโหลดนโยบาย...</div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          การอนุมัติโอนย้ายลูกค้า
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          เลือกว่าบริษัทไหนต้องขออนุมัติก่อนเปลี่ยนผู้ดูแลลูกค้า
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm space-y-3">
        <div className="font-medium text-gray-800">แต่ละสถานะทำอะไร</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-gray-200 p-3">
            <div className="font-medium text-gray-700 mb-1">ปิด (แบบเดิม)</div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
              <li>Telesale โอนลูกค้าให้หัวหน้าตัวเองได้</li>
              <li>หัวหน้าโอนหากันข้ามทีมได้</li>
              <li>หัวหน้าโอนให้ลูกทีมตัวเองได้</li>
              <li>ไม่มีคิวอนุมัติ ไม่ต้องรอใคร</li>
            </ul>
          </div>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <div className="font-medium text-amber-900 mb-1">เปิด</div>
            <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4">
              <li>เฉพาะแอดมินระดับสูงเปลี่ยนผู้ดูแลได้เอง</li>
              <li>คนอื่นกด "ขอโอนมาดูแล" พร้อมเหตุผล</li>
              <li>แอดมินอนุมัติในเมนู "คำขอโอนลูกค้า"</li>
              <li>ทุกคำขอและการตัดสินถูกบันทึกไว้</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-gray-800 text-sm">
              ค่าเริ่มต้นของบริษัทที่ไม่ได้ตั้งเอง
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              บริษัทที่เลือก "ตามค่าเริ่มต้น" จะใช้ค่านี้
            </p>
          </div>
          <div className="flex gap-1.5">
            {(["off", "on"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setDefaultStage(v);
                  setSaved(false);
                }}
                className={`px-3 py-1.5 text-xs rounded-md border ${
                  defaultStage === v
                    ? "bg-green-600 border-green-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {v === "off" ? "ปิด (แบบเดิม)" : "เปิด"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-medium text-gray-800 text-sm">รายบริษัท</span>
          <span className="text-xs text-gray-500">
            เปิดอยู่ {onCount} จาก {rows.length} บริษัท
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div
              key={r.company_id}
              className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="text-sm text-gray-800">{r.company_name}</div>
                <div className="text-[11px] text-gray-400">
                  ID {r.company_id}
                  {r.stage === null && ` · ตามค่าเริ่มต้น (${defaultStage === "on" ? "เปิด" : "ปิด"})`}
                </div>
              </div>
              <div className="flex gap-1.5">
                {([null, "off", "on"] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setCompanyStage(r.company_id, v)}
                    className={`px-2.5 py-1 text-xs rounded-md border ${
                      r.stage === v
                        ? v === "on"
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-gray-700 border-gray-700 text-white"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {v === null ? "ตามค่าเริ่มต้น" : v === "off" ? "ปิด" : "เปิด"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกนโยบาย"}
        </button>
        {saved && (
          <span className="text-sm text-green-700">
            บันทึกแล้ว — ผู้ใช้คนอื่นต้องรีเฟรชหน้าเว็บครั้งเดียวจึงจะเห็นผล
          </span>
        )}
      </div>

      {data && (
        <p className="text-[11px] text-gray-400">
          {/* บอกให้ชัดว่ากำลังแก้ของ deployment ไหน เพราะ beta_test ใช้ฐานข้อมูลเดียวกับ prod
              แต่แยก setting key กันไว้ ไม่งั้นเปิดทดสอบแล้วโดนของจริงทันที */}
          กำลังแก้ของ <span className="font-medium">{data.deployment}</span> · setting key{" "}
          <code>{data.setting_key}</code>
        </p>
      )}
    </div>
  );
};

export default TransferPolicySettingsPage;
