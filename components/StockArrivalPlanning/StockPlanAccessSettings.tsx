import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Lock, Search, Check } from 'lucide-react';
import { StockPlanManagerRow } from './types';
import { listStockPlanManagers, saveStockPlanManager } from '@/services/api';

interface StockPlanAccessSettingsProps {
  /** ผู้ใช้ปัจจุบัน (คนที่กำลังตั้งสิทธิ์) */
  currentUserId?: number;
  companyId?: number;
}

const COMPANY_LABELS: Record<number, string> = {
  1: 'พรีม่าแพสชั่น49',
  2: 'พรีออนิค',
};

const StockPlanAccessSettings: React.FC<StockPlanAccessSettingsProps> = ({ currentUserId, companyId }) => {
  const [rows, setRows] = useState<StockPlanManagerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [onlyGranted, setOnlyGranted] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listStockPlanManagers({ userId: currentUserId, companyId });
      setRows(res?.data ?? []);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'โหลดรายชื่อไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserId) load();
  }, [currentUserId, companyId]);

  const toggle = async (row: StockPlanManagerRow) => {
    if (row.always_allowed) return;
    setSavingId(row.id);
    setError(null);
    try {
      await saveStockPlanManager({
        user_id: row.id,
        can_manage: !row.can_manage,
        actor_user_id: currentUserId,
      });
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, can_manage: !row.can_manage } : r)));
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  };

  const grantedCount = useMemo(() => rows.filter(r => r.can_manage && !r.always_allowed).length, [rows]);
  const alwaysCount = useMemo(() => rows.filter(r => r.always_allowed).length, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter(r => (onlyGranted ? r.can_manage : true))
      .filter(r => !term || `${r.name} ${r.username} ${r.role ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => {
        // คนที่มีสิทธิ์อยู่แล้วขึ้นก่อน แล้วค่อยเรียงตามชื่อ
        if (a.can_manage !== b.can_manage) return a.can_manage ? -1 : 1;
        if (a.always_allowed !== b.always_allowed) return a.always_allowed ? -1 : 1;
        return a.name.localeCompare(b.name, 'th');
      });
  }, [rows, search, onlyGranted]);

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="p-4 border-b space-y-1">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <ShieldCheck size={15} /> สิทธิ์การจัดการแพลน (เพิ่ม/ลบแพลน + เพิ่มหมายเหตุ)
        </h3>
        <p className="text-xs text-gray-400">
          บัญชีที่ไม่ได้ติ๊กจะยังเข้าดูปฏิทิน กำหนดวันที่คาดว่าจะเข้า และยืนยันรับเข้าได้ตามปกติ —
          แต่จะเพิ่มแพลน ลบแพลน หรือเพิ่มหมายเหตุไม่ได้
        </p>
        <p className="text-xs text-gray-400">
          Super Admin / Admin Control / CEO มีสิทธิ์อยู่แล้วโดยอัตโนมัติ ({alwaysCount} บัญชี) ·
          ให้สิทธิ์เพิ่มไว้ {grantedCount} บัญชี
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / username / ตำแหน่ง..."
              className="border rounded-lg pl-8 pr-3 py-2 text-sm w-72 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={() => setOnlyGranted(v => !v)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              onlyGranted ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            เฉพาะคนที่มีสิทธิ์
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b">{error}</div>}

      <div className="divide-y max-h-[560px] overflow-y-auto">
        {loading && <div className="text-center py-10 text-gray-400 text-sm">กำลังโหลด...</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">ไม่พบบัญชีที่ค้นหา</div>
        )}

        {!loading && filtered.map(row => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-800 truncate font-medium">
                {row.name}
                <span className="text-gray-400 font-normal text-xs ml-2">@{row.username}</span>
              </div>
              <div className="text-[11px] text-gray-400 truncate mt-0.5">
                {row.role ?? '-'}
                {row.company_id ? ` · ${COMPANY_LABELS[row.company_id] ?? `บริษัท ${row.company_id}`}` : ''}
                {row.status && row.status !== 'active' ? ` · ${row.status}` : ''}
                {row.granted_by_name ? ` · ให้สิทธิ์โดย ${row.granted_by_name}` : ''}
              </div>
            </div>

            {row.always_allowed ? (
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 border rounded-full px-2.5 py-1">
                <Lock size={11} /> มีสิทธิ์เสมอ
              </span>
            ) : (
              <button
                onClick={() => toggle(row)}
                disabled={savingId === row.id}
                className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors disabled:opacity-50 ${
                  row.can_manage
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                }`}
                title={row.can_manage ? 'คลิกเพื่อถอนสิทธิ์' : 'คลิกเพื่อให้สิทธิ์'}
              >
                {savingId === row.id ? (
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check size={13} className={row.can_manage ? '' : 'opacity-30'} />
                )}
                {row.can_manage ? 'มีสิทธิ์' : 'ไม่มีสิทธิ์'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockPlanAccessSettings;
