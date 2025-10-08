import { Customer } from '../types';

/**
 * จัดการวันคงเหลือของลูกค้า
 */
export class OwnershipManager {
  
  /**
   * เพิ่มวันคงเหลือเมื่อขายได้
   * เพิ่ม +90 วัน สูงสุดไม่เกิน 90 วันคงเหลือ
   * เปลี่ยนสถานะเป็น "ลูกค้าเก่า 3 เดือน"
   */
  static addDaysOnSale(customer: Customer): Customer {
    const now = new Date();
    const currentExpiry = new Date(customer.ownershipExpires);
    const daysUntilExpiry = Math.ceil((currentExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // คำนวณวันที่จะเพิ่ม (สูงสุด 90 วัน)
    const daysToAdd = Math.min(90, 90 - daysUntilExpiry);
    
    if (daysToAdd > 0) {
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + daysToAdd);
      
      return {
        ...customer,
        ownershipExpires: newExpiry.toISOString(),
        hasSoldBefore: true,
        lastSaleDate: now.toISOString(),
        followUpCount: 0, // รีเซ็ตจำนวนครั้งที่ติดตาม
        lifecycleStatus: 'ลูกค้าเก่า 3 เดือน' as any,
      };
    }
    
    return {
      ...customer,
      hasSoldBefore: true,
      lastSaleDate: now.toISOString(),
      followUpCount: 0,
      lifecycleStatus: 'ลูกค้าเก่า 3 เดือน' as any,
    };
  }
  
  /**
   * เพิ่มวันคงเหลือเมื่อนัดหมายครั้งแรก
   * เพิ่ม +90 วัน (เฉพาะครั้งแรกเท่านั้น)
   */
  static addDaysOnFirstFollowUp(customer: Customer): Customer {
    const now = new Date();
    const currentExpiry = new Date(customer.ownershipExpires);
    
    // เพิ่ม 90 วัน
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + 90);
    
    return {
      ...customer,
      ownershipExpires: newExpiry.toISOString(),
      followUpCount: (customer.followUpCount || 0) + 1,
      lastFollowUpDate: now.toISOString(),
    };
  }
  
  /**
   * นัดหมายครั้งถัดไป (ไม่เพิ่มวัน)
   */
  static addFollowUp(customer: Customer): Customer {
    const now = new Date();
    
    return {
      ...customer,
      followUpCount: (customer.followUpCount || 0) + 1,
      lastFollowUpDate: now.toISOString(),
    };
  }
  
  /**
   * ตรวจสอบว่าควรเพิ่มวันหรือไม่
   */
  static shouldAddDaysOnFollowUp(customer: Customer): boolean {
    // ถ้าขายได้แล้ว ให้รีเซ็ต logic
    if (customer.hasSoldBefore) {
      return customer.followUpCount === 0; // ครั้งแรกหลังจากขายได้
    }
    
    // ถ้ายังไม่เคยขาย ให้เพิ่มเฉพาะครั้งแรก
    return customer.followUpCount === 0;
  }
  
  /**
   * ตรวจสอบว่าลูกค้าควรเข้าตระกร้ารอ 30 วันหรือไม่
   */
  static shouldMoveToWaitingBasket(customer: Customer): boolean {
    const now = new Date();
    const expiry = new Date(customer.ownershipExpires);
    
    // หมดอายุแล้วและยังไม่อยู่ในตระกร้ารอ
    return expiry <= now && !customer.isInWaitingBasket;
  }
  
  /**
   * ย้ายลูกค้าเข้าตระกร้ารอ 30 วัน
   */
  static moveToWaitingBasket(customer: Customer): Customer {
    const now = new Date();
    
    return {
      ...customer,
      isInWaitingBasket: true,
      waitingBasketStartDate: now.toISOString(),
      lifecycleStatus: 'ลูกค้าติดตาม' as any, // เปลี่ยนสถานะ
    };
  }
  
  /**
   * ตรวจสอบว่าควรย้ายจากตระกร้ารอไปตระกร้าแจกหรือไม่
   */
  static shouldMoveFromWaitingToDistribution(customer: Customer): boolean {
    if (!customer.isInWaitingBasket || !customer.waitingBasketStartDate) {
      return false;
    }
    
    const now = new Date();
    const waitingStart = new Date(customer.waitingBasketStartDate);
    const daysInWaiting = Math.ceil((now.getTime() - waitingStart.getTime()) / (1000 * 60 * 60 * 24));
    
    // ครบ 30 วันแล้ว
    return daysInWaiting >= 30;
  }
  
  /**
   * ย้ายจากตระกร้ารอไปตระกร้าแจก
   */
  static moveFromWaitingToDistribution(customer: Customer): Customer {
    const now = new Date();
    const newExpiry = new Date(now);
    newExpiry.setDate(newExpiry.getDate() + 30); // เริ่มต้นที่ 30 วัน
    
    return {
      ...customer,
      isInWaitingBasket: false,
      waitingBasketStartDate: undefined,
      ownershipExpires: newExpiry.toISOString(),
      lifecycleStatus: 'ลูกค้าแจกรายวัน' as any,
      followUpCount: 0, // รีเซ็ตจำนวนครั้งที่ติดตาม
    };
  }
  
  /**
   * แจกใหม่ (ลูกค้าใหม่หรือเก่าที่ยังขายไม่ได้)
   */
  static redistributeCustomer(customer: Customer): Customer {
    const now = new Date();
    const newExpiry = new Date(now);
    newExpiry.setDate(newExpiry.getDate() + 30); // เริ่มต้นที่ 30 วันเสมอ
    
    return {
      ...customer,
      ownershipExpires: newExpiry.toISOString(),
      lifecycleStatus: 'ลูกค้าแจกรายวัน' as any,
      followUpCount: 0,
      lastFollowUpDate: undefined,
      // ไม่เข้าตระกร้ารอ มาตระกร้าแจกทันที
      isInWaitingBasket: false,
      waitingBasketStartDate: undefined,
    };
  }
  
  /**
   * ตรวจสอบสถานะลูกค้าทั้งหมดและอัปเดตตามเงื่อนไข
   */
  static checkAndUpdateCustomerStatus(customer: Customer): Customer {
    let updatedCustomer = { ...customer };
    
    // ตรวจสอบว่าควรย้ายเข้าตระกร้ารอหรือไม่
    if (this.shouldMoveToWaitingBasket(updatedCustomer)) {
      updatedCustomer = this.moveToWaitingBasket(updatedCustomer);
    }
    
    // ตรวจสอบว่าควรย้ายจากตระกร้ารอไปตระกร้าแจกหรือไม่
    if (this.shouldMoveFromWaitingToDistribution(updatedCustomer)) {
      updatedCustomer = this.moveFromWaitingToDistribution(updatedCustomer);
    }
    
    return updatedCustomer;
  }
  
  /**
   * ดึงรายชื่อคืน
   * - ถ้ายังไม่เคยขายได้: มาตระกร้าแจกทันที (ไม่เข้าตระกร้ารอ)
   * - ถ้าเคยขายได้แล้ว: ต้องพักฟื้น 30 วันในตระกร้ารอ
   */
  static retrieveCustomer(customer: Customer): Customer {
    if (customer.hasSoldBefore) {
      // ถ้าเคยขายได้แล้ว ต้องพักฟื้น 30 วันในตระกร้ารอ
      return this.moveToWaitingBasket(customer);
    } else {
      // ถ้ายังไม่เคยขายได้ มาตระกร้าแจกทันที
      return this.redistributeCustomer(customer);
    }
  }
}
