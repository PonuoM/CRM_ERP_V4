import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Trash2, Phone, Mail, Building2 } from 'lucide-react';
import { Supplier, User } from '@/types';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/services/api';
import Modal from '@/components/Modal';

interface SuppliersManagementPageProps {
  currentUser?: User;
  companyId?: number;
}

const SuppliersManagementPage: React.FC<SuppliersManagementPageProps> = ({ currentUser, companyId }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const effectiveCompanyId = companyId ?? currentUser?.companyId ?? 1;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSuppliers(effectiveCompanyId);
      setSuppliers(rows.map((r: any) => ({
        id: Number(r.id),
        code: r.code,
        name: r.name,
        contactPerson: r.contact_person ?? undefined,
        phone: r.phone ?? undefined,
        email: r.email ?? undefined,
        address: r.address ?? undefined,
        province: r.province ?? undefined,
        taxId: r.tax_id ?? undefined,
        paymentTerms: r.payment_terms ?? undefined,
        creditLimit: r.credit_limit != null ? Number(r.credit_limit) : undefined,
        companyId: Number(r.company_id),
        isActive: (r.is_active ?? 1) == 1,
        notes: r.notes ?? undefined,
        createdAt: r.created_at ?? undefined,
        updatedAt: r.updated_at ?? undefined,
      })));
    } catch (e: any) {
      setError(e?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [effectiveCompanyId]);

  const filtered = useMemo(() => suppliers.filter(s => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.phone || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
  }), [suppliers, search]);

  const onCreate = async (payload: Omit<Supplier, 'id' | 'isActive'> & { isActive?: boolean }) => {
    await createSupplier({
      code: payload.code,
      name: payload.name,
      contactPerson: payload.contactPerson,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      province: payload.province,
      taxId: payload.taxId,
      paymentTerms: payload.paymentTerms,
      creditLimit: payload.creditLimit,
      companyId: payload.companyId,
      notes: payload.notes,
      isActive: payload.isActive ?? true,
    });
    await load();
  };

  const onUpdate = async (id: number, payload: Partial<Supplier>) => {
    await updateSupplier(id, {
      code: payload.code,
      name: payload.name,
      contactPerson: payload.contactPerson,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      province: payload.province,
      taxId: payload.taxId,
      paymentTerms: payload.paymentTerms,
      creditLimit: payload.creditLimit,
      companyId: payload.companyId,
      notes: payload.notes,
      isActive: payload.isActive,
    });
    await load();
  };

  const onDelete = async (id: number) => {
    if (!confirm('ลบซัพพลายเออร์นี้หรือไม่?')) return;
    await deleteSupplier(id);
    await load();
  };

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center"><Building2 className="h-5 w-5 mr-2"/>Suppliers</h2>
          <button onClick={() => setIsAddOpen(true)} className="inline-flex items-center px-3 py-2 rounded-md bg-[#2E7D32] text-white hover:bg-green-700">
            <Plus className="h-4 w-4 mr-1"/> เพิ่ม
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." className="w-80 px-3 py-2 border rounded-md"/>
        </div>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Active</th>
                <th className="px-6 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td className="px-6 py-8" colSpan={5}>กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-6 py-8 text-gray-500" colSpan={5}>ไม่พบข้อมูล</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td className="px-6 py-3 text-sm text-gray-900">{s.code}</td>
                  <td className="px-6 py-3">
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                    {s.address && <div className="text-xs text-gray-500">{s.address}</div>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-3">
                      {s.phone && <span className="inline-flex items-center text-gray-600"><Phone className="h-4 w-4 mr-1"/>{s.phone}</span>}
                      {s.email && <span className="inline-flex items-center text-gray-600"><Mail className="h-4 w-4 mr-1"/>{s.email}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{s.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button className="text-blue-600 hover:text-blue-800" onClick={() => setEditing(s)}><Edit size={16}/></button>
                      <button className="text-red-600 hover:text-red-800" onClick={() => onDelete(s.id)}><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAddOpen && (
        <SupplierModal
          title="เพิ่มซัพพลายเออร์"
          initial={{ code: '', name: '', companyId: effectiveCompanyId }}
          onClose={() => setIsAddOpen(false)}
          onSave={async (v) => { await onCreate(v as any); setIsAddOpen(false); }}
        />
      )}
      {editing && (
        <SupplierModal
          title="แก้ไขซัพพลายเออร์"
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => { await onUpdate(editing.id, v as any); setEditing(null); }}
        />
      )}
    </div>
  );
};

const SupplierModal: React.FC<{ title: string; initial: Partial<Supplier> & { companyId: number }; onClose: () => void; onSave: (value: Partial<Supplier>) => void; }>
  = ({ title, initial, onClose, onSave }) => {
  const [v, setV] = useState<Partial<Supplier>>(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600">Code</label>
            <input className="w-full border rounded px-2 py-1" value={v.code || ''} onChange={e => setV({ ...v, code: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Name</label>
            <input className="w-full border rounded px-2 py-1" value={v.name || ''} onChange={e => setV({ ...v, name: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600">Phone</label>
            <input className="w-full border rounded px-2 py-1" value={v.phone || ''} onChange={e => setV({ ...v, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Email</label>
            <input className="w-full border rounded px-2 py-1" value={v.email || ''} onChange={e => setV({ ...v, email: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600">Address</label>
          <input className="w-full border rounded px-2 py-1" value={v.address || ''} onChange={e => setV({ ...v, address: e.target.value })} />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button className="px-3 py-2 rounded border" onClick={onClose}>ยกเลิก</button>
          <button className="px-3 py-2 rounded bg-[#2E7D32] text-white" onClick={() => onSave({ ...v, companyId: (v.companyId as any) || (initial.companyId) })}>บันทึก</button>
        </div>
      </div>
    </Modal>
  );
};

export default SuppliersManagementPage;

