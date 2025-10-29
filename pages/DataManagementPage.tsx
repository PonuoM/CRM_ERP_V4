import React, { useState } from 'react';
import {
  Company,
  Warehouse,
  User,
  Customer,
  Order,
  SalesImportRow,
  CustomerImportRow,
  ImportResultSummary
} from '@/types';
import CompanyManagementPage from './CompanyManagementPage';
import WarehouseManagementPage from './WarehouseManagementPage';
import { Building2, Warehouse as WarehouseIcon, Users, Package, ShoppingCart } from 'lucide-react';

interface DataManagementPageProps {
  allUsers: User[];
  allCustomers: Customer[];
  allOrders: Order[];
  onImportSales?: (rows: SalesImportRow[]) => ImportResultSummary | Promise<ImportResultSummary | void> | void;
  onImportCustomers?: (rows: CustomerImportRow[]) => ImportResultSummary | Promise<ImportResultSummary | void> | void;
}

const DataManagementPage: React.FC<DataManagementPageProps> = ({
  allUsers,
  allCustomers,
  allOrders,
  onImportSales,
  onImportCustomers
}) => {
  const [activeTab, setActiveTab] = useState<'companies' | 'warehouses'>('companies');
  const [companies, setCompanies] = useState<Company[]>([
    {
      id: 1,
      name: 'Alpha Seeds Co.',
      address: '123 ถนนสุขุมวิท กรุงเทพฯ 10110',
      phone: '02-123-4567',
      email: 'info@alphaseeds.com',
      taxId: '0123456789012'
    },
    {
      id: 2,
      name: 'Beta Agriculture Ltd.',
      address: '456 ถนนพหลโยธิน เชียงใหม่ 50000',
      phone: '053-123-456',
      email: 'info@betaagriculture.com',
      taxId: '0123456789013'
    }
  ]);
  
  const [warehouses, setWarehouses] = useState<Warehouse[]>([
    {
      id: 1,
      name: 'คลังกรุงเทพ',
      companyId: 1,
      companyName: 'Alpha Seeds Co.',
      address: '123 ถนนสุขุมวิท',
      province: 'กรุงเทพมหานคร',
      district: 'คลองเตย',
      subdistrict: 'คลองเตย',
      postalCode: '10110',
      phone: '02-123-4567',
      email: 'bangkok@alphaseeds.com',
      managerName: 'สมชาย ใจดี',
      managerPhone: '081-234-5678',
      responsibleProvinces: ['กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      name: 'คลังเชียงใหม่',
      companyId: 1,
      companyName: 'Alpha Seeds Co.',
      address: '456 ถนนนิมมานเหมินท์',
      province: 'เชียงใหม่',
      district: 'เมืองเชียงใหม่',
      subdistrict: 'ศรีภูมิ',
      postalCode: '50200',
      phone: '053-123-456',
      email: 'chiangmai@alphaseeds.com',
      managerName: 'สมหญิง รักดี',
      managerPhone: '082-345-6789',
      responsibleProvinces: ['เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 3,
      name: 'คลังอุดรธานี',
      companyId: 1,
      companyName: 'Alpha Seeds Co.',
      address: '789 ถนนโพศรี',
      province: 'อุดรธานี',
      district: 'เมืองอุดรธานี',
      subdistrict: 'หมากแข้ง',
      postalCode: '41000',
      phone: '042-123-456',
      email: 'udon@alphaseeds.com',
      managerName: 'วิชัย เก่งมาก',
      managerPhone: '083-456-7890',
      responsibleProvinces: ['อุดรธานี', 'หนองคาย', 'เลย', 'หนองบัวลำภู', 'สกลนคร'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 4,
      name: 'คลังขอนแก่น',
      companyId: 2,
      companyName: 'Beta Agriculture Ltd.',
      address: '321 ถนนมิตรภาพ',
      province: 'ขอนแก่น',
      district: 'เมืองขอนแก่น',
      subdistrict: 'ในเมือง',
      postalCode: '40000',
      phone: '043-123-456',
      email: 'khonkaen@betaagriculture.com',
      managerName: 'มาลี สวยงาม',
      managerPhone: '084-567-8901',
      responsibleProvinces: ['ขอนแก่น', 'มหาสารคาม', 'ร้อยเอ็ด', 'กาฬสินธุ์', 'ชัยภูมิ'],
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ]);

  const tabs = [
    {
      id: 'companies' as const,
      name: 'บริษัท',
      icon: Building2,
      count: companies.length,
      description: 'จัดการข้อมูลบริษัทและข้อมูลติดต่อ'
    },
    {
      id: 'warehouses' as const,
      name: 'คลังสินค้า',
      icon: WarehouseIcon,
      count: warehouses.length,
      description: 'จัดการคลังสินค้าและจังหวัดที่รับผิดชอบ'
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">จัดการข้อมูลหลัก</h1>
        <p className="text-gray-600">จัดการข้อมูลพื้นฐานของระบบ เช่น บริษัท คลังสินค้า และข้อมูลอื่นๆ</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={20} />
                  <span>{tab.name}</span>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border">
        {activeTab === 'companies' && (
          <CompanyManagementPage
            companies={companies}
            currentUser={allUsers[0]}
            onCompanyChange={setCompanies}
          />
        )}
        
        {activeTab === 'warehouses' && (
          <WarehouseManagementPage
            warehouses={warehouses}
            companies={companies}
            currentUser={allUsers[0]}
            onWarehouseChange={setWarehouses}
          />
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">บริษัท</p>
              <p className="text-2xl font-semibold text-gray-900">{companies.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <WarehouseIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">คลังสินค้า</p>
              <p className="text-2xl font-semibold text-gray-900">{warehouses.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ผู้ใช้งาน</p>
              <p className="text-2xl font-semibold text-gray-900">{allUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ออเดอร์</p>
              <p className="text-2xl font-semibold text-gray-900">{allOrders.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataManagementPage;
