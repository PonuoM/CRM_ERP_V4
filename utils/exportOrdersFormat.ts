import { Order, Customer, User, Page, Product } from '../types';

export function formatOrdersRaw(
  orders: Order[],
  customers: Customer[],
  users: User[],
  pages: Page[],
  products: Product[],
  orderBoxesMap: Record<string, string>
): any[] {
  const ordersRawReport: any[] = [];

  orders.forEach(order => {
    // Match customer by pk (customer_id) or id (string)
    const customer = customers.find(c => {
      if (c.pk && typeof order.customerId === 'number') {
        return c.pk === order.customerId;
      }
      return String(c.id) === String(order.customerId) ||
        String(c.pk) === String(order.customerId);
    });

    // ฟังก์ชันช่วยดึงข้อมูล - ใช้ข้อมูลจาก order.shippingAddress ก่อน แล้วค่อย fallback ไป order.customerInfo แล้วค่อย customer
    const getCustomerName = () => {
      if (customer) {
        const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
        if (fullName) return fullName;
      }
      if (order.customerInfo) {
        const fullName = `${order.customerInfo.firstName || ''} ${order.customerInfo.lastName || ''}`.trim();
        if (fullName) return fullName;
      }
      if (order.shippingAddress?.recipientFirstName || order.shippingAddress?.recipientLastName) {
        return `${order.shippingAddress.recipientFirstName || ''} ${order.shippingAddress.recipientLastName || ''}`.trim() || '-';
      }
      return '-';
    };

    const getAddress = () => order.shippingAddress?.street || customer?.address?.street || '-';
    const getSubdistrict = () => order.shippingAddress?.subdistrict || customer?.address?.subdistrict || '-';
    const getDistrict = () => order.shippingAddress?.district || customer?.address?.district || '-';
    const getProvince = () => order.shippingAddress?.province || customer?.address?.province || customer?.province || '-';
    const getPostalCode = () => order.shippingAddress?.postalCode || customer?.address?.postalCode || '-';
    const getTrackingNumber = () => {
      if (order.trackingNumbers && order.trackingNumbers.length > 0) {
        return order.trackingNumbers.join(', ');
      }
      return '-';
    };

    const getRegion = (province: string): string => {
      const regionMap: { [key: string]: string } = {
        'กรุงเทพมหานคร': 'ภาคกลาง', 'นนทบุรี': 'ภาคกลาง', 'ปทุมธานี': 'ภาคกลาง', 'สมุทรปราการ': 'ภาคกลาง',
        'สมุทรสาคร': 'ภาคกลาง', 'นครปฐม': 'ภาคกลาง', 'อยุธยา': 'ภาคกลาง', 'พระนครศรีอยุธยา': 'ภาคกลาง',
        'อ่างทอง': 'ภาคกลาง', 'ลพบุรี': 'ภาคกลาง', 'สิงห์บุรี': 'ภาคกลาง', 'ชัยนาท': 'ภาคกลาง',
        'สระบุรี': 'ภาคกลาง', 'นครนายก': 'ภาคกลาง', 'สุพรรณบุรี': 'ภาคกลาง', 'สมุทรสงคราม': 'ภาคกลาง',
        'เชียงใหม่': 'ภาคเหนือ', 'เชียงราย': 'ภาคเหนือ', 'ลำปาง': 'ภาคเหนือ', 'ลำพูน': 'ภาคเหนือ',
        'แม่ฮ่องสอน': 'ภาคเหนือ', 'แพร่': 'ภาคเหนือ', 'น่าน': 'ภาคเหนือ', 'พะเยา': 'ภาคเหนือ',
        'อุตรดิตถ์': 'ภาคเหนือ', 'ตาก': 'ภาคเหนือ', 'สุโขทัย': 'ภาคเหนือ', 'พิษณุโลก': 'ภาคเหนือ',
        'พิจิตร': 'ภาคเหนือ', 'กำแพงเพชร': 'ภาคเหนือ', 'เพชรบูรณ์': 'ภาคเหนือ', 'นครสวรรค์': 'ภาคเหนือ', 'อุทัยธานี': 'ภาคเหนือ',
        'ขอนแก่น': 'ภาคตะวันออกเฉียงเหนือ', 'อุดรธานี': 'ภาคตะวันออกเฉียงเหนือ', 'นครราชสีมา': 'ภาคตะวันออกเฉียงเหนือ',
        'อุบลราชธานี': 'ภาคตะวันออกเฉียงเหนือ', 'ศรีสะเกษ': 'ภาคตะวันออกเฉียงเหนือ', 'สุรินทร์': 'ภาคตะวันออกเฉียงเหนือ',
        'บุรีรัมย์': 'ภาคตะวันออกเฉียงเหนือ', 'ร้อยเอ็ด': 'ภาคตะวันออกเฉียงเหนือ', 'มหาสารคาม': 'ภาคตะวันออกเฉียงเหนือ',
        'กาฬสินธุ์': 'ภาคตะวันออกเฉียงเหนือ', 'สกลนคร': 'ภาคตะวันออกเฉียงเหนือ', 'นครพนม': 'ภาคตะวันออกเฉียงเหนือ',
        'มุกดาหาร': 'ภาคตะวันออกเฉียงเหนือ', 'เลย': 'ภาคตะวันออกเฉียงเหนือ', 'หนองคาย': 'ภาคตะวันออกเฉียงเหนือ',
        'หนองบัวลำภู': 'ภาคตะวันออกเฉียงเหนือ', 'ยโสธร': 'ภาคตะวันออกเฉียงเหนือ', 'อำนาจเจริญ': 'ภาคตะวันออกเฉียงเหนือ',
        'ชัยภูมิ': 'ภาคตะวันออกเฉียงเหนือ', 'บึงกาฬ': 'ภาคตะวันออกเฉียงเหนือ',
        'ชลบุรี': 'ภาคตะวันออก', 'ระยอง': 'ภาคตะวันออก', 'จันทบุรี': 'ภาคตะวันออก', 'ตราด': 'ภาคตะวันออก',
        'ปราจีนบุรี': 'ภาคตะวันออก', 'สระแก้ว': 'ภาคตะวันออก', 'ฉะเชิงเทรา': 'ภาคตะวันออก',
        'ราชบุรี': 'ภาคตะวันตก', 'กาญจนบุรี': 'ภาคตะวันตก', 'เพชรบุรี': 'ภาคตะวันตก', 'ประจวบคีรีขันธ์': 'ภาคตะวันตก',
        'ภูเก็ต': 'ภาคใต้', 'สุราษฎร์ธานี': 'ภาคใต้', 'กระบี่': 'ภาคใต้', 'นครศรีธรรมราช': 'ภาคใต้',
        'สงขลา': 'ภาคใต้', 'ตรัง': 'ภาคใต้', 'พัทลุง': 'ภาคใต้', 'สตูล': 'ภาคใต้',
        'ชุมพร': 'ภาคใต้', 'ระนอง': 'ภาคใต้', 'พังงา': 'ภาคใต้', 'ปัตตานี': 'ภาคใต้',
        'ยะลา': 'ภาคใต้', 'นราธิวาส': 'ภาคใต้',
      };
      return regionMap[province] || 'ไม่ทราบภาค';
    };

    const getOrderStatusThai = (status: string, orderId?: string, boxNumber?: number): string => {
      const statusMap: { [key: string]: string } = {
        'Pending': 'รอดำเนินการ', 'Confirmed': 'ยืนยันแล้ว', 'Picking': 'กำลังจัดเตรียม',
        'Preparing': 'กำลังจัดเตรียมสินค้า', 'Shipping': 'กำลังจัดส่ง', 'Delivered': 'จัดส่งสำเร็จ',
        'Cancelled': 'ยกเลิก', 'Returned': 'ตีกลับ', 'Claiming': 'รอเคลม',
        'BadDebt': 'หนี้สูญ', 'PreApproved': 'รออนุมัติ'
      };
      const base = statusMap[status] || status;

      if (status === 'Returned' && orderId && boxNumber !== undefined) {
        const key = `${orderId}-${boxNumber}`;
        const returnStatus = orderBoxesMap[key];
        const returnStatusThai: { [key: string]: string } = {
          returning: 'กำลังตีกลับ', returned: 'สภาพดี', good: 'สภาพดี',
          damaged: 'ชำรุด', lost: 'ตีกลับสูญหาย'
        };
        const statusText = returnStatus ? (returnStatusThai[returnStatus] || returnStatus) : 'ไม่ถูกตีกลับ';
        return `ตีกลับ (กล่อง ${boxNumber} : ${statusText})`;
      }
      return base;
    };

    const getSeller = (itemCreatorId?: number) => {
      const creatorId = itemCreatorId ?? order.creatorId;
      const creator = users.find(u => u.id === creatorId);
      if (creator) {
        return `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.username || '-';
      }
      return '-';
    };

    const getSellerRole = (itemCreatorId?: number) => {
      const creatorId = itemCreatorId ?? order.creatorId;
      const creator = users.find(u => u.id === creatorId);
      return creator?.role || '-';
    };

    const getDeliveryDate = () => order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('th-TH-u-ca-gregory') : '-';
    const getSalesChannel = () => order.salesChannel || '-';
    const getPageName = () => {
      if (order.salesChannelPageId) {
        const page = pages.find(p => p.id === order.salesChannelPageId);
        return page?.name || '-';
      }
      return '-';
    };

    const getPaymentMethodThai = () => {
      const methodMap: { [key: string]: string } = {
        'COD': 'เก็บเงินปลายทาง', 'Transfer': 'โอนเงิน', 'PayAfter': 'จ่ายทีหลัง',
        'Claim': 'เคลม', 'FreeGift': 'ของแถม'
      };
      return methodMap[order.paymentMethod] || order.paymentMethod || '-';
    };

    const getCustomerPhone = () => (order as any).customerPhone || customer?.phone || order.customerInfo?.phone || order.shippingAddress?.phone || '-';
    const getAirportDeliveryDate = () => {
      const airportDate = (order as any).airportDeliveryDate;
      return airportDate ? new Date(airportDate).toLocaleDateString('th-TH-u-ca-gregory') : '-';
    };

    const getCustomerType = () => {
      let customerType = order.customerType || customer?.lifecycleStatus || '-';
      const typeMap: { [key: string]: string } = {
        'New Customer': 'ลูกค้าใหม่', 'Reorder Customer': 'ลูกค้ารีออเดอร์', 'Reorder': 'ลูกค้ารีออเดอร์'
      };
      return typeMap[customerType] || customerType;
    };

    const getPaymentComparisonStatus = () => {
      const paid = (order as any).amountPaid || 0;
      const total = order.totalAmount || 0;
      if (total === 0) return 'ไม่มียอด';
      if (paid === 0) return 'ค้าง';
      if (paid === total) return 'ตรง';
      if (paid < total) return 'ขาด';
      return 'เกิน';
    };

    if (order.items && order.items.length > 0) {
      const creatorTotals: Record<string, number> = {};
      const seenCreators = new Set<string>();
      
      const sortedItems = [...order.items].sort((a, b) => {
        const cidA = String(a.creatorId ?? order.creatorId ?? '');
        const cidB = String(b.creatorId ?? order.creatorId ?? '');
        if (cidA !== cidB) return cidA.localeCompare(cidB);
        return (a.id || 0) - (b.id || 0);
      });

      sortedItems.forEach(item => {
        const cid = String(item.creatorId ?? order.creatorId ?? '');
        const isPromoParent = !!(item as any).isPromotionParent;
        const isPromoChild = !!(item as any).parentItemId;
        const qty = item.quantity || 0;
        const netTotal = (item as any).netTotal || 0;
        const retailPrice = item.pricePerUnit || 0;

        let itTotal: number;
        if (isPromoParent) {
          itTotal = 0;
        } else if (isPromoChild) {
          itTotal = netTotal;
        } else if (item.isFreebie) {
          itTotal = 0;
        } else {
          const calculatedTotal = (retailPrice * qty) - (item.discount || 0);
          itTotal = calculatedTotal > 0 ? calculatedTotal : netTotal;
        }

        if (!item.isFreebie && !isPromoParent) {
          creatorTotals[cid] = (creatorTotals[cid] || 0) + itTotal;
        }
      });

      const grossTotal = Object.values(creatorTotals).reduce((sum, val) => sum + val, 0);
      const shippingCost = order.shippingCost || 0;
      const billDiscount = order.billDiscount || 0;

      if (shippingCost > 0 || billDiscount > 0) {
        const creatorIds = Object.keys(creatorTotals);
        if (grossTotal > 0) {
          creatorIds.forEach(cid => {
            const ratio = creatorTotals[cid] / grossTotal;
            creatorTotals[cid] = creatorTotals[cid] + (shippingCost * ratio) - (billDiscount * ratio);
          });
        } else if (creatorIds.length > 0) {
          const splitShipping = shippingCost / creatorIds.length;
          const splitDiscount = billDiscount / creatorIds.length;
          creatorIds.forEach(cid => {
            creatorTotals[cid] = creatorTotals[cid] + splitShipping - splitDiscount;
          });
        }
      }

      sortedItems.forEach((item, index) => {
        const cid = String(item.creatorId ?? order.creatorId ?? '');
        let displayCreatorTotal: number | string = '-';
        if (!seenCreators.has(cid)) {
          seenCreators.add(cid);
          displayCreatorTotal = creatorTotals[cid] || 0;
        }

        const isPromoParent = !!(item as any).isPromotionParent;
        const isPromoChild = !!(item as any).parentItemId;
        const qty = item.quantity || 0;
        const netTotal = (item as any).netTotal || 0;
        const retailPrice = item.pricePerUnit || 0;

        let effectiveDiscount: number;
        let itemTotal: number;

        if (isPromoParent) {
          effectiveDiscount = 0; itemTotal = 0;
        } else if (isPromoChild) {
          const retailTotal = qty * retailPrice;
          effectiveDiscount = retailTotal - netTotal;
          itemTotal = netTotal;
        } else if (item.isFreebie) {
          effectiveDiscount = item.discount || 0; itemTotal = 0;
        } else {
          effectiveDiscount = item.discount || 0;
          const calculatedTotal = (retailPrice * qty) - effectiveDiscount;
          itemTotal = calculatedTotal > 0 ? calculatedTotal : netTotal;
        }

        let productCode = '-';
        if (item.isPromotionParent) {
          productCode = item.promotionId ? `PROMO-${String(item.promotionId).padStart(3, '0')}` : '-';
        } else if (item.promotionId) {
          productCode = `PROMO-${String(item.promotionId).padStart(3, '0')}`;
        } else if ((item as any).productSku) {
          productCode = (item as any).productSku;
        } else if (item.productId) {
          const product = products.find(p => p.id === item.productId);
          productCode = product?.sku || '-';
        }

        const productForCategory = products.find(p => p.id === item.productId);
        const productCategory = (item as any).productCategory || productForCategory?.category || '-';
        const productReportCategory = (item as any).productReportCategory || (productForCategory as any)?.report_category || '-';

        let productName = item.productName || '-';
        let promoName = '-';

        if (item.isPromotionParent) {
          promoName = item.productName || '-';
          productName = `📦 ${item.productName}` || '-';
        } else if (item.promotionId && item.parentItemId) {
          const parentItem = order.items.find(i => i.id === item.parentItemId);
          promoName = parentItem?.productName || '-';
          productName = item.isFreebie ? `${item.productName} (ของแถม)` : item.productName;
        }

        ordersRawReport.push({
          'วันที่สั่งซื้อ': new Date(order.orderDate).toLocaleDateString('th-TH-u-ca-gregory'),
          'เวลาสั่งซื้อ': new Date(order.orderDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
          'เลขคำสั่งซื้อ': order.id,
          'user_id': item.creatorId ?? order.creatorId ?? '',
          'ผู้ขาย': getSeller(item.creatorId),
          'แผนก': getSellerRole(item.creatorId),
          'ชื่อลูกค้า': getCustomerName(),
          'เบอร์โทรลูกค้า': getCustomerPhone(),
          'ประเภทลูกค้า': getCustomerType(),
          'วันที่จัดส่ง': getDeliveryDate(),
          'ช่องทางสั่งซื้อ': getSalesChannel(),
          'เพจ': getPageName(),
          'ช่องทางการชำระ': getPaymentMethodThai(),
          'ที่อยู่': getAddress(),
          'ตำบล': getSubdistrict(),
          'อำเภอ': getDistrict(),
          'จังหวัด': getProvince(),
          'รหัสไปรษณีย์': getPostalCode(),
          'ภาค': getRegion(getProvince()),
          'รหัสสินค้า/โปร': productCode,
          'สินค้า': productName,
          'ประเภทสินค้า': productCategory,
          'ประเภทสินค้า (รีพอร์ต)': productReportCategory,
          'ชื่อโปร': promoName,
          'ของแถม': item.isFreebie ? 'ใช่' : 'ไม่',
          'จำนวน (ชิ้น)': item.quantity || 0,
          'ราคาต่อหน่วย': isPromoParent ? 0 : retailPrice,
          'ส่วนลด': effectiveDiscount,
          'ยอดรวมรายการ': (item.isFreebie || isPromoParent) ? 0 : itemTotal,
          'ค่าจัดส่ง (ต่อบิล)': order.shippingCost || 0,
          'ส่วนลดท้ายบิล': order.billDiscount || 0,
          'ยอดรวมทั้งบิล': index === 0 ? (order.totalAmount || 0) : '-',
          'ยอดรวมรายคน': displayCreatorTotal,
          'หมายเลขกล่อง': String(item.boxNumber || 1),
          'หมายเลขติดตาม': getTrackingNumber(),
          'วันที่จัดส่ง Airport': getAirportDeliveryDate(),
          'สถานะจาก Airport': (order as any).airportDeliveryStatus || '-',
          'สถานะออเดอร์': getOrderStatusThai(order.orderStatus || '', order.id, item.boxNumber || 1),
          'สถานะการชำระเงิน': getPaymentComparisonStatus(),
          'สถานะสลิป': (order.slips && order.slips.length > 0) ? `อัปโหลดแล้ว (${order.slips.length})` : (order.slipUrl ? 'อัปโหลดแล้ว' : 'ยังไม่อัปโหลด'),
          'วันที่รับเงิน': (order as any).paymentReceivedDate ? new Date((order as any).paymentReceivedDate).toLocaleDateString('th-TH-u-ca-gregory') : '-',
          'ตะกร้าขาย': (item as any).basketKeyAtSale || '-',
          'สาเหตุยอดไม่ตรง': '-'
        });
      });
    } else {
      ordersRawReport.push({
        'วันที่สั่งซื้อ': new Date(order.orderDate).toLocaleDateString('th-TH-u-ca-gregory'),
        'เวลาสั่งซื้อ': new Date(order.orderDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
        'เลขคำสั่งซื้อ': order.id,
        'user_id': order.creatorId ?? '',
        'ผู้ขาย': getSeller(),
        'แผนก': getSellerRole(),
        'ชื่อลูกค้า': getCustomerName(),
        'เบอร์โทรลูกค้า': getCustomerPhone(),
        'ประเภทลูกค้า': getCustomerType(),
        'วันที่จัดส่ง': getDeliveryDate(),
        'ช่องทางสั่งซื้อ': getSalesChannel(),
        'เพจ': getPageName(),
        'ช่องทางการชำระ': getPaymentMethodThai(),
        'ที่อยู่': getAddress(),
        'ตำบล': getSubdistrict(),
        'อำเภอ': getDistrict(),
        'จังหวัด': getProvince(),
        'รหัสไปรษณีย์': getPostalCode(),
        'ภาค': getRegion(getProvince()),
        'รหัสสินค้า/โปร': '-',
        'สินค้า': '-',
        'ประเภทสินค้า': '-',
        'ประเภทสินค้า (รีพอร์ต)': '-',
        'ชื่อโปร': '-',
        'ของแถม': '-',
        'จำนวน (ชิ้น)': 0,
        'ราคาต่อหน่วย': '-',
        'ส่วนลด': '-',
        'ยอดรวมรายการ': '-',
        'ค่าจัดส่ง (ต่อบิล)': order.shippingCost || 0,
        'ส่วนลดท้ายบิล': order.billDiscount || 0,
        'ยอดรวมทั้งบิล': order.totalAmount || 0,
        'ยอดรวมรายคน': order.totalAmount || 0,
        'หมายเลขกล่อง': '1',
        'หมายเลขติดตาม': getTrackingNumber(),
        'วันที่จัดส่ง Airport': getAirportDeliveryDate(),
        'สถานะจาก Airport': (order as any).airportDeliveryStatus || '-',
        'สถานะออเดอร์': getOrderStatusThai(order.orderStatus || '', order.id, 1),
        'สถานะการชำระเงิน': getPaymentComparisonStatus(),
        'สถานะสลิป': (order.slips && order.slips.length > 0) ? `อัปโหลดแล้ว (${order.slips.length})` : (order.slipUrl ? 'อัปโหลดแล้ว' : 'ยังไม่อัปโหลด'),
        'วันที่รับเงิน': (order as any).paymentReceivedDate ? new Date((order as any).paymentReceivedDate).toLocaleDateString('th-TH-u-ca-gregory') : '-',
        'ตะกร้าขาย': '-',
        'สาเหตุยอดไม่ตรง': '-'
      });
    }
  });

  return ordersRawReport;
}
