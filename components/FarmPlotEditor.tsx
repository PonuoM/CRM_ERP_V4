import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Search, Check, Sprout } from 'lucide-react';
import { searchCrops, createCrop, Crop, CustomerPlot } from '../services/api';

/**
 * ตัวแก้ไข "ข้อมูลสวนลูกค้า" — 1 ลูกค้ามีได้หลายชุด แต่ละชุดอิสระต่อกัน
 * ดูที่มาและเหตุผลได้ที่ api/migrations/088_customer_farm_profile.sql
 *
 * หลักการ: ไม่บังคับกรอก แค่ชวน — ปุ่มบันทึกของ modal แม่ต้องกดผ่านได้เสมอ
 */

export interface PlotDraft {
  key: string;
  cropId: number | null;
  cropName: string;
  cropUnit: 'ไร่' | 'ต้น';
  sizeValue: string;
  sizeUnit: 'ไร่' | 'ต้น' | 'งาน' | 'ตร.ว.';
  isHomeGarden: boolean;
  note: string;
}

let keySeq = 0;
export const makeEmptyPlot = (): PlotDraft => ({
  key: `p${Date.now()}_${keySeq++}`,
  cropId: null,
  cropName: '',
  cropUnit: 'ไร่',
  sizeValue: '',
  sizeUnit: 'ไร่',
  isHomeGarden: false,
  note: '',
});

/** แปลงข้อมูลจาก API เป็นร่างที่แก้ไขได้ */
export const plotsToDrafts = (plots: CustomerPlot[]): PlotDraft[] =>
  plots.map((p) => ({
    key: `p${p.plot_id ?? keySeq++}`,
    cropId: p.crop_id,
    cropName: p.crop_name || '',
    cropUnit: (p.default_unit === 'ต้น' ? 'ต้น' : 'ไร่') as 'ไร่' | 'ต้น',
    sizeValue: p.size_value != null ? String(Number(p.size_value)) : '',
    sizeUnit: (p.size_unit as PlotDraft['sizeUnit']) || (p.default_unit === 'ต้น' ? 'ต้น' : 'ไร่'),
    isHomeGarden: Number(p.is_home_garden) === 1,
    note: p.note || '',
  }));

// ───────────────────────── ช่องเลือกพืช ─────────────────────────

interface CropPickerProps {
  value: string;
  cropId: number | null;
  disabled?: boolean;
  userId?: number;
  onPick: (crop: { id: number | null; name: string; unit: 'ไร่' | 'ต้น' }) => void;
}

const CropPicker: React.FC<CropPickerProps> = ({ value, cropId, disabled, userId, onPick }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [items, setItems] = useState<Crop[]>([]);
  const [suggest, setSuggest] = useState<(Crop & { confidence: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => { setText(value); }, [value]);

  // ปิด dropdown เมื่อคลิกนอกกล่อง
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const runSearch = useCallback((q: string) => {
    setLoading(true);
    searchCrops(q, 12)
      .then((r) => { setItems(r?.items || []); setSuggest(r?.suggest || null); })
      .catch(() => { setItems([]); setSuggest(null); })
      .finally(() => setLoading(false));
  }, []);

  const onType = (v: string) => {
    setText(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v.trim()), 220);   // หน่วงไว้ไม่ให้ยิงทุกตัวอักษร
  };

  const choose = (c: Crop) => {
    onPick({ id: c.crop_id, name: c.name, unit: c.default_unit === 'ต้น' ? 'ต้น' : 'ไร่' });
    setText(c.name);
    setOpen(false);
  };

  /** เพิ่มพืชใหม่ — ถ้าระบบเจอตัวใกล้เคียงจะถามก่อน ไม่สร้างทันที */
  const addNew = async (force = false) => {
    const name = text.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const r: any = await createCrop(name, { force, userId });
      if (r?.needsConfirm && r?.suggest) {
        const ok = window.confirm(
          `หมายถึง "${r.suggest.name}" หรือไม่?\n\nกด "ตกลง" เพื่อใช้ ${r.suggest.name}\nกด "ยกเลิก" เพื่อเพิ่ม "${name}" เป็นพืชใหม่`
        );
        if (ok) { choose(r.suggest); return; }
        return addNew(true);
      }
      if (r?.crop) choose(r.crop);
      else if (r?.message) alert(r.message);
    } catch {
      alert('เพิ่มพืชไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setAdding(false);
    }
  };

  const exactExists = items.some((i) => i.name === text.trim());
  const canAdd = text.trim().length > 0 && !exactExists && !loading;

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={text}
          disabled={disabled}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => { setOpen(true); if (items.length === 0) runSearch(text.trim()); }}
          placeholder="พิมพ์ชื่อพืช เช่น ทุเรียน"
          className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
          style={{ colorScheme: 'light' }}
        />
        {cropId && text.trim() !== '' && (
          <Check size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-600" />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-gray-400">กำลังค้นหา...</div>}

          {!loading && suggest && (
            <button
              type="button"
              onClick={() => choose(suggest)}
              className="w-full text-left px-3 py-2 bg-amber-50 hover:bg-amber-100 border-b border-amber-200"
            >
              <span className="text-xs text-amber-700">หมายถึง </span>
              <span className="text-sm font-medium text-amber-900">{suggest.name}</span>
              <span className="text-xs text-amber-700"> หรือไม่?</span>
            </button>
          )}

          {!loading && items.map((c) => (
            <button
              type="button"
              key={c.crop_id}
              onClick={() => choose(c)}
              className="w-full text-left px-3 py-2 hover:bg-green-50 flex items-center justify-between gap-2"
            >
              <span className="text-sm text-gray-800 truncate">{c.name}</span>
              <span className="flex items-center gap-1.5 flex-none">
                {c.status === 'pending' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">รอตรวจ</span>
                )}
                <span className="text-[10px] text-gray-400">{c.category}</span>
              </span>
            </button>
          ))}

          {!loading && items.length === 0 && !suggest && text.trim() !== '' && (
            <div className="px-3 py-2 text-xs text-gray-400">ไม่พบพืชนี้ในระบบ</div>
          )}

          {canAdd && (
            <button
              type="button"
              onClick={() => addNew(false)}
              disabled={adding}
              className="w-full text-left px-3 py-2 border-t border-gray-200 text-sm text-green-700 hover:bg-green-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus size={14} />
              {adding ? 'กำลังเพิ่ม...' : <>เพิ่ม <b>&ldquo;{text.trim()}&rdquo;</b> เป็นพืชใหม่</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ───────────────────────── ตัวแก้ไขทั้งหมด ─────────────────────────

interface FarmPlotEditorProps {
  plots: PlotDraft[];
  onChange: (plots: PlotDraft[]) => void;
  disabled?: boolean;
  userId?: number;
  /** true เมื่อสถานะการโทรคือ ได้คุย/รับสาย — ใช้ตัดสินว่าจะขึ้นแถบชวนกรอกไหม */
  showNudge?: boolean;
}

const FarmPlotEditor: React.FC<FarmPlotEditorProps> = ({ plots, onChange, disabled, userId, showNudge }) => {
  const update = (key: string, patch: Partial<PlotDraft>) =>
    onChange(plots.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const remove = (key: string) => {
    const next = plots.filter((p) => p.key !== key);
    onChange(next.length > 0 ? next : [makeEmptyPlot()]);
  };

  const isEmpty = plots.every((p) => !p.cropName && !p.sizeValue && !p.isHomeGarden && !p.note);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-gray-700 font-medium flex items-center gap-1.5">
          <Sprout size={15} className="text-green-600" />
          ข้อมูลสวน
          <span className="text-xs font-normal text-gray-400">(ไม่บังคับ)</span>
        </label>
        {plots.length > 1 && (
          <span className="text-xs text-gray-400">{plots.length} ชุด</span>
        )}
      </div>

      {showNudge && isEmpty && (
        <div className="text-xs bg-green-50 border border-green-200 text-green-800 rounded-md px-3 py-2">
          ลูกค้ารายนี้ยังไม่มีข้อมูลสวน — ถ้าสะดวก ช่วยถามเพิ่มให้หน่อยได้ไหม (ข้ามได้)
        </div>
      )}

      {plots.map((p, idx) => (
        <div key={p.key} className="border border-gray-200 rounded-lg p-3 bg-gray-50/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">ชุดที่ {idx + 1}</span>
            {plots.length > 1 && (
              <button
                type="button"
                onClick={() => remove(p.key)}
                disabled={disabled}
                className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                aria-label={`ลบชุดที่ ${idx + 1}`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <CropPicker
            value={p.cropName}
            cropId={p.cropId}
            disabled={disabled}
            userId={userId}
            onPick={(c) =>
              update(p.key, {
                cropId: c.id,
                cropName: c.name,
                cropUnit: c.unit,
                // หน่วยเปลี่ยนตามชนิดพืช แต่ถ้าผู้ใช้กรอกตัวเลขไว้แล้วอย่าไปยุ่ง
                sizeUnit: p.sizeValue ? p.sizeUnit : c.unit,
              })
            }
          />

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="any"
              value={p.sizeValue}
              disabled={disabled}
              onChange={(e) => update(p.key, { sizeValue: e.target.value })}
              placeholder="ขนาด"
              className="flex-1 min-w-0 p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              style={{ colorScheme: 'light' }}
            />
            {/* ไม้ผลนับเป็นต้น พืชไร่นับเป็นไร่ — สลับเองได้เสมอ */}
            <div className="flex rounded-md border border-gray-300 overflow-hidden flex-none">
              {(['ไร่', 'ต้น'] as const).map((u) => (
                <button
                  type="button"
                  key={u}
                  disabled={disabled}
                  onClick={() => update(p.key, { sizeUnit: u })}
                  className={`px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                    p.sizeUnit === u
                      ? 'bg-[#2E7D32] text-white font-medium'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={p.isHomeGarden}
              disabled={disabled}
              onChange={(e) => update(p.key, { isHomeGarden: e.target.checked })}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            ปลูกกินเอง (ไม่ใช่เชิงการค้า)
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...plots, makeEmptyPlot()])}
        disabled={disabled || plots.length >= 20}
        className="w-full flex items-center justify-center py-2 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:border-green-500 hover:text-green-600 transition-colors disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-500"
      >
        <Plus size={14} className="mr-1.5" /> เพิ่มสวนอีกชุด
      </button>
    </div>
  );
};

export default FarmPlotEditor;
