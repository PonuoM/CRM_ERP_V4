// ตัวอย่างการใช้งานระบบเลือกคลังสินค้าอัตโนมัติ

import { selectBestWarehouse, getWarehouseRecommendations, canWarehouseDeliverTo } from './warehouseSelector';

// ข้อมูลคลังสินค้าตัวอย่าง
const sampleWarehouses = [
  {
    id: 1,
    name: 'คลังกรุงเทพ',
    province: 'กรุงเทพมหานคร',
    responsibleProvinces: ['กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร'],
    isActive: true
  },
  {
    id: 2,
    name: 'คลังเชียงใหม่',
    province: 'เชียงใหม่',
    responsibleProvinces: ['เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน'],
    isActive: true
  },
  {
    id: 3,
    name: 'คลังอุดรธานี',
    province: 'อุดรธานี',
    responsibleProvinces: ['อุดรธานี', 'หนองคาย', 'เลย', 'หนองบัวลำภู', 'สกลนคร'],
    isActive: true
  },
  {
    id: 4,
    name: 'คลังขอนแก่น',
    province: 'ขอนแก่น',
    responsibleProvinces: ['ขอนแก่น', 'มหาสารคาม', 'ร้อยเอ็ด', 'กาฬสินธุ์', 'ชัยภูมิ'],
    isActive: true
  }
];

// ตัวอย่างการใช้งาน
export function demonstrateWarehouseSelection() {
  console.log('=== ตัวอย่างการเลือกคลังสินค้าอัตโนมัติ ===\n');

  // ตัวอย่าง 1: ลูกค้าอยู่กรุงเทพ
  console.log('1. ลูกค้าอยู่กรุงเทพมหานคร:');
  const result1 = selectBestWarehouse('กรุงเทพมหานคร', sampleWarehouses);
  if (result1) {
    console.log(`   คลังที่เลือก: ${result1.warehouseName}`);
    console.log(`   เหตุผล: ${result1.reason}`);
    console.log(`   ระยะทาง: ${result1.distance} กม.\n`);
  }

  // ตัวอย่าง 2: ลูกค้าอยู่เชียงใหม่
  console.log('2. ลูกค้าอยู่เชียงใหม่:');
  const result2 = selectBestWarehouse('เชียงใหม่', sampleWarehouses);
  if (result2) {
    console.log(`   คลังที่เลือก: ${result2.warehouseName}`);
    console.log(`   เหตุผล: ${result2.reason}`);
    console.log(`   ระยะทาง: ${result2.distance} กม.\n`);
  }

  // ตัวอย่าง 3: ลูกค้าอยู่จังหวัดที่ไม่มีคลังรับผิดชอบ
  console.log('3. ลูกค้าอยู่ภูเก็ต (ไม่มีคลังรับผิดชอบ):');
  const result3 = selectBestWarehouse('ภูเก็ต', sampleWarehouses);
  if (result3) {
    console.log(`   คลังที่เลือก: ${result3.warehouseName}`);
    console.log(`   เหตุผล: ${result3.reason}`);
    console.log(`   ระยะทาง: ${result3.distance} กม.\n`);
  } else {
    console.log('   ไม่พบคลังที่สามารถจัดส่งได้\n');
  }

  // ตัวอย่าง 4: แสดงคำแนะนำคลังทั้งหมดสำหรับลูกค้าในกรุงเทพ
  console.log('4. คำแนะนำคลังทั้งหมดสำหรับลูกค้าในกรุงเทพ:');
  const recommendations = getWarehouseRecommendations('กรุงเทพมหานคร', sampleWarehouses);
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec.warehouseName} (${rec.province}) - ระยะทาง: ${rec.distance} กม.`);
  });
  console.log('');

  // ตัวอย่าง 5: ตรวจสอบว่าคลังสามารถจัดส่งได้หรือไม่
  console.log('5. ตรวจสอบความสามารถในการจัดส่ง:');
  console.log(`   คลังกรุงเทพ → เชียงใหม่: ${canWarehouseDeliverTo(1, 'เชียงใหม่', sampleWarehouses) ? 'ได้' : 'ไม่ได้'}`);
  console.log(`   คลังกรุงเทพ → นนทบุรี: ${canWarehouseDeliverTo(1, 'นนทบุรี', sampleWarehouses) ? 'ได้' : 'ไม่ได้'}`);
  console.log(`   คลังเชียงใหม่ → เชียงราย: ${canWarehouseDeliverTo(2, 'เชียงราย', sampleWarehouses) ? 'ได้' : 'ไม่ได้'}`);
}

// ฟังก์ชันสำหรับใช้ในระบบจริง
export function getWarehouseForOrder(customerProvince: string, warehouses: any[]) {
  const result = selectBestWarehouse(customerProvince, warehouses);
  
  if (!result) {
    throw new Error(`ไม่พบคลังสินค้าที่สามารถจัดส่งไปยังจังหวัด ${customerProvince} ได้`);
  }
  
  return {
    warehouseId: result.warehouseId,
    warehouseName: result.warehouseName,
    selectionReason: result.reason,
    estimatedDistance: result.distance
  };
}

// ฟังก์ชันสำหรับแสดงข้อมูลคลังที่แนะนำ
export function getWarehouseOptions(customerProvince: string, warehouses: any[]) {
  const recommendations = getWarehouseRecommendations(customerProvince, warehouses);
  
  return recommendations.map((rec, index) => ({
    id: rec.warehouseId,
    name: rec.warehouseName,
    province: rec.province,
    distance: rec.distance,
    priority: index + 1,
    isRecommended: index === 0
  }));
}
