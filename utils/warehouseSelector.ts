// ระบบเลือกคลังสินค้าอัตโนมัติตามจังหวัดใกล้เคียง

export interface ProvinceDistance {
  province: string;
  distance: number;
  warehouseId: number;
  warehouseName: string;
}

// ข้อมูลระยะทางระหว่างจังหวัด (ตัวอย่าง - ในระบบจริงควรใช้ API หรือฐานข้อมูล)
const PROVINCE_DISTANCES: Record<string, Record<string, number>> = {
  'กรุงเทพมหานคร': {
    'กรุงเทพมหานคร': 0,
    'นนทบุรี': 20,
    'ปทุมธานี': 25,
    'สมุทรปราการ': 30,
    'สมุทรสาคร': 35,
    'ชลบุรี': 80,
    'ระยอง': 150,
    'จันทบุรี': 200,
    'ตราด': 250,
    'เพชรบุรี': 120,
    'ประจวบคีรีขันธ์': 200,
    'กาญจนบุรี': 120,
    'สุพรรณบุรี': 100,
    'นครปฐม': 60,
    'ราชบุรี': 100,
    'ลพบุรี': 150,
    'สระบุรี': 100,
    'สิงห์บุรี': 120,
    'อ่างทอง': 100,
    'พระนครศรีอยุธยา': 80,
    'ชัยนาท': 120,
    'อุทัยธานี': 150,
    'นครสวรรค์': 200,
    'กำแพงเพชร': 250,
    'พิจิตร': 200,
    'พิษณุโลก': 300,
    'สุโขทัย': 350,
    'ตาก': 400,
    'เพชรบูรณ์': 250,
    'เชียงใหม่': 700,
    'เชียงราย': 800,
    'ลำปาง': 600,
    'ลำพูน': 650,
    'แม่ฮ่องสอน': 900,
    'น่าน': 700,
    'พะเยา': 750,
    'แพร่': 650,
    'อุตรดิตถ์': 500,
    'อุดรธานี': 500,
    'หนองคาย': 550,
    'เลย': 450,
    'หนองบัวลำภู': 450,
    'สกลนคร': 400,
    'นครพนม': 450,
    'มุกดาหาร': 400,
    'ขอนแก่น': 400,
    'มหาสารคาม': 350,
    'ร้อยเอ็ด': 350,
    'กาฬสินธุ์': 300,
    'ชัยภูมิ': 250,
    'อำนาจเจริญ': 400,
    'นครราชสีมา': 200,
    'บุรีรัมย์': 250,
    'สุรินทร์': 300,
    'ศรีสะเกษ': 350,
    'ยโสธร': 400,
    'กาญจนบุรี': 120,
    'สุพรรณบุรี': 100,
    'นครปฐม': 60,
    'ราชบุรี': 100,
    'เพชรบุรี': 120,
    'ประจวบคีรีขันธ์': 200,
    'ชุมพร': 400,
    'ระนอง': 500,
    'กระบี่': 600,
    'พังงา': 650,
    'ภูเก็ต': 700,
    'ตรัง': 650,
    'สตูล': 700,
    'สงขลา': 600,
    'พัทลุง': 650,
    'ปัตตานี': 700,
    'ยะลา': 750,
    'นราธิวาส': 800
  }
};

// ฟังก์ชันคำนวณระยะทางระหว่างจังหวัด
export function calculateProvinceDistance(fromProvince: string, toProvince: string): number {
  if (fromProvince === toProvince) return 0;
  
  // ตรวจสอบในทิศทางตรง
  if (PROVINCE_DISTANCES[fromProvince] && PROVINCE_DISTANCES[fromProvince][toProvince]) {
    return PROVINCE_DISTANCES[fromProvince][toProvince];
  }
  
  // ตรวจสอบในทิศทางย้อนกลับ
  if (PROVINCE_DISTANCES[toProvince] && PROVINCE_DISTANCES[toProvince][fromProvince]) {
    return PROVINCE_DISTANCES[toProvince][fromProvince];
  }
  
  // ถ้าไม่พบข้อมูล ให้คืนค่าขนาดใหญ่
  return 9999;
}

// ฟังก์ชันเลือกคลังสินค้าที่เหมาะสมที่สุด
export function selectBestWarehouse(
  customerProvince: string,
  warehouses: Array<{
    id: number;
    name: string;
    province: string;
    responsibleProvinces: string[];
    isActive: boolean;
  }>
): {
  warehouseId: number;
  warehouseName: string;
  reason: string;
  distance: number;
} | null {
  // กรองคลังที่ใช้งานอยู่และรับผิดชอบจังหวัดลูกค้า
  const eligibleWarehouses = warehouses.filter(warehouse => 
    warehouse.isActive && 
    warehouse.responsibleProvinces.includes(customerProvince)
  );

  if (eligibleWarehouses.length === 0) {
    return null;
  }

  // คำนวณระยะทางและเลือกที่ใกล้ที่สุด
  const distances: ProvinceDistance[] = eligibleWarehouses.map(warehouse => ({
    province: warehouse.province,
    distance: calculateProvinceDistance(customerProvince, warehouse.province),
    warehouseId: warehouse.id,
    warehouseName: warehouse.name
  }));

  // เรียงตามระยะทาง
  distances.sort((a, b) => a.distance - b.distance);

  const best = distances[0];
  
  return {
    warehouseId: best.warehouseId,
    warehouseName: best.warehouseName,
    reason: best.distance === 0 
      ? `คลังอยู่ในจังหวัดเดียวกับลูกค้า (${customerProvince})`
      : `คลังที่ใกล้ที่สุด (ระยะทาง ${best.distance} กม.)`,
    distance: best.distance
  };
}

// ฟังก์ชันแนะนำคลังสินค้าทั้งหมดเรียงตามระยะทาง
export function getWarehouseRecommendations(
  customerProvince: string,
  warehouses: Array<{
    id: number;
    name: string;
    province: string;
    responsibleProvinces: string[];
    isActive: boolean;
  }>
): ProvinceDistance[] {
  const eligibleWarehouses = warehouses.filter(warehouse => 
    warehouse.isActive && 
    warehouse.responsibleProvinces.includes(customerProvince)
  );

  const distances: ProvinceDistance[] = eligibleWarehouses.map(warehouse => ({
    province: warehouse.province,
    distance: calculateProvinceDistance(customerProvince, warehouse.province),
    warehouseId: warehouse.id,
    warehouseName: warehouse.name
  }));

  return distances.sort((a, b) => a.distance - b.distance);
}

// ฟังก์ชันตรวจสอบว่าคลังสามารถจัดส่งไปจังหวัดนั้นได้หรือไม่
export function canWarehouseDeliverTo(
  warehouseId: number,
  customerProvince: string,
  warehouses: Array<{
    id: number;
    responsibleProvinces: string[];
    isActive: boolean;
  }>
): boolean {
  const warehouse = warehouses.find(w => w.id === warehouseId);
  if (!warehouse || !warehouse.isActive) return false;
  
  return warehouse.responsibleProvinces.includes(customerProvince);
}

// ฟังก์ชันหาคลังสำรอง (ถ้าคลังหลักไม่ว่าง)
export function getBackupWarehouses(
  customerProvince: string,
  warehouses: Array<{
    id: number;
    name: string;
    province: string;
    responsibleProvinces: string[];
    isActive: boolean;
  }>,
  excludeWarehouseIds: number[] = []
): ProvinceDistance[] {
  const availableWarehouses = warehouses.filter(warehouse => 
    warehouse.isActive && 
    warehouse.responsibleProvinces.includes(customerProvince) &&
    !excludeWarehouseIds.includes(warehouse.id)
  );

  return getWarehouseRecommendations(customerProvince, availableWarehouses);
}
