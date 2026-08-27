import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

type Stage = "off" | "exports_only" | "full";

interface CompanyRow {
  company_id: number;
  company_name: string;
  stage: Stage | null;
}

interface RoleRow {
  id: number;
  name: string;
  can_view_phone: boolean;
}

interface PolicySettings {
  ok: boolean;
  deployment: string;
  setting_key: string;
  default_stage: Stage;
  using_default_roles: boolean;
  companies: CompanyRow[];
  roles: RoleRow[];
}

const STAGES: { value: Stage; label: string; detail: string }[] = [
  {
    value: "off",
    label: "ปิด",
    detail: "ทุกอย่างเหมือนเดิม เบอร์แสดงเต็มทุกที่",
  },
  {
    value: "exports_only",
    label: "ซ่อนเฉพาะไฟล์ที่ดาวน์โหลด",
    detail: "หน้าจอยังเห็นเบอร์ปกติ เทเลทำงานได้เหมือนเดิม แต่ไฟล์ Excel ที่โหลดออกไปจะถูกซ่อน",
  },
  {
    value: "full",
    label: "ซ่อนทั้งหมด",
    detail: "ซ่อนบนหน้าจอด้วย — เปิดเมื่อบริษัทนั้นมีแอปโทรบนมือถือแล้วเท่านั้น",
  },
];

const PhonePrivacySettingsPage: React.FC = () => {
  const [data, setData] = useState<PolicySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch("phone_policy_settings")
      .then((res) => {
        if (!alive) return;
        if (res?.ok) setData(res as PolicySettings);
        else setError(res?.message || "โหลดการตั้งค่าไม่สำเร็จ");
      })
      .catch(() => alive && setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const visibleRoleCount = useMemo(
    () => data?.roles.filter((r) => r.can_view_phone).length ?? 0,
    [data],
  );

  const setDefaultStage = (stage: Stage) =>
    setData((d) => (d ? { ...d, default_stage: stage } : d));

  const setCompanyStage = (companyId: number, stage: Stage | null) =>
    setData((d) =>
      d
        ? {
            ...d,
            companies: d.companies.map((c) =>
              c.company_id === companyId ? { ...c, stage } : c,
            ),
          }
        : d,
    );

  const toggleRole = (roleId: number) =>
    setData((d) =>
      d
        ? {
            ...d,
            roles: d.roles.map((r) =>
              r.id === roleId ? { ...r, can_view_phone: !r.can_view_phone } : r,
            ),
          }
        : d,
    );

  const handleSave = async () => {
    if (!data) return;
    if (visibleRoleCount === 0) {
      setError("ต้องเลือกอย่างน้อย 1 role ที่เห็นเบอร์ได้ ไม่งั้นจะไม่มีใครเห็นเบอร์เลย");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await apiFetch("phone_policy_settings", {
        method: "POST",
        body: JSON.stringify({
          default_stage: data.default_stage,
          companies: data.companies.map((c) => ({
            company_id: c.company_id,
            stage: c.stage,
          })),
          visible_roles: data.roles
            .filter((r) => r.can_view_phone)
            .map((r) => r.name),
        }),
      });
      if (res?.ok) {
        setSaved(true);
        setData((d) => (d ? { ...d, using_default_roles: false } : d));
      } else {
        setError(res?.message || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">กำลังโหลดการตั้งค่า…</div>;
  }
  if (!data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error || "ไม่มีสิทธิ์เข้าถึงหน้านี้"}
        </div>
      </div>
    );
  }

  const isProduction = data.deployment === "mini_erp";

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">การมองเห็นเบอร์ลูกค้า</h1>
        <p className="mt-1 text-sm text-gray-600">
          กำหนดว่าใครเห็นเบอร์ลูกค้าได้บ้าง และบริษัทไหนเปิดใช้นโยบายนี้แล้ว
        </p>
      </header>

      {/* ตัวเดียวกันนี้แสดงบนทุก deployment ที่ใช้ DB ร่วมกัน จึงต้องบอกให้ชัดว่ากำลังแก้ของใคร */}
      <div
        className={`rounded-lg border p-4 text-sm ${
          isProduction
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-sky-200 bg-sky-50 text-sky-900"
        }`}
      >
        <span className="font-semibold">
          {isProduction ? "⚠️ กำลังแก้ของระบบจริง (mini_erp)" : `กำลังแก้ของ ${data.deployment}`}
        </span>
        <span className="ml-2 opacity-80">
          {isProduction
            ? "การเปลี่ยนแปลงมีผลกับพนักงานทันที"
            : "การเปลี่ยนแปลงไม่กระทบระบบจริง"}
        </span>
      </div>

      {/* ── ค่าเริ่มต้น ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">ค่าเริ่มต้นของทุกบริษัท</h2>
        <p className="mt-1 text-sm text-gray-500">
          ใช้กับบริษัทที่ไม่ได้ตั้งค่าเฉพาะไว้
        </p>
        <div className="mt-4 space-y-2">
          {STAGES.map((s) => (
            <label
              key={s.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                data.default_stage === s.value
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                className="mt-1"
                checked={data.default_stage === s.value}
                onChange={() => setDefaultStage(s.value)}
              />
              <span>
                <span className="font-medium text-gray-900">{s.label}</span>
                <span className="block text-xs text-gray-500">{s.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ── รายบริษัท ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">ตั้งค่าเฉพาะบริษัท</h2>
        <p className="mt-1 text-sm text-gray-500">
          บริษัทที่เลือก "ตามค่าเริ่มต้น" จะเปลี่ยนตามหัวข้อด้านบนอัตโนมัติ
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2">บริษัท</th>
                <th className="py-2">การซ่อนเบอร์</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <tr key={c.company_id} className="border-b border-gray-100">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-gray-900">{c.company_name}</span>
                    <span className="ml-2 text-xs text-gray-400">#{c.company_id}</span>
                  </td>
                  <td className="py-3">
                    <select
                      className="w-56 rounded-lg border border-gray-300 px-3 py-1.5"
                      value={c.stage ?? ""}
                      onChange={(e) =>
                        setCompanyStage(
                          c.company_id,
                          e.target.value === "" ? null : (e.target.value as Stage),
                        )
                      }
                    >
                      <option value="">
                        ตามค่าเริ่มต้น ({STAGES.find((s) => s.value === data.default_stage)?.label})
                      </option>
                      {STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Role ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Role ที่ยังเห็นเบอร์เต็มได้</h2>
        <p className="mt-1 text-sm text-gray-500">
          Role ที่ไม่ติ๊กจะเห็นเป็น <code className="rounded bg-gray-100 px-1">09xxxxxx97</code> เมื่อบริษัทนั้นเปิดการซ่อน
          — ตั้งใจให้ Telesale และ Sup Telesale ไม่ติ๊ก
        </p>
        {data.using_default_roles && (
          <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            ตอนนี้ใช้ค่าตั้งต้นจากระบบอยู่ กดบันทึกครั้งแรกเพื่อกำหนดเอง
          </p>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.roles.map((r) => (
            <label
              key={r.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                r.can_view_phone
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={r.can_view_phone}
                onChange={() => toggleRole(r.id)}
              />
              <span className="font-medium text-gray-800">{r.name}</span>
              {!r.can_view_phone && (
                <span className="ml-auto font-mono text-xs text-gray-400">09xxxxxx97</span>
              )}
            </label>
          ))}
        </div>
        {visibleRoleCount === 0 && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            ต้องเลือกอย่างน้อย 1 role — ไม่งั้นจะไม่มีใครเห็นเบอร์เลย รวมถึงผู้ดูแลระบบเอง
          </p>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || visibleRoleCount === 0}
          className="rounded-lg bg-teal-700 px-5 py-2.5 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </button>
        {saved && <span className="text-sm text-green-700">บันทึกแล้ว มีผลทันที</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
};

export default PhonePrivacySettingsPage;
