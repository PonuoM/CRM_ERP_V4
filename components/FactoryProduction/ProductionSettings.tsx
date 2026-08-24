import React, { useEffect, useMemo, useState } from 'react';
import { Factory, Package, ShieldCheck, Plus, Trash2, Loader2 } from 'lucide-react';
import { User } from '@/types';
import {
  listProductionFactories, saveProductionFactory, deleteProductionFactory,
  listProductionManagers, saveProductionManager, saveProductDefaultFactory,
} from '@/services/api';
import ConfirmModal from '@/components/ConfirmModal';
import { ProductionFactory, ProductionAccess, ProductionManagerRow } from '@/components/FactoryProduction/types';

interface Props {
  factories: ProductionFactory[];
  products: any[];
  access: ProductionAccess;
  companyId?: number;
  currentUser?: User;
  onChanged: () => void;
}

type Tab = 'factories' | 'products' | 'access';

const ProductionSettings: React.FC<Props> = ({ factories, products, access, companyId, currentUser, onChanged }) => {
  const [tab, setTab] = useState<Tab>('factories');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ── โรงงาน ── */
  const [allFactories, setAllFactories] = useState<ProductionFactory[]>(factories);
  const [newFactory, setNewFactory] = useState({ code: '', name: '' });
  const [pendingRemove, setPendingRemove] = useState<ProductionFactory | null>(null);

  const reloadFactories = async () => {
    const res: any = await listProductionFactories({ userId: currentUser?.id, includeInactive: true });
    setAllFactories(res?.data ?? []);
    onChanged();
  };

  useEffect(() => { reloadFactories().catch(() => {}); }, []);

  const addFactory = async () => {
    setError(null);
    if (!newFactory.code.trim() || !newFactory.name.trim()) {
      setError('กรุณาระบุรหัสและชื่อโรงงาน');
      return;
    }
    setBusy(true);
    try {
      await saveProductionFactory({
        code: newFactory.code.trim(),
        name: newFactory.name.trim(),
        sort_order: allFactories.length + 1,
        user_id: currentUser?.id,
      });
      setNewFactory({ code: '', name: '' });
      await reloadFactories();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const toggleFactory = async (f: ProductionFactory) => {
    setError(null);
    setBusy(true);
    try {
      await saveProductionFactory({
        id: f.id, code: f.code, name: f.name, note: f.note ?? '',
        sort_order: f.sort_order, is_active: !f.is_active, user_id: currentUser?.id,
      });
      await reloadFactories();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  /** ยืนยันผ่าน ConfirmModal ของระบบ -- AGENTS.md ห้ามใช้ window.confirm */
  const removeFactory = (f: ProductionFactory) => setPendingRemove(f);

  const doRemoveFactory = async (f: ProductionFactory) => {
    setPendingRemove(null);
    setError(null);
    setBusy(true);
    try {
      await deleteProductionFactory({ id: f.id, user_id: currentUser?.id });
      await reloadFactories();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'ลบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  /* ── โรงงานเริ่มต้นต่อสินค้า ── */
  const [productSearch, setProductSearch] = useState('');
  const [defaults, setDefaults] = useState<Record<number, number | ''>>({});

  useEffect(() => {
    const m: Record<number, number | ''> = {};
    products.forEach(p => { m[p.id] = p.default_factory_id ?? ''; });
    setDefaults(m);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(term));
  }, [products, productSearch]);

  const setProductFactory = async (productId: number, factoryId: number | '') => {
    setDefaults(prev => ({ ...prev, [productId]: factoryId }));
    try {
      await saveProductDefaultFactory({
        product_id: productId,
        factory_id: factoryId === '' ? null : Number(factoryId),
        user_id: currentUser?.id,
      });
      onChanged();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  /* ── สิทธิ์ ── */
  const [managers, setManagers] = useState<ProductionManagerRow[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');

  const loadManagers = async () => {
    if (!access.can_grant || !currentUser?.id) return;
    setLoadingManagers(true);
    try {
      const res: any = await listProductionManagers({ userId: currentUser.id, companyId });
      setManagers(res?.data ?? []);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'โหลดรายชื่อไม่สำเร็จ');
    } finally {
      setLoadingManagers(false);
    }
  };

  useEffect(() => { if (tab === 'access') loadManagers(); }, [tab]);

  const toggleManage = async (row: ProductionManagerRow) => {
    if (row.always_allowed || !currentUser?.id) return;
    try {
      await saveProductionManager({
        user_id: row.id, actor_user_id: currentUser.id, can_manage: !row.can_manage,
      });
      await loadManagers();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const toggleFactoryScope = async (row: ProductionManagerRow, factoryId: number) => {
    if (!currentUser?.id) return;
    const next = row.factory_ids.includes(factoryId)
      ? row.factory_ids.filter(id => id !== factoryId)
      : [...row.factory_ids, factoryId];
    try {
      await saveProductionManager({ user_id: row.id, actor_user_id: currentUser.id, factory_ids: next });
      await loadManagers();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  const filteredManagers = useMemo(() => {
    const term = managerSearch.trim().toLowerCase();
    if (!term) return managers;
    return managers.filter(m => `${m.name} ${m.username} ${m.role}`.toLowerCase().includes(term));
  }, [managers, managerSearch]);

  const TABS: { key: Tab; label: string; icon: any; hidden?: boolean }[] = [
    { key: 'factories', label: 'โรงงานผลิต', icon: Factory },
    { key: 'products', label: 'โรงงานเริ่มต้นของสินค้า', icon: Package },
    { key: 'access', label: 'สิทธิ์', icon: ShieldCheck, hidden: !access.can_grant },
  ];

  return (
    <div className="bg-white rounded-lg border">
      <div className="flex border-b">
        {TABS.filter(t => !t.hidden).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px ${
              tab === t.key ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 mb-3">{error}</div>}

        {tab === 'factories' && (
          <div className="space-y-4">
            {access.can_manage && (
              <div className="flex flex-wrap items-end gap-2 bg-gray-50 border rounded p-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">รหัส</label>
                  <input value={newFactory.code} onChange={e => setNewFactory(p => ({ ...p, code: e.target.value }))}
                         placeholder="F4" className="border rounded px-3 py-2 text-sm w-24" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-600 mb-1">ชื่อโรงงาน</label>
                  <input value={newFactory.name} onChange={e => setNewFactory(p => ({ ...p, name: e.target.value }))}
                         placeholder="โรงงาน 4 (การ 4)" className="border rounded px-3 py-2 text-sm w-full" />
                </div>
                <button onClick={addFactory} disabled={busy}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50">
                  <Plus size={14} /> เพิ่มโรงงาน
                </button>
              </div>
            )}

            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">รหัส</th>
                  <th className="text-left py-2">ชื่อโรงงาน</th>
                  <th className="text-center py-2 w-32">สถานะ</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {allFactories.map(f => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-2 text-gray-500">{f.code}</td>
                    <td className="py-2 text-gray-800">{f.name}</td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => access.can_manage && toggleFactory(f)}
                        disabled={!access.can_manage || busy}
                        className={`px-2 py-1 rounded text-xs ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} ${access.can_manage ? 'hover:opacity-80' : 'cursor-default'}`}
                      >
                        {f.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </button>
                    </td>
                    <td className="py-2 text-center">
                      {access.can_manage && (
                        <button onClick={() => removeFactory(f)} className="text-gray-400 hover:text-red-600">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'products' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              ตั้งไว้แล้วระบบจะเลือกโรงงานให้อัตโนมัติตอนเปิด SO (เช่น ปุ๋ยอินทรีย์ → การ 3) และเตือนถ้าเลือกโรงงานไม่ตรง
            </p>
            <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                   placeholder="ค้นหารหัส/ชื่อสินค้า" className="border rounded px-3 py-2 text-sm w-full max-w-sm" />
            <div className="max-h-[55vh] overflow-y-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">สินค้า</th>
                    <th className="text-left px-3 py-2 w-56">โรงงานเริ่มต้น</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="text-gray-800">{p.name}</div>
                        <div className="text-[11px] text-gray-400">{p.sku}</div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={defaults[p.id] ?? ''}
                          disabled={!access.can_manage}
                          onChange={e => setProductFactory(p.id, e.target.value ? Number(e.target.value) : '')}
                          className="border rounded px-2 py-1.5 text-sm bg-white w-full disabled:bg-gray-100"
                        >
                          <option value="">— ไม่กำหนด —</option>
                          {allFactories.filter(f => f.is_active).map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'access' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              <span className="font-medium">แก้ไขข้อมูล</span> = เปิด SO / คีย์ใบขน / กดรับเข้าคลังได้ ·
              <span className="font-medium"> ล็อกโรงงาน</span> = บัญชีนั้นเห็นเฉพาะโรงงานที่ติ๊ก (ไม่ติ๊กเลย = เห็นทุกโรงงาน)
            </p>
            <input value={managerSearch} onChange={e => setManagerSearch(e.target.value)}
                   placeholder="ค้นหาชื่อ/username/role" className="border rounded px-3 py-2 text-sm w-full max-w-sm" />

            {loadingManagers ? (
              <div className="flex items-center justify-center p-8 text-gray-500">
                <Loader2 className="animate-spin mr-2" size={18} /> กำลังโหลด...
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">บัญชี</th>
                      <th className="text-center px-3 py-2 w-32">แก้ไขข้อมูล</th>
                      <th className="text-left px-3 py-2">ล็อกโรงงาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManagers.map(m => (
                      <tr key={m.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="text-gray-800">{m.name}</div>
                          <div className="text-[11px] text-gray-400">{m.username} · {m.role}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {m.always_allowed ? (
                            <span className="text-xs text-gray-400">มีสิทธิ์อัตโนมัติ</span>
                          ) : (
                            <input type="checkbox" checked={m.can_manage} onChange={() => toggleManage(m)} />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            {allFactories.filter(f => f.is_active).map(f => (
                              <label key={f.id} className="flex items-center gap-1 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={m.factory_ids.includes(f.id)}
                                  onChange={() => toggleFactoryScope(m, f.id)}
                                />
                                {f.code}
                              </label>
                            ))}
                            {m.factory_ids.length === 0 && (
                              <span className="text-[11px] text-gray-400">เห็นทุกโรงงาน</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {pendingRemove && (
        <ConfirmModal
          title="ลบโรงงานผลิต"
          message={<>ลบ <b>{pendingRemove.name}</b> ออกจากระบบ?</>}
          confirmText="ลบโรงงาน"
          type="danger"
          onConfirm={() => doRemoveFactory(pendingRemove)}
          onClose={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
};

export default ProductionSettings;
