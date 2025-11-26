import React, { useState, useMemo, useEffect } from 'react';
import { Product, User, Company, UserRole, Warehouse } from '../types';
import { PlusCircle, Edit, Trash2, Package, Eye, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { listProductLots, listProducts, getProductTotalStock, listWarehouses, updateProduct, updateProductLot } from '@/services/api';
import LotManagementModal from '../components/LotManagementModal';

interface ProductManagementPageProps {
  products: Product[];
  openModal: (type: string, data?: any) => void;
  currentUser: User;
  allCompanies: Company[];
}

const ProductManagementPage: React.FC<ProductManagementPageProps> = ({ products, openModal, currentUser, allCompanies }) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [shopFilter, setShopFilter] = useState<string>('');
  const [selectedProductLots, setSelectedProductLots] = useState<any[]>([]);
  const [showLotsModal, setShowLotsModal] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [productStocks, setProductStocks] = useState<{ [key: number]: number }>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productLots, setProductLots] = useState<{ [key: number]: any[] }>({});
  const [showLotManagementModal, setShowLotManagementModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);

  // โหลดข้อมูลคลังสินค้า
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const effectiveCompanyId = currentUser?.companyId || 1;
        const warehouseData = await listWarehouses(effectiveCompanyId);
        setWarehouses(warehouseData as Warehouse[]);
      } catch (error) {
        console.error('Error loading warehouses:', error);
      }
    };

    loadWarehouses();
  }, [currentUser]);

  // โหลดข้อมูล Lot ของสินค้าทั้งหมด
  useEffect(() => {
    const loadAllProductLots = async () => {
      const lotsData: { [key: number]: any[] } = {};
      
      for (const product of products) {
        try {
          const lots = await listProductLots({ productId: product.id });
          lotsData[product.id] = lots;
        } catch (error) {
          console.error(`Error loading lots for product ${product.id}:`, error);
          lotsData[product.id] = [];
        }
      }
      
      setProductLots(lotsData);
    };

    if (products.length > 0) {
      loadAllProductLots();
    }
  }, [products]);

  // ดึงข้อมูลสต็อกรวมของสินค้าทั้งหมด
  useEffect(() => {
    const fetchProductStocks = async () => {
      const stocks: { [key: number]: number } = {};
      
      // ดึงข้อมูลสต็อกสำหรับแต่ละสินค้า
      for (const product of products) {
        try {
          const result = await getProductTotalStock(product.id);
          stocks[product.id] = result.total_stock || 0;
        } catch (error) {
          console.error(`Error fetching stock for product ${product.id}:`, error);
          stocks[product.id] = product.stock || 0; // ใช้ค่าเดิมถ้าเกิดข้อผิดพลาด
        }
      }
      
      setProductStocks(stocks);
    };

    if (products.length > 0) {
      fetchProductStocks();
    }
  }, [products]);

  const handleDelete = (product: Product) => {
    openModal('confirmDelete', {
      id: product.id,
      name: product.name,
      type: 'product'
    });
  };

  const handleViewLots = async (product: Product) => {
    try {
      const lots = await listProductLots({ productId: product.id });
      setSelectedProductLots(lots);
      setSelectedProductName(product.name);
      setShowLotsModal(true);
      setSelectedWarehouse(null); // Reset selected warehouse when opening lots modal
    } catch (error) {
      console.error('Error fetching product lots:', error);
    }
  };

  const handleManageLots = (product: Product) => {
    setSelectedProduct(product);
    setShowLotManagementModal(true);
  };

  const handleToggleProductStatus = async (product: Product) => {
    try {
      const currentStatus = getProductStatus(product);
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

      await updateProduct(product.id, { status: newStatus });
      
      // แจ้ง parent component ให้อัปเดตข้อมูล
      openModal('refreshProducts');
    } catch (error) {
      console.error('Error updating product status:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : (error as any)?.message ?? '';
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะสินค้า: ' + errorMessage);
    }
  };

  // คำนวณต้นทุนเฉลี่ยจาก Lot ทั้งหมด
  const getAverageCost = (productId: number) => {
    const lots = productLots[productId] || [];
    if (lots.length === 0) return 0;
    
    const totalCost = lots.reduce((sum, lot) => sum + (parseFloat(lot.unit_cost) * parseFloat(lot.quantity_remaining)), 0);
    const totalQuantity = lots.reduce((sum, lot) => sum + parseFloat(lot.quantity_remaining), 0);
    
    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  };

  // คำนวณราคาขายเฉลี่ยจาก Lot ทั้งหมด (ใช้ราคาขายของสินค้าเป็นหลัก)
  const getAveragePrice = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product ? product.price : 0;
  };

  // หา Lot ล่าสุดที่ใช้อยู่
  const getLatestLot = (productId: number) => {
    const lots = productLots[productId] || [];
    if (lots.length === 0) return '-';
    
    // เรียงตามวันที่รับเข้าล่าสุด
    const sortedLots = lots.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
    return sortedLots[0].lot_number;
  };

  // ตรวจสอบสถานะการใช้งานของสินค้า
  const getProductStatus = (product: Product) => {
    // อ่านสถานะโดยตรงจากตาราง products
    const rawStatus = (product.status ?? '').toString().trim();
    if (!rawStatus) {
      return 'Active';
    }
    const lower = rawStatus.toLowerCase();
    if (lower === 'active') return 'Active';
    if (lower === 'inactive') return 'Inactive';
    if (lower === '1' || lower === 'true' || lower === 'enabled') return 'Active';
    if (lower === '0' || lower === 'false' || lower === 'disabled') return 'Inactive';
    return rawStatus;
  };

  // ฟังก์ชันสำหรับหาชื่อคลังสินค้า
  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? warehouse.name : `คลัง ${warehouseId}`;
  };

  const productCategories = useMemo(() => {
    return [...new Set(products.map(p => p.category))];
  }, [products]);

  const productShops = useMemo(() => {
    return [...new Set(products.map(p => p.shop).filter(Boolean))].sort();
  }, [products]);

  const isSuperAdmin = currentUser.role === UserRole.SuperAdmin;

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const categoryMatch = !categoryFilter || product.category === categoryFilter;
      const companyMatch = !isSuperAdmin || !companyFilter || product.companyId === parseInt(companyFilter);
      const shopMatch = !shopFilter || product.shop === shopFilter;
      return categoryMatch && companyMatch && shopMatch;
    });
  }, [products, categoryFilter, companyFilter, shopFilter, isSuperAdmin]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จัดการสินค้า</h2>
          <p className="text-gray-600">จัดการข้อมูลสินค้าทั้งหมดในระบบ</p>
        </div>
        <button
          onClick={() => openModal('addProduct')}
          className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm"
        >
          <PlusCircle size={16} className="mr-2"/>
          เพิ่มสินค้าใหม่
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex items-center space-x-4">
        <div className="flex-1">
          <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">กรองตามหมวดหมู่</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
            style={{ colorScheme: 'light' }}
          >
            <option value="">ทุกหมวดหมู่</option>
            {productCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="shop-filter" className="block text-sm font-medium text-gray-700 mb-1">กรองตามร้านค้า</label>
          <select
            id="shop-filter"
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
            style={{ colorScheme: 'light' }}
          >
            <option value="">ทุกร้านค้า</option>
            {productShops.map(shop => (
              <option key={shop} value={shop}>{shop}</option>
            ))}
          </select>
        </div>
        {isSuperAdmin && (
          <div className="flex-1">
            <label htmlFor="company-filter" className="block text-sm font-medium text-gray-700 mb-1">กรองตามบริษัท</label>
            <select
              id="company-filter"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
              style={{ colorScheme: 'light' }}
            >
              <option value="">ทุกบริษัท</option>
              {allCompanies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">ID</th>
              <th scope="col" className="px-6 py-3">รหัสสินค้า (SKU)</th>
              <th scope="col" className="px-6 py-3">ชื่อสินค้า</th>
              <th scope="col" className="px-6 py-3">ร้านค้า</th>
              <th scope="col" className="px-6 py-3">ต้นทุน(เฉลี่ย)</th>
              <th scope="col" className="px-6 py-3">ราคาขาย(เฉลี่ย)</th>
              <th scope="col" className="px-6 py-3">สต็อกทั้งหมด</th>
              <th scope="col" className="px-6 py-3">Lot ล่าสุด</th>
              <th scope="col" className="px-6 py-3">สถานะ</th>
              <th scope="col" className="px-6 py-3 text-right">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-xs">{product.id}</td>
                <td className="px-6 py-4 font-mono text-xs">{product.sku}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                <td className="px-6 py-4 text-gray-600">{product.shop || '-'}</td>
                <td className="px-6 py-4">฿{getAverageCost(product.id).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-6 py-4">฿{getAveragePrice(product.id).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <Package size={16} className="mr-1 text-gray-500" />
                    {productStocks[product.id]?.toLocaleString() || 0}
                  </div>
                </td>
                <td className="px-6 py-4">{getLatestLot(product.id)}</td>
                <td className="px-6 py-4">
                  <div 
                    className="flex items-center cursor-pointer"
                    onClick={() => handleToggleProductStatus(product)}
                  >
                    {getProductStatus(product) === 'Active' ? (
                      <div className="w-8 h-4 bg-green-500 rounded-full relative">
                        <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                      </div>
                    ) : (
                      <div className="w-8 h-4 bg-red-500 rounded-full relative">
                        <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 flex items-center justify-end space-x-2">
                  <button 
                    onClick={() => handleManageLots(product)} 
                    className="p-2 text-green-600 hover:bg-green-100 rounded-full" 
                    title="จัดการ Lot"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={() => handleViewLots(product)} 
                    className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-full" 
                    title="ดูข้อมูล Lot"
                  >
                    <Eye size={16} />
                  </button>
                  <button onClick={() => openModal('editProduct', product)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(product)} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            ไม่พบข้อมูลสินค้า
          </div>
        )}
      </div>

      {/* Modal สำหรับแสดงข้อมูล Lot ของสินค้า */}
      {showLotsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-7xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">ข้อมูล Lot ของสินค้า: {selectedProductName}</h3>
              <button 
                onClick={() => setShowLotsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {selectedProductLots.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ไม่พบข้อมูล Lot สำหรับสินค้านี้
              </div>
            ) : (
              <div>
                {/* Dropdown สำหรับเลือกคลัง */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">เลือกคลังสินค้า:</label>
                  <select
                    value={selectedWarehouse || 'all'}
                    onChange={(e) => setSelectedWarehouse(e.target.value === 'all' ? null : parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="all">ทุกคลัง</option>
                    {(() => {
                      // จัดกลุ่ม Lot ตามคลัง
                      const warehousesSet = new Set<number>();
                      selectedProductLots.forEach(lot => {
                        warehousesSet.add(lot.warehouse_id);
                      });
                      
                      return Array.from(warehousesSet).map(warehouseId => (
                        <option key={warehouseId} value={warehouseId}>
                          {getWarehouseName(warehouseId)}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
                
                {/* สรุปสต็อกตามคลัง */}
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-3">สรุปสต็อกตามคลัง</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      // จัดกลุ่ม Lot ตามคลังและกรองตามที่เลือก
                      const lotsByWarehouse: { [key: number]: any[] } = {};
                      selectedProductLots.forEach(lot => {
                        const warehouseId = lot.warehouse_id;
                        if (!lotsByWarehouse[warehouseId]) {
                          lotsByWarehouse[warehouseId] = [];
                        }
                        lotsByWarehouse[warehouseId].push(lot);
                      });
                      
                      // กรองตามคลังที่เลือก
                      const filteredWarehouses = selectedWarehouse 
                        ? { [selectedWarehouse]: lotsByWarehouse[selectedWarehouse] }
                        : lotsByWarehouse;
                      
                      return Object.entries(filteredWarehouses).map(([warehouseId, lots]) => {
                        const totalStock = lots.reduce((sum, lot) => sum + parseFloat(lot.quantity_remaining), 0);
                        const activeLots = lots.filter(lot => lot.status === 'Active').length;
                        
                        return (
                          <div key={warehouseId} className="bg-white p-3 rounded border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium text-gray-700">{getWarehouseName(parseInt(warehouseId))}</h5>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                activeLots > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {activeLots > 0 ? 'มีสินค้า' : 'ไม่มีสินค้า'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <div>สต็อกทั้งหมด: <span className="font-medium">{totalStock.toLocaleString()}</span></div>
                              <div>จำนวน Lot: <span className="font-medium">{lots.length}</span></div>
                              <div>Lot ที่ใช้งาน: <span className="font-medium">{activeLots}</span></div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                
                {/* รายละเอียด Lot แบบกลุ่มตามคลัง */}
                <div className="overflow-x-auto">
                  {(() => {
                    // กรอง Lot ตามคลังที่เลือก
                    let filteredLots = selectedProductLots;
                    if (selectedWarehouse) {
                      filteredLots = selectedProductLots.filter(lot => lot.warehouse_id === selectedWarehouse);
                    }
                    
                    // จัดกลุ่ม Lot ตามคลัง
                    const lotsByWarehouse: { [key: number]: any[] } = {};
                    filteredLots.forEach(lot => {
                      const warehouseId = lot.warehouse_id;
                      if (!lotsByWarehouse[warehouseId]) {
                        lotsByWarehouse[warehouseId] = [];
                      }
                      lotsByWarehouse[warehouseId].push(lot);
                    });
                    
                    return Object.entries(lotsByWarehouse).map(([warehouseId, lots]) => (
                      <div key={warehouseId} className="mb-6">
                        <h4 className="font-medium text-gray-800 mb-3 flex items-center">
                          <Package size={16} className="mr-2 text-gray-600" />
                          {getWarehouseName(parseInt(warehouseId))}
                          <span className="ml-2 text-sm text-gray-500">({lots.length} Lot)</span>
                        </h4>
                        <table className="w-full text-sm text-left text-gray-500 border border-gray-200 rounded-lg overflow-hidden">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                              <th scope="col" className="px-4 py-2">Lot Number</th>
                              <th scope="col" className="px-4 py-2">จำนวนรับเข้า</th>
                              <th scope="col" className="px-4 py-2">จำนวนคงเหลือ</th>
                              <th scope="col" className="px-4 py-2">ต้นทุนต่อหน่วย</th>
                              <th scope="col" className="px-4 py-2">วันหมดอายุ</th>
                              <th scope="col" className="px-4 py-2">สถานะ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lots.map((lot, index) => (
                              <tr key={index} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium">{lot.lot_number}</td>
                                <td className="px-4 py-2">{Number(lot.quantity_received).toLocaleString()}</td>
                                <td className="px-4 py-2">{Number(lot.quantity_remaining).toLocaleString()}</td>
                                <td className="px-4 py-2">฿{Number(lot.unit_cost).toLocaleString()}</td>
                                <td className="px-4 py-2">{lot.expiry_date || '-'}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    lot.status === 'Active' ? 'bg-green-100 text-green-800' : 
                                    lot.status === 'Depleted' ? 'bg-red-100 text-red-800' : 
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {lot.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal สำหรับจัดการ Lot */}
      {showLotManagementModal && selectedProduct && (
        <LotManagementModal
          product={selectedProduct}
          warehouses={warehouses}
          onClose={() => {
            setShowLotManagementModal(false);
            setSelectedProduct(null);
          }}
          onSave={() => {
            // รีเฟรชข้อมูลหลังจากบันทึก
            openModal('refreshProducts');
            setShowLotManagementModal(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default ProductManagementPage;
