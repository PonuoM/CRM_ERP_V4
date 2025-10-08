import React, { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { getRolePermissions, saveRolePermissions } from '@/services/api';
import { UserRole } from '@/types';

const PermissionsPage: React.FC = () => {
  // Layout-only placeholder matching the described list view
  const rows = [
    { code: UserRole.SuperAdmin, name: 'Super Admin', createdBy: 'System' },
    { code: UserRole.AdminControl, name: 'Admin Control', createdBy: 'System' },
    { code: UserRole.Admin, name: 'Admin Page', createdBy: 'System' },
    { code: UserRole.Backoffice, name: 'Backoffice', createdBy: 'System' },
    { code: UserRole.Supervisor, name: 'Supervisor Telesale', createdBy: 'System' },
    { code: UserRole.Telesale, name: 'Telesale', createdBy: 'System' },
    { code: UserRole.Marketing, name: 'Marketing', createdBy: 'System' },
  ];

  const [selected, setSelected] = useState<{code: string; name: string} | null>(null);
  const [perms, setPerms] = useState<Record<string, { view?: boolean; use?: boolean }>>({});

  const roleNameTh = (r: string) => ({
    [UserRole.SuperAdmin]: 'ซูเปอร์แอดมิน',
    [UserRole.AdminControl]: 'แอดมินควบคุม',
    [UserRole.Admin]: 'ผู้ดูแล (หน้าแอดมิน)',
    [UserRole.Backoffice]: 'แบ็คออฟฟิศ',
    [UserRole.Supervisor]: 'หัวหน้าทีมเทเลเซล',
    [UserRole.Telesale]: 'เทเลเซล',
    [UserRole.Marketing]: 'การตลาด',
  } as any)[r] || r;

  const catalog: Record<string, { title: string; items: { key: string; label: string; roles: string[]; desc: string }[] }> = {
    home: {
      title: 'หน้าหลัก',
      items: [
        {
          key: 'home.dashboard',
          label: 'แดชบอร์ด',
          roles: [UserRole.SuperAdmin, UserRole.Admin, UserRole.Telesale, UserRole.Supervisor, UserRole.Backoffice],
          desc: 'แสดงแดชบอร์ดตามบทบาท เช่น แอดมิน (สรุปภาพรวมบริษัท), เทเลเซล (ลูกค้าของฉัน/กิจกรรมล่าสุด), แบ็คออฟฟิศ (สถานะคำสั่งซื้อที่ต้องจัดการ)'
        },
        {
          key: 'home.sales_overview',
          label: 'ภาพรวมการขาย',
          roles: [UserRole.SuperAdmin, UserRole.AdminControl, UserRole.Admin],
          desc: 'กราฟ/สถิติยอดขายรวมต่อเดือน ใช้สำหรับฝ่ายบริหาร/การตลาด'
        },
        {
          key: 'home.calls_overview',
          label: 'ภาพรวมการโทร',
          roles: [UserRole.SuperAdmin, UserRole.Supervisor],
          desc: 'จำนวนสายที่โทร/รับ/เวลาคุย รายวัน พร้อมสรุประดับพนักงาน'
        },
      ],
    },
    data: {
      title: 'จัดการข้อมูล',
      items: [
        { key: 'data.users', label: 'ผู้ใช้งาน', roles: [UserRole.SuperAdmin, UserRole.AdminControl], desc: 'เพิ่ม/แก้ไข/ระงับผู้ใช้' },
        { key: 'data.permissions', label: 'สิทธิ์การใช้งาน', roles: [UserRole.SuperAdmin], desc: 'กำหนดการมองเห็นและสิทธิ์ใช้งานเมนูแต่ละตัว' },
        { key: 'data.products', label: 'สินค้า', roles: [UserRole.SuperAdmin, UserRole.AdminControl], desc: 'จัดการสินค้าเดี่ยว/โปรโมชัน' },
        { key: 'data.teams', label: 'ทีม', roles: [UserRole.SuperAdmin, UserRole.AdminControl, UserRole.Supervisor], desc: 'กำหนดพนักงานอยู่ทีมใด' },
        { key: 'data.pages', label: 'เพจ', roles: [UserRole.SuperAdmin, UserRole.Marketing], desc: 'เพิ่ม/ลด/เปิด-ปิด เพจที่ใช้ขาย' },
        { key: 'data.tags', label: 'แท็ก', roles: [UserRole.SuperAdmin, UserRole.AdminControl], desc: 'แท็กระบบ และแท็กที่พนักงานสร้าง (จำกัด 10/คน)' },
      ],
    },
    nav: {
      title: 'เมนูนำทาง',
      items: [
        { key: 'nav.orders', label: 'คำสั่งซื้อ', roles: [UserRole.Telesale, UserRole.Supervisor, UserRole.Admin], desc: 'ดู/สร้างคำสั่งซื้อของฉัน' },
        { key: 'nav.customers', label: 'ลูกค้า', roles: [UserRole.Telesale, UserRole.Supervisor, UserRole.Admin], desc: 'ค้นหา/ดู/ติดตามลูกค้า' },
        { key: 'nav.manage_orders', label: 'จัดการคำสั่งซื้อ', roles: [UserRole.Backoffice], desc: 'คิวตรวจสลิป/ใส่เลขพัสดุ/สถานะส่งคืน ฯลฯ' },
        { key: 'nav.debt', label: 'ติดตามหนี้', roles: [UserRole.Backoffice], desc: 'ติดตามการชำระเงิน เก็บเงินปลายทาง ฯลฯ' },
        { key: 'nav.reports', label: 'รายงาน', roles: [UserRole.Backoffice, UserRole.SuperAdmin], desc: 'รายงานภาพรวมด้านคำสั่งซื้อ' },
        { key: 'nav.bulk_tracking', label: 'บันทึกเลขพัสดุ', roles: [UserRole.Backoffice], desc: 'อัปโหลดเลขพัสดุแบบจำนวนมาก' },
        { key: 'nav.search', label: 'ค้นหา', roles: [UserRole.SuperAdmin, UserRole.Admin, UserRole.Backoffice, UserRole.Telesale, UserRole.Supervisor], desc: 'ค้นหาลูกค้า/คำสั่งซื้อ' },
        { key: 'nav.call_history', label: 'ประวัติการโทร', roles: [UserRole.SuperAdmin, UserRole.AdminControl, UserRole.Admin, UserRole.Telesale, UserRole.Supervisor, UserRole.Backoffice], desc: 'ประวัติการโทรที่บันทึกในระบบ กรองได้ตามวันที่/ชื่อลูกค้า/สถานะ' },
        { key: 'nav.share', label: 'แชร์', roles: [UserRole.SuperAdmin, UserRole.AdminControl], desc: 'เมนูควบคุมภายในสำหรับผู้ดูแล' },
        { key: 'nav.settings', label: 'การตั้งค่า', roles: [UserRole.SuperAdmin, UserRole.AdminControl], desc: 'ตั้งค่าระบบ' },
        { key: 'nav.data', label: 'ข้อมูล', roles: [UserRole.SuperAdmin, UserRole.AdminControl], desc: 'เมนูข้อมูลภายใน' },
      ],
    },
  };

  const openManage = async (role: string, name: string) => {
    setSelected({ code: role, name });
    try {
      const res = await getRolePermissions(role);
      const data = (res && res.data) || {};
      setPerms(data);
    } catch (e) {
      setPerms({});
    }
  };

  const toggleModule = (key: string) =>
    setModules(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">สิทธิ์การใช้งาน</h2>
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">คำค้น</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="ค้นหา" />
          </div>
          <div className="flex items-end">
            <button className="mr-2 px-4 py-2 border rounded-md text-sm">ค้นหา</button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm">เพิ่มสิทธิ์</button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 px-3 font-medium">รหัสบทบาท</th>
              <th className="py-2 px-3 font-medium">ชื่อบทบาท</th>
              <th className="py-2 px-3 font-medium">สร้างโดย</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t">
                <td className="py-2 px-3">{r.code}</td>
                <td className="py-2 px-3">{r.name}</td>
                <td className="py-2 px-3">{r.createdBy}</td>
                <td className="py-2 px-3 text-right">
                  <button className="text-blue-600 hover:underline" onClick={() => openManage(r.code, r.name)}>จัดการ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal title={`จัดการสิทธิ์: ${selected.name}`} onClose={() => setSelected(null)} size="fullscreen">
          <div className="space-y-6">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-2 px-3 font-medium">หมวดหมู่</th>
                    <th className="py-2 px-3 font-medium">เมนู</th>
                    <th className="py-2 px-3 font-medium">คำอธิบาย</th>
                    <th className="py-2 px-3 font-medium">เหมาะกับ</th>
                    <th className="py-2 px-3 font-medium text-center">เห็นเมนู</th>
                    <th className="py-2 px-3 font-medium text-center">ใช้งาน</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(catalog).map(([catKey, cat]) => (
                    cat.items.map(item => {
                      const p = perms[item.key] || {};
                      return (
                        <tr key={`${catKey}-${item.key}`} className="border-t">
                          <td className="py-2 px-3 text-gray-500 align-top">{cat.title}</td>
                          <td className="py-2 px-3 text-gray-800 align-top whitespace-nowrap">{item.label}</td>
                          <td className="py-2 px-3 text-gray-600 align-top">{item.desc}</td>
                          <td className="py-2 px-3 text-gray-600 align-top whitespace-nowrap">{item.roles.map(r => roleNameTh(r)).join(', ') || '-'}</td>
                          <td className="py-2 px-3 text-center align-top">
                            <input type="checkbox" checked={p.view !== false} onChange={() => setPerms(prev => ({ ...prev, [item.key]: { ...prev[item.key], view: !(p.view !== false) } }))} />
                          </td>
                          <td className="py-2 px-3 text-center align-top">
                            <input type="checkbox" checked={!!p.use} onChange={() => setPerms(prev => ({ ...prev, [item.key]: { ...prev[item.key], use: !p.use } }))} />
                          </td>
                        </tr>
                      );
                    })
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end space-x-2">
              <button className="px-4 py-2 border rounded-md text-sm" onClick={() => setSelected(null)}>ยกเลิก</button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm" onClick={async () => { await saveRolePermissions(selected.code, perms); try { localStorage.setItem(`role_permissions:${selected.code}`, JSON.stringify(perms)); (window as any).dispatchEvent(new CustomEvent('role-permissions-updated', { detail: { role: selected.code } })); } catch {} setSelected(null); }}>บันทึก</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PermissionsPage;
