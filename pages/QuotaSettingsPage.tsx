import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Plus, Edit, Trash2, Calendar, DollarSign,
  ChevronDown, ChevronRight, Search, RefreshCcw,
  TrendingUp, Users, Clock, Gift, Eye, Settings,
  AlertCircle, CheckCircle, X
} from 'lucide-react';
import type { Product, User, QuotaProduct, QuotaRateSchedule, QuotaAllocation, QuotaSummary } from '../types';
import {
  listQuotaProducts, createQuotaProduct, createQuotaProductWithNew, updateQuotaProduct,
  listRateSchedules, createRateSchedule, updateRateSchedule, deleteRateSchedule, getActiveRate,
  getQuotaSummary, allocateQuota, listQuotaAllocations,
} from '../services/quotaApi';
import { listProducts } from '../services/api';

interface QuotaSettingsPageProps {
  currentUser: User;
  products?: Product[];
}

const QuotaSettingsPage: React.FC<QuotaSettingsPageProps> = ({ currentUser, products: propProducts }) => {
  // ============ State ============
  const [activeTab, setActiveTab] = useState<'products' | 'rates' | 'summary'>('products');
  const [loading, setLoading] = useState(false);

  // Products tab
  const [quotaProducts, setQuotaProducts] = useState<QuotaProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>(propProducts || []);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<QuotaProduct | null>(null);
  const [productForm, setProductForm] = useState({ productId: 0, displayName: '', csvLabel: '', quotaCost: '1' });
  const [productCreateMode, setProductCreateMode] = useState<'existing' | 'new'>('existing');
  const [newProductForm, setNewProductForm] = useState({ sku: '', productName: '', price: '', category: '', shop: '', description: '' });

  // Rates tab
  const [selectedQuotaProduct, setSelectedQuotaProduct] = useState<QuotaProduct | null>(null);
  const [rateSchedules, setRateSchedules] = useState<QuotaRateSchedule[]>([]);
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({
    salesPerQuota: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    orderDateField: 'order_date' as 'order_date' | 'delivery_date',
    quotaMode: 'reset' as 'reset' | 'cumulative',
    resetType: 'monthly' as 'interval' | 'monthly',
    resetIntervalDays: '30',
    resetDayOfMonth: '1',
    resetAnchorDate: new Date().toISOString().split('T')[0],
  });
  const [editingRate, setEditingRate] = useState<QuotaRateSchedule | null>(null);

  // Summary tab
  const [summaryData, setSummaryData] = useState<QuotaSummary[]>([]);
  const [summaryQuotaProduct, setSummaryQuotaProduct] = useState<QuotaProduct | null>(null);

  // Allocation modal
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateTarget, setAllocateTarget] = useState<QuotaSummary | null>(null);
  const [allocateQuantity, setAllocateQuantity] = useState('');
  const [allocateNote, setAllocateNote] = useState('');

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyUser, setHistoryUser] = useState<QuotaSummary | null>(null);
  const [historyData, setHistoryData] = useState<QuotaAllocation[]>([]);

  const companyId = currentUser.companyId;

  // ============ Load Data ============
  const loadQuotaProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listQuotaProducts(companyId);
      setQuotaProducts(data);
    } catch (e) {
      console.error('Failed to load quota products', e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadAllProducts = useCallback(async () => {
    if (propProducts && propProducts.length > 0) {
      setAllProducts(propProducts);
      return;
    }
    try {
      const res = await listProducts({ companyId });
      setAllProducts(Array.isArray(res) ? res : (res as any).data || []);
    } catch (e) {
      console.error('Failed to load products', e);
    }
  }, [companyId, propProducts]);

  useEffect(() => {
    loadQuotaProducts();
    loadAllProducts();
  }, [loadQuotaProducts, loadAllProducts]);

  // Load rates when quota product is selected
  useEffect(() => {
    if (selectedQuotaProduct) {
      loadRates(selectedQuotaProduct.id);
    }
  }, [selectedQuotaProduct]);

  // Load summary when summary tab quota product changes
  useEffect(() => {
    if (summaryQuotaProduct && activeTab === 'summary') {
      loadSummary(summaryQuotaProduct.id);
    }
  }, [summaryQuotaProduct, activeTab]);

  const loadRates = async (qpId: number) => {
    try {
      const data = await listRateSchedules(qpId);
      setRateSchedules(data);
    } catch (e) {
      console.error('Failed to load rates', e);
    }
  };

  const loadSummary = async (qpId: number) => {
    setLoading(true);
    try {
      const data = await getQuotaSummary(companyId, qpId);
      setSummaryData(data);
    } catch (e) {
      console.error('Failed to load summary', e);
    } finally {
      setLoading(false);
    }
  };

  // ============ Handlers ============

  // -- Product CRUD --
  const handleSaveProduct = async () => {
    if (editingProduct) {
      // Edit mode
      if (!productForm.displayName.trim()) {
        alert('กรุณากรอกชื่อที่แสดงในระบบ');
        return;
      }
    } else if (productCreateMode === 'existing') {
      if (!productForm.productId || !productForm.displayName.trim()) {
        alert('กรุณาเลือกสินค้าและกรอกชื่อที่แสดงในระบบ');
        return;
      }
    } else {
      // new mode
      if (!newProductForm.sku.trim() || !productForm.displayName.trim()) {
        alert('กรุณากรอก SKU และชื่อที่แสดงในระบบ');
        return;
      }
    }
    try {
      if (editingProduct) {
        await updateQuotaProduct({
          id: editingProduct.id,
          displayName: productForm.displayName.trim(),
          csvLabel: productForm.csvLabel.trim() || undefined,
          quotaCost: parseInt(productForm.quotaCost) || 1,
        });
      } else if (productCreateMode === 'existing') {
        await createQuotaProduct({
          productId: productForm.productId,
          companyId,
          displayName: productForm.displayName.trim(),
          csvLabel: productForm.csvLabel.trim() || undefined,
          quotaCost: parseInt(productForm.quotaCost) || 1,
        });
      } else {
        await createQuotaProductWithNew({
          companyId,
          displayName: productForm.displayName.trim(),
          csvLabel: productForm.csvLabel.trim() || undefined,
          quotaCost: parseInt(productForm.quotaCost) || 1,
          sku: newProductForm.sku.trim(),
          productName: newProductForm.productName.trim() || productForm.displayName.trim(),
          price: parseFloat(newProductForm.price) || 0,
          category: newProductForm.category.trim() || undefined,
          shop: newProductForm.shop.trim() || undefined,
          description: newProductForm.description.trim() || undefined,
        });
        // Reload all products since a new one was created
        loadAllProducts();
      }
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({ productId: 0, displayName: '', csvLabel: '', quotaCost: '1' });
      setNewProductForm({ sku: '', productName: '', price: '', category: '', shop: '', description: '' });
      setProductCreateMode('existing');
      loadQuotaProducts();
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  };

  const handleToggleProductActive = async (qp: QuotaProduct) => {
    try {
      await updateQuotaProduct({ id: qp.id, isActive: !qp.isActive });
      loadQuotaProducts();
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  };

  const handleEditProduct = (qp: QuotaProduct) => {
    setEditingProduct(qp);
    setProductForm({
      productId: qp.productId,
      displayName: qp.displayName,
      csvLabel: qp.csvLabel || '',
      quotaCost: String(qp.quotaCost || 1),
    });
    setShowProductForm(true);
  };

  // -- Rate Schedule --
  const handleSaveRate = async () => {
    if (!selectedQuotaProduct || !rateForm.salesPerQuota || !rateForm.effectiveDate) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    // Warn when creating/updating to a "reset" rate — all cumulative quota will be lost
    if (rateForm.quotaMode === 'reset' && !editingRate) {
      const effDate = new Date(rateForm.effectiveDate);
      const formattedDate = effDate.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const confirmed = window.confirm(
        `⚠️ คำเตือน: การสร้างอัตราโควตาแบบ "รีเซ็ต"\n\n` +
        `โควตาสะสม (Auto + Admin) ของพนักงานทุกคนจะหายไป\n` +
        `ตั้งแต่วันที่ ${formattedDate} เป็นต้นไป\n\n` +
        `ประวัติอัตราก่อนหน้าจะไม่ถูกนำมาคำนวณอีก\n\n` +
        `ต้องการดำเนินการต่อหรือไม่?`
      );
      if (!confirmed) return;
    }

    try {
      if (editingRate) {
        // Update existing rate
        await updateRateSchedule({
          id: editingRate.id,
          salesPerQuota: parseFloat(rateForm.salesPerQuota),
          effectiveDate: rateForm.effectiveDate,
          orderDateField: rateForm.orderDateField,
          quotaMode: rateForm.quotaMode,
          resetIntervalDays: parseInt(rateForm.resetIntervalDays) || 30,
          resetDayOfMonth: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'monthly') ? parseInt(rateForm.resetDayOfMonth) || 1 : null,
          resetAnchorDate: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'interval') ? rateForm.resetAnchorDate : null,
        });
      } else {
        // Create new rate
        await createRateSchedule({
          quotaProductId: selectedQuotaProduct.id,
          salesPerQuota: parseFloat(rateForm.salesPerQuota),
          effectiveDate: rateForm.effectiveDate,
          orderDateField: rateForm.orderDateField,
          quotaMode: rateForm.quotaMode,
          resetIntervalDays: parseInt(rateForm.resetIntervalDays) || 30,
          resetDayOfMonth: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'monthly') ? parseInt(rateForm.resetDayOfMonth) || 1 : undefined,
          resetAnchorDate: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'interval') ? rateForm.resetAnchorDate : undefined,
          createdBy: currentUser.id,
        });
      }
      setShowRateForm(false);
      setEditingRate(null);
      loadRates(selectedQuotaProduct.id);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  };

  // -- Allocation --
  const handleAllocate = async () => {
    if (!allocateTarget || !summaryQuotaProduct || !allocateQuantity) return;
    try {
      await allocateQuota({
        quotaProductId: summaryQuotaProduct.id,
        userId: allocateTarget.userId,
        companyId,
        quantity: parseFloat(allocateQuantity),
        source: 'admin',
        sourceDetail: allocateNote || 'Admin เพิ่มโควตาเอง',
        allocatedBy: currentUser.id,
        periodStart: allocateTarget.periodStart || undefined,
        periodEnd: allocateTarget.periodEnd || undefined,
      });
      setShowAllocateModal(false);
      setAllocateQuantity('');
      setAllocateNote('');
      loadSummary(summaryQuotaProduct.id);
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  };

  // -- History --
  const handleViewHistory = async (summary: QuotaSummary) => {
    setHistoryUser(summary);
    setShowHistoryModal(true);
    try {
      const data = await listQuotaAllocations({
        quotaProductId: summaryQuotaProduct?.id,
        userId: summary.userId,
        companyId,
      });
      setHistoryData(data);
    } catch (e) {
      console.error('Failed to load history', e);
    }
  };

  // Active products for dropdowns
  const activeQuotaProducts = useMemo(() => quotaProducts.filter(qp => qp.isActive), [quotaProducts]);

  // Set default selected when quota products load
  useEffect(() => {
    if (activeQuotaProducts.length > 0 && !selectedQuotaProduct) {
      setSelectedQuotaProduct(activeQuotaProducts[0]);
    }
    if (activeQuotaProducts.length > 0 && !summaryQuotaProduct) {
      setSummaryQuotaProduct(activeQuotaProducts[0]);
    }
  }, [activeQuotaProducts]);

  // Available products (not yet added as quota)
  const availableProducts = useMemo(() => {
    const usedIds = new Set(quotaProducts.map(qp => qp.productId));
    return allProducts.filter(p => !usedIds.has(p.id) && p.status !== 'Inactive' && !p.sku?.startsWith('UNKNOWN'));
  }, [allProducts, quotaProducts]);

  // ============ Tab navigation ============
  const tabs = [
    { key: 'products' as const, label: 'สินค้าโควตา', icon: Package },
    { key: 'rates' as const, label: 'อัตราโควตา', icon: Settings },
    { key: 'summary' as const, label: 'สรุปโควตาพนักงาน', icon: Users },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Package size={24} className="text-indigo-600" />
          </div>
          ระบบสินค้าโควตา
        </h1>
        <p className="text-gray-500 mt-1 ml-12">จัดการโควตาสินค้าตามยอดขายของพนักงาน</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ Tab: Products ============ */}
      {activeTab === 'products' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">รายการสินค้าโควตา</h2>
            <button
              onClick={() => {
                setEditingProduct(null);
                setProductForm({ productId: 0, displayName: '', csvLabel: '', quotaCost: '1' });
                setNewProductForm({ sku: '', productName: '', price: '', category: '', shop: '', description: '' });
                setProductCreateMode('existing');
                setShowProductForm(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 text-sm font-medium shadow-sm"
            >
              <Plus size={16} />
              เพิ่มสินค้าโควตา
            </button>
          </div>

          {/* Product Form Modal */}
          {showProductForm && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="p-5 border-b flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingProduct ? 'แก้ไขสินค้าโควตา' : 'เพิ่มสินค้าโควตา'}
                  </h3>
                  <button onClick={() => setShowProductForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  {/* Mode toggle — only show when adding new (not editing) */}
                  {!editingProduct && (
                    <div className="flex border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setProductCreateMode('existing')}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                          productCreateMode === 'existing'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        เลือกจากสินค้าที่มี
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductCreateMode('new')}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                          productCreateMode === 'new'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        สร้างสินค้าใหม่
                      </button>
                    </div>
                  )}

                  {/* Mode: existing product */}
                  {!editingProduct && productCreateMode === 'existing' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">สินค้า *</label>
                      <select
                        value={productForm.productId}
                        onChange={e => {
                          const pid = parseInt(e.target.value);
                          const p = allProducts.find(p => p.id === pid);
                          setProductForm(prev => ({
                            ...prev,
                            productId: pid,
                            displayName: prev.displayName || p?.name || '',
                          }));
                        }}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value={0}>-- เลือกสินค้า --</option>
                        {availableProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Mode: create new product */}
                  {!editingProduct && productCreateMode === 'new' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                          <input
                            type="text"
                            value={newProductForm.sku}
                            onChange={e => setNewProductForm(prev => ({ ...prev, sku: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="เช่น QP-001"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">ราคาขาย</label>
                          <input
                            type="number"
                            value={newProductForm.price}
                            onChange={e => setNewProductForm(prev => ({ ...prev, price: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสินค้า (ในตาราง Products)</label>
                        <input
                          type="text"
                          value={newProductForm.productName}
                          onChange={e => setNewProductForm(prev => ({ ...prev, productName: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          placeholder="ถ้าว่าง จะใช้ชื่อที่แสดงในระบบ"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                          <input
                            type="text"
                            value={newProductForm.category}
                            onChange={e => setNewProductForm(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="เช่น โควตา"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Shop</label>
                          <input
                            type="text"
                            value={newProductForm.shop}
                            onChange={e => setNewProductForm(prev => ({ ...prev, shop: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="ชื่อร้าน"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚡ ระบบจะสร้างสินค้าใหม่ในตาราง Products อัตโนมัติ แล้วผูกเป็นสินค้าโควตา</p>
                    </>
                  )}

                  {/* Common fields */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อที่แสดงในระบบ *</label>
                    <input
                      type="text"
                      value={productForm.displayName}
                      onChange={e => setProductForm(prev => ({ ...prev, displayName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="ชื่อสินค้าโควตาที่แสดงในระบบ"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อที่แสดงใน CSV Export</label>
                    <input
                      type="text"
                      value={productForm.csvLabel}
                      onChange={e => setProductForm(prev => ({ ...prev, csvLabel: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="ถ้าว่าง จะใช้ชื่อจากตาราง products"
                    />
                    <p className="text-xs text-gray-400 mt-1">ใช้สำหรับ data_source: item.quotaCsvLabel ในระบบ Export Template</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ต้นทุนโควตา (ต่อชิ้น) *</label>
                    <input
                      type="number"
                      value={productForm.quotaCost}
                      onChange={e => setProductForm(prev => ({ ...prev, quotaCost: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="1"
                      min="1"
                    />
                    <p className="text-xs text-gray-400 mt-1">จำนวนโควตาที่ต้องใช้เมื่อเพิ่มสินค้านี้ 1 ชิ้นลงออเดอร์</p>
                  </div>
                </div>
                <div className="p-5 border-t flex justify-end gap-3">
                  <button onClick={() => setShowProductForm(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleSaveProduct} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                    {editingProduct ? 'บันทึก' : 'เพิ่ม'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Product Table */}
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">สินค้า</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อในระบบ</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ชื่อใน CSV</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">ต้นทุนโควตา</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">สถานะ</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotaProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                      <Package size={40} className="mx-auto mb-3 text-gray-300" />
                      <p>ยังไม่มีสินค้าโควตา</p>
                    </td>
                  </tr>
                ) : (
                  quotaProducts.map(qp => (
                    <tr key={qp.id} className={!qp.isActive ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{qp.productSku || `#${qp.productId}`}</div>
                        <div className="text-xs text-gray-400">{qp.productName || '—'}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">{qp.displayName}</td>
                      <td className="px-4 py-3 text-gray-500">{qp.csvLabel || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                          🎫 {qp.quotaCost}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleProductActive(qp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            qp.isActive
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {qp.isActive ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                          {qp.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleEditProduct(qp)}
                          className="text-gray-400 hover:text-indigo-600 p-1"
                          title="แก้ไข"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ Tab: Rates ============ */}
      {activeTab === 'rates' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">เลือกสินค้าโควตา</label>
              <select
                value={selectedQuotaProduct?.id || ''}
                onChange={e => {
                  const qp = activeQuotaProducts.find(x => x.id === parseInt(e.target.value));
                  setSelectedQuotaProduct(qp || null);
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {activeQuotaProducts.length === 0 && <option value="">-- ไม่มีสินค้าโควตา --</option>}
                {activeQuotaProducts.map(qp => (
                  <option key={qp.id} value={qp.id}>{qp.displayName} ({qp.productSku})</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setEditingRate(null); setShowRateForm(true); }}
              disabled={!selectedQuotaProduct}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 text-sm font-medium shadow-sm disabled:opacity-50 mt-5"
            >
              <Plus size={16} />
              อัตราใหม่
            </button>
          </div>

          {/* Rate Form Modal */}
          {showRateForm && selectedQuotaProduct && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="p-5 border-b flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingRate ? 'แก้ไขอัตราโควตา' : 'สร้างอัตราโควตาใหม่'} — {selectedQuotaProduct.displayName}
                  </h3>
                  <button onClick={() => { setShowRateForm(false); setEditingRate(null); }} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ยอดขาย (บาท) ต่อ 1 โควตา *</label>
                    <input
                      type="number"
                      value={rateForm.salesPerQuota}
                      onChange={e => setRateForm(prev => ({ ...prev, salesPerQuota: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="เช่น 5000"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">มีผลตั้งแต่วันที่ *</label>
                    <input
                      type="date"
                      value={rateForm.effectiveDate}
                      onChange={e => setRateForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">คำนวณจากออเดอร์ตาม</label>
                    <select
                      value={rateForm.orderDateField}
                      onChange={e => setRateForm(prev => ({ ...prev, orderDateField: e.target.value as any }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="order_date">วันที่สร้างคำสั่งซื้อ (order_date)</option>
                      <option value="delivery_date">วันที่จัดส่ง (delivery_date)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">โหมดโควตา</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="quotaMode"
                          value="reset"
                          checked={rateForm.quotaMode === 'reset'}
                          onChange={() => setRateForm(prev => ({ ...prev, quotaMode: 'reset' }))}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm">รีเซ็ตตามรอบ</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="quotaMode"
                          value="cumulative"
                          checked={rateForm.quotaMode === 'cumulative'}
                          onChange={() => setRateForm(prev => ({ ...prev, quotaMode: 'cumulative' }))}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm">สะสม</span>
                      </label>
                    </div>
                  </div>
                  {rateForm.quotaMode === 'reset' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">รูปแบบการรีเซ็ต</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="resetType"
                              value="monthly"
                              checked={rateForm.resetType === 'monthly'}
                              onChange={() => setRateForm(prev => ({ ...prev, resetType: 'monthly' }))}
                              className="accent-indigo-600"
                            />
                            <span className="text-sm">ทุกวันที่ X ของเดือน</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="resetType"
                              value="interval"
                              checked={rateForm.resetType === 'interval'}
                              onChange={() => setRateForm(prev => ({ ...prev, resetType: 'interval' }))}
                              className="accent-indigo-600"
                            />
                            <span className="text-sm">ทุก N วัน</span>
                          </label>
                        </div>
                      </div>
                      {rateForm.resetType === 'monthly' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">รีเซ็ตทุกวันที่</label>
                          <select
                            value={rateForm.resetDayOfMonth}
                            onChange={e => setRateForm(prev => ({ ...prev, resetDayOfMonth: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                          >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={String(d)}>วันที่ {d} ของทุกเดือน</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">จำกัดที่วันที่ 1-28 เพื่อให้ทำงานกับทุกเดือน</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนวันต่อรอบ</label>
                            <input
                              type="number"
                              value={rateForm.resetIntervalDays}
                              onChange={e => setRateForm(prev => ({ ...prev, resetIntervalDays: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">วันเริ่มนับรอบ</label>
                            <input
                              type="date"
                              value={rateForm.resetAnchorDate}
                              onChange={e => setRateForm(prev => ({ ...prev, resetAnchorDate: e.target.value }))}
                              className="w-full border rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="p-5 border-t flex justify-end gap-3">
                  <button onClick={() => setShowRateForm(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleSaveRate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rates Timeline */}
          {selectedQuotaProduct && (
            <div className="bg-white border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">ประวัติอัตราโควตา — {selectedQuotaProduct.displayName}</h3>
              {rateSchedules.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock size={36} className="mx-auto mb-2 text-gray-300" />
                  <p>ยังไม่มีอัตราโควตา</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rateSchedules.map((rate, idx) => {
                    const isActive = idx === 0 && new Date(rate.effectiveDate) <= new Date();
                    const isFuture = new Date(rate.effectiveDate) > new Date();
                    return (
                      <div
                        key={rate.id}
                        className={`border rounded-lg p-4 ${
                          isActive ? 'border-indigo-300 bg-indigo-50' : isFuture ? 'border-amber-200 bg-amber-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isActive && <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">ใช้งานอยู่</span>}
                            {isFuture && <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">กำหนดล่วงหน้า</span>}
                            {!isActive && !isFuture && <span className="bg-gray-300 text-gray-600 text-xs px-2 py-0.5 rounded-full">เก่า</span>}
                            <span className="font-medium text-gray-800">
                              ฿{Number(rate.salesPerQuota).toLocaleString()} / 1 โควตา
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">มีผล: {rate.effectiveDate}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingRate(rate);
                                setRateForm({
                                  salesPerQuota: String(rate.salesPerQuota),
                                  effectiveDate: rate.effectiveDate,
                                  orderDateField: rate.orderDateField,
                                  quotaMode: rate.quotaMode,
                                  resetType: rate.resetDayOfMonth ? 'monthly' : 'interval',
                                  resetIntervalDays: String(rate.resetIntervalDays),
                                  resetDayOfMonth: String(rate.resetDayOfMonth || 1),
                                  resetAnchorDate: rate.resetAnchorDate || new Date().toISOString().split('T')[0],
                                });
                                setShowRateForm(true);
                              }}
                              className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
                              title="แก้ไข"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm(`ลบอัตราโควตา ฿${Number(rate.salesPerQuota).toLocaleString()} / 1 โควตา (มีผล ${rate.effectiveDate})?`)) return;
                                try {
                                  await deleteRateSchedule(rate.id);
                                  if (selectedQuotaProduct) {
                                    const rates = await listRateSchedules(selectedQuotaProduct.id);
                                    setRateSchedules(rates);
                                  }
                                } catch (e) { console.error(e); }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                              title="ลบ"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>📅 ใช้: {rate.orderDateField === 'delivery_date' ? 'วันจัดส่ง' : 'วันสร้างออเดอร์'}</span>
                          <span>🔄 Mode: {rate.quotaMode === 'reset' ? (rate.resetDayOfMonth ? `รีเซ็ตทุกวันที่ ${rate.resetDayOfMonth}` : `รีเซ็ตทุก ${rate.resetIntervalDays} วัน`) : 'สะสม'}</span>
                          {rate.quotaMode === 'reset' && rate.resetAnchorDate && (
                            <span>📌 Anchor: {rate.resetAnchorDate}</span>
                          )}
                          {rate.createdByName && <span>👤 สร้างโดย: {rate.createdByName}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ Tab: Summary ============ */}
      {activeTab === 'summary' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">เลือกสินค้าโควตา</label>
              <select
                value={summaryQuotaProduct?.id || ''}
                onChange={e => {
                  const qp = activeQuotaProducts.find(x => x.id === parseInt(e.target.value));
                  setSummaryQuotaProduct(qp || null);
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {activeQuotaProducts.length === 0 && <option value="">-- ไม่มีสินค้าโควตา --</option>}
                {activeQuotaProducts.map(qp => (
                  <option key={qp.id} value={qp.id}>{qp.displayName} ({qp.productSku})</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => summaryQuotaProduct && loadSummary(summaryQuotaProduct.id)}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 text-sm mt-5"
            >
              <RefreshCcw size={14} />
              รีเฟรช
            </button>
          </div>

          {/* Period Info */}
          {summaryData.length > 0 && summaryData[0].periodStart && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700 flex items-center gap-2">
              <Calendar size={16} />
              <span>
                รอบปัจจุบัน: {summaryData[0].periodStart} — {summaryData[0].periodEnd}
                {summaryData[0].quotaMode && ` (${summaryData[0].quotaMode === 'reset' ? 'รีเซ็ตตามรอบ' : 'สะสม'})`}
              </span>
            </div>
          )}

          {/* Summary Table */}
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">พนักงาน</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">ยอดขาย</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">โควตา (Auto)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">โควตา (Admin)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">รวมโควตา</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">ใช้ไปแล้ว</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">คงเหลือ</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                      <p className="mt-2">กำลังโหลด...</p>
                    </td>
                  </tr>
                ) : summaryData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      <Users size={40} className="mx-auto mb-3 text-gray-300" />
                      <p>ไม่มีข้อมูล</p>
                    </td>
                  </tr>
                ) : (
                  summaryData.map(row => (
                    <tr key={row.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{row.userName}</div>
                        <div className="text-xs text-gray-400">{row.role}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">
                        ฿{Number(row.totalSales).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-600 font-medium">
                        {Number(row.totalAutoQuota)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-purple-600 font-medium">
                        {Number(row.totalAdminQuota)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800 font-bold">
                        {Number(row.totalQuota)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-orange-600">
                        {Number(row.totalUsed)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono font-bold text-lg ${
                          Number(row.remaining) > 0 ? 'text-green-600' : Number(row.remaining) === 0 ? 'text-gray-400' : 'text-red-600'
                        }`}>
                          {Number(row.remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setAllocateTarget(row);
                              setAllocateQuantity('');
                              setAllocateNote('');
                              setShowAllocateModal(true);
                            }}
                            className="text-indigo-500 hover:text-indigo-700 p-1 rounded hover:bg-indigo-50"
                            title="เพิ่มโควตา"
                          >
                            <Gift size={16} />
                          </button>
                          <button
                            onClick={() => handleViewHistory(row)}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                            title="ดูประวัติ"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ Allocation Modal ============ */}
      {showAllocateModal && allocateTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">เพิ่มโควตาให้ {allocateTarget.userName}</h3>
              <button onClick={() => setShowAllocateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนโควตา *</label>
                <input
                  type="number"
                  value={allocateQuantity}
                  onChange={e => setAllocateQuantity(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  min="1"
                  placeholder="จำนวน"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                <textarea
                  value={allocateNote}
                  onChange={e => setAllocateNote(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="เช่น โบนัสจากกิจกรรม..."
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-500">
                <p>สินค้า: <strong>{summaryQuotaProduct?.displayName}</strong></p>
                <p>รอบ: {allocateTarget.periodStart || '—'} — {allocateTarget.periodEnd || '—'}</p>
                <p>โควตาปัจจุบัน: {allocateTarget.totalQuota} | คงเหลือ: {allocateTarget.remaining}</p>
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-3">
              <button onClick={() => setShowAllocateModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                ยกเลิก
              </button>
              <button
                onClick={handleAllocate}
                disabled={!allocateQuantity || parseFloat(allocateQuantity) <= 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                เพิ่มโควตา
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ History Modal ============ */}
      {showHistoryModal && historyUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">
                ประวัติโควตา — {historyUser.userName}
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {historyData.length === 0 ? (
                <div className="text-center py-8 text-gray-400">ไม่มีประวัติ</div>
              ) : (
                <div className="space-y-2">
                  {historyData.map(alloc => (
                    <div key={alloc.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            alloc.source === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {alloc.source === 'admin' ? 'Admin' : 'Auto'}
                          </span>
                          <span className="font-medium text-gray-800">+{alloc.quantity}</span>
                        </div>
                        {alloc.sourceDetail && (
                          <p className="text-xs text-gray-400 mt-1">{alloc.sourceDetail}</p>
                        )}
                        {alloc.allocatedByFirstName && (
                          <p className="text-xs text-gray-400">โดย: {alloc.allocatedByFirstName} {alloc.allocatedByLastName}</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 text-right">
                        <div>{alloc.createdAt?.split(' ')[0]}</div>
                        {alloc.periodStart && <div>รอบ: {alloc.periodStart} — {alloc.periodEnd}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaSettingsPage;
