import React, { useState, useMemo } from 'react';
import { Order, Product, Promotion } from '../types';
import { BarChart3, Package, ShoppingCart, TrendingUp, Eye, EyeOff } from 'lucide-react';

interface ProductSalesReportPageProps {
  orders: Order[];
  products: Product[];
  promotions: Promotion[];
}

type ViewMode = 'promotion' | 'product';

interface SalesData {
  id: string | number;
  name: string;
  quantity: number;
  revenue: number;
  orders: number;
  type: 'promotion' | 'product';
}

const ProductSalesReportPage: React.FC<ProductSalesReportPageProps> = ({ 
  orders, 
  products, 
  promotions 
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('product');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    return orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [orders, dateRange]);

  // Calculate sales data based on view mode
  const salesData = useMemo(() => {
    const data: SalesData[] = [];
    const dataMap = new Map<string, SalesData>();

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (viewMode === 'promotion') {
          // Group by promotion (parent items only)
          if (item.isPromotionParent && item.promotionId) {
            const key = `promo_${item.promotionId}`;
            const promotion = promotions.find(p => p.id === item.promotionId);
            const name = promotion?.name || `โปรโมชั่น #${item.promotionId}`;
            
            if (!dataMap.has(key)) {
              dataMap.set(key, {
                id: item.promotionId!,
                name,
                quantity: 0,
                revenue: 0,
                orders: 0,
                type: 'promotion'
              });
            }
            
            const existing = dataMap.get(key)!;
            existing.quantity += item.quantity;
            existing.revenue += item.quantity * item.pricePerUnit;
            existing.orders += 1;
          }
        } else {
          // Group by product (child items + regular items)
          if (!item.isPromotionParent && item.productId) {
            const key = `prod_${item.productId}`;
            const product = products.find(p => p.id === item.productId);
            const name = product?.name || `สินค้า #${item.productId}`;
            
            if (!dataMap.has(key)) {
              dataMap.set(key, {
                id: item.productId!,
                name,
                quantity: 0,
                revenue: 0,
                orders: 0,
                type: 'product'
              });
            }
            
            const existing = dataMap.get(key)!;
            existing.quantity += item.quantity;
            existing.revenue += item.quantity * item.pricePerUnit;
            existing.orders += 1;
          }
        }
      });
    });

    return Array.from(dataMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders, products, promotions, viewMode]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
    const totalQuantity = salesData.reduce((sum, item) => sum + item.quantity, 0);
    const totalOrders = filteredOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalQuantity,
      totalOrders,
      avgOrderValue
    };
  }, [salesData, filteredOrders]);

  const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = 
    ({ title, value, icon: Icon, color }) => (
      <div className={`bg-white p-6 rounded-lg shadow-sm border-l-4 ${color}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className="h-8 w-8 text-gray-400" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">รายงานยอดขายสินค้า</h2>
        <p className="text-gray-600">วิเคราะห์ยอดขายตามโปรโมชั่นหรือสินค้าแต่ละตัว</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Date Range */}
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('product')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'product'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              ตามสินค้า
            </button>
            <button
              onClick={() => setViewMode('promotion')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'promotion'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4 inline mr-2" />
              ตามโปรโมชั่น
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard 
          title="รายได้รวม" 
          value={`฿${summary.totalRevenue.toLocaleString()}`} 
          icon={TrendingUp}
          color="border-blue-500"
        />
        <StatCard 
          title={viewMode === 'product' ? 'จำนวนสินค้าที่ขาย' : 'จำนวนโปรโมชั่นที่ขาย'} 
          value={summary.totalQuantity.toLocaleString()} 
          icon={Package}
          color="border-green-500"
        />
        <StatCard 
          title="จำนวนออเดอร์" 
          value={summary.totalOrders.toLocaleString()} 
          icon={ShoppingCart}
          color="border-purple-500"
        />
        <StatCard 
          title="ยอดเฉลี่ย/ออเดอร์" 
          value={`฿${summary.avgOrderValue.toLocaleString()}`} 
          icon={BarChart3}
          color="border-orange-500"
        />
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {viewMode === 'product' ? 'ยอดขายตามสินค้า' : 'ยอดขายตามโปรโมชั่น'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {salesData.length} รายการ • วันที่ {dateRange.start} - {dateRange.end}
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {viewMode === 'product' ? 'สินค้า' : 'โปรโมชั่น'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จำนวน
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  รายได้
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จำนวนออเดอร์
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ราคาเฉลี่ย
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {salesData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>ไม่พบข้อมูลในช่วงเวลาที่เลือก</p>
                  </td>
                </tr>
              ) : (
                salesData.map((item, index) => (
                  <tr key={`${item.type}_${item.id}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {item.type === 'promotion' ? (
                            <ShoppingCart className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Package className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-500">
                            {item.type === 'promotion' ? 'โปรโมชั่น' : 'สินค้า'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ฿{item.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.orders.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ฿{item.quantity > 0 ? (item.revenue / item.quantity).toFixed(2) : '0.00'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Eye className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">คำอธิบายมุมมอง</h4>
            <div className="text-sm text-blue-700 space-y-1">
              {viewMode === 'product' ? (
                <>
                  <p><strong>ตามสินค้า:</strong> แสดงจำนวนชิ้นที่ขายจริงของแต่ละสินค้า รวมทั้งที่ขายเดี่ยวและที่ขายในโปรโมชั่น</p>
                  <p><strong>ตัวอย่าง:</strong> ปุ๋ย แสงราชสีห์ ขายเดี่ยว 5 ชิ้น + ขายในโปรโมชั่น 8 ชิ้น = รวม 13 ชิ้น</p>
                </>
              ) : (
                <>
                  <p><strong>ตามโปรโมชั่น:</strong> แสดงจำนวนเซ็ตโปรโมชั่นที่ขาย (ไม่แยกสินค้าภายใน)</p>
                  <p><strong>ตัวอย่าง:</strong> "ปุ๋ย ซื้อ 4 แถม 1" ขาย 2 เซ็ต = 2 เซ็ต (ไม่แสดงว่าแต่ละสินค้าขายกี่ชิ้น)</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSalesReportPage;
