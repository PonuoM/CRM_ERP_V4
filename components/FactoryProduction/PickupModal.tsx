import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Truck } from 'lucide-react';
import { User } from '@/types';
import { pickupDeliveryNote } from '@/services/api';
import { DeliveryNote, fmtQty, fmtDate } from '@/components/FactoryProduction/types';

interface Props {
  note: DeliveryNote;
  warehouses: { id: number; name: string }[];
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

/** ขั้นที่ 4: Airport ขับรถมารับของตามใบขน -> ยอดย้ายจากโรงงานเข้าคลัง */
const PickupModal: React.FC<Props> = ({ note, warehouses, currentUser, onClose, onSaved }) => {
  const today = new Date().toISOString().slice(0, 10);

  // คลังกาญจนบุรี = ปลายทางหลักของเทพมงคล -> เดาให้เป็นค่าเริ่มต้น
  // แต่เดาเฉพาะตอนที่ตรงแค่รายการเดียวเท่านั้น -- prod มีคลังชื่อ "กาญจนบุรี" มากกว่าหนึ่ง
  // (id 2 "Airport KAN (คลังกาญจนบุรี)" กับ id 8 "Airport  คลังกาญจนบุรี") เดาผิดแล้วของเข้าผิดคลัง
  const defaultWarehouse = useMemo(() => {
    const kan = warehouses.filter(w => (w.name ?? '').includes('กาญจน'));
    if (kan.length === 1) return kan[0].id;
    return warehouses.length === 1 ? warehouses[0].id : '';
  }, [warehouses]);

  const [warehouseId, setWarehouseId] = useState<number | ''>(defaultWarehouse as number | '');
  const [receivedDate, setReceivedDate] = useState(today);
  const [vehicleNote, setVehicleNote] = useState(note.vehicle_note ?? '');
  const [received, setReceived] = useState<Record<number, number | ''>>(() => {
    const init: Record<number, number | ''> = {};
    note.items.forEach(i => { init[i.id] = i.received_qty ?? i.qty; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalQty = note.items.reduce((s, i) => s + i.qty, 0);
  const totalReceived = note.items.reduce((s, i) => s + (Number(received[i.id]) || 0), 0);
  const shortage = totalQty - totalReceived;

  const handleSave = async () => {
    setError(null);
    if (!warehouseId) return setError('กรุณาเลือกคลังปลายทาง');
    if (!receivedDate) return setError('กรุณาระบุวันที่รับของ');

    const bad = note.items.find(i => {
      const v = Number(received[i.id]);
      return isNaN(v) || v < 0 || v > i.qty;
    });
    if (bad) return setError(`ยอดรับจริงของ "${bad.product_name}" ต้องอยู่ระหว่าง 0 ถึง ${fmtQty(bad.qty)}`);

    setSaving(true);
    try {
      await pickupDeliveryNote({
        id: note.id,
        action: 'pickup',
        warehouse_id: Number(warehouseId),
        received_date: receivedDate,
        vehicle_note: vehicleNote,
        user_id: currentUser?.id,
        items: note.items.map(i => ({ id: i.id, received_qty: Number(received[i.id]) || 0 })),
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-emerald-700" />
            <div>
              <h2 className="text-lg font-semibold text-gray-800">รับเข้าคลัง — ใบขน {note.dn_number}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {note.factory_name} · ออกใบขน {fmtDate(note.issued_date)} · SO {note.so_numbers.join(', ')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">คลังปลายทาง *</label>
              <select value={warehouseId}
                      onChange={e => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border rounded px-3 py-2 text-sm bg-white">
                <option value="">— เลือกคลัง —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">วันที่รับของ *</label>
              <input type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)}
                     className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ทะเบียนรถ/คนขับ</label>
              <input value={vehicleNote} onChange={e => setVehicleNote(e.target.value)}
                     className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">สินค้า</th>
                  <th className="text-right px-3 py-2 w-28">ตามใบขน</th>
                  <th className="text-right px-3 py-2 w-32">รับจริง</th>
                </tr>
              </thead>
              <tbody>
                {note.items.map(i => {
                  const v = received[i.id];
                  const short = Number(v) < i.qty;
                  return (
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="text-gray-800">{i.product_name}</div>
                        <div className="text-[11px] text-gray-400">{i.sku} · SO {i.so_number}</div>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtQty(i.qty)}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={i.qty}
                          value={v ?? ''}
                          onChange={e => setReceived(prev => ({
                            ...prev,
                            [i.id]: e.target.value === '' ? '' : Number(e.target.value),
                          }))}
                          className={`w-full border rounded px-2 py-1.5 text-sm text-right ${short ? 'border-amber-400 bg-amber-50' : ''}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {shortage > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-2">
              ของมาไม่ครบ {fmtQty(shortage)} หน่วย — ระบบจะบันทึกส่วนต่างไว้ให้ตรวจสอบกับโรงงาน
              (ยอด SO ยังนับตามใบขน จึงไม่ทำให้ยอดค้างผลิตเพี้ยน)
            </div>
          )}
        </div>

        <footer className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            รับเข้า <span className="font-semibold text-gray-800">{fmtQty(totalReceived)}</span> / {fmtQty(totalQty)}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-100">ยกเลิก</button>
            <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 text-sm bg-emerald-700 text-white rounded hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              ยืนยันรับเข้าคลัง
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default PickupModal;
