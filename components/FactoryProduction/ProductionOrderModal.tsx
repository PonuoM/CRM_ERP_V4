import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2, Info } from 'lucide-react';
import { User, UserRole } from '@/types';
import { getProductionOrder, saveProductionOrder } from '@/services/api';
import ProductSearchSelect from '@/components/ProductSearchSelect';
import PdfImportPanel, { type StoredDoc } from '@/components/FactoryProduction/PdfImportPanel';
import type { ParsedDoc } from '@/components/FactoryProduction/pdfImport';
import { ProductionFactory, fmtQty } from '@/components/FactoryProduction/types';

interface ItemDraft {
  id?: number;
  product_id: number | '';
  ordered_qty: number | '';
  note?: string;
  /** ยอดที่ออกใบขนไปแล้ว — เป็นพื้นห้ามลดต่ำกว่านี้ */
  deliveredQty?: number;
  /* ค่าตามใบ SO ต้นทาง (เก็บไว้เทียบย้อนหลังเวลารหัสสินค้าไม่ตรง) */
  docLineNo?: number;
  docSku?: string;
  docName?: string;
  unit?: string;
  department?: string;
}

interface Props {
  editOrderId?: number;
  factories: ProductionFactory[];
  /** แคตตาล็อกสินค้า (stock_arrival_products) — มี default_factory_id ติดมาด้วย */
  products: any[];
  companyId?: number;
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

const ProductionOrderModal: React.FC<Props> = ({
  editOrderId, factories, products, companyId, currentUser, onClose, onSaved,
}) => {
  const isEdit = !!editOrderId;
  const isSuperAdmin = currentUser?.role === UserRole.SuperAdmin;
  const today = new Date().toISOString().slice(0, 10);

  const [soNumber, setSoNumber] = useState('');
  const [factoryId, setFactoryId] = useState<number | ''>(factories[0]?.id ?? '');
  const [soDate, setSoDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('open');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([{ product_id: '', ordered_qty: '' }]);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ข้อมูลที่อ่านได้จากไฟล์ PDF (ใบจองสินค้า/ใบสั่งขายจาก e-acc) */
  const [imported, setImported] = useState<ParsedDoc | null>(null);
  const [importFile, setImportFile] = useState('');
  const [storedDoc, setStoredDoc] = useState<StoredDoc | null>(null);
  const [savedDocPath, setSavedDocPath] = useState<string | null>(null);
  const [unmatchedSkus, setUnmatchedSkus] = useState<string[]>([]);

  useEffect(() => {
    if (!editOrderId) return;
    let mounted = true;
    setLoading(true);
    getProductionOrder(editOrderId, currentUser?.id)
      .then((res: any) => {
        if (!mounted || !res?.success) return;
        const o = res.data;
        setSoNumber(o.so_number);
        setFactoryId(o.factory_id);
        setSoDate(o.so_date?.slice(0, 10) ?? today);
        setDueDate(o.due_date?.slice(0, 10) ?? o.receive_date?.slice(0, 10) ?? '');
        setSavedDocPath(o.source_path ?? null);
        setStatus(o.status);
        setNotes(o.notes ?? '');
        setItems((o.items ?? []).map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          ordered_qty: it.ordered_qty,
          note: it.note ?? '',
          deliveredQty: it.delivered_qty ?? 0,
        })));
      })
      .catch((err: any) => {
        if (mounted) setError(err?.data?.error || err?.message || 'โหลดข้อมูล SO ไม่สำเร็จ');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [editOrderId]);

  const productMap = useMemo(() => {
    const m: Record<number, any> = {};
    products.forEach(p => { m[p.id] = p; });
    return m;
  }, [products]);

  /** รหัสสินค้าในแคตตาล็อก -> ตัวสินค้า (เทียบแบบไม่แคร์ตัวพิมพ์/ช่องว่าง) */
  const productBySku = useMemo(() => {
    const m: Record<string, any> = {};
    products.forEach(p => {
      const key = String(p.sku ?? '').trim().toUpperCase();
      if (key) m[key] = p;
    });
    return m;
  }, [products]);

  /** อ่านไฟล์เสร็จ -> เติมหัวบิลกับรายการสินค้าให้ (ผู้ใช้ยังแก้ได้ทุกช่อง) */
  const applyParsed = (doc: ParsedDoc, fileName: string, stored: StoredDoc | null) => {
    setImported(doc);
    setImportFile(fileName);
    setStoredDoc(stored);
    setError(null);

    if (doc.docNumber) setSoNumber(doc.docNumber);
    if (doc.docDate) setSoDate(doc.docDate);
    if (doc.receiveDate) setDueDate(doc.receiveDate);

    const missing: string[] = [];
    const rows: ItemDraft[] = doc.items.map(it => {
      const p = productBySku[it.sku.toUpperCase()];
      if (!p) missing.push(it.sku);
      return {
        product_id: p ? p.id : '',
        ordered_qty: Math.round(it.qty),
        docLineNo: it.lineNo,
        docSku: it.sku,
        docName: it.name,
        unit: it.unit,
        department: it.department,
      };
    });
    setUnmatchedSkus(missing);
    if (rows.length > 0) setItems(rows);

    /* เดาโรงงานจาก "โรงงานเริ่มต้น" ของสินค้าในใบ — เอาเสียงข้างมาก */
    const votes: Record<number, number> = {};
    rows.forEach(r => {
      const def = r.product_id ? productMap[r.product_id as number]?.default_factory_id : null;
      if (def) votes[def] = (votes[def] ?? 0) + 1;
    });
    const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    if (winner) setFactoryId(Number(winner[0]));
  };

  const clearImport = () => {
    setImported(null);
    setImportFile('');
    setStoredDoc(null);
    setUnmatchedSkus([]);
  };

  const addRow = () => setItems(prev => [...prev, { product_id: '', ordered_qty: '' }]);

  const removeRow = (index: number) => {
    const row = items[index];
    if (row?.deliveredQty) {
      setError(`"${productMap[row.product_id as number]?.name ?? 'รายการนี้'}" ออกใบขนไปแล้ว ${fmtQty(row.deliveredQty)} — ลบไม่ได้ ต้องยกเลิกใบขนก่อน`);
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof ItemDraft, value: any) => {
    setItems(prev => prev.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [field]: value };
      // เลือกสินค้าที่ตั้งโรงงานเริ่มต้นไว้ -> เติมโรงงานให้อัตโนมัติ (ถ้ายังไม่ได้เลือก)
      if (field === 'product_id' && value) {
        const def = productMap[value as number]?.default_factory_id;
        if (def && !factoryId) setFactoryId(def);
      }
      return next;
    }));
  };

  const totalQty = items.reduce((s, r) => s + (Number(r.ordered_qty) || 0), 0);

  // โรงงานเริ่มต้นของสินค้าในบิลไม่ตรงกับโรงงานที่เลือก -> เตือน (ไม่บล็อก)
  const factoryMismatch = useMemo(() => {
    if (!factoryId) return null;
    const wrong = items.find(r => {
      const def = r.product_id ? productMap[r.product_id as number]?.default_factory_id : null;
      return def && def !== factoryId;
    });
    if (!wrong) return null;
    const p = productMap[wrong.product_id as number];
    const f = factories.find(x => x.id === p?.default_factory_id);
    return `"${p?.name}" ปกติผลิตที่ ${f?.name ?? 'โรงงานอื่น'}`;
  }, [items, factoryId, productMap, factories]);

  const handleSave = async () => {
    setError(null);
    if (!soNumber.trim()) return setError('กรุณาระบุเลข SO');
    if (!factoryId) return setError('กรุณาเลือกโรงงานผลิต');
    if (!soDate) return setError('กรุณาระบุวันที่ SO');
    if (items.length === 0) return setError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    if (items.some(r => !r.product_id || !r.ordered_qty || Number(r.ordered_qty) <= 0)) {
      return setError('กรุณาระบุสินค้าและจำนวนให้ครบทุกแถว (มากกว่า 0)');
    }
    const belowDelivered = items.find(r => r.deliveredQty && Number(r.ordered_qty) < r.deliveredQty);
    if (belowDelivered && !isSuperAdmin) {
      return setError(`จำนวนต้องไม่ต่ำกว่ายอดที่ออกใบขนไปแล้ว (${fmtQty(belowDelivered.deliveredQty)})`);
    }

    setSaving(true);
    try {
      await saveProductionOrder({
        ...(isEdit ? { id: editOrderId } : {}),
        so_number: soNumber.trim(),
        company_id: companyId ?? null,
        factory_id: Number(factoryId),
        so_date: soDate,
        due_date: dueDate || null,
        status,
        notes,
        force: !!belowDelivered && isSuperAdmin,
        user_id: currentUser?.id,
        ...(imported ? {
          customer_code: imported.customerCode || null,
          customer_name: imported.customerName || null,
          customer_address: imported.customerAddress || null,
          receive_date: imported.receiveDate || null,
          warehouse_name: imported.warehouseName || null,
          coordinator_name: imported.coordinator || null,
          source_type: 'pdf',
          source_file: importFile || null,
          source_path: storedDoc?.path ?? null,
          source_size: storedDoc?.size ?? null,
        } : {}),
        items: items.map(r => ({
          ...(r.id ? { id: r.id } : {}),
          product_id: Number(r.product_id),
          ordered_qty: Number(r.ordered_qty),
          note: r.note || null,
          ...(r.docSku ? {
            doc_line_no: r.docLineNo ?? null,
            doc_sku: r.docSku,
            doc_name: r.docName ?? null,
            unit: r.unit ?? null,
            department: r.department ?? null,
          } : {}),
        })),
      });
      onSaved();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ overflowX: 'hidden' }}>
        <header className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? `แก้ไข SO ${soNumber}` : 'เปิด SO สั่งผลิตใหม่'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-gray-500">
            <Loader2 className="animate-spin mr-2" size={18} /> กำลังโหลด...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>
            )}

            <PdfImportPanel
              kind="so"
              parsed={imported}
              fileName={importFile}
              unmatchedSkus={unmatchedSkus}
              onParsed={applyParsed}
              onClear={clearImport}
              userId={currentUser?.id}
              storedPath={savedDocPath}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">เลข SO *</label>
                <input
                  value={soNumber}
                  onChange={e => setSoNumber(e.target.value)}
                  placeholder="เช่น SO-2569-0001"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">โรงงานผลิต *</label>
                <select
                  value={factoryId}
                  onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border rounded px-3 py-2 text-sm bg-white"
                >
                  <option value="">— เลือกโรงงาน —</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">วันที่ SO *</label>
                <input type="date" value={soDate} onChange={e => setSoDate(e.target.value)}
                       className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  กำหนดส่ง (วันที่รับสินค้า)
                </label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                       className="w-full border rounded px-3 py-2 text-sm" />
                <p className="text-[11px] text-gray-500 mt-1">ใช้เป็นตัวตั้งของ “ค้างกี่วัน” บนหน้าภาพรวม</p>
              </div>
            </div>

            {factoryMismatch && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-2">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{factoryMismatch} — ตรวจสอบว่าเลือกโรงงานถูกหรือไม่ (ยังบันทึกได้ตามที่เลือก)</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">รายการสินค้า</label>
                <button onClick={addRow} className="flex items-center gap-1 text-sm text-slate-900 hover:text-slate-600 underline decoration-dotted underline-offset-4">
                  <Plus size={14} /> เพิ่มรายการ
                </button>
              </div>

              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 w-1/2">สินค้า</th>
                      <th className="text-right px-3 py-2 w-32">จำนวนสั่งผลิต</th>
                      <th className="text-left px-3 py-2">หมายเหตุ</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">
                          <ProductSearchSelect
                            products={products as any}
                            value={row.product_id}
                            onChange={v => updateRow(i, 'product_id', v)}
                            placeholder="ค้นหารหัส/ชื่อสินค้า"
                          />
                          {!!row.deliveredQty && (
                            <div className="text-[11px] text-slate-500 mt-1">
                              ออกใบขนไปแล้ว {fmtQty(row.deliveredQty)} — ลดต่ำกว่านี้ไม่ได้
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={row.ordered_qty}
                            onChange={e => updateRow(i, 'ordered_qty', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full border rounded px-2 py-1.5 text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={row.note ?? ''}
                            onChange={e => updateRow(i, 'note', e.target.value)}
                            className="w-full border rounded px-2 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 text-sm font-medium">
                    <tr>
                      <td className="px-3 py-2 text-right text-gray-600">รวม</td>
                      <td className="px-3 py-2 text-right">{fmtQty(totalQty)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {isEdit && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">สถานะ SO</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm bg-white">
                    <option value="open">เปิดอยู่</option>
                    <option value="closed">ปิดยอด (ผลิตไม่ครบแล้วเลิก)</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                </div>
              )}
              <div className={isEdit ? 'md:col-span-2' : 'md:col-span-3'}>
                <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                       className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        )}

        <footer className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-100">ยกเลิก</button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'บันทึกการแก้ไข' : 'เปิด SO'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default ProductionOrderModal;
