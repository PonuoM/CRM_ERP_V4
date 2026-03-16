import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Plus, Edit, Trash2, Calendar, DollarSign,
  ChevronDown, ChevronRight, Search, RefreshCcw,
  TrendingUp, Users, Clock, Gift, Eye, Settings,
  AlertCircle, CheckCircle, X, Filter
} from 'lucide-react';
import type { Product, User, QuotaProduct, QuotaRateSchedule, QuotaAllocation, QuotaSummary } from '../types';
import {
  listQuotaProducts, createQuotaProduct, createQuotaProductWithNew, updateQuotaProduct,
  listRateSchedules, createRateSchedule, updateRateSchedule, deleteRateSchedule, getActiveRate,
  getQuotaSummary, allocateQuota, listQuotaAllocations, confirmQuota,
  getSummaryByRate, bulkConfirmQuota,
} from '../services/quotaApi';
import { listProducts } from '../services/api';
import SingleDatePicker from '../components/SingleDatePicker';
import DateRangePicker from '../components/DateRangePicker';

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
  const [allRateSchedules, setAllRateSchedules] = useState<QuotaRateSchedule[]>([]);
  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState({
    salesPerQuota: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    orderDateField: 'order_date' as 'order_date' | 'delivery_date',
    quotaMode: 'reset' as 'reset' | 'cumulative' | 'confirm',
    resetType: 'monthly' as 'interval' | 'monthly',
    resetIntervalDays: '30',
    resetDayOfMonth: '1',
    resetAnchorDate: new Date().toISOString().split('T')[0],
    calcPeriodStart: '',
    calcPeriodEnd: '',
    usageStartDate: '',
    usageEndDate: '',
    requireConfirm: true,
    scopeProductIds: [] as number[],
  });
  const [editingRate, setEditingRate] = useState<QuotaRateSchedule | null>(null);

  // Rate tab filters
  const [rateFilterProducts, setRateFilterProducts] = useState<number[]>([]); // empty = show all
  const [rateFilterMode, setRateFilterMode] = useState<'' | 'reset' | 'cumulative' | 'confirm'>('');
  const [rateFilterDateFrom, setRateFilterDateFrom] = useState('');
  const [rateFilterDateTo, setRateFilterDateTo] = useState('');
  const [rateFilterDropdownOpen, setRateFilterDropdownOpen] = useState(false);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const rateFilterRef = React.useRef<HTMLDivElement>(null);

  // Summary tab
  const [summaryData, setSummaryData] = useState<QuotaSummary[]>([]);
  const [summaryRateId, setSummaryRateId] = useState<number | 'all'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // Allocation modal
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateTarget, setAllocateTarget] = useState<QuotaSummary | null>(null);
  const [allocateQuantity, setAllocateQuantity] = useState('');
  const [allocateNote, setAllocateNote] = useState('');

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyUser, setHistoryUser] = useState<QuotaSummary | null>(null);
  const [historyData, setHistoryData] = useState<QuotaAllocation[]>([]);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<QuotaRateSchedule | null>(null);

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

  // Close rate filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rateFilterRef.current && !rateFilterRef.current.contains(e.target as Node)) {
        setRateFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load rates when quota product is selected (for backward compat + summary tab)
  useEffect(() => {
    if (selectedQuotaProduct) {
      loadRates(selectedQuotaProduct.id || 'global');
    }
  }, [selectedQuotaProduct]);

  // Filtered rates from all rates
  const filteredRates = useMemo(() => {
    let result = [...allRateSchedules];
    // Filter by products
    if (rateFilterProducts.length > 0) {
      result = result.filter(r => {
        const rpid = r.quotaProductId;
        if (rateFilterProducts.includes(0)) {
          // "Global" selected — show rates where quotaProductId is null/0
          if (!rpid || rpid === 0) return true;
        }
        // Product-specific
        if (rpid && rateFilterProducts.includes(rpid)) return true;
        // Scoped rates that include selected products
        if ((!rpid || rpid === 0) && r.scopeProductIds && r.scopeProductIds.length > 0) {
          return r.scopeProductIds.some(id => rateFilterProducts.includes(id));
        }
        return false;
      });
    }
    // Filter by mode
    if (rateFilterMode) {
      result = result.filter(r => r.quotaMode === rateFilterMode);
    }
    // Filter by date range
    if (rateFilterDateFrom) {
      result = result.filter(r => r.effectiveDate >= rateFilterDateFrom);
    }
    if (rateFilterDateTo) {
      result = result.filter(r => r.effectiveDate <= rateFilterDateTo);
    }
    // Sort: newest effective date first
    result.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    return result;
  }, [allRateSchedules, rateFilterProducts, rateFilterMode, rateFilterDateFrom, rateFilterDateTo]);

  // Load summary when summary tab rate changes
  useEffect(() => {
    if (activeTab === 'summary') {
      loadSummaryByRateId(summaryRateId);
      // Also load all rates for the dropdown
      if (allRateSchedules.length === 0) {
        loadAllRatesForSummary();
      }
    }
  }, [summaryRateId, activeTab]);

  const loadAllRatesForSummary = async () => {
    try {
      // Load rates for all products + global
      const productRates: QuotaRateSchedule[] = [];
      for (const qp of quotaProducts) {
        const data = await listRateSchedules(qp.id);
        productRates.push(...data);
      }
      const globalRates = await listRateSchedules('global');
      productRates.push(...globalRates);
      // Dedupe by id
      const seen = new Set<number>();
      const unique: QuotaRateSchedule[] = [];
      for (const r of productRates) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          unique.push(r);
        }
      }
      setAllRateSchedules(unique);
    } catch (e) {
      console.error('Failed to load all rates', e);
    }
  };

  const loadRates = async (qpId: number | 'global') => {
    try {
      const data = await listRateSchedules(qpId);
      setRateSchedules(data);
    } catch (e) {
      console.error('Failed to load rates', e);
    }
  };

  const loadSummaryByRateId = async (rateId: number | 'all') => {
    setLoading(true);
    setSelectedUserIds([]);
    try {
      const data = await getSummaryByRate(companyId, rateId);
      setSummaryData(data);
    } catch (e) {
      console.error('Failed to load summary by rate', e);
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
    if (!selectedQuotaProduct || !rateForm.salesPerQuota || (!rateForm.effectiveDate && rateForm.quotaMode !== 'confirm')) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    // Validate confirm mode dates
    if (rateForm.quotaMode === 'confirm') {
      if (!rateForm.calcPeriodStart || !rateForm.calcPeriodEnd) {
        alert('กรุณาระบุช่วงออเดอร์คำนวณ (เริ่มต้น และ สิ้นสุด)');
        return;
      }
      if (rateForm.calcPeriodStart >= rateForm.calcPeriodEnd) {
        alert('ช่วงออเดอร์เริ่มต้นต้องน้อยกว่าสิ้นสุด');
        return;
      }
      if (!rateForm.usageStartDate) {
        alert('กรุณาระบุวันเริ่มใช้โควตา');
        return;
      }
      if (rateForm.usageEndDate && rateForm.usageStartDate >= rateForm.usageEndDate) {
        alert('วันเริ่มใช้ต้องน้อยกว่าวันหมดอายุ');
        return;
      }
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
          effectiveDate: rateForm.quotaMode === 'confirm' ? rateForm.calcPeriodStart : rateForm.effectiveDate,
          orderDateField: rateForm.orderDateField,
          quotaMode: rateForm.quotaMode,
          resetIntervalDays: parseInt(rateForm.resetIntervalDays) || 30,
          resetDayOfMonth: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'monthly') ? parseInt(rateForm.resetDayOfMonth) || 1 : null,
          resetAnchorDate: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'interval') ? rateForm.resetAnchorDate : null,
          calcPeriodStart: rateForm.quotaMode === 'confirm' ? rateForm.calcPeriodStart || null : null,
          calcPeriodEnd: rateForm.quotaMode === 'confirm' ? rateForm.calcPeriodEnd || null : null,
          usageStartDate: rateForm.quotaMode === 'confirm' ? rateForm.usageStartDate || null : null,
          usageEndDate: rateForm.quotaMode === 'confirm' ? rateForm.usageEndDate || null : null,
          requireConfirm: rateForm.quotaMode === 'confirm' ? rateForm.requireConfirm : undefined,
        });
      } else {
        // Create new rate
        await createRateSchedule({
          quotaProductId: selectedQuotaProduct.id,
          salesPerQuota: parseFloat(rateForm.salesPerQuota),
          effectiveDate: rateForm.quotaMode === 'confirm' ? rateForm.calcPeriodStart : rateForm.effectiveDate,
          orderDateField: rateForm.orderDateField,
          quotaMode: rateForm.quotaMode,
          resetIntervalDays: parseInt(rateForm.resetIntervalDays) || 30,
          resetDayOfMonth: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'monthly') ? parseInt(rateForm.resetDayOfMonth) || 1 : undefined,
          resetAnchorDate: (rateForm.quotaMode === 'reset' && rateForm.resetType === 'interval') ? rateForm.resetAnchorDate : undefined,
          calcPeriodStart: rateForm.quotaMode === 'confirm' ? rateForm.calcPeriodStart : undefined,
          calcPeriodEnd: rateForm.quotaMode === 'confirm' ? rateForm.calcPeriodEnd : undefined,
          usageStartDate: rateForm.quotaMode === 'confirm' ? rateForm.usageStartDate : undefined,
          usageEndDate: rateForm.quotaMode === 'confirm' ? rateForm.usageEndDate : undefined,
          requireConfirm: rateForm.quotaMode === 'confirm' ? rateForm.requireConfirm : undefined,
          scopeProductIds: rateForm.scopeProductIds.length > 0 ? rateForm.scopeProductIds : undefined,
          createdBy: currentUser.id,
        });
      }
      setShowRateForm(false);
      setEditingRate(null);
      loadAllRates();
      if (selectedQuotaProduct) loadRates(selectedQuotaProduct.id || 'global');
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  };

  // -- Allocation --
  const handleAllocate = async () => {
    if (!allocateTarget || !allocateQuantity) return;
    try {
      await allocateQuota({
        quotaProductId: allocateTarget.rateScheduleId || 0,
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
      loadSummaryByRateId(summaryRateId);
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

  useEffect(() => {
    if (activeQuotaProducts.length > 0 && !selectedQuotaProduct) {
      setSelectedQuotaProduct(activeQuotaProducts[0]);
    }
  }, [activeQuotaProducts]);

  // Load all rates when tab becomes active or products change
  const loadAllRates = useCallback(async () => {
    try {
      const promises: Promise<QuotaRateSchedule[]>[] = [
        listRateSchedules('global'),
        ...activeQuotaProducts.map(qp => listRateSchedules(qp.id)),
      ];
      const results = await Promise.all(promises);
      const all = results.flat();
      // Deduplicate by id
      const unique = Array.from(new Map(all.map(r => [r.id, r])).values());
      setAllRateSchedules(unique);
    } catch (e) {
      console.error('Failed to load all rates', e);
    }
  }, [activeQuotaProducts]);

  useEffect(() => {
    if (activeTab === 'rates' && activeQuotaProducts.length > 0) {
      loadAllRates();
    }
  }, [activeTab, loadAllRates]);

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
    <>
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
          {/* Filter Bar */}
          <div className="bg-white border rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700">ตัวกรอง</span>
              {(rateFilterProducts.length > 0 || rateFilterMode || rateFilterDateFrom || rateFilterDateTo) && (
                <button
                  onClick={() => { setRateFilterProducts([]); setRateFilterMode(''); setRateFilterDateFrom(''); setRateFilterDateTo(''); }}
                  className="text-xs text-red-500 hover:text-red-700 ml-auto"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Multi-select product filter */}
              <div className="relative" ref={rateFilterRef}>
                <label className="block text-xs font-medium text-gray-500 mb-1">สินค้า</label>
                <button
                  onClick={() => setRateFilterDropdownOpen(o => !o)}
                  className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2 bg-white hover:border-indigo-300 transition-colors min-w-[200px] justify-between"
                >
                  <span className="text-gray-600 truncate">
                    {rateFilterProducts.length === 0
                      ? 'ทั้งหมด'
                      : `เลือก ${rateFilterProducts.length} รายการ`}
                  </span>
                  {rateFilterProducts.length > 0 && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {rateFilterProducts.length}
                    </span>
                  )}
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                {rateFilterDropdownOpen && (
                  <div className="absolute z-30 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 w-[280px] max-h-60 overflow-y-auto">
                    <div className="p-2 border-b flex gap-2">
                      <button
                        onClick={() => setRateFilterProducts([0, ...activeQuotaProducts.map(qp => qp.id)])}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        เลือกทั้งหมด
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setRateFilterProducts([])}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        ล้าง
                      </button>
                    </div>
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={rateFilterProducts.includes(0)}
                        onChange={e => {
                          setRateFilterProducts(prev => e.target.checked ? [...prev, 0] : prev.filter(id => id !== 0));
                        }}
                        className="rounded text-indigo-600"
                      />
                      <span>🌐 Global</span>
                    </label>
                    {activeQuotaProducts.map(qp => (
                      <label key={qp.id} className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={rateFilterProducts.includes(qp.id)}
                          onChange={e => {
                            setRateFilterProducts(prev => e.target.checked ? [...prev, qp.id] : prev.filter(id => id !== qp.id));
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span className="truncate">{qp.displayName}</span>
                        {qp.productSku && <span className="text-gray-400 text-xs">({qp.productSku})</span>}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Rate type filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ประเภท Rate</label>
                <select
                  value={rateFilterMode}
                  onChange={e => setRateFilterMode(e.target.value as any)}
                  className="border rounded-lg px-3 py-2 text-sm min-w-[150px]"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="reset">รีเซ็ตตามรอบ</option>
                  <option value="cumulative">สะสม</option>
                  <option value="confirm">กำหนดเอง</option>
                </select>
              </div>

              {/* Date range filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">วันที่มีผล (จาก)</label>
                <input
                  type="date"
                  value={rateFilterDateFrom}
                  onChange={e => setRateFilterDateFrom(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">ถึง</label>
                <input
                  type="date"
                  value={rateFilterDateTo}
                  onChange={e => setRateFilterDateTo(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Create button */}
              <button
                onClick={() => {
                  setEditingRate(null);
                  // Always use Global context — scope dropdown determines products
                  setSelectedQuotaProduct({ id: 0, productId: 0, companyId: currentUser.companyId, displayName: '🌐 ทั้งหมด (Global)', isActive: true, quotaCost: 1 } as any);
                  setRateForm(prev => ({ ...prev, scopeProductIds: [] }));
                  setScopeDropdownOpen(false);
                  setShowRateForm(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 text-sm font-medium shadow-sm"
              >
                <Plus size={16} />
                อัตราใหม่
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              แสดง {filteredRates.length} จาก {allRateSchedules.length} รายการ
            </div>
          </div>

          {/* Rate Form Modal */}
          {showRateForm && selectedQuotaProduct && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-5 border-b flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {editingRate ? 'แก้ไขอัตราโควตา' : 'สร้างอัตราโควตาใหม่'}
                  </h3>
                  <button onClick={() => { setShowRateForm(false); setEditingRate(null); }} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  {/* 1. โหมดโควตา — top priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">โหมดโควตา</label>
                    <div className="flex gap-4">
                      <label className={`flex items-center gap-2 ${editingRate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="radio" name="quotaMode" value="reset" checked={rateForm.quotaMode === 'reset'} onChange={() => setRateForm(prev => ({ ...prev, quotaMode: 'reset' }))} className="accent-indigo-600" disabled={!!editingRate} />
                        <span className="text-sm">รีเซ็ตตามรอบ</span>
                      </label>
                      <label className={`flex items-center gap-2 ${editingRate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="radio" name="quotaMode" value="cumulative" checked={rateForm.quotaMode === 'cumulative'} onChange={() => setRateForm(prev => ({ ...prev, quotaMode: 'cumulative' }))} className="accent-indigo-600" disabled={!!editingRate} />
                        <span className="text-sm">สะสม</span>
                      </label>
                      <label className={`flex items-center gap-2 ${editingRate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input type="radio" name="quotaMode" value="confirm" checked={rateForm.quotaMode === 'confirm'} onChange={() => setRateForm(prev => ({ ...prev, quotaMode: 'confirm' }))} className="accent-indigo-600" disabled={!!editingRate} />
                        <span className="text-sm">กำหนดเอง</span>
                      </label>
                    </div>
                    {editingRate && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ ไม่สามารถเปลี่ยนโหมดได้ กรุณาสร้างอัตราใหม่แทน</p>
                    )}
                  </div>

                  {/* 2. ยอดขาย + คำนวณจากออเดอร์ตาม — same row */}
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                  {/* 3. สินค้าที่ใช้โควตานี้ได้ */}
                  {!editingRate && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">สินค้าที่ใช้โควตานี้ได้</label>
                      <p className="text-xs text-gray-500 mb-2">ไม่เลือก = ใช้ได้กับทุกสินค้า (Global)</p>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setScopeDropdownOpen(o => !o)}
                          className="w-full border rounded-lg px-3 py-2 text-sm flex items-center justify-between bg-white hover:border-indigo-300 transition-colors"
                        >
                          <span className="text-gray-600 truncate">
                            {rateForm.scopeProductIds.length === 0
                              ? '🌐 ทุกสินค้า (Global)'
                              : `📌 เลือก ${rateForm.scopeProductIds.length} สินค้า`}
                          </span>
                          {rateForm.scopeProductIds.length > 0 && (
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-1.5 py-0.5 rounded-full mr-1">
                              {rateForm.scopeProductIds.length}
                            </span>
                          )}
                          <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                        </button>
                        {scopeDropdownOpen && (
                          <div className="absolute z-30 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 w-full max-h-48 overflow-y-auto">
                            <div className="p-2 border-b flex gap-2">
                              <button type="button" onClick={() => setRateForm(prev => ({ ...prev, scopeProductIds: activeQuotaProducts.map(qp => qp.id) }))} className="text-xs text-indigo-600 hover:text-indigo-800">เลือกทั้งหมด</button>
                              <span className="text-gray-300">|</span>
                              <button type="button" onClick={() => setRateForm(prev => ({ ...prev, scopeProductIds: [] }))} className="text-xs text-gray-500 hover:text-gray-700">ล้าง (Global)</button>
                            </div>
                            {activeQuotaProducts.map(qp => (
                              <label key={qp.id} className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm">
                                <input
                                  type="checkbox"
                                  checked={rateForm.scopeProductIds.includes(qp.id)}
                                  onChange={e => {
                                    setRateForm(prev => ({
                                      ...prev,
                                      scopeProductIds: e.target.checked
                                        ? [...prev.scopeProductIds, qp.id]
                                        : prev.scopeProductIds.filter(id => id !== qp.id),
                                    }));
                                  }}
                                  className="rounded text-indigo-600"
                                />
                                <span className="truncate">{qp.displayName}</span>
                                {qp.productSku && <span className="text-gray-400 text-xs">({qp.productSku})</span>}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {rateForm.scopeProductIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rateForm.scopeProductIds.map(id => {
                            const qp = activeQuotaProducts.find(p => p.id === id);
                            return (
                              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">
                                {qp?.displayName || `#${id}`}
                                <button type="button" onClick={() => setRateForm(prev => ({ ...prev, scopeProductIds: prev.scopeProductIds.filter(sid => sid !== id) }))} className="hover:text-red-600">
                                  <X size={10} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. มีผลตั้งแต่วันที่ — for reset/cumulative modes */}
                  {rateForm.quotaMode !== 'confirm' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">มีผลตั้งแต่วันที่ *</label>
                      <SingleDatePicker
                        value={rateForm.effectiveDate}
                        onChange={v => setRateForm(prev => ({ ...prev, effectiveDate: v }))}
                        placeholder="เลือกวันที่มีผล"
                      />
                    </div>
                  )}

                  {/* 5. Reset mode options */}
                  {rateForm.quotaMode === 'reset' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">รูปแบบการรีเซ็ต</label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="resetType" value="monthly" checked={rateForm.resetType === 'monthly'} onChange={() => setRateForm(prev => ({ ...prev, resetType: 'monthly' }))} className="accent-indigo-600" />
                            <span className="text-sm">ทุกวันที่ X ของเดือน</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="resetType" value="interval" checked={rateForm.resetType === 'interval'} onChange={() => setRateForm(prev => ({ ...prev, resetType: 'interval' }))} className="accent-indigo-600" />
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
                        <div className="grid grid-cols-2 gap-4">
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
                            <SingleDatePicker
                              value={rateForm.resetAnchorDate}
                              onChange={v => setRateForm(prev => ({ ...prev, resetAnchorDate: v }))}
                              placeholder="เลือกวันเริ่มนับ"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 6. Confirm mode options */}
                  {rateForm.quotaMode === 'confirm' && (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                        <p className="font-medium">โหมดกำหนดเอง: กำหนดช่วงออเดอร์คำนวณ, วันเริ่มใช้งาน, วันหมดอายุ และรูปแบบการยืนยันได้อย่างอิสระ</p>
                      </div>
                      {/* ช่วงออเดอร์ที่ใช้คำนวณ — DateRangePicker on same row */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงออเดอร์ที่ใช้คำนวณ *</label>
                        <DateRangePicker
                          value={{
                            start: rateForm.calcPeriodStart ? rateForm.calcPeriodStart + 'T00:00:00' : new Date().toISOString(),
                            end: rateForm.calcPeriodEnd ? rateForm.calcPeriodEnd + 'T23:59:59' : new Date().toISOString(),
                          }}
                          onApply={range => {
                            setRateForm(prev => ({
                              ...prev,
                              calcPeriodStart: range.start.split('T')[0],
                              calcPeriodEnd: range.end.split('T')[0],
                            }));
                          }}
                        />
                      </div>
                      {/* Usage dates — same row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">โควตาเริ่มใช้งานได้ตั้งแต่วันที่ *</label>
                          <SingleDatePicker
                            value={rateForm.usageStartDate}
                            onChange={v => setRateForm(prev => ({ ...prev, usageStartDate: v }))}
                            placeholder="เลือกวันเริ่มใช้"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">โควตาหมดอายุวันที่</label>
                          <SingleDatePicker
                            value={rateForm.usageEndDate}
                            onChange={v => setRateForm(prev => ({ ...prev, usageEndDate: v }))}
                            placeholder="ไม่มีวันหมดอายุ"
                            disabled={!rateForm.usageEndDate && rateForm.usageEndDate === ''}
                          />
                          <label className="flex items-center gap-2 cursor-pointer mt-2">
                            <input
                              type="checkbox"
                              checked={!rateForm.usageEndDate}
                              onChange={e => setRateForm(prev => ({ ...prev, usageEndDate: e.target.checked ? '' : new Date().toISOString().split('T')[0] }))}
                              className="accent-indigo-600 w-4 h-4"
                            />
                            <span className="text-xs text-gray-500">ติ๊กเพื่อให้โควตาไม่มีวันหมดอายุ</span>
                          </label>
                        </div>
                      </div>
                      <div className="border rounded-lg p-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rateForm.requireConfirm}
                            onChange={e => setRateForm(prev => ({ ...prev, requireConfirm: e.target.checked }))}
                            className="accent-indigo-600 w-4 h-4"
                          />
                          <span className="text-sm font-medium text-gray-700">รอ Admin ยืนยันก่อนใช้งาน</span>
                        </label>
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          <p>✅ <strong>เปิด</strong>: โควตาจะถูก freeze ตอนที่ Admin กดยืนยัน คำนวณได้เท่าไหร่ก็ได้เท่านั้น ไม่เปลี่ยนแปลงภายหลัง</p>
                          <p>❌ <strong>ปิด</strong>: โควตาจะคำนวณอัตโนมัติตลอดเวลา หากมีออเดอร์เพิ่มในช่วงคำนวณ โควตาจะเพิ่มขึ้นอัตโนมัติ</p>
                        </div>
                      </div>
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

          {/* Rates List */}
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">รายการอัตราโควตา</h3>
            {filteredRates.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock size={36} className="mx-auto mb-2 text-gray-300" />
                <p>{allRateSchedules.length === 0 ? 'ยังไม่มีอัตราโควตา' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRates.map((rate) => {
                  const today = new Date().toISOString().split('T')[0];
                  const effectivePassed = rate.effectiveDate <= today;

                  // Determine status
                  let isActive = false;
                  let isFuture = !effectivePassed;
                  let isExpired = false;
                  let isBeforeUsage = false;
                  let statusLabel = '';
                  let statusColor = '';

                  if (rate.quotaMode === 'confirm') {
                    const usageStart = rate.usageStartDate || rate.effectiveDate;
                    const usageEnd = rate.usageEndDate;
                    const startOk = !usageStart || today >= usageStart;
                    const endOk = !usageEnd || today <= usageEnd;

                    if (usageEnd && today > usageEnd) {
                      isExpired = true;
                      statusLabel = 'หมดอายุ';
                      statusColor = 'bg-red-400 text-white';
                    } else if (usageStart && today < usageStart) {
                      isBeforeUsage = true;
                      isFuture = true;
                      statusLabel = 'ยังไม่เริ่มใช้';
                      statusColor = 'bg-amber-500 text-white';
                    } else if (effectivePassed && startOk && endOk) {
                      isActive = true;
                      statusLabel = 'ใช้งานอยู่';
                      statusColor = 'bg-indigo-600 text-white';
                    } else if (!effectivePassed) {
                      statusLabel = 'กำหนดล่วงหน้า';
                      statusColor = 'bg-amber-500 text-white';
                    }
                  } else {
                    // For mixed view, check if this is the latest effective for its product
                    if (effectivePassed) {
                      isActive = true;
                      statusLabel = 'ใช้งานอยู่';
                      statusColor = 'bg-indigo-600 text-white';
                    } else {
                      statusLabel = 'กำหนดล่วงหน้า';
                      statusColor = 'bg-amber-500 text-white';
                    }
                  }

                  // Resolve product name for card
                  const rpid = rate.quotaProductId;
                  const productLabel = (!rpid || rpid === 0)
                    ? null // global/scoped
                    : activeQuotaProducts.find(p => p.id === rpid)?.displayName || `สินค้า #${rpid}`;
                  const modeLabel = rate.quotaMode === 'reset'
                    ? (rate.resetDayOfMonth ? `รีเซ็ตทุกวันที่ ${rate.resetDayOfMonth}` : `รีเซ็ตทุก ${rate.resetIntervalDays} วัน`)
                    : rate.quotaMode === 'cumulative' ? 'สะสม' : 'กำหนดเอง';

                  return (
                    <div
                      key={rate.id}
                      className={`border rounded-lg p-4 ${
                        isActive ? 'border-indigo-300 bg-indigo-50' : (isFuture || isBeforeUsage) ? 'border-amber-200 bg-amber-50' : isExpired ? 'border-red-200 bg-red-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
                          {/* Product badge */}
                          {productLabel ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                              📦 {productLabel}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                              {rate.scopeProductIds && rate.scopeProductIds.length > 0
                                ? `📌 ${rate.scopeProductIds.map(id => activeQuotaProducts.find(p => p.id === id)?.displayName || `#${id}`).join(', ')}`
                                : '🌐 ทุกสินค้า'}
                            </span>
                          )}
                          <span className="font-semibold text-gray-800">
                            ฿{Number(rate.salesPerQuota).toLocaleString()} / 1 โควตา
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">มีผล: {rate.effectiveDate}</span>
                          <button
                            onClick={() => {
                              // Set context product for editing
                              if (!rpid || rpid === 0) {
                                setSelectedQuotaProduct({ id: 0, productId: 0, companyId: currentUser.companyId, displayName: '🌐 ทั้งหมด (Global)', isActive: true, quotaCost: 1 } as any);
                              } else {
                                const qp = activeQuotaProducts.find(x => x.id === rpid);
                                if (qp) setSelectedQuotaProduct(qp);
                              }
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
                                calcPeriodStart: rate.calcPeriodStart || '',
                                calcPeriodEnd: rate.calcPeriodEnd || '',
                                usageStartDate: rate.usageStartDate || '',
                                usageEndDate: rate.usageEndDate || '',
                                requireConfirm: rate.requireConfirm !== false,
                                scopeProductIds: rate.scopeProductIds || [],
                              });
                              setShowRateForm(true);
                            }}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
                            title="แก้ไข"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(rate)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                            title="ลบ"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span>🔄 {modeLabel}</span>
                        <span>📅 {rate.orderDateField === 'delivery_date' ? 'วันจัดส่ง' : 'วันสร้างออเดอร์'}</span>
                        {rate.quotaMode === 'reset' && rate.resetAnchorDate && (
                          <span>📌 Anchor: {rate.resetAnchorDate}</span>
                        )}
                        {rate.quotaMode === 'confirm' && rate.usageStartDate && (
                          <span>📅 ใช้ได้: {rate.usageStartDate}{rate.usageEndDate ? ` — ${rate.usageEndDate}` : ' เป็นต้นไป'}</span>
                        )}
                        {rate.createdByName && <span>👤 {rate.createdByName}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ Tab: Summary ============ */}
      {activeTab === 'summary' && (
        <div>
          {/* Rate Selector */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">เลือกอัตราโควตา</label>
              <select
                value={summaryRateId}
                onChange={e => {
                  const v = e.target.value;
                  setSummaryRateId(v === 'all' ? 'all' : parseInt(v));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">🔄 ทั้งหมด (รวมทุก rate)</option>
                {allRateSchedules.map(rate => {
                  const modeLabel = rate.quotaMode === 'reset' ? '🔁 รีเซ็ต' : rate.quotaMode === 'cumulative' ? '📈 สะสม' : '📋 กำหนดเอง';
                  const periodLabel = rate.quotaMode === 'confirm'
                    ? `${rate.calcPeriodStart || '?'} — ${rate.calcPeriodEnd || '?'}`
                    : `มีผล ${rate.effectiveDate}`;
                  const product = rate.quotaProductId
                    ? quotaProducts.find(qp => qp.id === rate.quotaProductId)
                    : null;
                  const productLabel = product ? product.displayName : 'ทุกสินค้า';
                  // Count pending users for confirm-mode rates
                  const pendingCount = rate.quotaMode === 'confirm' && rate.requireConfirm
                    ? summaryData.filter(s => s.rateScheduleId === rate.id && !s.isConfirmed && (s.pendingAutoQuota ?? 0) > 0).length
                    : 0;
                  return (
                    <option key={rate.id} value={rate.id}>
                      {modeLabel} ฿{Number(rate.salesPerQuota).toLocaleString()}/โควตา — {productLabel} — {periodLabel}
                      {pendingCount > 0 ? ` ⏳ ${pendingCount} รอยืนยัน` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <button
              onClick={() => loadSummaryByRateId(summaryRateId)}
              className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 text-sm mt-5"
            >
              <RefreshCcw size={14} />
              รีเฟรช
            </button>
          </div>

          {/* Period Info */}
          {summaryData.length > 0 && summaryData[0].periodStart && summaryRateId !== 'all' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700 flex items-center gap-2">
              <Calendar size={16} />
              <span>
                {summaryData[0].quotaMode === 'confirm'
                  ? `ช่วงออเดอร์คำนวณ: ${summaryData[0].periodStart} — ${summaryData[0].periodEnd} (กำหนดเอง)`
                  : `รอบปัจจุบัน: ${summaryData[0].periodStart} — ${summaryData[0].periodEnd} (${summaryData[0].quotaMode === 'reset' ? 'รีเซ็ตตามรอบ' : 'สะสม'})`
                }
              </span>
            </div>
          )}

          {/* Bulk Confirm Bar */}
          {selectedUserIds.length > 0 && summaryRateId !== 'all' && (() => {
            const selectedRate = allRateSchedules.find(r => r.id === summaryRateId);
            if (!selectedRate || selectedRate.quotaMode !== 'confirm' || !selectedRate.requireConfirm) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
                <span className="text-sm text-amber-700">
                  เลือก {selectedUserIds.length} คน
                </span>
                <button
                  onClick={async () => {
                    if (!confirm(`ยืนยันโควตาให้ ${selectedUserIds.length} คน?`)) return;
                    try {
                      const res = await bulkConfirmQuota({
                        rateScheduleId: summaryRateId as number,
                        userIds: selectedUserIds,
                        confirmedBy: currentUser.id,
                        companyId,
                      });
                      alert(`ยืนยันสำเร็จ ${res.confirmed} คน`);
                      setSelectedUserIds([]);
                      loadSummaryByRateId(summaryRateId);
                    } catch (e) {
                      alert('Error: ' + (e as Error).message);
                    }
                  }}
                  className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 flex items-center gap-2"
                >
                  <CheckCircle size={14} />
                  ยืนยันโควตา {selectedUserIds.length} คน
                </button>
              </div>
            );
          })()}

          {/* Summary Table */}
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {/* Checkbox column — only for confirm-mode single rate */}
                  {summaryRateId !== 'all' && (() => {
                    const selectedRate = allRateSchedules.find(r => r.id === summaryRateId);
                    if (selectedRate?.quotaMode === 'confirm' && selectedRate?.requireConfirm) {
                      const unconfirmedUsers = summaryData.filter(s => !s.isConfirmed && !s.isBeforeUsageStart && (s.pendingAutoQuota ?? 0) > 0);
                      const allSelected = unconfirmedUsers.length > 0 && unconfirmedUsers.every(u => selectedUserIds.includes(u.userId));
                      return (
                        <th className="px-3 py-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds(unconfirmedUsers.map(u => u.userId));
                              } else {
                                setSelectedUserIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </th>
                      );
                    }
                    return null;
                  })()}
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
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                      <p className="mt-2">กำลังโหลด...</p>
                    </td>
                  </tr>
                ) : summaryData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      <Users size={40} className="mx-auto mb-3 text-gray-300" />
                      <p>ไม่มีข้อมูล</p>
                    </td>
                  </tr>
                ) : (
                  summaryData.map(row => {
                    const isConfirmMode = summaryRateId !== 'all' && (() => {
                      const selectedRate = allRateSchedules.find(r => r.id === summaryRateId);
                      return selectedRate?.quotaMode === 'confirm' && selectedRate?.requireConfirm;
                    })();
                    const canCheck = isConfirmMode && !row.isConfirmed && !row.isBeforeUsageStart && (row.pendingAutoQuota ?? 0) > 0;

                    return (
                      <tr key={row.userId} className="hover:bg-gray-50">
                        {/* Checkbox cell */}
                        {isConfirmMode && (
                          <td className="px-3 py-3 text-center">
                            {canCheck ? (
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(row.userId)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUserIds(prev => [...prev, row.userId]);
                                  } else {
                                    setSelectedUserIds(prev => prev.filter(id => id !== row.userId));
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                            ) : row.isConfirmed ? (
                              <CheckCircle size={14} className="text-green-500 mx-auto" />
                            ) : null}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{row.userName}</div>
                          <div className="text-xs text-gray-400">{row.role}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-600">
                          ฿{Number(row.totalSales).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600 font-medium">
                          {Number(row.totalAutoQuota)}
                          {isConfirmMode && !row.isConfirmed && (row.pendingAutoQuota ?? 0) > 0 && (
                            <div className="text-xs text-amber-500">({row.pendingAutoQuota} รอ)</div>
                          )}
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
                            row.isExpired ? 'text-gray-400 line-through' :
                            row.isBeforeUsageStart ? 'text-gray-400' :
                            Number(row.remaining) > 0 ? 'text-green-600' : Number(row.remaining) === 0 ? 'text-gray-400' : 'text-red-600'
                          }`}>
                            {row.isExpired ? '0 (หมดอายุ)' : row.isBeforeUsageStart ? '0 (ยังไม่เริ่มใช้)' : Number(row.remaining)}
                          </span>
                          {row.usageEndDate && !row.isExpired && !row.isBeforeUsageStart && (
                            <div className="text-xs text-amber-500 mt-0.5">หมดอายุ: {row.usageEndDate}</div>
                          )}
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
                            {row.quotaMode === 'confirm' && row.rateScheduleId && row.requireConfirm === 1 && !row.isBeforeUsageStart && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await bulkConfirmQuota({
                                      rateScheduleId: row.rateScheduleId!,
                                      userIds: [row.userId],
                                      confirmedBy: currentUser.id,
                                      companyId,
                                    });
                                    const r = res.results?.[0];
                                    alert(`ยืนยันโควตาสำเร็จ (${r?.confirmedQuota ?? 0} โควตา จากยอดขาย ฿${Number(r?.totalSales ?? 0).toLocaleString()})`);
                                    loadSummaryByRateId(summaryRateId);
                                  } catch (e) {
                                    alert('Error: ' + (e as Error).message);
                                  }
                                }}
                                className={`p-1 rounded ${row.isConfirmed ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}`}
                                title={row.isConfirmed ? `ยืนยันแล้ว (กดเพื่ออัปเดต)` : `กดยืนยันโควตา (${row.pendingAutoQuota ?? 0} รอยืนยัน)`}
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
                <p>อัตรา: <strong>{summaryRateId === 'all' ? 'ทั้งหมด' : `Rate #${summaryRateId}`}</strong></p>
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

    {/* Delete Confirm Modal */}
    {deleteTarget && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">ยืนยันการลบ</h3>
          </div>
          <p className="text-sm text-gray-600 mb-1">ต้องการลบอัตราโควตานี้หรือไม่?</p>
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
            <p className="font-medium text-gray-800">฿{Number(deleteTarget.salesPerQuota).toLocaleString()} / 1 โควตา</p>
            <p className="text-gray-500">มีผล: {deleteTarget.effectiveDate}</p>
            <p className="text-gray-500">Mode: {deleteTarget.quotaMode === 'reset' ? 'รีเซ็ตตามรอบ' : deleteTarget.quotaMode === 'cumulative' ? 'สะสม' : 'กำหนดเอง'}</p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={async () => {
                try {
                  await deleteRateSchedule(deleteTarget.id);
                  loadAllRates();
                } catch (e) { console.error(e); }
                setDeleteTarget(null);
              }}
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              ลบอัตราโควตา
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default QuotaSettingsPage;
