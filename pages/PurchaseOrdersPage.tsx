import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Package, Building2, DollarSign } from 'lucide-react';
import { Purchase, Supplier, User, Warehouse } from '@/types';
import { listPurchases, createPurchase, listSuppliers, listProducts, listWarehouses } from '@/services/api';
import Modal from '@/components/Modal';

interface PurchaseOrdersPageProps {
  currentUser?: User;
  companyId?: number;
}

const PurchaseOrdersPage: React.FC<PurchaseOrdersPageProps> = ({ currentUser, companyId }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([] as any);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const effectiveCompanyId = companyId ?? currentUser?.companyId ?? 1;

  const load = async () => {
    setLoading(true);
    try {
      const [rows, sups, prods, whs] = await Promise.all([
        listPurchases({ companyId: effectiveCompanyId }),
        listSuppliers(effectiveCompanyId),
        listProducts(),
        listWarehouses(effectiveCompanyId),
      ]);
      setPurchases(rows.map((r: any) => ({
        id: Number(r.id),
        purchaseNumber: r.purchase_number,
        supplierId: Number(r.supplier_id),
        warehouseId: Number(r.warehouse_id),
        companyId: Number(r.company_id),
        purchaseDate: r.purchase_date,
        expectedDeliveryDate: r.expected_delivery_date ?? undefined,
        receivedDate: r.received_date ?? undefined,
        totalAmount: Number(r.total_amount ?? 0),
        status: r.status,
        paymentStatus: r.payment_status,
        paymentMethod: r.payment_method ?? undefined,
        notes: r.notes ?? undefined,
        createdBy: r.created_by ?? undefined,
        createdAt: r.created_at ?? undefined,
        updatedAt: r.updated_at ?? undefined,
        items: [],
      })));
      setSuppliers(sups.map((s: any) => ({
        id: Number(s.id), code: s.code, name: s.name, companyId: Number(s.company_id), isActive: (s.is_active ?? 1) == 1,
      })));
      setProducts(prods);
      setWarehouses(whs.map((w: any) => ({
        id: Number(w.id), name: w.name, companyId: Number(w.company_id), companyName: w.company_name,
        address: w.address, province: w.province, district: w.district, subdistrict: w.subdistrict,
        postalCode: w.postal_code, phone: w.phone, email: w.email, responsibleProvinces: Array.isArray(w.responsible_provinces) ? w.responsible_provinces : [],
        isActive: (w.is_active ?? 1) == 1, createdAt: w.created_at, updatedAt: w.updated_at,
      })) as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [effectiveCompanyId]);

  const filtered = useMemo(() => purchases.filter(p => {
    const q = search.toLowerCase();
    return p.purchaseNumber.toLowerCase().includes(q) || String(p.id).includes(q) || (p.notes || '').toLowerCase().includes(q);
  }), [purchases, search]);

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center"><Package className="h-5 w-5 mr-2"/>Purchase Orders</h2>
        <button onClick={() => setIsOpen(true)} className="inline-flex items-center px-3 py-2 rounded-md bg-[#2E7D32] text-white hover:bg-green-700">
          <Plus className="h-4 w-4 mr-1"/> สร้าง PO
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." className="w-80 px-3 py-2 border rounded-md"/>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">PO#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Supplier</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Warehouse</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td className="px-6 py-8" colSpan={6}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-6 py-8 text-gray-500" colSpan={6}>ไม่พบข้อมูล</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id}>
                <td className="px-6 py-3 text-sm text-gray-900">{p.purchaseNumber}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{suppliers.find(s => s.id === p.supplierId)?.name || '-'}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{warehouses.find((w: any) => w.id === p.warehouseId)?.name || '-'}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{p.purchaseDate}</td>
                <td className="px-6 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">{p.status}</span></td>
                <td className="px-6 py-3 text-right text-sm text-gray-900"><span className="inline-flex items-center"><DollarSign className="h-4 w-4 mr-1"/>{p.totalAmount.toFixed(2)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <CreatePurchaseModal
          companyId={effectiveCompanyId}
          suppliers={suppliers}
          warehouses={warehouses as any}
          products={products}
          onClose={() => setIsOpen(false)}
          onCreated={async () => { setIsOpen(false); await load(); }}
        />
      )}
    </div>
  );
};

const CreatePurchaseModal: React.FC<{
  companyId: number;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  products: any[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ companyId, suppliers, warehouses, products, onClose, onCreated }) => {
  const [supplierId, setSupplierId] = useState<number>(suppliers[0]?.id || 0);
  const [warehouseId, setWarehouseId] = useState<number>(warehouses[0]?.id || 0);
  const [purchaseNumber, setPurchaseNumber] = useState<string>(() => `PO-${Date.now()}`);
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [items, setItems] = useState<Array<{ productId: number; quantity: number; unitCost: number; }>>([]);
  const [saving, setSaving] = useState(false);

  const addRow = () => setItems([...items, { productId: products[0]?.id || 0, quantity: 1, unitCost: Number(products[0]?.cost || 0) }]);
  const updateRow = (idx: number, patch: Partial<{ productId: number; quantity: number; unitCost: number }>) => {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch } as any;
    setItems(next);
  };
  const removeRow = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const total = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unitCost)), 0);

  const onSave = async () => {
    if (!supplierId || !warehouseId || items.length === 0) return;
    setSaving(true);
    try {
      await createPurchase({ purchaseNumber, supplierId, warehouseId, companyId, purchaseDate, expectedDeliveryDate: expectedDeliveryDate || undefined, items });
      await onCreated();
    } finally { setSaving(false); }
  };

  return (
    <Modal title="สร้างใบสั่งซื้อ" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600">Supplier</label>
            <select className="w-full border rounded px-2 py-1" value={supplierId} onChange={e => setSupplierId(Number(e.target.value))}>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600">Warehouse</label>
            <select className="w-full border rounded px-2 py-1" value={warehouseId} onChange={e => setWarehouseId(Number(e.target.value))}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600">PO Number</label>
            <input className="w-full border rounded px-2 py-1" value={purchaseNumber} onChange={e => setPurchaseNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Purchase Date</label>
            <input type="date" className="w-full border rounded px-2 py-1" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Expected Delivery</label>
            <input type="date" className="w-full border rounded px-2 py-1" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} />
          </div>
        </div>

        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-gray-700">Items</div>
            <button onClick={addRow} className="text-sm px-2 py-1 bg-gray-100 rounded">เพิ่มแถว</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1">สินค้า</th>
                <th className="text-right py-1">จำนวน</th>
                <th className="text-right py-1">ต้นทุน/หน่วย</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td className="py-2 text-gray-500" colSpan={4}>ยังไม่มีรายการ</td></tr>
              ) : items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-1 pr-2">
                    <select className="w-full border rounded px-2 py-1" value={it.productId} onChange={e => updateRow(idx, { productId: Number(e.target.value), unitCost: Number(products.find(p => p.id === Number(e.target.value))?.cost || 0) })}>
                      {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} className="w-full border rounded px-2 py-1 text-right" value={it.quantity} onChange={e => updateRow(idx, { quantity: Number(e.target.value) })} />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} step="0.01" className="w-full border rounded px-2 py-1 text-right" value={it.unitCost} onChange={e => updateRow(idx, { unitCost: Number(e.target.value) })} />
                  </td>
                  <td className="py-1 text-right">
                    <button onClick={() => removeRow(idx)} className="text-sm text-red-600">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-end mt-2 text-sm text-gray-700">รวม: {total.toFixed(2)}</div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="px-3 py-2 rounded border" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="px-3 py-2 rounded bg-[#2E7D32] text-white" onClick={onSave} disabled={saving || items.length === 0}>บันทึก</button>
        </div>
      </div>
    </Modal>
  );
};

export default PurchaseOrdersPage;

