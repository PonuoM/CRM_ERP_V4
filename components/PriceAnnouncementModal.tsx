import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Product, Company, PriceAnnouncement, PriceAnnouncementTier, PriceAnnouncementDiscountTier } from '../types';
import { createPriceAnnouncement, updatePriceAnnouncement, listRoles, uploadPriceImage } from '../services/api';
import Modal from './Modal';
import MultiSelectFilter, { MultiSelectOption } from './MultiSelectFilter';

interface PriceAnnouncementModalProps {
  announcement: PriceAnnouncement | null;
  // When set (and announcement is null), pre-fills the form from this announcement
  // but always submits as a brand-new record (POST), so the source is left untouched.
  copyFrom?: PriceAnnouncement | null;
  products: Product[];
  companies: Company[];
  defaultCompanyId: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type LocalTier = PriceAnnouncementTier & {
  localId: number;
  // Once the unit price has been typed directly, stop auto-recomputing it from total/quantity.
  unitPriceManual?: boolean;
  // Snapshot of the value at copy/load time, used to highlight edited rows.
  original?: { quantity: number; new_total_price: number; new_unit_price: number | null };
};

const computeUnitPrice = (totalPrice: number, quantity: number): number | null =>
  quantity ? Math.round((totalPrice / quantity) * 100) / 100 : null;

type LocalDiscountTier = PriceAnnouncementDiscountTier & {
  localId: number;
  original?: { min_amount: number; cod_discount_pct: number | null; transfer_discount_pct: number | null };
};

const monthInputValue = (month?: string) => (month ? month.slice(0, 7) : '');

const nextMonthValue = (month?: string) => {
  const base = month ? new Date(`${monthInputValue(month)}-01`) : new Date();
  base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 7);
};

const PriceAnnouncementModal: React.FC<PriceAnnouncementModalProps> = ({
  announcement,
  copyFrom,
  products,
  companies,
  defaultCompanyId,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [productId, setProductId] = useState<number | ''>('');
  const [month, setMonth] = useState('');
  const [title, setTitle] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

  const [tiers, setTiers] = useState<LocalTier[]>([]);
  const [tierForm, setTierForm] = useState({ quantity: '', new_total_price: '', new_unit_price: '' });
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountTiers, setDiscountTiers] = useState<LocalDiscountTier[]>([]);
  const [discountTierForm, setDiscountTierForm] = useState({ min_amount: '', cod_discount_pct: '', transfer_discount_pct: '' });
  const [discountNotes, setDiscountNotes] = useState<string[]>([]);
  const [discountNoteDraft, setDiscountNoteDraft] = useState('');

  const [roleOptions, setRoleOptions] = useState<MultiSelectOption[]>([]);
  const [visibilityRoleIds, setVisibilityRoleIds] = useState<number[]>([]);
  const [visibilityCompanyIds, setVisibilityCompanyIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const companyOptions: MultiSelectOption[] = companies.map((c) => ({ id: c.id, label: c.name }));

  useEffect(() => {
    listRoles()
      .then((data: any) => {
        const rows = Array.isArray(data) ? data : (data?.roles ?? []);
        setRoleOptions(rows.map((r: any) => ({ id: r.id, label: r.name || r.code })));
      })
      .catch(() => setRoleOptions([]));
  }, []);

  useEffect(() => {
    const source = announcement || copyFrom;
    if (source) {
      setProductId(source.product_id);
      setMonth(announcement ? monthInputValue(announcement.month) : nextMonthValue(source.month));
      setTitle(source.title || '');
      setGeneralNotes(source.general_notes || '');
      setImageUrl(source.image_url || '');
      // Drop server-assigned ids when copying so they're treated as brand-new rows on submit.
      setTiers(
        source.tiers.map((t) => {
          const unitPrice = t.new_unit_price ?? computeUnitPrice(t.new_total_price, t.quantity);
          return {
            ...t,
            id: announcement ? t.id : undefined,
            localId: Date.now() + Math.random(),
            new_unit_price: unitPrice,
            // An explicit stored override stays locked; a derived value keeps auto-syncing with total/qty.
            unitPriceManual: t.new_unit_price != null,
            original: { quantity: t.quantity, new_total_price: t.new_total_price, new_unit_price: unitPrice },
          };
        })
      );
      setDiscountTiers(
        (source.discount_tiers || []).map((dt) => ({
          ...dt,
          id: announcement ? dt.id : undefined,
          localId: Date.now() + Math.random(),
          original: { min_amount: dt.min_amount, cod_discount_pct: dt.cod_discount_pct ?? null, transfer_discount_pct: dt.transfer_discount_pct ?? null },
        }))
      );
      setDiscountEnabled((source.discount_tiers || []).length > 0);
      setDiscountNotes(source.discount_notes || []);
      setVisibilityRoleIds(source.visibility_role_ids || []);
      setVisibilityCompanyIds(source.visibility_company_ids || []);
    } else {
      setProductId('');
      setMonth(new Date().toISOString().slice(0, 7));
      setTitle('');
      setGeneralNotes('');
      setImageUrl('');
      setImageUploading(false);
      setTiers([]);
      setDiscountTiers([]);
      setDiscountEnabled(false);
      setDiscountNotes([]);
      setVisibilityRoleIds([]);
      setVisibilityCompanyIds([]);
    }
    setError('');
  }, [announcement, copyFrom]);

  const addTier = () => {
    const quantity = parseInt(tierForm.quantity, 10);
    const price = parseFloat(tierForm.new_total_price);
    if (!quantity || isNaN(price)) {
      setError('กรุณากรอกจำนวนและราคาใหม่');
      return;
    }
    const manualUnitPrice = tierForm.new_unit_price.trim() !== '' ? parseFloat(tierForm.new_unit_price) : null;
    const hasManualUnitPrice = manualUnitPrice !== null && !isNaN(manualUnitPrice);
    setTiers((prev) => [
      ...prev,
      {
        localId: Date.now() + Math.random(),
        quantity,
        new_total_price: price,
        new_unit_price: hasManualUnitPrice ? manualUnitPrice : computeUnitPrice(price, quantity),
        unitPriceManual: hasManualUnitPrice,
        notes: [],
      },
    ]);
    setTierForm({ quantity: '', new_total_price: '', new_unit_price: '' });
    setError('');
  };

  const removeTier = (localId: number) => setTiers((prev) => prev.filter((t) => t.localId !== localId));

  const updateTierQuantity = (localId: number, value: string) => {
    const quantity = parseInt(value, 10);
    setTiers((prev) =>
      prev.map((t) => {
        if (t.localId !== localId) return t;
        const q = isNaN(quantity) ? 0 : quantity;
        return { ...t, quantity: q, new_unit_price: t.unitPriceManual ? t.new_unit_price : computeUnitPrice(t.new_total_price, q) };
      })
    );
  };

  const updateTierPrice = (localId: number, value: string) => {
    const price = parseFloat(value);
    setTiers((prev) =>
      prev.map((t) => {
        if (t.localId !== localId) return t;
        const p = isNaN(price) ? 0 : price;
        return { ...t, new_total_price: p, new_unit_price: t.unitPriceManual ? t.new_unit_price : computeUnitPrice(p, t.quantity) };
      })
    );
  };

  const updateTierUnitPrice = (localId: number, value: string) => {
    if (value === '') {
      setTiers((prev) => prev.map((t) => (t.localId === localId ? { ...t, new_unit_price: null, unitPriceManual: true } : t)));
      return;
    }
    const price = parseFloat(value);
    setTiers((prev) =>
      prev.map((t) => (t.localId === localId ? { ...t, new_unit_price: isNaN(price) ? null : price, unitPriceManual: true } : t))
    );
  };

  const isTierChanged = (t: LocalTier) =>
    !!t.original &&
    (t.original.quantity !== t.quantity ||
      t.original.new_total_price !== t.new_total_price ||
      (t.original.new_unit_price ?? null) !== (t.new_unit_price ?? null));

  const addTierNote = (localId: number) => {
    const text = (noteDraft[localId] || '').trim();
    if (!text) return;
    setTiers((prev) => prev.map((t) => (t.localId === localId ? { ...t, notes: [...t.notes, text] } : t)));
    setNoteDraft((prev) => ({ ...prev, [localId]: '' }));
  };

  const removeTierNote = (localId: number, noteIndex: number) => {
    setTiers((prev) =>
      prev.map((t) => (t.localId === localId ? { ...t, notes: t.notes.filter((_, i) => i !== noteIndex) } : t))
    );
  };

  const addDiscountTier = () => {
    const minAmount = parseFloat(discountTierForm.min_amount);
    if (isNaN(minAmount)) {
      setError('กรุณากรอกยอดขั้นต่ำของส่วนลดท้ายบิล');
      return;
    }
    setDiscountTiers((prev) => [
      ...prev,
      {
        localId: Date.now() + Math.random(),
        min_amount: minAmount,
        cod_discount_pct: discountTierForm.cod_discount_pct ? parseFloat(discountTierForm.cod_discount_pct) : null,
        transfer_discount_pct: discountTierForm.transfer_discount_pct ? parseFloat(discountTierForm.transfer_discount_pct) : null,
      },
    ]);
    setDiscountTierForm({ min_amount: '', cod_discount_pct: '', transfer_discount_pct: '' });
    setError('');
  };

  const removeDiscountTier = (localId: number) => setDiscountTiers((prev) => prev.filter((t) => t.localId !== localId));

  const updateDiscountTierField = (localId: number, field: 'min_amount' | 'cod_discount_pct' | 'transfer_discount_pct', value: string) => {
    setDiscountTiers((prev) =>
      prev.map((dt) => {
        if (dt.localId !== localId) return dt;
        if (value === '' && field !== 'min_amount') {
          return { ...dt, [field]: null };
        }
        const parsed = parseFloat(value);
        return { ...dt, [field]: isNaN(parsed) ? (field === 'min_amount' ? 0 : null) : parsed };
      })
    );
  };

  const isDiscountTierChanged = (dt: LocalDiscountTier) =>
    !!dt.original &&
    (dt.original.min_amount !== dt.min_amount ||
      (dt.original.cod_discount_pct ?? null) !== (dt.cod_discount_pct ?? null) ||
      (dt.original.transfer_discount_pct ?? null) !== (dt.transfer_discount_pct ?? null));

  const addDiscountNote = () => {
    const text = discountNoteDraft.trim();
    if (!text) return;
    setDiscountNotes((prev) => [...prev, text]);
    setDiscountNoteDraft('');
  };

  const removeDiscountNote = (index: number) => setDiscountNotes((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('กรุณาเลือกสินค้า');
      return;
    }
    if (!month) {
      setError('กรุณาเลือกเดือน');
      return;
    }
    if (tiers.length === 0) {
      setError('กรุณาเพิ่มราคาอย่างน้อย 1 รายการ');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        company_id: defaultCompanyId,
        product_id: productId,
        month: `${month}-01`,
        title: title || null,
        general_notes: generalNotes || null,
        image_url: imageUrl.trim() || null,
        tiers: tiers.map((t) => {
          // Flush any note still sitting in the draft input (typed but never confirmed with "+")
          // so it isn't silently lost on save.
          const pendingNote = (noteDraft[t.localId] || '').trim();
          return {
            quantity: t.quantity,
            new_total_price: t.new_total_price,
            new_unit_price: t.new_unit_price,
            notes: pendingNote ? [...t.notes, pendingNote] : t.notes,
          };
        }),
        discount_tiers: discountEnabled
          ? discountTiers.map((dt) => ({
              min_amount: dt.min_amount,
              cod_discount_pct: dt.cod_discount_pct,
              transfer_discount_pct: dt.transfer_discount_pct,
            }))
          : [],
        discount_notes: discountEnabled
          ? (discountNoteDraft.trim() ? [...discountNotes, discountNoteDraft.trim()] : discountNotes)
          : [],
        visibility_role_ids: visibilityRoleIds,
        visibility_company_ids: visibilityCompanyIds,
      };

      if (announcement) {
        await updatePriceAnnouncement(announcement.id, payload);
      } else {
        await createPriceAnnouncement(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.data?.message || err?.message || 'เกิดข้อผิดพลาดในการบันทึกประกาศราคา');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      onClose={onClose}
      title={announcement ? 'แก้ไขประกาศราคา/โปรโมชั่น' : copyFrom ? 'คัดลอกประกาศ (สร้างเป็นรายการใหม่)' : 'สร้างประกาศราคา/โปรโมชั่นใหม่'}
      size="lg"
      requireConfirmation
    >
      {!announcement && copyFrom && (
        <div className="bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded mb-4 text-sm">
          คัดลอกข้อมูลจากเดือน {monthInputValue(copyFrom.month)} มาให้แล้ว ปรับ <strong>ราคา</strong> และ <strong>เดือน</strong> ตามต้องการ แล้วกดสร้างประกาศ
          (ไม่กระทบประกาศเดือนเดิม)
        </div>
      )}

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สินค้า *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">-- เลือกสินค้า --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เดือนที่ประกาศ *</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">หัวข้อ (ถ้ามี)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ราคา update กรกฎาคม 2569"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-900 mb-2">ตารางราคาตามจำนวน</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
            <input
              type="number"
              min={1}
              placeholder="จำนวน"
              value={tierForm.quantity}
              onChange={(e) => setTierForm((p) => ({ ...p, quantity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="ราคาใหม่ (รวม)"
              value={tierForm.new_total_price}
              onChange={(e) => setTierForm((p) => ({ ...p, new_total_price: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="ซองละใหม่ (auto ถ้าเว้นว่าง)"
              value={tierForm.new_unit_price}
              onChange={(e) => setTierForm((p) => ({ ...p, new_unit_price: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              type="button"
              onClick={addTier}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center justify-center gap-1"
            >
              <Plus size={14} /> เพิ่มแถว
            </button>
          </div>

          {tiers.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">จำนวน</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">ราคาใหม่</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">ซองละใหม่</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">หมายเหตุ</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tiers.map((t) => {
                  const changed = isTierChanged(t);
                  const cellClass = `px-1 py-1 ${changed ? 'bg-green-50' : ''}`;
                  return (
                  <tr key={t.localId}>
                    <td className={cellClass}>
                      <input
                        type="number"
                        min={1}
                        value={t.quantity}
                        onChange={(e) => updateTierQuantity(t.localId, e.target.value)}
                        className={`w-16 px-2 py-1 border rounded text-sm ${changed ? 'border-green-400 text-green-800 font-medium' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className={cellClass}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={t.new_total_price}
                        onChange={(e) => updateTierPrice(t.localId, e.target.value)}
                        className={`w-24 px-2 py-1 border rounded text-sm ${changed ? 'border-green-400 text-green-800 font-medium' : 'border-gray-300'}`}
                      />
                      {changed && (
                        <div className="text-xs text-green-600 mt-0.5">เดิม {t.original!.new_total_price.toLocaleString()}</div>
                      )}
                    </td>
                    <td className={cellClass}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={t.new_unit_price ?? ''}
                        onChange={(e) => updateTierUnitPrice(t.localId, e.target.value)}
                        placeholder="auto"
                        className={`w-24 px-2 py-1 border rounded text-sm ${changed ? 'border-green-400 text-green-800 font-medium' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <ul className="space-y-1 mb-1">
                        {t.notes.map((n, ni) => (
                          <li key={ni} className="flex items-center gap-1 text-xs text-gray-600">
                            <span>• {n}</span>
                            <button type="button" onClick={() => removeTierNote(t.localId, ni)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={10} />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          placeholder="+ เพิ่มหมายเหตุ"
                          value={noteDraft[t.localId] || ''}
                          onChange={(e) => setNoteDraft((p) => ({ ...p, [t.localId]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTierNote(t.localId);
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <button type="button" onClick={() => addTierNote(t.localId)} className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => removeTier(t.localId)} className="text-red-600 hover:text-red-900">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            หมายเหตุทั่วไป (เช่น เงื่อนไขแลกของแถม) — ขึ้นบรรทัดใหม่ได้
          </label>
          <textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            rows={4}
            placeholder={'หมายเหตุ : เสื้อ 3 ตัว แลก ไตโค หรือ ไคโตซาน ได้ 1 ซอง\nหมายเหตุ : เสื้อ 3 ตัว แลก หมวก 1 ใบ\nหมายเหตุ : ซื้อครบ 5500 แถมเสื้อ 1 ตัว'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm whitespace-pre-wrap"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพสินค้า (ถ้ามี)</label>
          <div className="flex items-start gap-3">
            {imageUrl && (
              <div className="relative flex-shrink-0">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-24 w-24 object-cover border border-gray-200 rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                  title="ลบรูป"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex-1">
              <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${imageUploading ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'}`}>
                <div className="flex flex-col items-center justify-center gap-1 text-center px-2">
                  {imageUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-blue-600">กำลังอัปโหลด...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-gray-500">{imageUrl ? 'เปลี่ยนรูป' : 'คลิกเพื่ออัปโหลดรูป'}</span>
                      <span className="text-xs text-gray-400">PNG, JPG, WebP</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  className="hidden"
                  disabled={imageUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageUploading(true);
                    setError('');
                    try {
                      const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => resolve(ev.target?.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      });
                      const res = await uploadPriceImage(base64);
                      setImageUrl(res.url);
                    } catch {
                      setError('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
                    } finally {
                      setImageUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              <p className="text-xs text-gray-400 mt-1">รูปจะแสดงทางซ้ายของตารางราคา</p>
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(e) => setDiscountEnabled(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-900">มีส่วนลดท้ายบิลสำหรับสินค้านี้</span>
          </label>

          {discountEnabled && (
            <div className="border border-gray-200 rounded-md p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  type="number"
                  min={0}
                  placeholder="ยอดขั้นต่ำ"
                  value={discountTierForm.min_amount}
                  onChange={(e) => setDiscountTierForm((p) => ({ ...p, min_amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="% ปลายทาง/COD"
                  value={discountTierForm.cod_discount_pct}
                  onChange={(e) => setDiscountTierForm((p) => ({ ...p, cod_discount_pct: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="% โอน"
                  value={discountTierForm.transfer_discount_pct}
                  onChange={(e) => setDiscountTierForm((p) => ({ ...p, transfer_discount_pct: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={addDiscountTier}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> เพิ่มแถว
                </button>
              </div>

              {discountTiers.length > 0 && (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">ยอดขาย</th>
                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">ปลายทาง/COD</th>
                      <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">โอน</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {discountTiers.map((dt) => {
                      const changed = isDiscountTierChanged(dt);
                      const cellClass = `px-1 py-1 ${changed ? 'bg-green-50' : ''}`;
                      const inputClass = `w-20 px-2 py-1 border rounded text-sm ${changed ? 'border-green-400 text-green-800 font-medium' : 'border-gray-300'}`;
                      return (
                        <tr key={dt.localId}>
                          <td className={cellClass}>
                            <input
                              type="number"
                              min={0}
                              value={dt.min_amount}
                              onChange={(e) => updateDiscountTierField(dt.localId, 'min_amount', e.target.value)}
                              className={inputClass}
                            />
                          </td>
                          <td className={cellClass}>
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={dt.cod_discount_pct ?? ''}
                              onChange={(e) => updateDiscountTierField(dt.localId, 'cod_discount_pct', e.target.value)}
                              className={inputClass}
                            />
                          </td>
                          <td className={cellClass}>
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={dt.transfer_discount_pct ?? ''}
                              onChange={(e) => updateDiscountTierField(dt.localId, 'transfer_discount_pct', e.target.value)}
                              className={inputClass}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <button type="button" onClick={() => removeDiscountTier(dt.localId)} className="text-red-600 hover:text-red-900">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div>
                <ul className="space-y-1 mb-1">
                  {discountNotes.map((n, ni) => (
                    <li key={ni} className="flex items-center gap-1 text-xs text-gray-600">
                      <span>• {n}</span>
                      <button type="button" onClick={() => removeDiscountNote(ni)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={10} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="+ เพิ่มหมายเหตุเงื่อนไข (เช่น ไม่รวมปุ๋ย)"
                    value={discountNoteDraft}
                    onChange={(e) => setDiscountNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDiscountNote();
                      }
                    }}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                  <button type="button" onClick={addDiscountNote} className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">แสดงให้แผนก (role) เห็น</label>
            <MultiSelectFilter
              options={roleOptions}
              selectedIds={visibilityRoleIds}
              onChange={setVisibilityRoleIds}
              placeholder="ค้นหาแผนก..."
              emptyMeansAllLabel="ทุกแผนก (ไม่จำกัด)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">แสดงให้บริษัทอื่นเห็นด้วย</label>
            <MultiSelectFilter
              options={companyOptions}
              selectedIds={visibilityCompanyIds}
              onChange={setVisibilityCompanyIds}
              placeholder="ค้นหาบริษัท..."
              emptyMeansAllLabel="ทุกบริษัท (ไม่จำกัด)"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="mr-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : announcement ? 'อัปเดต' : 'สร้างประกาศ'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PriceAnnouncementModal;
