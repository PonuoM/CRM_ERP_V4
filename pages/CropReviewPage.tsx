import React, { useState, useEffect, useCallback } from 'react';
import { Check, GitMerge, Trash2, RefreshCw, Search, Sprout } from 'lucide-react';
import { listPendingCrops, reviewCrop, searchCrops, Crop } from '../services/api';

/**
 * คิวตรวจพืชที่เทเลเพิ่มเอง
 *
 * เทเลเพิ่มพืชใหม่ได้ทันทีโดยไม่ต้องรออนุมัติ (ดู migration 088) หน้านี้คือด่านตรวจย้อนหลัง
 * เรียงตามจำนวนลูกค้าที่ใช้จริง — ตัวที่ใช้บ่อยลอยขึ้นบนสุดเอง ตัวที่ใช้ครั้งเดียวรอได้
 *
 * ตอนเปิดใช้ครั้งแรกมีคิวราว 900 รายการ แต่ 750 รายการมีลูกค้าแค่ 1 ราย จึงไม่ใช่งานเร่ง
 */

interface PendingCrop {
  crop_id: number;
  name: string;
  category: string;
  default_unit: string;
  usage_count: number;
  created_at: string;
  suggest: { name: string; confidence: string } | null;
}

const CATEGORIES = ['ไม้ผล', 'พืชไร่', 'ผัก', 'ไม้ดอก', 'รวม', 'อื่นๆ'];

const MergeBox: React.FC<{ crop: PendingCrop; onMerge: (intoId: number) => void; busy: boolean }> = ({
  crop, onMerge, busy,
}) => {
  const [q, setQ] = useState(crop.suggest?.name || '');
  const [items, setItems] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      if (!q.trim()) { setItems([]); return; }
      setLoading(true);
      searchCrops(q.trim(), 6)
        .then((r) => { if (alive) setItems((r?.items || []).filter((c) => c.crop_id !== crop.crop_id)); })
        .catch(() => { if (alive) setItems([]); })
        .finally(() => { if (alive) setLoading(false); });
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q, crop.crop_id]);

  return (
    <div className="mt-2 p-2.5 bg-gray-50 rounded-md border border-gray-200">
      <div className="relative mb-2">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="พิมพ์ชื่อพืชที่จะรวมเข้า"
          className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:ring-1 focus:ring-green-500"
          style={{ colorScheme: 'light' }}
        />
      </div>
      {loading && <p className="text-xs text-gray-400">กำลังค้นหา...</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.map((c) => (
          <button
            key={c.crop_id}
            disabled={busy}
            onClick={() => onMerge(c.crop_id)}
            className="px-2.5 py-1 text-xs rounded border border-green-300 bg-white text-green-700 hover:bg-green-50 disabled:opacity-50"
          >
            รวมเข้า &ldquo;{c.name}&rdquo;
          </button>
        ))}
        {!loading && q.trim() && items.length === 0 && (
          <span className="text-xs text-gray-400">ไม่พบพืชที่ตรงกัน</span>
        )}
      </div>
    </div>
  );
};

const CropReviewPage: React.FC = () => {
  const [items, setItems] = useState<PendingCrop[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [mergeFor, setMergeFor] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, { category: string; unit: 'ไร่' | 'ต้น' }>>({});

  const load = useCallback(() => {
    setLoading(true);
    listPendingCrops(50)
      .then((r: any) => { setItems(r?.items || []); setTotal(r?.total || 0); })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (
    cropId: number,
    action: 'approve' | 'merge' | 'discard',
    extra?: { mergeInto?: number },
  ) => {
    if (action === 'discard' && !window.confirm('ทิ้งพืชนี้? ชุดข้อมูลที่อ้างถึงจะกลายเป็นชุดไม่ระบุพืช (ไม่ได้ลบชุดทิ้ง)')) return;
    setBusyId(cropId);
    try {
      const e = edits[cropId];
      await reviewCrop({
        cropId,
        action,
        mergeInto: extra?.mergeInto,
        category: e?.category,
        defaultUnit: e?.unit,
      });
      setItems((prev) => prev.filter((i) => i.crop_id !== cropId));
      setTotal((t) => Math.max(0, t - 1));
      setMergeFor(null);
    } catch {
      alert('ทำรายการไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Sprout size={20} className="text-green-600" />
          ตรวจพืชที่เพิ่มใหม่
        </h1>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        พืชที่พนักงานเพิ่มเอง — ใช้งานได้แล้วตั้งแต่วินาทีที่เพิ่ม หน้านี้คือการตรวจย้อนหลัง
        เรียงตามจำนวนลูกค้าที่ใช้จริง ตัวที่ใช้ครั้งเดียวไม่ต้องรีบ
        {total > 0 && <span className="ml-1 font-medium text-gray-700">· เหลือ {total.toLocaleString()} รายการ</span>}
      </p>

      {loading && <p className="text-sm text-gray-400">กำลังโหลด...</p>}
      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Check size={36} className="mx-auto mb-2 text-green-500" />
          <p className="text-sm">ไม่มีพืชรอตรวจแล้ว</p>
        </div>
      )}

      <div className="space-y-2.5">
        {items.map((c) => {
          const e = edits[c.crop_id] || {
            category: c.category === 'อื่นๆ' && c.suggest ? 'อื่นๆ' : c.category,
            unit: (c.default_unit === 'ต้น' ? 'ต้น' : 'ไร่') as 'ไร่' | 'ต้น',
          };
          const busy = busyId === c.crop_id;
          return (
            <div key={c.crop_id} className="border border-gray-200 rounded-lg p-3.5 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 break-words">{c.name}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    ใช้กับลูกค้า {c.usage_count.toLocaleString()} ราย
                  </span>
                  {c.suggest && (
                    <span className="ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                      คล้าย &ldquo;{c.suggest.name}&rdquo;
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <select
                  value={e.category}
                  disabled={busy}
                  onChange={(ev) => setEdits((p) => ({ ...p, [c.crop_id]: { ...e, category: ev.target.value } }))}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900"
                  style={{ colorScheme: 'light' }}
                >
                  {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <div className="flex rounded border border-gray-300 overflow-hidden">
                  {(['ไร่', 'ต้น'] as const).map((u) => (
                    <button
                      key={u}
                      disabled={busy}
                      onClick={() => setEdits((p) => ({ ...p, [c.crop_id]: { ...e, unit: u } }))}
                      className={`px-2.5 py-1.5 text-sm ${
                        e.unit === u ? 'bg-[#2E7D32] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-gray-400">หน่วยตั้งต้นเมื่อเลือกพืชนี้</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => act(c.crop_id, 'approve')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-[#2E7D32] text-white hover:bg-green-800 disabled:opacity-50"
                >
                  <Check size={14} /> อนุมัติ
                </button>
                <button
                  disabled={busy}
                  onClick={() => setMergeFor(mergeFor === c.crop_id ? null : c.crop_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <GitMerge size={14} /> รวมกับพืชอื่น
                </button>
                <button
                  disabled={busy}
                  onClick={() => act(c.crop_id, 'discard')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={14} /> ทิ้ง
                </button>
              </div>

              {mergeFor === c.crop_id && (
                <MergeBox crop={c} busy={busy} onMerge={(into) => act(c.crop_id, 'merge', { mergeInto: into })} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CropReviewPage;
