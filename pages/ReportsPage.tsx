import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Package, 
  TrendingUp, 
  DollarSign, 
  Users, 
  ShoppingCart,
  Download,
  Calendar,
  Filter,
  ChevronDown,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';
import { Order, Customer, Product, WarehouseStock, StockMovement } from '../types';
import { calculateCustomerGrade } from '@/utils/customerGrade';

const getCustomerDisplayName = (customer: Customer): string => {
  const first = (customer.firstName || '').trim();
  const last = (customer.lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ');
  if (fullName) return fullName;
  if (customer.facebookName) return customer.facebookName;
  if (customer.lineId) return customer.lineId;
  if (customer.phone) return customer.phone;
  return customer.id;
};

interface ReportsPageProps {
  orders?: Order[];
  customers?: Customer[];
  products?: Product[];
  warehouseStock?: WarehouseStock[];
  stockMovements?: StockMovement[];
  productLots?: any[];
}

type ReportType = 'stock' | 'lot-stock' | 'customers' | 'orders-raw';

interface ReportCard {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const reportCards: ReportCard[] = [
  {
    id: 'orders-raw',
    title: 'รายงานออเดอร์แบบละเอียด',
    description: 'รายงานออเดอร์แบบ Raw Data แสดงทุกรายการสินค้า พร้อมสถานะการดำเนินการ',
    icon: FileSpreadsheet,
    color: 'bg-indigo-500'
  },
  {
    id: 'stock',
    title: 'รายงานสต๊อคคงเหลือ',
    description: 'รายงานสินค้าคงคลังรวมทุกคลังสินค้า พร้อมมูลค่าสต๊อค',
    icon: Package,
    color: 'bg-blue-500'
  },
  {
    id: 'lot-stock',
    title: 'รายงานสต๊อคคงคลัง-Lot',
    description: 'รายงานสต๊อคแยกตาม Lot พร้อมวันหมดอายุและราคาต้นทุน',
    icon: TrendingUp,
    color: 'bg-green-500'
  },
  {
    id: 'customers',
    title: 'รายงานลูกค้า',
    description: 'รายงานข้อมูลลูกค้า พฤติกรรมการซื้อ และมูลค่าการซื้อ',
    icon: Users,
    color: 'bg-pink-500'
  }
];

const ReportsPage: React.FC<ReportsPageProps> = ({ 
  orders = [], 
  customers = [], 
  products = [],
  warehouseStock = [],
  stockMovements = [],
  productLots = []
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // คำนวณข้อมูลสำหรับแต่ละรายงาน
  const reportData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filterStartDate = new Date(today);
    let filterEndDate = new Date(today);
    filterEndDate.setHours(23, 59, 59, 999);

    switch (dateRange) {
      case 'today':
        break;
      case 'week':
        filterStartDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        filterStartDate.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        filterStartDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'custom':
        if (startDate) filterStartDate = new Date(startDate);
        if (endDate) {
          filterEndDate = new Date(endDate);
          filterEndDate.setHours(23, 59, 59, 999);
        }
        break;
    }

    // ฟิลเตอร์ออเดอร์ตามวันที่
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate >= filterStartDate && orderDate <= filterEndDate;
    });

    // รายงานสต๊อคคงเหลือ
    const stockReport = warehouseStock.map(stock => {
      const product = products.find(p => p.id === stock.productId);
      return {
        productId: stock.productId,
        productName: product?.name || 'N/A',
        productCode: product?.code || 'N/A',
        warehouseId: stock.warehouseId,
        quantity: stock.quantity,
        reservedQuantity: stock.reservedQuantity,
        availableQuantity: stock.availableQuantity,
        sellingPrice: stock.sellingPrice || 0,
        totalValue: (stock.sellingPrice || 0) * stock.quantity,
        lotNumber: stock.lotNumber,
        expiryDate: stock.expiryDate
      };
    });

    // รายงานสต๊อคคงคลัง-Lot (แยกตาม Lot)
    const lotStockReport = productLots.map(lot => {
      return {
        'คลังสินค้า': lot.warehouseName || 'N/A',
        'รหัสสินค้า': lot.productCode || 'N/A',
        'ชื่อสินค้า': lot.productName || 'N/A',
        'หมายเลข Lot': lot.lotNumber || 'N/A',
        'วันที่รับเข้า': lot.purchaseDate ? new Date(lot.purchaseDate).toLocaleDateString('th-TH') : '-',
        'วันหมดอายุ': lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString('th-TH') : '-',
        'จำนวนที่รับ': lot.quantityReceived || 0,
        'จำนวนคงเหลือ': lot.quantityRemaining || 0,
        'ราคาต้นทุน/หน่วย': `฿${(lot.unitCost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        'มูลค่ารวม': `฿${((lot.quantityRemaining || 0) * (lot.unitCost || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
        'สถานะ': lot.status || 'N/A',
        'Invoice': lot.supplierInvoice || '-',
        'หมายเหตุ': lot.notes || '-'
      };
    });

    // รายงานออเดอร์แบบละเอียด (Raw Data - Order Items Level)
    const ordersRawReport: any[] = [];
    filteredOrders.forEach(order => {
      // Match customer by pk (customer_id) or id (string)
      const customer = customers.find(c => {
        if (c.pk && typeof order.customerId === 'number') {
          return c.pk === order.customerId;
        }
        return String(c.id) === String(order.customerId) || 
               String(c.pk) === String(order.customerId);
      });
      
      // ฟังก์ชันช่วยดึงข้อมูล - ใช้ข้อมูลจาก order.shippingAddress ก่อน แล้วค่อย fallback ไปที่ customer
      const getCustomerName = () => {
        if (customer) {
          const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
          return fullName || '-';
        }
        return '-';
      };
      
      const getAddress = () => {
        return order.shippingAddress?.street || 
               customer?.address?.street || 
               '-';
      };
      
      const getSubdistrict = () => {
        return order.shippingAddress?.subdistrict || 
               customer?.address?.subdistrict || 
               '-';
      };
      
      const getDistrict = () => {
        return order.shippingAddress?.district || 
               customer?.address?.district || 
               '-';
      };
      
      const getProvince = () => {
        return order.shippingAddress?.province || 
               customer?.address?.province || 
               customer?.province || 
               '-';
      };
      
      const getPostalCode = () => {
        return order.shippingAddress?.postalCode || 
               customer?.address?.postalCode || 
               '-';
      };
      
      const getTrackingNumber = () => {
        if (order.trackingNumbers && order.trackingNumbers.length > 0) {
          return order.trackingNumbers.join(', ');
        }
        return '-';
      };
      
      const getRegion = (province: string): string => {
        const regionMap: { [key: string]: string } = {
          'กรุงเทพมหานคร': 'ภาคกลาง',
          'นนทบุรี': 'ภาคกลาง',
          'ปทุมธานี': 'ภาคกลาง',
          'สมุทรปราการ': 'ภาคกลาง',
          'สมุทรสาคร': 'ภาคกลาง',
          'นครปฐม': 'ภาคกลาง',
          'เชียงใหม่': 'ภาคเหนือ',
          'เชียงราย': 'ภาคเหนือ',
          'ภูเก็ต': 'ภาคใต้',
          'สุราษฎร์ธานี': 'ภาคใต้',
          'กระบี่': 'ภาคใต้',
          'ขอนแก่น': 'ภาคตะวันออกเฉียงเหนือ',
          'อุดรธานี': 'ภาคตะวันออกเฉียงเหนือ',
        };
        return regionMap[province] || 'ไม่ทราบภาค';
      };
      
      const getOrderStatusThai = (status: string): string => {
        const statusMap: { [key: string]: string } = {
          'Pending': 'รอดำเนินการ',
          'Confirmed': 'ยืนยันแล้ว',
          'Picking': 'กำลังจัดเตรียม',
          'Shipping': 'กำลังจัดส่ง',
          'Delivered': 'จัดส่งสำเร็จ',
          'Cancelled': 'ยกเลิก',
          'Returned': 'ตีกลับ'
        };
        return statusMap[status] || status;
      };
      
      if (order.items && order.items.length > 0) {
        // มี items - แสดงแต่ละรายการ
        order.items.forEach(item => {
          const itemTotal = (item.pricePerUnit * item.quantity) - (item.discount || 0);
          
          // กำหนด รหัสสินค้า/โปร
          let productCode = '-';
          if (item.isPromotionParent) {
            // รายการแม่ของโปรโมชั่น - แสดงรหัสโปรโมชั่น
            productCode = item.promotionId ? `PROMO-${String(item.promotionId).padStart(3, '0')}` : '-';
          } else if (item.promotionId) {
            // รายการย่อยของโปรโมชั่น (สินค้าในชุด/ของแถม) - แสดงรหัสโปรโมชั่น
            productCode = `PROMO-${String(item.promotionId).padStart(3, '0')}`;
          } else if (item.productSku) {
            // สินค้าเดี่ยวที่มี SKU
            productCode = item.productSku;
          } else if (item.productId) {
            // Fallback: หา product จาก products array
            const product = products.find(p => p.id === item.productId);
            productCode = product?.sku || '-';
          }
          
          // กำหนดชื่อสินค้าและชื่อโปร
          let productName = item.productName || '-';
          let promoName = '-';
          
          if (item.isPromotionParent) {
            // รายการแม่ของโปรโมชั่น - ชื่อโปรเป็นชื่อสินค้า
            promoName = item.productName || '-';
            productName = `📦 ${item.productName}` || '-';
          } else if (item.promotionId && item.parentItemId) {
            // รายการย่อยของโปรโมชั่น - หาชื่อโปรจาก parent
            const parentItem = order.items.find(i => i.id === item.parentItemId);
            promoName = parentItem?.productName || '-';
            // เพิ่ม (ของแถม) ถ้าเป็น freebie
            productName = item.isFreebie ? `${item.productName} (ของแถม)` : item.productName;
          }
          
          ordersRawReport.push({
            'วันที่สั่งซื้อ': new Date(order.orderDate).toLocaleDateString('th-TH'),
            'เลขคำสั่งซื้อ': order.orderNumber || order.id,
            'ชื่อลูกค้า': getCustomerName(),
            'ที่อยู่': getAddress(),
            'ตำบล': getSubdistrict(),
            'อำเภอ': getDistrict(),
            'จังหวัด': getProvince(),
            'รหัสไปรษณีย์': getPostalCode(),
            'ภาค': getRegion(getProvince()),
            'รหัสสินค้า/โปร': productCode,
            'สินค้า': productName,
            'ชื่อโปร': promoName,
            'จำนวน (ชิ้น)': item.quantity || 0,
            'ราคาต่อหน่วย': `฿${(item.pricePerUnit || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'ส่วนลด': `฿${(item.discount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'ยอดรวมรายการ': `฿${itemTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'หมายเลขกล่อง': String(item.boxNumber || 1),
            'หมายเลขติดตาม': getTrackingNumber(),
            'สถานะออเดอร์': getOrderStatusThai(order.orderStatus || ''),
            'สถานะสลิป': (order.slips && order.slips.length > 0) ? `อัปโหลดแล้ว (${order.slips.length})` : (order.slipUrl ? 'อัปโหลดแล้ว' : 'ยังไม่อัปโหลด')
          });
        });
      } else {
        // ไม่มี items - แสดงแถวเดียวจากออเดอร์หลัก
        ordersRawReport.push({
          'วันที่สั่งซื้อ': new Date(order.orderDate).toLocaleDateString('th-TH'),
          'เลขคำสั่งซื้อ': order.orderNumber || order.id,
          'ชื่อลูกค้า': getCustomerName(),
          'ที่อยู่': getAddress(),
          'ตำบล': getSubdistrict(),
          'อำเภอ': getDistrict(),
          'จังหวัด': getProvince(),
          'รหัสไปรษณีย์': getPostalCode(),
          'ภาค': getRegion(getProvince()),
          'รหัสสินค้า/โปร': '-',
          'สินค้า': '-',
          'ชื่อโปร': '-',
          'จำนวน (ชิ้น)': 0,
          'ราคาต่อหน่วย': `฿0.00`,
          'ส่วนลด': `฿0.00`,
          'ยอดรวมรายการ': `฿${(order.totalAmount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          'หมายเลขกล่อง': '0',
          'หมายเลขติดตาม': getTrackingNumber(),
          'สถานะออเดอร์': getOrderStatusThai(order.orderStatus || ''),
          'สถานะสลิป': (order.slips && order.slips.length > 0) ? `อัปโหลดแล้ว (${order.slips.length})` : (order.slipUrl ? 'อัปโหลดแล้ว' : 'ยังไม่อัปโหลด')
        });
      }
    });

    // รายงานลูกค้า
    const customersWithOrders = customers.map(customer => {
      const customerOrders = filteredOrders
        .filter(o => o.customerId === customer.id)
        .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

      const totalSpent = customerOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const lastOrder = customerOrders.length > 0
        ? customerOrders[customerOrders.length - 1].orderDate
        : null;
      const grade = calculateCustomerGrade(totalSpent);

      return {
        'ชื่อลูกค้า': getCustomerDisplayName(customer),
        'เบอร์โทร': customer.phone || '-',
        'จำนวนออเดอร์': customerOrders.length,
        'ยอดซื้อรวม (บาท)': `฿${totalSpent.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        'วันที่ออเดอร์ล่าสุด': lastOrder ? new Date(lastOrder).toLocaleDateString('th-TH') : '-',
        'เกรดลูกค้า': grade,
        'สถานะลูกค้า': customer.lifecycleStatus || '-'
      };
    }).filter(c => c['จำนวนออเดอร์'] > 0);

    return {
      ordersRaw: ordersRawReport,
      stock: stockReport,
      lotStock: lotStockReport,
      customers: customersWithOrders
    };
  }, [orders, customers, products, warehouseStock, stockMovements, productLots, dateRange, startDate, endDate]);

  // ฟังก์ชันดาวน์โหลด CSV
  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert('ไม่มีข้อมูลสำหรับดาวน์โหลด');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape comma and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (!selectedReport) return;

    const exportData: { [key: string]: { data: any[], filename: string } } = {
      'orders-raw': { 
        data: reportData.ordersRaw, 
        filename: `orders-raw_${new Date().toISOString().split('T')[0]}` 
      },
      stock: { 
        data: reportData.stock, 
        filename: 'รายงานสต๊อคคงเหลือ' 
      },
      'lot-stock': { 
        data: reportData.lotStock, 
        filename: `lot-stock_${new Date().toISOString().split('T')[0]}` 
      },
      customers: { 
        data: reportData.customers, 
        filename: 'รายงานลูกค้า' 
      }
    };

    const { data, filename } = exportData[selectedReport];
    downloadCSV(data, filename);
  };

  // ตรวจสอบว่ารายงานมีข้อมูลหรือไม่
  const isReportDataAvailable = (reportType: ReportType): boolean => {
    switch (reportType) {
      case 'orders-raw':
        return orders.length > 0;
      case 'stock':
        return warehouseStock.length > 0;
      case 'lot-stock':
        return productLots.length > 0;
      case 'customers':
        return customers.length > 0;
      default:
        return false;
    }
  };

  const renderReportContent = () => {
    if (!selectedReport) {
      return (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">เลือกรายงานที่ต้องการดูจากด้านบน</p>
        </div>
      );
    }

    // แสดงข้อความถ้าไม่มีข้อมูล
    if (!isReportDataAvailable(selectedReport)) {
      const dataSourceMessages: { [key: string]: string } = {
        'orders-raw': 'ยังไม่มีออเดอร์ในระบบ กรุณาสร้างออเดอร์ที่เมนู "สร้างออเดอร์"',
        stock: 'ระบบยังไม่มีข้อมูลสต๊อคคงเหลือในฐานข้อมูล กรุณาเพิ่มข้อมูลที่เมนู "จัดการสินค้าคงคลัง"',
        'lot-stock': 'ระบบยังไม่มีข้อมูล Product Lots ในฐานข้อมูล กรุณารับสินค้าเข้าคลังที่เมนู "รับสินค้าเข้าคลัง"',
        customers: 'ยังไม่มีข้อมูลลูกค้าที่มีออเดอร์ในช่วงเวลาที่เลือก'
      };

      return (
        <div className="text-center py-20">
          <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium mb-2">ไม่มีข้อมูลสำหรับรายงานนี้</p>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            {dataSourceMessages[selectedReport]}
          </p>
        </div>
      );
    }

    const renderTable = (data: any[], title: string, maxPreviewRows: number = 10) => {
      if (data.length === 0) {
        return (
          <div className="text-center py-10 text-gray-500">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p>ไม่พบข้อมูลสำหรับช่วงเวลาที่เลือก</p>
          </div>
        );
      }

      const headers = Object.keys(data[0]);
      const previewData = data.slice(0, maxPreviewRows);
      const hasMore = data.length > maxPreviewRows;

      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  {headers.map(header => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {idx + 1}
                    </td>
                    {headers.map(header => {
                      let content = row[header] ?? '-';
                      let className = "px-6 py-4 whitespace-nowrap text-sm text-gray-900";
                      
                      // จัดรูปแบบตามประเภทข้อมูล
                      if (typeof row[header] === 'number' && header.toLowerCase().includes('amount')) {
                        content = `฿${row[header].toLocaleString()}`;
                      } else if (header === 'สถานะออเดอร์') {
                        // แสดงสถานะด้วยสี
                        const statusColors: { [key: string]: string } = {
                          'รอดำเนินการ': 'bg-yellow-100 text-yellow-800',
                          'ยืนยันแล้ว': 'bg-blue-100 text-blue-800',
                          'กำลังจัดเตรียม': 'bg-purple-100 text-purple-800',
                          'กำลังจัดส่ง': 'bg-indigo-100 text-indigo-800',
                          'จัดส่งสำเร็จ': 'bg-green-100 text-green-800',
                          'ยกเลิก': 'bg-red-100 text-red-800',
                          'ตีกลับ': 'bg-orange-100 text-orange-800'
                        };
                        const statusColor = statusColors[content] || 'bg-gray-100 text-gray-800';
                        return (
                          <td key={header} className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                              {content}
                            </span>
                          </td>
                        );
                      }
                      
                      return (
                        <td key={header} className={className}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {hasMore && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    แสดงเพียง {maxPreviewRows} รายการแรก จากทั้งหมด {data.length.toLocaleString()} รายการ
                  </p>
                  <p className="text-xs text-blue-700">
                    กรุณาคลิก "ดาวน์โหลด CSV" เพื่อดูข้อมูลทั้งหมด
                  </p>
                </div>
              </div>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดทั้งหมด
              </button>
            </div>
          )}
        </div>
      );
    };

    switch (selectedReport) {
      case 'orders-raw':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานออเดอร์แบบละเอียด (Raw Data)</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนออเดอร์</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {orders.filter(o => {
                    const orderDate = new Date(o.orderDate);
                    let filterStartDate = new Date();
                    filterStartDate.setHours(0, 0, 0, 0);
                    let filterEndDate = new Date();
                    filterEndDate.setHours(23, 59, 59, 999);

                    switch (dateRange) {
                      case 'today':
                        break;
                      case 'week':
                        filterStartDate.setDate(filterStartDate.getDate() - 7);
                        break;
                      case 'month':
                        filterStartDate.setMonth(filterStartDate.getMonth() - 1);
                        break;
                      case 'year':
                        filterStartDate.setFullYear(filterStartDate.getFullYear() - 1);
                        break;
                      case 'custom':
                        if (startDate) filterStartDate = new Date(startDate);
                        if (endDate) {
                          filterEndDate = new Date(endDate);
                          filterEndDate.setHours(23, 59, 59, 999);
                        }
                        break;
                    }
                    return orderDate >= filterStartDate && orderDate <= filterEndDate;
                  }).length}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนรายการสินค้า</p>
                <p className="text-2xl font-bold text-green-600">
                  {reportData.ordersRaw.length}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่ารวม</p>
                <p className="text-2xl font-bold text-blue-600">
                  ฿{orders.filter(o => {
                    const orderDate = new Date(o.orderDate);
                    let filterStartDate = new Date();
                    filterStartDate.setHours(0, 0, 0, 0);
                    let filterEndDate = new Date();
                    filterEndDate.setHours(23, 59, 59, 999);

                    switch (dateRange) {
                      case 'today':
                        break;
                      case 'week':
                        filterStartDate.setDate(filterStartDate.getDate() - 7);
                        break;
                      case 'month':
                        filterStartDate.setMonth(filterStartDate.getMonth() - 1);
                        break;
                      case 'year':
                        filterStartDate.setFullYear(filterStartDate.getFullYear() - 1);
                        break;
                      case 'custom':
                        if (startDate) filterStartDate = new Date(startDate);
                        if (endDate) {
                          filterEndDate = new Date(endDate);
                          filterEndDate.setHours(23, 59, 59, 999);
                        }
                        break;
                    }
                    return orderDate >= filterStartDate && orderDate <= filterEndDate;
                  }).reduce((sum, o) => sum + o.totalAmount, 0).toLocaleString()}
                </p>
              </div>
            </div>
            {renderTable(reportData.ordersRaw, 'รายการออเดอร์แบบละเอียด')}
          </div>
        );

      case 'stock':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานสต๊อคคงเหลือ</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">รายการสินค้าทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-600">{reportData.stock.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่าสต๊อครวม</p>
                <p className="text-2xl font-bold text-green-600">
                  ฿{reportData.stock.reduce((sum, s) => sum + s.totalValue, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนรวมทั้งหมด</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {reportData.stock.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()}
                </p>
              </div>
            </div>
            {renderTable(reportData.stock, 'สต๊อคคงเหลือ')}
          </div>
        );

      case 'lot-stock':
        const totalLots = reportData.lotStock.length;
        const activeLots = productLots.filter(l => l.status === 'Active').length;
        const expiredLots = productLots.filter(l => l.status === 'Expired').length;
        const depletedLots = productLots.filter(l => l.status === 'Depleted').length;
        const totalValue = productLots.reduce((sum, l) => sum + ((l.quantityRemaining || 0) * (l.unitCost || 0)), 0);
        const totalQuantity = productLots.reduce((sum, l) => sum + (l.quantityRemaining || 0), 0);
        
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานสต๊อคคงคลัง-Lot</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Lot ทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-600">{totalLots}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeLots}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-red-600">{expiredLots}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Depleted</p>
                <p className="text-2xl font-bold text-gray-600">{depletedLots}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">จำนวนคงเหลือรวม</p>
                <p className="text-2xl font-bold text-purple-600">{totalQuantity.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่ารวม</p>
                <p className="text-2xl font-bold text-indigo-600">฿{totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            {renderTable(reportData.lotStock, 'สต๊อคแยกตาม Lot')}
          </div>
        );

      case 'customers':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-4">รายงานลูกค้า</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-pink-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">ลูกค้าที่มีออเดอร์</p>
                <p className="text-2xl font-bold text-pink-600">{reportData.customers.length}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">มูลค่าซื้อรวม</p>
                <p className="text-2xl font-bold text-purple-600">
                  ฿{reportData.customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}
                </p>
              </div>
            </div>
            {renderTable(reportData.customers, 'ลูกค้า')}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">รายงาน</h1>
          <p className="text-gray-600 mt-1">จัดการและดาวน์โหลดรายงานต่างๆ ของระบบ</p>
        </div>
        <BarChart3 className="w-12 h-12 text-indigo-500" />
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportCards.map(card => {
          const Icon = card.icon;
          const isSelected = selectedReport === card.id;
          const hasData = isReportDataAvailable(card.id);
          
          return (
            <button
              key={card.id}
              onClick={() => setSelectedReport(card.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left relative ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow'
              }`}
            >
              {/* Status Badge */}
              <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                hasData 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {hasData ? 'มีข้อมูล' : 'ไม่มีข้อมูล'}
              </div>
              
              <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1 pr-16">{card.title}</h3>
              <p className="text-xs text-gray-600">{card.description}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {selectedReport && (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">ช่วงเวลา:</span>
            </div>

            <div className="flex gap-2">
              {[
                { value: 'today', label: 'วันนี้' },
                { value: 'week', label: '7 วัน' },
                { value: 'month', label: '30 วัน' },
                { value: 'year', label: '1 ปี' },
                { value: 'custom', label: 'กำหนดเอง' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === option.value
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <span className="text-gray-500">ถึง</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={!selectedReport || !isReportDataAvailable(selectedReport)}
              className={`ml-auto px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                selectedReport && isReportDataAvailable(selectedReport)
                  ? 'bg-green-500 text-white hover:bg-green-600 cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลด CSV
            </button>
          </div>
        </div>
      )}

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        {renderReportContent()}
      </div>
    </div>
  );
};

export default ReportsPage;
