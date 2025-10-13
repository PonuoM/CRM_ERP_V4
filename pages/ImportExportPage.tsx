import React, { useState } from 'react';
import { User, Customer, Order } from '@/types';
import { FileUp, Download, History } from 'lucide-react';
import ExportHistoryPage from './ExportHistoryPage';

interface ImportExportPageProps {
  allUsers: User[];
  allCustomers: Customer[];
  allOrders: Order[];
  onImportSales?: (data: any) => void;
  onImportCustomers?: (data: any) => void;
}

const ImportExportPage: React.FC<ImportExportPageProps> = ({
  allUsers,
  allCustomers,
  allOrders,
  onImportSales,
  onImportCustomers
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  const tabs = [
    {
      id: 'import' as const,
      name: 'นำเข้าข้อมูล',
      icon: FileUp,
      description: 'นำเข้าข้อมูลลูกค้าและคำสั่งซื้อ'
    },
    {
      id: 'export' as const,
      name: 'ส่งออกข้อมูล',
      icon: Download,
      description: 'ส่งออกข้อมูลและดูประวัติการส่งออก'
    }
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'sales' | 'customers') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Simple CSV parsing (in a real app, this would be more robust)
        const lines = content.split('\n');
        const headers = lines[0].split(',');
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header.trim()] = values[index]?.trim();
          });
          return obj;
        }).filter(row => Object.keys(row).length > 1);

        if (type === 'sales') {
          onImportSales?.(data);
        } else {
          onImportCustomers?.(data);
        }
      } catch (error) {
        alert('การอ่านไฟล์ผิดพลาด: ' + error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">นำเข้าและส่งออกข้อมูล</h1>
        <p className="text-gray-600">จัดการการนำเข้าและส่งออกข้อมูลลูกค้าและคำสั่งซื้อ</p>
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
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {activeTab === 'import' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">นำเข้าข้อมูล</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Import Sales */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">นำเข้าข้อมูลการขาย</h3>
                <p className="text-sm text-gray-600 mb-4">
                  นำเข้าข้อมูลคำสั่งซื้อจากไฟล์ CSV (รองรับคอลัมน์: customer_id, product_name, quantity, price)
                </p>
                <label className="block">
                  <span className="sr-only">เลือกไฟล์ CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileUpload(e, 'sales')}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                </label>
              </div>

              {/* Import Customers */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">นำเข้าข้อมูลลูกค้า</h3>
                <p className="text-sm text-gray-600 mb-4">
                  นำเข้าข้อมูลลูกค้าจากไฟล์ CSV (รองรับคอลัมน์: name, phone, email, address)
                </p>
                <label className="block">
                  <span className="sr-only">เลือกไฟล์ CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileUpload(e, 'customers')}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-green-50 file:text-green-700
                      hover:file:bg-green-100"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-800 mb-2">คำแนะนำ:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• ไฟล์ต้องเป็นรูปแบบ CSV เท่านั้น</li>
                <li>• บรรทัดแรกต้องเป็นชื่อคอลัมน์</li>
                <li>• ข้อมูลจะถูกตรวจสอบก่อนนำเข้า</li>
                <li>• ข้อมูลที่ซ้ำจะถูกข้าม</li>
              </ul>
            </div>
          </div>
        )}
        
        {activeTab === 'export' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ส่งออกข้อมูล</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Export Sales */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">ส่งออกข้อมูลการขาย</h3>
                <p className="text-sm text-gray-600 mb-4">
                  ส่งออกข้อมูลคำสั่งซื้อทั้งหมดเป็นไฟล์ CSV
                </p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <Download size={16} className="inline mr-2" />
                  ส่งออกข้อมูลการขาย
                </button>
              </div>

              {/* Export Customers */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">ส่งออกข้อมูลลูกค้า</h3>
                <p className="text-sm text-gray-600 mb-4">
                  ส่งออกข้อมูลลูกค้าทั้งหมดเป็นไฟล์ CSV
                </p>
                <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <Download size={16} className="inline mr-2" />
                  ส่งออกข้อมูลลูกค้า
                </button>
              </div>
            </div>

            {/* Export History */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <History size={20} className="mr-2" />
                ประวัติการส่งออก
              </h3>
              <ExportHistoryPage />
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">การนำเข้าทั้งหมด</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">การส่งออกทั้งหมด</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <History className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ไฟล์ใน 30 วัน</p>
              <p className="text-2xl font-semibold text-gray-900">0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportExportPage;