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
  getSummaryByRate, bulkConfirmQuota, getUserQuotaDetail, getPendingCounts,
} from '../services/quotaApi';
import type { UserQuotaDetailItem } from '../services/quotaApi';
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
    rateName: '',
    salesPerQuota: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    orderDateField: 'order_date' as 'order_date' | 'delivery_date',
    calcPeriodStart: '',
    calcPeriodEnd: '',
    usageStartDate: '',
    usageEndDate: '',
    requireConfirm: true,
    scopeRates: [] as Array<{ quotaProductId: number; salesPerQuota: string }>,
  });
  const [editingRate, setEditingRate] = useState<QuotaRateSchedule | null>(null);
  const [allProductsMode, setAllProductsMode] = useState(false);
  const [allProductsSalesPerQuota, setAllProductsSalesPerQuota] = useState('');

  // Rate tab filters
  const [rateFilterProducts, setRateFilterProducts] = useState<number[]>([]); // empty = show all
  const [rateFilterDateFrom, setRateFilterDateFrom] = useState('');
  const [rateFilterDateTo, setRateFilterDateTo] = useState('');
  const [rateFilterDropdownOpen, setRateFilterDropdownOpen] = useState(false);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const rateFilterRef = React.useRef<HTMLDivElement>(null);

  // Summary tab
  const [summaryData, setSummaryData] = useState<QuotaSummary[]>([]);
  const [summaryRateId, setSummaryRateId] = useState<number | 'all'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [pendingCountsMap, setPendingCountsMap] = useState<Record<number, number>>({});
  const [pendingCountsLoading, setPendingCountsLoading] = useState(false);
  const [rateSelectorOpen, setRateSelectorOpen] = useState(false);
  const rateSelectorRef = React.useRef<HTMLDivElement>(null);

  // Allocation modal
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateTarget, setAllocateTarget] = useState<QuotaSummary | null>(null);
  const [allocateQuantity, setAllocateQuantity] = useState('');
  const [allocateNote, setAllocateNote] = useState('');
  const [allocateValidFrom, setAllocateValidFrom] = useState('');
  const [allocateValidUntil, setAllocateValidUntil] = useState('');
  const [allocateAllProducts, setAllocateAllProducts] = useState(true);
  const [allocateProductIds, setAllocateProductIds] = useState<number[]>([]);

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyUser, setHistoryUser] = useState<QuotaSummary | null>(null);
  const [historyData, setHistoryData] = useState<QuotaAllocation[]>([]);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<QuotaRateSchedule | null>(null);

  // Bulk confirm loading
  const [bulkConfirming, setBulkConfirming] = useState(false);

  // Quota breakdown modal
  const [breakdownUser, setBreakdownUser] = useState<QuotaSummary | null>(null);
  const [breakdownData, setBreakdownData] = useState<UserQuotaDetailItem[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

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

  // Close rate selector dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rateSelectorRef.current && !rateSelectorRef.current.contains(e.target as Node)) {
        setRateSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load rates when quota product is selected (for backward compat + summary tab)
  useEffect(() => {
    if (selectedQuotaProduct) {
      // Not needed anymore — rates loaded via companyId
    }
  }, [selectedQuotaProduct]);

  // Filtered rates from all rates
  const filteredRates = useMemo(() => {
    let result = [...allRateSchedules];
    // Filter by products
    if (rateFilterProducts.length > 0) {
      result = result.filter(r => {
        // Check if any scope rate's product matches
        if (r.scopeRates && r.scopeRates.length > 0) {
          return r.scopeRates.some(sr => rateFilterProducts.includes(sr.quotaProductId));
        }
        return false;
      });
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
  }, [allRateSchedules, rateFilterProducts, rateFilterDateFrom, rateFilterDateTo]);

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

  // Pre-load pending counts for all confirm-mode rates when summary tab opens
  useEffect(() => {
    if (activeTab === 'summary' && companyId) {
      setPendingCountsLoading(true);
      getPendingCounts(companyId).then(counts => {
        setPendingCountsMap(counts);
      }).catch(e => console.error('Failed to load pending counts', e))
        .finally(() => setPendingCountsLoading(false));
    }
  }, [activeTab, companyId]);

  const loadAllRatesForSummary = async () => {
    try {
      const rates = await listRateSchedules(companyId);
      setAllRateSchedules(rates);
    } catch (e) {
      console.error('Failed to load all rates', e);
    }
  };

  const loadRates = async () => {
    try {
      const data = await listRateSchedules(companyId);
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
    // Build effective scope rates — expand allProductsMode if needed
    let effectiveScopeRates = rateForm.scopeRates;
    if (allProductsMode && !editingRate) {
      const spq = allProductsSalesPerQuota;
      if (!spq || parseFloat(spq) <= 0) {
        alert('กรุณากรอกยอดขาย/โควตา');
        return;
      }
      if (activeQuotaProducts.length === 0) {
        alert('ยังไม่มีสินค้าโควตา กรุณาสร้างสินค้าโควตาก่อน');
        return;
      }
      effectiveScopeRates = activeQuotaProducts.map(qp => ({ quotaProductId: qp.id, salesPerQuota: spq }));
    }

    // Validate scope rates
    if (effectiveScopeRates.length === 0 && !editingRate) {
      alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    // Check all scope rates have salesPerQuota
    const invalidRate = effectiveScopeRates.find(sr => !sr.salesPerQuota || parseFloat(sr.salesPerQuota) <= 0);
    if (invalidRate) {
      const qp = activeQuotaProducts.find(p => p.id === invalidRate.quotaProductId);
      alert(`กรุณากรอกยอดขาย/โควตาของ ${qp?.displayName || 'สินค้า'}`);
      return;
    }

    // Validate confirm mode dates
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

    try {
      const scopeRatesPayload = effectiveScopeRates.map(sr => ({
        quotaProductId: sr.quotaProductId,
        salesPerQuota: parseFloat(sr.salesPerQuota),
      }));

      if (editingRate) {
        await updateRateSchedule({
          id: editingRate.id,
          rateName: rateForm.rateName || undefined,
          salesPerQuota: scopeRatesPayload[0]?.salesPerQuota || parseFloat(rateForm.salesPerQuota) || 1,
          effectiveDate: rateForm.calcPeriodStart,
          orderDateField: rateForm.orderDateField,
          calcPeriodStart: rateForm.calcPeriodStart || null,
          calcPeriodEnd: rateForm.calcPeriodEnd || null,
          usageStartDate: rateForm.usageStartDate || null,
          usageEndDate: rateForm.usageEndDate || null,
          requireConfirm: rateForm.requireConfirm,
          scopeRates: scopeRatesPayload,
        });
      } else {
        await createRateSchedule({
          rateName: rateForm.rateName || undefined,
          salesPerQuota: scopeRatesPayload[0]?.salesPerQuota || parseFloat(rateForm.salesPerQuota) || 1,
          effectiveDate: rateForm.calcPeriodStart,
          orderDateField: rateForm.orderDateField,
          calcPeriodStart: rateForm.calcPeriodStart,
          calcPeriodEnd: rateForm.calcPeriodEnd,
          usageStartDate: rateForm.usageStartDate,
          usageEndDate: rateForm.usageEndDate || undefined,
          requireConfirm: rateForm.requireConfirm,
          scopeRates: scopeRatesPayload,
          createdBy: currentUser.id,
        });
      }
      setShowRateForm(false);
      setEditingRate(null);
      setAllProductsMode(false);
      setAllProductsSalesPerQuota('');
      loadAllRates();
    } catch (e) {
      alert('Error: ' + (e as Error).message);
    }
  };

  // -- Allocation --
  const handleAllocate = async () => {
    if (!allocateTarget || !allocateQuantity) return;
    // Determine which product IDs to allocate
    const targetIds = allocateAllProducts
      ? activeQuotaProducts.map(qp => qp.id)
      : allocateProductIds;
    if (targetIds.length === 0) {
      alert('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
      return;
    }
    try {
      const qty = parseFloat(allocateQuantity);
      const promises = targetIds.map(qpId =>
        allocateQuota({
          quotaProductId: qpId,
          userId: allocateTarget.userId,
          companyId,
          quantity: qty,
          source: 'admin',
          sourceDetail: allocateNote || 'Admin เพิ่มโควตาเอง',
          allocatedBy: currentUser.id,
          validFrom: allocateValidFrom || undefined,
          validUntil: allocateValidUntil || undefined,
        })
      );
      await Promise.all(promises);
      setShowAllocateModal(false);
      setAllocateQuantity('');
      setAllocateNote('');
      setAllocateValidFrom('');
      setAllocateValidUntil('');
      setAllocateAllProducts(true);
      setAllocateProductIds([]);
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
      const all = await listRateSchedules(companyId);
      setAllRateSchedules(all);
    } catch (e) {
      console.error('Failed to load all rates', e);
    }
  }, [companyId]);

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
      {/* ===== Clean White Header ===== */}
      <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-emerald-100 p-2.5 rounded-xl">
              <Package size={24} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">ระบบสินค้าโควตา</h1>
              <p className="text-gray-400 text-sm">จัดการโควตาสินค้าตามยอดขายของพนักงาน</p>
            </div>
          </div>
          {/* Stats bar */}
          <div className="flex gap-4 mt-4">
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <Package size={14} className="text-emerald-500" />
              <span className="text-sm font-medium text-gray-700">{quotaProducts.length} สินค้า</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <Settings size={14} className="text-teal-500" />
              <span className="text-sm font-medium text-gray-700">{allRateSchedules.length} อัตรา</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <Users size={14} className="text-emerald-500" />
              <span className="text-sm font-medium text-gray-700">{summaryData.length} พนักงาน</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Pill Tabs ===== */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ Tab: Products ============ */}
      {activeTab === 'products' && (
        <div className="animate-[fadeIn_0.2s_ease-out]">
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
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all text-sm font-medium shadow-md"
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
                            ? 'bg-emerald-600 text-white'
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
                            ? 'bg-emerald-600 text-white'
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU ที่แสดงใน CSV Export</label>
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
                  <button onClick={handleSaveProduct} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                    {editingProduct ? 'บันทึก' : 'เพิ่ม'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Product Table */}
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-emerald-50/30 border-b">
                <tr>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">สินค้า</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">ชื่อในระบบ</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">SKU ใน CSV</th>
                  <th className="px-5 py-3.5 text-center font-semibold text-gray-600 text-xs uppercase tracking-wider">ต้นทุนโควตา</th>
                  <th className="px-5 py-3.5 text-center font-semibold text-gray-600 text-xs uppercase tracking-wider">สถานะ</th>
                  <th className="px-5 py-3.5 text-center font-semibold text-gray-600 text-xs uppercase tracking-wider">การดำเนินการ</th>
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
                    <tr key={qp.id} className={`transition-colors ${!qp.isActive ? 'opacity-50 bg-gray-50' : 'hover:bg-emerald-50/40'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{qp.productSku || `#${qp.productId}`}</div>
                        <div className="text-xs text-gray-400">{qp.productName || '—'}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-700">{qp.displayName}</td>
                      <td className="px-4 py-3 text-gray-500">{qp.csvLabel || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-700">
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
                          className="text-gray-400 hover:text-emerald-600 p-1"
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
        <div className="animate-[fadeIn_0.2s_ease-out]">
          {/* Filter Bar */}
          <div className="bg-white border rounded-2xl p-4 mb-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-emerald-500" />
              <span className="text-sm font-semibold text-gray-700">ตัวกรอง</span>
              {(rateFilterProducts.length > 0 || rateFilterDateFrom || rateFilterDateTo) && (
                <button
                  onClick={() => { setRateFilterProducts([]); setRateFilterDateFrom(''); setRateFilterDateTo(''); }}
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
                  className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2 bg-white hover:border-emerald-300 transition-colors min-w-[200px] justify-between"
                >
                  <span className="text-gray-600 truncate">
                    {rateFilterProducts.length === 0
                      ? 'ทั้งหมด'
                      : `เลือก ${rateFilterProducts.length} รายการ`}
                  </span>
                  {rateFilterProducts.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {rateFilterProducts.length}
                    </span>
                  )}
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                {rateFilterDropdownOpen && (
                  <div className="absolute z-30 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 w-[280px] max-h-60 overflow-y-auto">
                    <div className="p-2 border-b flex gap-2">
                      <button
                        onClick={() => setRateFilterProducts(activeQuotaProducts.map(qp => qp.id))}
                        className="text-xs text-emerald-600 hover:text-emerald-800"
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
                    {activeQuotaProducts.map(qp => (
                      <label key={qp.id} className="flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={rateFilterProducts.includes(qp.id)}
                          onChange={e => {
                            setRateFilterProducts(prev => e.target.checked ? [...prev, qp.id] : prev.filter(id => id !== qp.id));
                          }}
                          className="rounded text-emerald-600"
                        />
                        <span className="truncate">{qp.displayName}</span>
                        {qp.productSku && <span className="text-gray-400 text-xs">({qp.productSku})</span>}
                      </label>
                    ))}
                  </div>
                )}
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
                  setRateForm({
                    rateName: '',
                    salesPerQuota: '',
                    effectiveDate: new Date().toISOString().split('T')[0],
                    orderDateField: 'order_date',
                    calcPeriodStart: '',
                    calcPeriodEnd: '',
                    usageStartDate: '',
                    usageEndDate: '',
                    requireConfirm: true,
                    scopeRates: [],
                  });
                  setScopeDropdownOpen(false);
                  setShowRateForm(true);
                }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all text-sm font-medium shadow-md"
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
          {showRateForm && (
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
                  {/* 0. ชื่ออัตราโควตา */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่ออัตราโควตา</label>
                    <input
                      type="text"
                      value={rateForm.rateName}
                      onChange={e => setRateForm(prev => ({ ...prev, rateName: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="เช่น โควตาเดือนมีนาคม, โควตาสินค้าพิเศษ (ไม่บังคับ)"
                    />
                  </div>

                  {/* 1. สินค้าและยอดขาย/โควตา — per-product rate table */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">สินค้าและยอดขาย/โควตา *</label>
                    {/* All products mode toggle */}
                    {!editingRate && (
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={allProductsMode}
                          onChange={e => {
                            setAllProductsMode(e.target.checked);
                            if (e.target.checked) {
                              setRateForm(prev => ({ ...prev, scopeRates: [] }));
                            } else {
                              setAllProductsSalesPerQuota('');
                            }
                          }}
                          className="accent-emerald-600 w-4 h-4"
                        />
                        <span className="text-sm text-emerald-700 font-medium">สินค้าทั้งหมด ({activeQuotaProducts.length} รายการ)</span>
                      </label>
                    )}

                    {allProductsMode && !editingRate ? (
                      /* All products mode — single salesPerQuota input */
                      <div>
                        <p className="text-xs text-gray-500 mb-2">กำหนดยอดขาย (บาท) ต่อ 1 โควตา เท่ากันทุกสินค้า</p>
                        <div className="bg-white rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <label className="text-sm text-gray-600 whitespace-nowrap">ยอดขาย (฿) / 1 โควตา</label>
                            <input
                              type="number"
                              value={allProductsSalesPerQuota}
                              onChange={e => setAllProductsSalesPerQuota(e.target.value)}
                              className="flex-1 border rounded px-3 py-2 text-sm text-right"
                              placeholder="5000"
                              min="1"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {activeQuotaProducts.map(qp => (
                              <span key={qp.id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                {qp.displayName}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Per-product mode — individual selection */
                      <>
                        <p className="text-xs text-gray-500 mb-2">เลือกสินค้าที่ต้องการ แล้วกำหนดยอดขาย (บาท) ต่อ 1 โควตา ให้แต่ละสินค้า</p>
                        {/* Add product buttons */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {activeQuotaProducts
                            .filter(qp => !rateForm.scopeRates.some(sr => sr.quotaProductId === qp.id))
                            .map(qp => (
                              <button
                                key={qp.id}
                                type="button"
                                onClick={() => setRateForm(prev => ({ ...prev, scopeRates: [...prev.scopeRates, { quotaProductId: qp.id, salesPerQuota: '' }] }))}
                                className="text-xs px-2.5 py-1.5 rounded-full border border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition-colors"
                              >
                                + {qp.displayName}
                              </button>
                            ))}
                          {activeQuotaProducts.length > 0 && rateForm.scopeRates.length < activeQuotaProducts.length && (
                            <button
                              type="button"
                              onClick={() => {
                                const allRates = activeQuotaProducts
                                  .filter(qp => !rateForm.scopeRates.some(sr => sr.quotaProductId === qp.id))
                                  .map(qp => ({ quotaProductId: qp.id, salesPerQuota: '' }));
                                setRateForm(prev => ({ ...prev, scopeRates: [...prev.scopeRates, ...allRates] }));
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium"
                            >
                              + เพิ่มทั้งหมด
                            </button>
                          )}
                        </div>
                        {/* Scope rates table */}
                        {rateForm.scopeRates.length > 0 && (
                          <div className="bg-white rounded-lg border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">สินค้า</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-40">ยอดขาย (฿) / 1 โควตา</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {rateForm.scopeRates.map((sr, idx) => {
                                  const qp = activeQuotaProducts.find(p => p.id === sr.quotaProductId);
                                  return (
                                    <tr key={sr.quotaProductId} className="hover:bg-gray-50">
                                      <td className="px-3 py-2">
                                        <span className="font-medium text-gray-700">{qp?.displayName || `#${sr.quotaProductId}`}</span>
                                        {qp?.productSku && <span className="text-gray-400 text-xs ml-1">({qp.productSku})</span>}
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          value={sr.salesPerQuota}
                                          onChange={e => {
                                            const newRates = [...rateForm.scopeRates];
                                            newRates[idx] = { ...newRates[idx], salesPerQuota: e.target.value };
                                            setRateForm(prev => ({ ...prev, scopeRates: newRates }));
                                          }}
                                          className="w-full border rounded px-2 py-1 text-sm text-right"
                                          placeholder="5000"
                                          min="1"
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => setRateForm(prev => ({ ...prev, scopeRates: prev.scopeRates.filter((_, i) => i !== idx) }))}
                                          className="text-gray-400 hover:text-red-600"
                                        >
                                          <X size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {rateForm.scopeRates.length === 0 && (
                          <div className="text-center py-4 text-gray-400 text-xs">
                            คลิกปุ่มสินค้าด้านบนเพื่อเพิ่ม
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 2. คำนวณจากออเดอร์ตาม */}
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

                  {/* 3. ช่วงออเดอร์ที่ใช้คำนวณ */}
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
                  {/* 4. วันเริ่มใช้ + หมดอายุ */}
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
                          className="accent-emerald-600 w-4 h-4"
                        />
                        <span className="text-xs text-gray-500">ติ๊กเพื่อให้โควตาไม่มีวันหมดอายุ</span>
                      </label>
                    </div>
                  </div>
                  {/* 5. การยืนยัน */}
                  <div className="border rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rateForm.requireConfirm}
                        onChange={e => setRateForm(prev => ({ ...prev, requireConfirm: e.target.checked }))}
                        className="accent-emerald-600 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">รอ Admin ยืนยันก่อนใช้งาน</span>
                    </label>
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>✅ <strong>เปิด</strong>: โควตาจะถูก freeze ตอนที่ Admin กดยืนยัน คำนวณได้เท่าไหร่ก็ได้เท่านั้น ไม่เปลี่ยนแปลงภายหลัง</p>
                      <p>❌ <strong>ปิด</strong>: โควตาจะคำนวณอัตโนมัติตลอดเวลา หากมีออเดอร์เพิ่มในช่วงคำนวณ โควตาจะเพิ่มขึ้นอัตโนมัติ</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 border-t flex justify-end gap-3">
                  <button onClick={() => setShowRateForm(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    ยกเลิก
                  </button>
                  <button onClick={handleSaveRate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                    บันทึก
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rates List */}
          <div className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
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

                  // All rates are now confirm mode — use usage dates for status
                  {
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
                    } else if (startOk && endOk) {
                      isActive = true;
                      statusLabel = 'ใช้งานอยู่';
                      statusColor = 'bg-emerald-600 text-white';
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
                  const modeLabel = 'กำหนดเอง';

                  return (
                    <div
                      key={rate.id}
                      className={`border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${
                        isActive ? 'border-emerald-300 bg-emerald-50/70 shadow-sm border-l-4 border-l-emerald-500' : (isFuture || isBeforeUsage) ? 'border-amber-200 bg-amber-50/70 border-l-4 border-l-amber-400' : isExpired ? 'border-red-200 bg-red-50/70 border-l-4 border-l-red-400' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Row 1: Status + Rate Name + Price + Actions */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor}`}>{statusLabel}</span>
                          <span className="font-semibold text-gray-800">
                            {rate.rateName || 'อัตราโควตา'}
                          </span>
                          <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-lg font-medium">
                            ฿{Number(rate.salesPerQuota).toLocaleString()} / 1 โควตา
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 mr-1">มีผล: {rate.effectiveDate}</span>
                          <button
                            onClick={() => {
                              if (!rpid || rpid === 0) {
                                setSelectedQuotaProduct({ id: 0, productId: 0, companyId: currentUser.companyId, displayName: '🌐 ทั้งหมด (Global)', isActive: true, quotaCost: 1 } as any);
                              } else {
                                const qp = activeQuotaProducts.find(x => x.id === rpid);
                                if (qp) setSelectedQuotaProduct(qp);
                              }
                              setEditingRate(rate);
                              setRateForm({
                                rateName: rate.rateName || '',
                                salesPerQuota: String(rate.salesPerQuota),
                                effectiveDate: rate.effectiveDate,
                                orderDateField: rate.orderDateField,
                                calcPeriodStart: rate.calcPeriodStart || '',
                                calcPeriodEnd: rate.calcPeriodEnd || '',
                                usageStartDate: rate.usageStartDate || '',
                                usageEndDate: rate.usageEndDate || '',
                                requireConfirm: rate.requireConfirm !== false,
                                scopeRates: (rate.scopeRates || []).map(sr => ({
                                  quotaProductId: sr.quotaProductId,
                                  salesPerQuota: String(sr.salesPerQuota),
                                })),
                              });
                              setShowRateForm(true);
                            }}
                            className="p-1 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
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

                      {/* Row 2: Product pill badges */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {productLabel ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                            📦 {productLabel}
                          </span>
                        ) : (
                          rate.scopeRates && rate.scopeRates.length > 0
                            ? rate.scopeRates.map((sr, idx) => (
                              <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 font-medium">
                                📦 {sr.displayName || activeQuotaProducts.find(p => p.id === sr.quotaProductId)?.displayName || `#${sr.quotaProductId}`}
                                {sr.salesPerQuota && Number(sr.salesPerQuota) !== Number(rate.salesPerQuota)
                                  ? ` (฿${Number(sr.salesPerQuota).toLocaleString()})`
                                  : ''}
                              </span>
                            ))
                            : <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">ไม่มีสินค้า</span>
                        )}
                      </div>

                      {/* Row 3: Dates + Creator */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          📅 {rate.orderDateField === 'delivery_date' ? 'วันจัดส่ง' : 'วันสร้างออเดอร์'}
                          {rate.calcPeriodStart && <span className="text-gray-500 ml-0.5">({rate.calcPeriodStart} — {rate.calcPeriodEnd || '?'})</span>}
                        </span>
                        {rate.usageStartDate && (
                          <span className="flex items-center gap-1">
                            🎫 ใช้ได้: {rate.usageStartDate}{rate.usageEndDate ? ` — ${rate.usageEndDate}` : ' เป็นต้นไป'}
                          </span>
                        )}
                        {rate.createdByName && <span className="flex items-center gap-1">👤 {rate.createdByName}</span>}
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
        <div className="animate-[fadeIn_0.2s_ease-out]">
          {/* Rate Selector */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">เลือกอัตราโควตา</label>
              <div ref={rateSelectorRef} className="relative">
                <button
                  type="button"
                  onClick={() => setRateSelectorOpen(!rateSelectorOpen)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white shadow-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all flex items-center justify-between text-left"
                >
                  <span className="flex items-center gap-2 flex-wrap">
                    {summaryRateId === 'all' ? (
                      <span>🔄 ทั้งหมด (รวมทุก rate)</span>
                    ) : (() => {
                      const selRate = allRateSchedules.find(r => r.id === Number(summaryRateId));
                      if (!selRate) return <span>เลือกอัตราโควตา</span>;
                      const pc = pendingCountsMap[selRate.id] ?? 0;
                      const label = selRate.rateName || `📋 กำหนดเอง ฿${Number(selRate.salesPerQuota).toLocaleString()}/โควตา`;
                      return (
                        <>
                          {pc > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                              ⏳ {pc} รอยืนยัน
                            </span>
                          )}
                          <span>{label}</span>
                        </>
                      );
                    })()}
                  </span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${rateSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {rateSelectorOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                    {/* All option */}
                    <button
                      type="button"
                      onClick={() => { setSummaryRateId('all'); setRateSelectorOpen(false); }}
                      className={`w-full px-4 py-3 text-sm text-left flex items-center gap-2 hover:bg-emerald-50 transition-colors ${
                        summaryRateId === 'all' ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-gray-700'
                      }`}
                    >
                      🔄 ทั้งหมด (รวมทุก rate)
                    </button>
                    {allRateSchedules.map(rate => {
                      const modeLabel = '📋 กำหนดเอง';
                      const periodLabel = `${rate.calcPeriodStart || '?'} — ${rate.calcPeriodEnd || '?'}`;
                      const product = rate.quotaProductId
                        ? quotaProducts.find(qp => qp.id === rate.quotaProductId)
                        : null;
                      let productLabel = 'ทุกสินค้า';
                      if (product) {
                        productLabel = product.displayName;
                      } else if (rate.scopeRates && rate.scopeRates.length > 0) {
                        productLabel = rate.scopeRates
                          .map(sr => sr.displayName || quotaProducts.find(qp => qp.id === sr.quotaProductId)?.displayName || `#${sr.quotaProductId}`)
                          .join(', ');
                      }
                      const pendingCount = pendingCountsMap[rate.id] ?? 0;
                      const displayLabel = rate.rateName
                        ? `${rate.rateName} (${modeLabel} ฿${Number(rate.salesPerQuota).toLocaleString()}/โควตา)`
                        : `${modeLabel} ฿${Number(rate.salesPerQuota).toLocaleString()}/โควตา — ${productLabel} — ${periodLabel}`;
                      const isSelected = summaryRateId === rate.id;
                      return (
                        <button
                          key={rate.id}
                          type="button"
                          onClick={() => { setSummaryRateId(rate.id); setRateSelectorOpen(false); }}
                          className={`w-full px-4 py-3 text-sm text-left flex items-center gap-2 hover:bg-emerald-50 transition-colors border-t border-gray-100 ${
                            isSelected ? 'bg-emerald-50 font-medium text-emerald-700' : 'text-gray-700'
                          }`}
                        >
                          {pendingCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 shrink-0">
                              ⏳ {pendingCount} รอยืนยัน
                            </span>
                          )}
                          <span className="truncate">{displayLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {pendingCountsLoading && (
                <span className="ml-2 mt-5 inline-flex items-center gap-1 text-xs text-gray-400 px-3 py-1.5">
                  <RefreshCcw size={14} className="animate-spin" /> กำลังโหลด...
                </span>
              )}
              {!pendingCountsLoading && (() => {
                const selRate = summaryRateId !== 'all' ? allRateSchedules.find(r => r.id === Number(summaryRateId)) : null;
                const isConfirmMode = selRate && selRate.quotaMode === 'confirm' && selRate.requireConfirm;
                if (!isConfirmMode) return null;
                const pc = pendingCountsMap[selRate.id] ?? 0;
                return (
                  <span className={`ml-2 mt-5 inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border ${
                    pc > 0
                      ? 'bg-amber-100 text-amber-700 border-amber-300 animate-pulse'
                      : 'bg-gray-100 text-gray-500 border-gray-300'
                  }`}>
                    {pc > 0 ? '⏳' : '✅'} {pc} รอยืนยัน
                  </span>
                );
              })()}
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
                  disabled={bulkConfirming}
                  onClick={async () => {
                    setBulkConfirming(true);
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
                    } finally {
                      setBulkConfirming(false);
                    }
                  }}
                  className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkConfirming ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      กำลังยืนยัน...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      ยืนยันโควตา {selectedUserIds.length} คน
                    </>
                  )}
                </button>
              </div>
            );
          })()}

          {/* Summary Tables — split by role group */}
          {(() => {
            const telesaleRows = summaryData.filter(r => r.role === 'Telesale' || r.role === 'Supervisor Telesale');
            const adminPageRows = summaryData.filter(r => r.role === 'Admin Page');

            const renderSummaryTable = (rows: QuotaSummary[], groupLabel: string, groupColor: string) => {
              const isConfirmMode = summaryRateId !== 'all' && (() => {
                const selectedRate = allRateSchedules.find(r => r.id === summaryRateId);
                return selectedRate?.quotaMode === 'confirm' && selectedRate?.requireConfirm;
              })();

              return (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm ${groupColor}`}>
                      <Users size={13} /> {groupLabel}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{rows.length} คน</span>
                  </div>
                  <div className="bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-gray-50 to-emerald-50/30 border-b">
                        <tr>
                          {isConfirmMode && (() => {
                            const unconfirmedUsers = rows.filter(s => !s.isConfirmed && !s.isBeforeUsageStart && (s.pendingAutoQuota ?? 0) > 0);
                            const allSelected = unconfirmedUsers.length > 0 && unconfirmedUsers.every(u => selectedUserIds.includes(u.userId));
                            return (
                              <th className="px-3 py-3.5 text-center w-10">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUserIds(prev => [...prev, ...unconfirmedUsers.map(u => u.userId).filter(id => !prev.includes(id))]);
                                    } else {
                                      const idsToRemove = new Set(unconfirmedUsers.map(u => u.userId));
                                      setSelectedUserIds(prev => prev.filter(id => !idsToRemove.has(id)));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              </th>
                            );
                          })()}
                          <th className="px-5 py-3.5 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider">พนักงาน</th>
                          <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">ยอดขาย</th>
                          <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">โควตา (Auto)</th>
                          <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">โควตา (Admin)</th>
                          <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">รวมโควตา</th>
                          <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">ใช้ไปแล้ว</th>
                          <th className="px-4 py-3.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wider">คงเหลือ</th>
                          <th className="px-4 py-3.5 text-center font-semibold text-gray-600 text-xs uppercase tracking-wider">การดำเนินการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                              <p>ไม่มีข้อมูล</p>
                            </td>
                          </tr>
                        ) : (
                          rows.map(row => {
                            const canCheck = isConfirmMode && !row.isConfirmed && !row.isBeforeUsageStart && (row.pendingAutoQuota ?? 0) > 0;

                            return (
                              <tr key={row.userId} className="hover:bg-emerald-50/40 transition-colors even:bg-gray-50/50">
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
                                <td className="px-4 py-3 text-right font-mono text-teal-600 font-medium">
                                  {Number(row.totalAdminQuota)}
                                </td>
                                <td
                                  className="px-4 py-3 text-right font-mono text-gray-800 font-bold cursor-pointer hover:bg-emerald-50 transition-colors"
                                  onClick={async () => {
                                    setBreakdownUser(row);
                                    setBreakdownLoading(true);
                                    setBreakdownData([]);
                                    try {
                                      const data = await getUserQuotaDetail({
                                        companyId,
                                        userId: row.userId,
                                        rateScheduleId: summaryRateId,
                                      });
                                      setBreakdownData(data);
                                    } catch (e) { console.error(e); }
                                    setBreakdownLoading(false);
                                  }}
                                  title="คลิกเพื่อดูรายละเอียดโควตาแยกตามสินค้า"
                                >
                                  <span className="border-b border-dashed border-emerald-400">{Number(row.totalQuota)}</span>
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
                                        setAllocateValidFrom('');
                                        setAllocateValidUntil('');
                                        setAllocateAllProducts(true);
                                        setAllocateProductIds([]);
                                        setShowAllocateModal(true);
                                      }}
                                      className="text-emerald-500 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50"
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
                                    {row.rateScheduleId && row.requireConfirm === 1 && !row.isBeforeUsageStart && (
                                      <button
                                        disabled={bulkConfirming}
                                        onClick={async () => {
                                          setBulkConfirming(true);
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
                                          } finally {
                                            setBulkConfirming(false);
                                          }
                                        }}
                                        className={`p-1 rounded ${row.isConfirmed ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'} disabled:opacity-50`}
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
              );
            };

            return loading ? (
              <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                <p className="mt-2">กำลังโหลด...</p>
              </div>
            ) : summaryData.length === 0 ? (
              <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
                <Users size={40} className="mx-auto mb-3 text-gray-300" />
                <p>ไม่มีข้อมูล</p>
              </div>
            ) : (
              <>
                {telesaleRows.length > 0 && renderSummaryTable(telesaleRows, 'Telesale', 'bg-blue-100 text-blue-700')}
                {adminPageRows.length > 0 && renderSummaryTable(adminPageRows, 'Admin Page', 'bg-teal-100 text-teal-700')}
              </>
            );
          })()}
        </div>
      )}

      {/* ============ Allocation Modal ============ */}
      {showAllocateModal && allocateTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">เพิ่มโควตาให้ {allocateTarget.userName}</h3>
              <button onClick={() => setShowAllocateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Product selection */}
              <div className="bg-blue-50 rounded-lg p-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">เลือกสินค้า *</label>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={allocateAllProducts}
                    onChange={e => {
                      setAllocateAllProducts(e.target.checked);
                      if (e.target.checked) setAllocateProductIds([]);
                    }}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <span className="text-sm text-emerald-700 font-medium">สินค้าทั้งหมด ({activeQuotaProducts.length} รายการ)</span>
                </label>
                {allocateAllProducts ? (
                  <div className="flex flex-wrap gap-1">
                    {activeQuotaProducts.map(qp => (
                      <span key={qp.id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {qp.displayName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {activeQuotaProducts.map(qp => {
                      const selected = allocateProductIds.includes(qp.id);
                      return (
                        <button
                          key={qp.id}
                          type="button"
                          onClick={() => {
                            setAllocateProductIds(prev =>
                              selected ? prev.filter(id => id !== qp.id) : [...prev, qp.id]
                            );
                          }}
                          className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                            selected
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{qp.displayName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนโควตา (ต่อสินค้า) *</label>
                <input
                  type="number"
                  value={allocateQuantity}
                  onChange={e => setAllocateQuantity(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  min="1"
                  placeholder="จำนวน"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar size={14} className="inline mr-1" />
                    วันเริ่มต้น
                  </label>
                  <input
                    type="date"
                    value={allocateValidFrom}
                    onChange={e => setAllocateValidFrom(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock size={14} className="inline mr-1" />
                    วันหมดอายุ
                  </label>
                  <input
                    type="date"
                    value={allocateValidUntil}
                    onChange={e => setAllocateValidUntil(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-2">* หากไม่กำหนดวันหมดอายุ โควตาจะใช้งานได้ตลอด</p>
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
              {/* Summary info */}
              {(() => {
                const count = allocateAllProducts ? activeQuotaProducts.length : allocateProductIds.length;
                return count > 0 && allocateQuantity ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    <p>⚠️ จะสร้าง <strong>{count}</strong> แถว (สินค้าละ <strong>{allocateQuantity}</strong> แต้ม, รวม <strong>{count * parseFloat(allocateQuantity || '0')}</strong> แต้ม)</p>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="p-5 border-t flex justify-end gap-3">
              <button onClick={() => setShowAllocateModal(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                ยกเลิก
              </button>
              <button
                onClick={handleAllocate}
                disabled={!allocateQuantity || parseFloat(allocateQuantity) <= 0 || (!allocateAllProducts && allocateProductIds.length === 0)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
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
                              ? 'bg-teal-100 text-teal-700'
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
                        <div>ให้เมื่อวันที่ {alloc.createdAt?.split(' ')[0]}</div>
                        {(alloc.valid_from || alloc.valid_until) && (
                          <div className="mt-0.5">
                            <span className="text-emerald-500">ใช้ได้: </span>
                            {alloc.valid_from || '—'} — {alloc.valid_until || 'ตลอด'}
                            {alloc.valid_until && new Date(alloc.valid_until) < new Date() && (
                              <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">หมดอายุ</span>
                            )}
                          </div>
                        )}
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

    {/* ============ Quota Breakdown Modal ============ */}
    {breakdownUser && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
          <div className="p-5 border-b flex justify-between items-center flex-shrink-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                รายละเอียดโควตา — {breakdownUser.userName}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">แยกตามอัตราโควตา / สินค้า</p>
            </div>
            <button onClick={() => setBreakdownUser(null)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {breakdownLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                <span className="ml-3 text-gray-500">กำลังโหลด...</span>
              </div>
            ) : breakdownData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package size={40} className="mx-auto mb-3 text-gray-300" />
                <p>ไม่มีข้อมูลโควตา</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">สินค้า / อัตรา</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">โหมด</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">ยอดขาย</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Auto</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Admin</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">รวม</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">ใช้ไป</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">คงเหลือ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdownData.map(item => (
                    <tr key={item.rateScheduleId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.productLabel.split(', ').map((name: string, i: number) => {
                            const colors = [
                              'bg-emerald-50 text-emerald-700 border-emerald-200',
                              'bg-blue-50 text-blue-700 border-blue-200',
                              'bg-violet-50 text-violet-700 border-violet-200',
                              'bg-amber-50 text-amber-700 border-amber-200',
                              'bg-rose-50 text-rose-700 border-rose-200',
                              'bg-cyan-50 text-cyan-700 border-cyan-200',
                              'bg-orange-50 text-orange-700 border-orange-200',
                              'bg-pink-50 text-pink-700 border-pink-200',
                            ];
                            const hash = name.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 5381);
                            const colorClass = colors[Math.abs(hash) % colors.length];
                            return (
                              <span key={i} className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${colorClass}`}>
                                {name}
                              </span>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.rateName ? (
                            <>{item.rateName} <span className="text-gray-300">·</span> ฿{Number(item.salesPerQuota).toLocaleString()}/โควตา</>
                          ) : (
                            <>฿{Number(item.salesPerQuota).toLocaleString()}/โควตา
                            {item.periodStart && ` · ${item.periodStart} — ${item.periodEnd}`}</>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700`}>
                          {item.modeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-600">
                        ฿{Number(item.totalSales).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-blue-600">
                        {Number(item.autoQuota)}
                        {item.pendingAutoQuota != null && item.pendingAutoQuota > 0 && !item.isConfirmed && (
                          <div className="text-xs text-amber-500">({item.pendingAutoQuota} รอ)</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-teal-600">
                        {Number(item.adminQuota)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-800 font-bold">
                        {Number(item.totalQuota)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-orange-600">
                        {Number(item.totalUsed)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`font-mono font-bold ${
                          item.isExpired ? 'text-gray-400' :
                          Number(item.remaining) > 0 ? 'text-green-600' :
                          Number(item.remaining) === 0 ? 'text-gray-400' : 'text-red-600'
                        }`}>
                          {item.isExpired ? '0' : Number(item.remaining)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {breakdownData.length > 1 && (
                  <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                    <tr className="font-semibold">
                      <td className="px-4 py-3 text-gray-700" colSpan={2}>รวมทั้งหมด</td>
                      <td className="px-3 py-3 text-right font-mono text-gray-700">
                        ฿{breakdownData.reduce((s, i) => s + Number(i.totalSales), 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-blue-700">
                        {breakdownData.reduce((s, i) => s + Number(i.autoQuota), 0)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-teal-700">
                        {breakdownData.reduce((s, i) => s + Number(i.adminQuota), 0)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-800 font-bold">
                        {breakdownData.reduce((s, i) => s + Number(i.totalQuota), 0)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-orange-700">
                        {breakdownData.reduce((s, i) => s + Number(i.totalUsed), 0)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-green-700 font-bold">
                        {breakdownData.reduce((s, i) => s + Number(i.remaining), 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      </div>
    )}

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
            <p className="font-medium text-gray-800">{deleteTarget.rateName || `฿${Number(deleteTarget.salesPerQuota).toLocaleString()} / 1 โควตา`}</p>
            {deleteTarget.rateName && <p className="text-gray-500">฿{Number(deleteTarget.salesPerQuota).toLocaleString()} / 1 โควตา</p>}
            <p className="text-gray-500">มีผล: {deleteTarget.effectiveDate}</p>
            <p className="text-gray-500">Mode: กำหนดเอง</p>
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
