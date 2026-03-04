import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, fetchExportTemplates, setDefaultTemplate, listTemplateDefaults, listExportCompanies } from '../services/api';
import { User } from '../types';
import {
    FileSpreadsheet, Plus, Pencil, Trash2, Save, X, ChevronUp, ChevronDown,
    Loader2, GripVertical, Eye, Star, Building2
} from 'lucide-react';

interface ExportTemplateSettingsProps {
    currentUser?: User | null;
}

interface TemplateColumn {
    id?: number;
    header_name: string;
    data_source: string;
    sort_order: number;
    default_value?: string | null;
    display_mode?: string;
}

interface ExportTemplate {
    id: number;
    name: string;
    is_default: number;
    columns: TemplateColumn[];
    created_at: string;
}

// Known data sources for dropdown
const DATA_SOURCES = [
    { value: '', label: '(ค่าว่าง)' },
    { value: 'order.onlineOrderId', label: 'หมายเลขออเดอร์ (sub)' },
    { value: 'order.id', label: 'หมายเลขออเดอร์หลัก' },
    { value: 'order.orderDate', label: 'วันที่สั่งซื้อ' },
    { value: 'order.deliveryDate', label: 'วันที่จัดส่ง' },
    { value: 'order.notes', label: 'หมายเหตุออเดอร์' },
    { value: 'order.totalAmount', label: 'จำนวนเงินรวม' },
    { value: 'order.codFlag', label: 'COD (ใช่/ไม่)' },
    { value: 'order.paymentMethod', label: 'วิธีชำระเงิน' },
    { value: 'order.orderStatus', label: 'สถานะออเดอร์' },
    { value: 'order.shippingProvider', label: 'บริษัทขนส่ง' },
    { value: 'order.trackingNumbers', label: 'หมายเลขขนส่ง' },
    { value: 'order.shippingCost', label: 'ค่าขนส่ง' },
    { value: 'customer.phone', label: 'เบอร์โทรลูกค้า' },
    { value: 'customer.email', label: 'อีเมลลูกค้า' },
    { value: 'address.recipientFullName', label: 'ชื่อผู้รับ (เต็ม)' },
    { value: 'address.recipientFirstName', label: 'ชื่อผู้รับ' },
    { value: 'address.recipientLastName', label: 'นามสกุลผู้รับ' },
    { value: 'address.street', label: 'ที่อยู่ (ถนน)' },
    { value: 'address.subdistrict', label: 'แขวง/ตำบล' },
    { value: 'address.district', label: 'เขต/อำเภอ' },
    { value: 'address.province', label: 'จังหวัด' },
    { value: 'address.postalCode', label: 'รหัสไปรษณีย์' },
    { value: 'product.shop', label: 'ชื่อร้านค้า' },
    { value: 'product.sku', label: 'รหัสสินค้า (SKU)' },
    { value: 'item.productName', label: 'ชื่อสินค้า' },
    { value: 'item.quantity', label: 'จำนวนสินค้า' },
    { value: 'item.pricePerUnit', label: 'ราคาต่อหน่วย' },
];

const ExportTemplateSettingsPage: React.FC<ExportTemplateSettingsProps> = ({ currentUser }) => {
    const [templates, setTemplates] = useState<ExportTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Edit state
    const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
    const [editName, setEditName] = useState('');
    const [editColumns, setEditColumns] = useState<TemplateColumn[]>([]);

    // Create state
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');

    // Preview state
    const [previewTemplate, setPreviewTemplate] = useState<ExportTemplate | null>(null);

    const loadTemplates = useCallback(async () => {
        if (!currentUser?.companyId) return;
        setLoading(true);
        try {
            const data = await fetchExportTemplates(currentUser.companyId);
            setTemplates(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to load templates', e);
            setMessage({ type: 'error', text: 'โหลด Template ไม่สำเร็จ' });
        } finally {
            setLoading(false);
        }
    }, [currentUser?.companyId]);

    // Company defaults management
    const [companies, setCompanies] = useState<any[]>([]);
    const [companyDefaults, setCompanyDefaults] = useState<Record<number, number>>({});
    const [savingDefault, setSavingDefault] = useState<number | null>(null);

    const loadCompanyDefaults = useCallback(async () => {
        if (!currentUser?.companyId) return;
        try {
            const [comps, defs] = await Promise.all([
                listExportCompanies(),
                listTemplateDefaults(currentUser.companyId),
            ]);
            setCompanies(Array.isArray(comps) ? comps : []);
            const defaultMap: Record<number, number> = {};
            (Array.isArray(defs) ? defs : []).forEach((d: any) => {
                defaultMap[d.company_id] = Number(d.template_id);
            });
            setCompanyDefaults(defaultMap);
        } catch (e) {
            console.error('Failed to load company defaults', e);
        }
    }, [currentUser?.companyId]);

    useEffect(() => {
        loadTemplates();
        loadCompanyDefaults();
    }, [loadTemplates, loadCompanyDefaults]);

    const startEdit = (tpl: ExportTemplate) => {
        setEditingTemplate(tpl);
        setEditName(tpl.name);
        setEditColumns([...tpl.columns].sort((a, b) => a.sort_order - b.sort_order));
        setShowCreate(false);
        setPreviewTemplate(null);
    };

    const cancelEdit = () => {
        setEditingTemplate(null);
        setEditName('');
        setEditColumns([]);
    };

    const saveTemplate = async () => {
        if (!editingTemplate || !currentUser?.companyId) return;
        setSaving(true);
        try {
            await apiFetch(`Order_DB/export_templates.php?companyId=${currentUser.companyId}&id=${editingTemplate.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: editName,
                    columns: editColumns.map((col, i) => ({
                        header_name: col.header_name,
                        data_source: col.data_source,
                        sort_order: i,
                        default_value: col.default_value || null,
                        display_mode: col.display_mode || 'all',
                    })),
                }),
            });
            setMessage({ type: 'success', text: 'บันทึกสำเร็จ' });
            cancelEdit();
            loadTemplates();
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'บันทึกไม่สำเร็จ' });
        } finally {
            setSaving(false);
        }
    };

    const createTemplate = async () => {
        if (!newName.trim() || !currentUser?.companyId) return;
        setSaving(true);
        try {
            await apiFetch(`Order_DB/export_templates.php?companyId=${currentUser.companyId}`, {
                method: 'POST',
                body: JSON.stringify({
                    name: newName.trim(),
                    columns: [],
                }),
            });
            setMessage({ type: 'success', text: 'สร้าง Template สำเร็จ' });
            setShowCreate(false);
            setNewName('');
            loadTemplates();
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'สร้างไม่สำเร็จ' });
        } finally {
            setSaving(false);
        }
    };

    const deleteTemplate = async (id: number) => {
        if (!currentUser?.companyId) return;
        if (!window.confirm('ต้องการลบ Template นี้ใช่หรือไม่?')) return;
        try {
            await apiFetch(`Order_DB/export_templates.php?companyId=${currentUser.companyId}&id=${id}`, {
                method: 'DELETE',
            });
            setMessage({ type: 'success', text: 'ลบสำเร็จ' });
            loadTemplates();
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'ลบไม่สำเร็จ' });
        }
    };

    const handleSetDefault = async (templateId: number, targetCompanyId?: number) => {
        if (!currentUser?.companyId) return;
        const target = targetCompanyId ?? currentUser.companyId;
        setSavingDefault(target);
        try {
            await setDefaultTemplate(currentUser.companyId, templateId, target);
            setMessage({ type: 'success', text: `ตั้งเป็น Default สำเร็จ` });
            loadTemplates();
            loadCompanyDefaults();
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'ตั้ง Default ไม่สำเร็จ' });
        } finally {
            setSavingDefault(null);
        }
    };

    // Column operations
    const addColumn = () => {
        setEditColumns(prev => [...prev, {
            header_name: '',
            data_source: '',
            sort_order: prev.length,
            default_value: null,
            display_mode: 'all',
        }]);
    };

    const removeColumn = (index: number) => {
        setEditColumns(prev => prev.filter((_, i) => i !== index));
    };

    const updateColumn = (index: number, field: keyof TemplateColumn, value: string) => {
        setEditColumns(prev => prev.map((col, i) =>
            i === index ? { ...col, [field]: value } : col
        ));
    };

    const moveColumn = (index: number, direction: 'up' | 'down') => {
        const newCols = [...editColumns];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newCols.length) return;
        [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
        setEditColumns(newCols);
    };

    // Auto-dismiss message
    useEffect(() => {
        if (message) {
            const t = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(t);
        }
    }, [message]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-7 h-7 text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">ตั้งค่าการส่งออกข้อมูล</h1>
                        <p className="text-sm text-gray-500">จัดการ Template สำหรับ Export ข้อมูลออเดอร์</p>
                    </div>
                </div>
                <button
                    onClick={() => { setShowCreate(true); cancelEdit(); setPreviewTemplate(null); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    สร้าง Template ใหม่
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* Create Form */}
            {showCreate && (
                <div className="mb-6 bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">สร้าง Template ใหม่</h3>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="ชื่อ Template เช่น v.3 รายงานเฉพาะ"
                            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            onClick={createTemplate}
                            disabled={saving || !newName.trim()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            สร้าง
                        </button>
                        <button
                            onClick={() => { setShowCreate(false); setNewName(''); }}
                            className="px-3 py-2 text-gray-500 hover:text-gray-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Template List */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 text-left font-medium text-gray-600">ชื่อ Template</th>
                            <th className="p-4 text-center font-medium text-gray-600">จำนวนคอลัมน์</th>
                            <th className="p-4 text-center font-medium text-gray-600">สถานะ</th>
                            <th className="p-4 text-center font-medium text-gray-600">สร้างเมื่อ</th>
                            <th className="p-4 text-center font-medium text-gray-600">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {templates.map(tpl => (
                            <tr key={tpl.id} className="border-t hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-800">
                                    {tpl.name}
                                    {tpl.is_default ? (
                                        <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full">DEFAULT</span>
                                    ) : null}
                                </td>
                                <td className="p-4 text-center text-gray-600">{tpl.columns.length}</td>
                                <td className="p-4 text-center">
                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">ใช้งาน</span>
                                </td>
                                <td className="p-4 text-center text-gray-500 text-xs">
                                    {tpl.created_at ? new Date(tpl.created_at).toLocaleDateString('th-TH') : '-'}
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => setPreviewTemplate(previewTemplate?.id === tpl.id ? null : tpl)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                            title="ดูตัวอย่าง"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => startEdit(tpl)}
                                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                                            title="แก้ไข"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        {!tpl.is_default && (
                                            <button
                                                onClick={() => handleSetDefault(tpl.id)}
                                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded"
                                                title="ตั้งเป็น Default"
                                            >
                                                <Star className="w-4 h-4" />
                                            </button>
                                        )}
                                        {!tpl.is_default && (
                                            <button
                                                onClick={() => deleteTemplate(tpl.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                title="ลบ"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {templates.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400">ไม่มี Template</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Per-Company Default Management */}
            {companies.length > 0 && templates.length > 0 && (
                <div className="mt-6 bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            ตั้งค่า Default Template ตามบริษัท
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">เลือก template ที่จะใช้เป็นค่าเริ่มต้นสำหรับแต่ละบริษัท</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-3 text-left font-medium text-gray-600">ID</th>
                                <th className="p-3 text-left font-medium text-gray-600">ชื่อบริษัท</th>
                                <th className="p-3 text-left font-medium text-gray-600">Default Template</th>
                                <th className="p-3 text-center font-medium text-gray-600 w-24"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map((comp: any) => (
                                <tr key={comp.id} className="border-t hover:bg-gray-50">
                                    <td className="p-3 text-gray-500 text-xs">{comp.id}</td>
                                    <td className="p-3 font-medium text-gray-800">{comp.name || comp.company_name || `Company ${comp.id}`}</td>
                                    <td className="p-3">
                                        <select
                                            value={companyDefaults[comp.id] || ''}
                                            onChange={e => {
                                                const tplId = Number(e.target.value);
                                                if (tplId) handleSetDefault(tplId, comp.id);
                                            }}
                                            disabled={savingDefault === comp.id}
                                            className="px-3 py-1.5 border rounded-lg text-sm bg-white min-w-[180px] focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                        >
                                            <option value="">ยังไม่ได้ตั้ง</option>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="p-3 text-center">
                                        {savingDefault === comp.id && (
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-500 inline" />
                                        )}
                                        {companyDefaults[comp.id] && savingDefault !== comp.id && (
                                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 rounded-full">ตั้งแล้ว</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Preview */}
            {previewTemplate && !editingTemplate && (
                <div className="mt-6 bg-white border rounded-xl p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                        ตัวอย่าง Headers: {previewTemplate.name}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {previewTemplate.columns
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((col, i) => (
                                <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg border">
                                    {i + 1}. {col.header_name}
                                </span>
                            ))}
                    </div>
                </div>
            )}

            {/* Edit Form */}
            {editingTemplate && (
                <div className="mt-6 bg-white border rounded-xl shadow-sm">
                    <div className="p-5 border-b">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-800">
                                แก้ไข Template: {editingTemplate.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={cancelEdit}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={saveTemplate}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    บันทึก
                                </button>
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="text-sm text-gray-600 font-medium">ชื่อ Template</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="mt-1 w-full max-w-md px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Expression syntax help */}
                    <div className="px-5 py-3 bg-blue-50 border-b text-xs text-blue-700">
                        <strong>สูตรแหล่งข้อมูล:</strong> เลือกจาก dropdown หรือพิมพ์สูตรเอง เช่น <code className="bg-blue-100 px-1 rounded">{'{product.sku}-{item.quantity}'}</code> → <code className="bg-blue-100 px-1 rounded">LATM01L001-5</code>
                        <span className="ml-2 text-blue-500">| ใส่ข้อมูลใน {'{ }'} เพื่อดึงค่าจากระบบ ข้อความนอก {'{ }'} จะแสดงตามเดิม</span>
                    </div>

                    {/* Columns Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-3 text-center text-gray-500 w-12">#</th>
                                    <th className="p-3 text-center text-gray-500 w-16">ลำดับ</th>
                                    <th className="p-3 text-left text-gray-600 font-medium">ชื่อ Header (แสดงใน Excel)</th>
                                    <th className="p-3 text-left text-gray-600 font-medium">แหล่งข้อมูล</th>
                                    <th className="p-3 text-left text-gray-600 font-medium w-28">การแสดง</th>
                                    <th className="p-3 text-left text-gray-600 font-medium">ค่า Default</th>
                                    <th className="p-3 text-center text-gray-500 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editColumns.map((col, i) => (
                                    <tr key={i} className="border-t hover:bg-gray-50">
                                        <td className="p-2 text-center text-gray-400">
                                            <GripVertical className="w-4 h-4 inline" />
                                        </td>
                                        <td className="p-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => moveColumn(i, 'up')}
                                                    disabled={i === 0}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <span className="text-xs text-gray-500 w-5 text-center">{i + 1}</span>
                                                <button
                                                    onClick={() => moveColumn(i, 'down')}
                                                    disabled={i === editColumns.length - 1}
                                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={col.header_name}
                                                onChange={e => updateColumn(i, 'header_name', e.target.value)}
                                                placeholder="เช่น หมายเลขออเดอร์"
                                                className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    list={`ds-list-${i}`}
                                                    value={col.data_source}
                                                    onChange={e => updateColumn(i, 'data_source', e.target.value)}
                                                    placeholder="เลือกหรือพิมพ์สูตร เช่น {product.sku}-{item.quantity}"
                                                    className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
                                                />
                                                <datalist id={`ds-list-${i}`}>
                                                    {DATA_SOURCES.map(ds => (
                                                        <option key={ds.value} value={ds.value} label={ds.label} />
                                                    ))}
                                                </datalist>
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <select
                                                value={col.display_mode || 'all'}
                                                onChange={e => updateColumn(i, 'display_mode', e.target.value)}
                                                className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500 bg-white"
                                            >
                                                <option value="all">ทุกแถว</option>
                                                <option value="index">เฉพาะแถวแรก</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={col.default_value || ''}
                                                onChange={e => updateColumn(i, 'default_value', e.target.value)}
                                                placeholder="เช่น ไทย"
                                                className="w-full px-2 py-1.5 border rounded text-sm focus:ring-1 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => removeColumn(i)}
                                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t flex items-center justify-between">
                        <button
                            onClick={addColumn}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            เพิ่มคอลัมน์
                        </button>
                        <span className="text-xs text-gray-400">{editColumns.length} คอลัมน์</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportTemplateSettingsPage;
