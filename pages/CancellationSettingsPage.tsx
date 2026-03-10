import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  GripVertical,
  Star,
  Shield,
} from 'lucide-react';
import { User } from '../types';
import {
  manageCancellationTypes,
  setDefaultCancellationType,
} from '../services/api';

interface CancellationSettingsPageProps {
  currentUser: User;
}

interface CancellationType {
  id: number;
  label: string;
  description: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

const CancellationSettingsPage: React.FC<CancellationSettingsPageProps> = ({ currentUser }) => {
  const [types, setTypes] = useState<CancellationType[]>([]);
  const [defaultTypeId, setDefaultTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ label: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await manageCancellationTypes('GET');
      if (res?.status === 'success') {
        setTypes(res.data || []);
        setDefaultTypeId(res.default_type_id ?? null);
      }
    } catch (err) {
      console.error('Failed to load types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const handleAdd = async () => {
    if (!addForm.label.trim()) {
      alert('กรุณาระบุชื่อประเภท');
      return;
    }
    setSaving(true);
    try {
      const res = await manageCancellationTypes('POST', {
        label: addForm.label,
        description: addForm.description,
      });
      if (res?.status === 'success') {
        setAddForm({ label: '', description: '' });
        setShowAddForm(false);
        loadTypes();
      }
    } catch (err) {
      console.error('Failed to add type:', err);
      alert('เกิดข้อผิดพลาดในการเพิ่ม');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (type: CancellationType) => {
    setEditingId(type.id);
    setEditForm({ label: type.label, description: type.description || '' });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.label.trim()) return;
    setSaving(true);
    try {
      await manageCancellationTypes('PUT', {
        id: editingId,
        label: editForm.label,
        description: editForm.description,
      });
      setEditingId(null);
      loadTypes();
    } catch (err) {
      console.error('Failed to update:', err);
      alert('เกิดข้อผิดพลาดในการแก้ไข');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: CancellationType) => {
    if (!confirm(`ต้องการลบประเภท "${type.label}" ใช่หรือไม่?`)) return;
    try {
      const res = await manageCancellationTypes('DELETE', { id: type.id });
      if (res?.status === 'success') {
        alert(res.message);
        loadTypes();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const handleToggleActive = async (type: CancellationType) => {
    try {
      await manageCancellationTypes('PUT', {
        id: type.id,
        is_active: type.is_active ? 0 : 1,
      });
      loadTypes();
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const handleSetDefault = async (typeId: number) => {
    try {
      await setDefaultCancellationType(typeId);
      setDefaultTypeId(typeId);
    } catch (err) {
      console.error('Failed to set default:', err);
      alert('เกิดข้อผิดพลาดในการตั้งค่า');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ตั้งค่าการยกเลิก</h1>
            <p className="text-sm text-gray-500">จัดการประเภทการยกเลิกและค่าเริ่มต้น</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadTypes}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
          <button
            onClick={() => { setShowAddForm(true); setAddForm({ label: '', description: '' }); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg shadow hover:shadow-md transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            เพิ่มประเภท
          </button>
        </div>
      </div>

      {/* Default Setting Card */}
      <div className="bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-violet-50/50 border-b border-violet-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-600" />
            <h2 className="font-semibold text-violet-900 text-sm">ค่าเริ่มต้นสำหรับปุ่มยกเลิก (หน้า Orders)</h2>
          </div>
          <p className="text-xs text-violet-600 mt-1">เมื่อกดยกเลิกออเดอร์จากหน้า Orders จะใช้ประเภทนี้โดยอัตโนมัติ</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            {types.filter(t => t.is_active).map(type => (
              <button
                key={type.id}
                onClick={() => handleSetDefault(type.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  defaultTypeId === type.id
                    ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm ring-2 ring-violet-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50/30'
                }`}
              >
                {defaultTypeId === type.id && <Star className="w-4 h-4 text-violet-500 fill-violet-500" />}
                {type.label}
              </button>
            ))}
          </div>
          {defaultTypeId && (
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ค่าเริ่มต้นปัจจุบัน: <strong className="text-gray-600">{types.find(t => t.id === defaultTypeId)?.label}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
          <h3 className="font-semibold text-green-800 text-sm mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            เพิ่มประเภทยกเลิกใหม่
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ชื่อประเภท *</label>
              <input
                type="text"
                value={addForm.label}
                onChange={(e) => setAddForm(prev => ({ ...prev, label: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="ระบุชื่อประเภทยกเลิก"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">คำอธิบาย</label>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !addForm.label.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-500 rounded-lg hover:bg-green-600 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* Types List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-700 text-sm">ประเภทการยกเลิกทั้งหมด ({types.length})</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">กำลังโหลด...</p>
          </div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center">
            <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">ยังไม่มีประเภทการยกเลิก</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {types.map((type) => (
              <div
                key={type.id}
                className={`flex items-center px-5 py-4 hover:bg-gray-50/50 transition-colors ${!type.is_active ? 'opacity-50 bg-gray-50/30' : ''}`}
              >
                <div className="flex items-center gap-3 mr-4 text-gray-300">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">#{type.sort_order}</span>
                </div>

                {editingId === type.id ? (
                  // Editing mode
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="text"
                      value={editForm.label}
                      onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="คำอธิบาย"
                    />
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // Display mode
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">{type.label}</span>
                        {defaultTypeId === type.id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                            <Star className="w-3 h-3 fill-violet-500" />
                            ค่าเริ่มต้น
                          </span>
                        )}
                        {!type.is_active && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            ปิดใช้งาน
                          </span>
                        )}
                      </div>
                      {type.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{type.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => handleToggleActive(type)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                          type.is_active
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {type.is_active ? 'เปิดใช้' : 'ปิดอยู่'}
                      </button>
                      <button
                        onClick={() => handleEdit(type)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition"
                        title="แก้ไข"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(type)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CancellationSettingsPage;
