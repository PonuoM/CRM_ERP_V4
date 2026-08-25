import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Search } from 'lucide-react';
import { User, UserRole } from '@/types';
import { listProductionOrders, saveDeliveryNote } from '@/services/api';
import PdfImportPanel, { type StoredDoc, type DocReference } from '@/components/FactoryProduction/PdfImportPanel';
import type { ParsedDoc } from '@/components/FactoryProduction/pdfImport';
import {
  ProductionFactory, ProductionOrder, DeliveryNote, fmtQty, fmtDate,
} from '@/components/FactoryProduction/types';

interface Props {
  editNote?: DeliveryNote | null;
  /** เปิดจากปุ่ม "ออกใบขน" ในแถว SO — ล็อกโรงงานและกรอง SO ให้เลย */
  presetOrderId?: number;
  presetFactoryId?: number;
  factories: ProductionFactory[];
  companyId?: number;
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

const DeliveryNoteModal: React.FC<Props> = ({
  editNote, presetOrderId, presetFactoryId, factories, companyId, currentUser, onClose, onSaved,
}) => {
  const isEdit = !!editNote;
  const isSuperAdmin = currentUser?.role === UserRole.SuperAdmin;
  const today = new Date().toISOString().slice(0, 10);

  const [dnNumber, setDnNumber] = useState(editNote?.dn_number ?? '');
  const [factoryId, setFactoryId] = useState<number | ''>(
    editNote?.factory_id ?? presetFactoryId ?? (factories.length === 1 ? factories[0].id : '')
  );
  const [issuedDate, setIssuedDate] = useState(editNote?.issued_date?.slice(0, 10) ?? today);
  const [vehicleNote, setVehicleNote] = useState(editNote?.vehicle_note ?? '');
  const [note, setNote] = useState(editNote?.note ?? '');
  const [search, setSearch] = useState('');

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [qtyByItem, setQtyByItem] = useState<Record<number, number | ''>>(() => {
    const init: Record<number, number | ''> = {};
    (editNote?.items ?? []).forEach(i => { init[i.order_item_id] = i.qty; });
    return init;
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ข้อมูลที่อ่านได้จากไฟล์ PDF ของใบขน */
  const [imported, setImported] = useState<ParsedDoc | null>(null);
  const [importFile, setImportFile] = useState('');
  const [storedDoc, setStoredDoc] = useState<StoredDoc | null>(null);
  const [unmatchedSkus, setUnmatchedSkus] = useState<string[]>([]);
  /** ไฟล์ที่อ่านแล้วแต่ยังจับคู่กับ SO ไม่ได้ (ยังไม่ได้เลือกโรงงาน / SO ยังโหลดไม่เสร็จ) */
  const [pendingMatch, setPendingMatch] = useState<{ doc: ParsedDoc; reference: DocReference | null } | null>(null);

  // ยอดของใบขนใบนี้เอง — ตอนแก้ไขต้องบวกคืนเข้ายอดคงเหลือ ไม่งั้นจะดูเหมือนเกิน
  const ownQty = useMemo(() => {
    const m: Record<number, number> = {};
    (editNote?.items ?? []).forEach(i => { m[i.order_item_id] = (m[i.order_item_id] ?? 0) + i.qty; });
    return m;
  }, [editNote]);

  useEffect(() => {
    if (!factoryId) { setOrders([]); return; }
    let mounted = true;
    setLoading(true);
    /* ล้างของโรงงานเดิมทิ้งก่อน ไม่งั้นระหว่างรอโหลด ตัวจับคู่ใบขนจะไปหยิบ SO
       ของโรงงานที่เพิ่งเปลี่ยนออกมาใช้ */
    setOrders([]);
    listProductionOrders({
      userId: currentUser?.id,
      companyId,
      factoryId: Number(factoryId),
      status: 'open',
    })
      .then((res: any) => {
        if (!mounted || !res?.success) return;
        setOrders(res.data ?? []);
      })
      .catch((err: any) => {
        if (mounted) setError(err?.data?.error || err?.message || 'โหลดรายการ SO ไม่สำเร็จ');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [factoryId, companyId, currentUser?.id]);

  const visibleOrders = useMemo(() => {
    let list = orders;
    if (presetOrderId) list = list.filter(o => o.id === presetOrderId);
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(o =>
        o.so_number.toLowerCase().includes(term) ||
        o.items.some(i => `${i.sku} ${i.product_name}`.toLowerCase().includes(term))
      );
    }
    // ซ่อน SO ที่ผลิตครบแล้ว เว้นแต่มีรายการที่ใบขนใบนี้ถืออยู่
    return list
      .map(o => ({
        ...o,
        items: o.items.filter(i => (i.pending_qty + (ownQty[i.id] ?? 0)) > 0 || qtyByItem[i.id] !== undefined),
      }))
      .filter(o => o.items.length > 0);
  }, [orders, presetOrderId, search, ownQty, qtyByItem]);

  const remainingOf = (itemId: number, pending: number) => pending + (ownQty[itemId] ?? 0);

  const setQty = (itemId: number, value: string, max?: number) => {
    setQtyByItem(prev => {
      const next = { ...prev };
      if (value === '') { next[itemId] = ''; return next; }
      let n = Number(value);
      if (!Number.isFinite(n) || n <= 0) { delete next[itemId]; return next; }
      // clamp ตอนพิมพ์/paste — กันไม่ให้ค่าเกินยอดคงเหลือ (input max= อาจหลุดจาก paste/ลูกศร spinner)
      if (max !== undefined && n > max) n = max;
      next[itemId] = n;
      return next;
    });
  };

  const fillRemaining = (itemId: number, remaining: number) => {
    setQtyByItem(prev => ({ ...prev, [itemId]: remaining }));
  };

  /**
   * อ่านไฟล์ใบขนเสร็จ -> เติมเลขใบขน/วันที่ แล้วกระจายจำนวนลงบรรทัด SO ที่รหัสตรงกัน
   * ถ้ารหัสเดียวไปโผล่หลาย SO จะไล่เติมจากใบที่ค้างมากสุดก่อน แล้วค่อยล้นไปใบถัดไป
   */
  /**
   * กระจายจำนวนในไฟล์ลงบรรทัด SO ที่รหัสตรงกัน
   * คืน false ถ้ายังจับคู่ไม่ได้เพราะรายการ SO ยังไม่พร้อม (จะรอไป match รอบหน้า)
   */
  const matchToOrders = (doc: ParsedDoc, reference: DocReference | null): boolean => {
    if (orders.length === 0) return false;

    const next: Record<number, number | ''> = {};
    const missing: string[] = [];
    /* ใช้เฉพาะเลข SO ที่ยืนยันแล้วว่ามีจริงในระบบ -- ห้ามใช้เลขดิบจากไฟล์
       ไม่งั้นจะเทียบไม่ตรงแล้วเงียบ ๆ ไปลง SO ใบอื่นแทน */
    const refSo = reference?.so_number ?? '';

    doc.items.forEach(docItem => {
      const sku = docItem.sku.toUpperCase();
      const candidates = orders
        .flatMap(o => o.items.map(i => ({ item: i, so: o.so_number })))
        .filter(c => String(c.item.sku ?? '').toUpperCase() === sku)
        /* ใบขนที่ระบุ SO ต้นทางไว้ ให้ลงเฉพาะ SO ใบนั้นใบเดียว
           ยอดที่เกินถือเป็นของผิดปกติ ต้องให้คนดู ไม่ใช่ล้นไปใบอื่นเอง */
        .filter(c => !refSo || c.so === refSo)
        .map(c => ({ ...c, remaining: remainingOf(c.item.id, c.item.pending_qty) }))
        .filter(c => c.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining);

      if (candidates.length === 0) {
        missing.push(refSo ? `${docItem.sku} (ไม่มียอดค้างใน ${refSo})` : docItem.sku);
        return;
      }
      let left = Math.round(docItem.qty);
      for (const c of candidates) {
        if (left <= 0) break;
        const take = Math.min(left, c.remaining);
        next[c.item.id] = (Number(next[c.item.id]) || 0) + take;
        left -= take;
      }
      if (left > 0) missing.push(`${docItem.sku} (เกินยอดค้าง ${fmtQty(left)})`);
    });

    setQtyByItem(prev => ({ ...prev, ...next }));
    setUnmatchedSkus(missing);
    return true;
  };

  const applyParsed = (
    doc: ParsedDoc, fileName: string, stored: StoredDoc | null, reference: DocReference | null,
  ) => {
    setImported(doc);
    setImportFile(fileName);
    setStoredDoc(stored);
    setError(null);
    setPendingMatch(null);

    if (doc.docNumber) setDnNumber(doc.docNumber);
    if (doc.docDate) setIssuedDate(doc.docDate);

    /* ใบขนอ้าง SO ที่ยังไม่มีในระบบ -- ห้ามเดาว่าเป็นใบไหน เพราะถ้าโรงงานนี้มี SO อื่น
       ที่มีรหัสสินค้าเดียวกันค้างอยู่ ยอดจะไหลไปลงใบนั้นแบบเงียบ ๆ */
    if (doc.soReference && !reference) {
      setUnmatchedSkus([]);
      setError(`ใบขนนี้อ้างถึง SO ${doc.soReference} ซึ่งยังไม่มีในระบบ — ต้องเปิด SO ใบนั้นก่อน `
        + `แล้วค่อยคีย์ใบขนนี้ (ถ้าจะคีย์ลง SO ใบอื่นจริง ๆ ให้ติ๊กจำนวนเองด้านล่าง)`);
      return;
    }

    /* ใบนั้นอยู่ในระบบ -- ใช้โรงงานของมันเลย ไม่ต้องให้คนคีย์มาเดา
       แต่ถ้าต้องสลับโรงงาน ห้ามจับคู่ตอนนี้ เพราะ orders ในมือยังเป็นของโรงงานเดิม
       ต้องรอ useEffect โหลดรายการ SO ของโรงงานใหม่มาก่อน */
    if (reference?.factory_id && !editNote && reference.factory_id !== factoryId) {
      setFactoryId(reference.factory_id);
      setUnmatchedSkus([]);
      setPendingMatch({ doc, reference });
      return;
    }

    if (!factoryId) {
      setUnmatchedSkus([]);
      setPendingMatch({ doc, reference });
      setError('เลือกโรงงานก่อน แล้วระบบจะจับคู่รายการในไฟล์กับ SO ที่ค้างอยู่ให้');
      return;
    }

    if (!matchToOrders(doc, reference)) setPendingMatch({ doc, reference });
  };

  /* รายการ SO มาถึงหลังจากอ่านไฟล์ไปแล้ว -> จับคู่ให้เลย ผู้ใช้จะได้ไม่ต้องอัปไฟล์ซ้ำ */
  useEffect(() => {
    if (!pendingMatch || orders.length === 0) return;
    if (matchToOrders(pendingMatch.doc, pendingMatch.reference)) {
      setPendingMatch(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, pendingMatch]);

  const clearImport = () => {
    setImported(null);
    setImportFile('');
    setStoredDoc(null);
    setUnmatchedSkus([]);
    setPendingMatch(null);
  };

  const selected = useMemo(
    () => Object.entries(qtyByItem)
      .filter(([, q]) => q !== '' && Number(q) > 0)
      .map(([id, q]) => ({ order_item_id: Number(id), qty: Number(q) })),
    [qtyByItem]
  );
  const totalQty = selected.reduce((s, r) => s + r.qty, 0);

  const overLimit = useMemo(() => {
    for (const o of orders) {
      for (const i of o.items) {
        const q = qtyByItem[i.id];
        if (q !== undefined && q !== '' && Number(q) > remainingOf(i.id, i.pending_qty)) {
          return `"${i.product_name}" ใส่เกินยอดคงเหลือของ SO ${o.so_number} (เหลือ ${fmtQty(remainingOf(i.id, i.pending_qty))})`;
        }
      }
    }
    return null;
  }, [orders, qtyByItem, ownQty]);

  const handleSave = async () => {
    setError(null);
    if (!dnNumber.trim()) return setError('กรุณาระบุเลขใบขน');
    if (!factoryId) return setError('กรุณาเลือกโรงงาน');
    if (!issuedDate) return setError('กรุณาระบุวันที่ออกใบขน');
    if (selected.length === 0) return setError('กรุณาเลือกรายการสินค้าที่อยู่ในใบขนอย่างน้อย 1 รายการ');
    if (overLimit && !isSuperAdmin) return setError(overLimit);

    setSaving(true);
    try {
      await saveDeliveryNote({
        ...(isEdit ? { id: editNote!.id } : {}),
        dn_number: dnNumber.trim(),
        factory_id: Number(factoryId),
        issued_date: issuedDate,
        status: 'issued',
        vehicle_note: vehicleNote,
        note,
        force: !!overLimit && isSuperAdmin,
        user_id: currentUser?.id,
        ...(imported ? {
          customer_code: imported.customerCode || null,
          customer_name: imported.customerName || null,
          doc_receive_date: imported.receiveDate || null,
          warehouse_name: imported.warehouseName || null,
          coordinator_name: imported.coordinator || null,
          source_type: 'pdf',
          source_file: importFile || null,
          source_path: storedDoc?.path ?? null,
          source_size: storedDoc?.size ?? null,
          source_hash: storedDoc?.hash ?? null,
        } : {}),
        items: selected,
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
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {isEdit ? `แก้ไขใบขน ${editNote!.dn_number}` : 'คีย์ใบขนใหม่'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              ใบขน = หลักฐานว่าโรงงานผลิตเสร็จและส่งมอบให้เทพมงคลแล้ว
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}

          <PdfImportPanel
            kind="dn"
            parsed={imported}
            fileName={importFile}
            unmatchedSkus={unmatchedSkus}
            onParsed={applyParsed}
            onClear={clearImport}
            userId={currentUser?.id}
            storedPath={editNote?.source_path ?? null}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">เลขใบขน *</label>
              <input value={dnNumber} onChange={e => setDnNumber(e.target.value)}
                     placeholder="เลขที่ใบขน" className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">โรงงาน *</label>
              <select
                value={factoryId}
                onChange={e => { setFactoryId(e.target.value ? Number(e.target.value) : ''); setQtyByItem({}); }}
                disabled={!!presetFactoryId && !isEdit}
                className="w-full border rounded px-3 py-2 text-sm bg-white disabled:bg-gray-100"
              >
                <option value="">— เลือกโรงงาน —</option>
                {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">วันที่ออกใบขน *</label>
              <input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)}
                     className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ทะเบียนรถ/คนขับ</label>
              <input value={vehicleNote} onChange={e => setVehicleNote(e.target.value)}
                     className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">เลือกรายการที่ผลิตเสร็จ</label>
              <div className="relative">
                <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                       placeholder="ค้นหา SO / สินค้า"
                       className="border rounded pl-7 pr-3 py-1.5 text-sm w-56" />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-8 text-gray-500 border rounded">
                <Loader2 className="animate-spin mr-2" size={18} /> กำลังโหลด SO...
              </div>
            ) : !factoryId ? (
              <div className="text-sm text-gray-500 border rounded p-6 text-center">เลือกโรงงานก่อน</div>
            ) : visibleOrders.length === 0 ? (
              <div className="text-sm text-gray-500 border rounded p-6 text-center">
                ไม่มี SO ที่ยังค้างผลิตในโรงงานนี้
              </div>
            ) : (
              <div className="border rounded divide-y max-h-[45vh] overflow-y-auto">
                {visibleOrders.map(o => (
                  <div key={o.id}>
                    <div className="bg-gray-50 px-3 py-2 flex items-center justify-between text-sm sticky top-0">
                      <span className="font-medium text-gray-700">SO {o.so_number}</span>
                      <span className="text-xs text-gray-500">
                        {o.factory_name} · เปิด {fmtDate(o.so_date)}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-1.5">สินค้า</th>
                          <th className="text-right px-3 py-1.5 w-24">สั่งผลิต</th>
                          <th className="text-right px-3 py-1.5 w-24">คงเหลือ</th>
                          <th className="text-right px-3 py-1.5 w-32">ใส่ในใบขน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map(i => {
                          const remaining = remainingOf(i.id, i.pending_qty);
                          const val = qtyByItem[i.id];
                          const over = val !== undefined && val !== '' && Number(val) > remaining;
                          return (
                            <tr key={i.id} className="border-t">
                              <td className="px-3 py-2">
                                <div className="text-gray-800">{i.product_name}</div>
                                <div className="text-[11px] text-gray-400">{i.sku}</div>
                              </td>
                              <td className="px-3 py-2 text-right text-gray-500">{fmtQty(i.ordered_qty)}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => fillRemaining(i.id, remaining)}
                                  className="text-slate-900 underline decoration-dotted underline-offset-4 hover:decoration-solid"
                                  title="ใส่ยอดคงเหลือทั้งหมด"
                                >
                                  {fmtQty(remaining)}
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={remaining}
                                  value={val ?? ''}
                                  onChange={e => setQty(i.id, e.target.value, remaining)}
                                  className={`w-full border rounded px-2 py-1.5 text-sm text-right ${over ? 'border-red-400 bg-red-50' : ''}`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>

          {overLimit && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-2">
              {overLimit}{isSuperAdmin ? ' — Super Admin บันทึกทับได้' : ''}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">หมายเหตุ</label>
            <input value={note} onChange={e => setNote(e.target.value)}
                   className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <footer className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            รวมในใบขน <span className="font-semibold text-gray-800">{fmtQty(totalQty)}</span> หน่วย
            <span className="text-gray-400"> · {selected.length} รายการ</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-100">ยกเลิก</button>
            <button
              onClick={handleSave}
              disabled={saving || (!!overLimit && !isSuperAdmin)}
              title={overLimit && !isSuperAdmin ? overLimit : undefined}
              className="px-4 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'บันทึกการแก้ไข' : 'บันทึกใบขน'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default DeliveryNoteModal;
