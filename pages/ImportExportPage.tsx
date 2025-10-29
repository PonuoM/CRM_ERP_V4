import React, { useRef, useState } from 'react';
import {
  User,
  Customer,
  Order,
  SalesImportRow,
  CustomerImportRow,
  ImportResultSummary
} from '@/types';
import { FileUp, Download, History, X, FileText, AlertCircle } from 'lucide-react';
import ExportHistoryPage from './ExportHistoryPage';

type TemplateKey = 'sales' | 'customers';
type ImportKind = 'sales' | 'customers';

const SALES_HEADERS = [
  'วันที่ขาย',
  'หมายเลขคำสั่งซื้อ',
  'รหัสลูกค้า',
  'ชื่อลูกค้า',
  'นามสกุลลูกค้า',
  'เบอร์โทรลูกค้า',
  'อีเมลลูกค้า',
  'แขวง/ตำบลจัดส่ง',
  'เขต/อำเภอจัดส่ง',
  'จังหวัดจัดส่ง',
  'รหัสไปรษณีย์จัดส่ง',
  'ที่อยู่จัดส่ง',
  'รหัสสินค้า',
  'ชื่อสินค้า',
  'จำนวน',
  'ราคาต่อหน่วย',
  'ส่วนลด',
  'ยอดรวมรายการ',
  'รหัสพนักงานขาย',
  'รหัสผู้ดูแล',
  'วิธีชำระเงิน',
  'สถานะการชำระเงิน',
  'หมายเหตุคำสั่งซื้อ',
];

const CUSTOMER_HEADERS = [
  'รหัสลูกค้า',
  'ชื่อลูกค้า',
  'นามสกุลลูกค้า',
  'เบอร์โทร',
  'อีเมล',
  'แขวง/ตำบล',
  'เขต/อำเภอ',
  'จังหวัด',
  'รหัสไปรษณีย์',
  'ที่อยู่',
  'ประเภทธุรกิจ',
  'แหล่งที่มา',
  'รหัสผู้ดูแล',
  'หมายเหตุ',
];

const CSV_TEMPLATES: Record<TemplateKey, { fileName: string; rows: string[][] }> = {
  sales: {
    fileName: 'sales-import-template.csv',
    rows: [
      SALES_HEADERS,
      [
        '2024-10-01',
        'SO-0001',
        'CUST-001',
        'Somchai',
        'Sukjai',
        '0891234567',
        'somchai@example.com',
        'Subdistrict A',
        'District B',
        'Bangkok',
        '10330',
        '128/12 Example Street, Soi 5, Bangkok',
        'SKU-1001',
        'CRM Pro Package',
        '3',
        '1500',
        '0',
        '4500',
        '101',
        '55',
        'Transfer',
        'Paid',
        'First order from October campaign',
      ],
    ],
  },
  customers: {
    fileName: 'customers-import-template.csv',
    rows: [
      CUSTOMER_HEADERS,
      [
        'CUST-001',
        'Somchai',
        'Sukjai',
        '0891234567',
        'somchai@example.com',
        'Subdistrict A',
        'District B',
        'Bangkok',
        '10330',
        '128/12 Example Street, Soi 5, Bangkok',
        'B2B',
        'Facebook Ads',
        '55',
        'Imported from October campaign',
      ],
    ],
  },
};
const createCsvContent = (rows: string[][]) =>
  rows
    .map((row) =>
      row
        .map((value) => `"${value.replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

const downloadCsvTemplate = (type: TemplateKey) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const template = CSV_TEMPLATES[type];
  const csvContent = '\uFEFF' + createCsvContent(template.rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = template.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const SALES_HEADER_MAP: Record<string, keyof SalesImportRow> = {
  'วันที่ขาย': 'saleDate',
  'วันที่สั่งซื้อ': 'saleDate',
  'sale date': 'saleDate',
  'order date': 'saleDate',
  'หมายเลขคำสั่งซื้อ': 'orderNumber',
  'order number': 'orderNumber',
  'order no': 'orderNumber',
  'order id': 'orderNumber',
  'รหัสลูกค้า': 'customerId',
  'customer id': 'customerId',
  'customer code': 'customerId',
  'ชื่อลูกค้า': 'customerFirstName',
  'customer first name': 'customerFirstName',
  'first name': 'customerFirstName',
  'นามสกุลลูกค้า': 'customerLastName',
  'customer last name': 'customerLastName',
  'last name': 'customerLastName',
  'customer name': 'customerName',
  'เบอร์โทรลูกค้า': 'customerPhone',
  'customer phone': 'customerPhone',
  'phone': 'customerPhone',
  'mobile': 'customerPhone',
  'อีเมลลูกค้า': 'customerEmail',
  'customer email': 'customerEmail',
  'email': 'customerEmail',
  'แขวง/ตำบลจัดส่ง': 'subdistrict',
  'shipping subdistrict': 'subdistrict',
  'subdistrict': 'subdistrict',
  'tambon': 'subdistrict',
  'เขต/อำเภอจัดส่ง': 'district',
  'shipping district': 'district',
  'district': 'district',
  'amphoe': 'district',
  'จังหวัดจัดส่ง': 'province',
  'shipping province': 'province',
  'province': 'province',
  'รหัสไปรษณีย์จัดส่ง': 'postalCode',
  'shipping postal code': 'postalCode',
  'postal code': 'postalCode',
  'zip code': 'postalCode',
  'zipcode': 'postalCode',
  'ที่อยู่จัดส่ง': 'address',
  'shipping address': 'address',
  'address': 'address',
  'รหัสสินค้า': 'productCode',
  'product sku': 'productCode',
  'product code': 'productCode',
  'sku': 'productCode',
  'ชื่อสินค้า': 'productName',
  'product name': 'productName',
  'จำนวน': 'quantity',
  'quantity': 'quantity',
  'qty': 'quantity',
  'ราคาต่อหน่วย': 'unitPrice',
  'unit price': 'unitPrice',
  'price': 'unitPrice',
  'ส่วนลด': 'discount',
  'discount': 'discount',
  'ยอดรวมรายการ': 'totalAmount',
  'line total': 'totalAmount',
  'total amount': 'totalAmount',
  'sales total': 'totalAmount',
  'รหัสพนักงานขาย': 'salespersonId',
  'salesperson id': 'salespersonId',
  'รหัสผู้ดูแล': 'caretakerId',
  'caretaker id': 'caretakerId',
  'owner id': 'caretakerId',
  'วิธีชำระเงิน': 'paymentMethod',
  'payment method': 'paymentMethod',
  'สถานะการชำระเงิน': 'paymentStatus',
  'payment status': 'paymentStatus',
  'หมายเหตุคำสั่งซื้อ': 'notes',
  'order notes': 'notes',
  'notes': 'notes',
  'หมายเหตุ': 'notes',
};

const CUSTOMER_HEADER_MAP: Record<string, keyof CustomerImportRow> = {
  'รหัสลูกค้า': 'customerId',
  'customer id': 'customerId',
  'customer code': 'customerId',
  'ชื่อลูกค้า': 'firstName',
  'customer first name': 'firstName',
  'first name': 'firstName',
  'นามสกุลลูกค้า': 'lastName',
  'customer last name': 'lastName',
  'last name': 'lastName',
  'customer name': 'customerName',
  'เบอร์โทร': 'phone',
  'phone': 'phone',
  'mobile': 'phone',
  'อีเมล': 'email',
  'email': 'email',
  'แขวง/ตำบล': 'subdistrict',
  'subdistrict': 'subdistrict',
  'เขต/อำเภอ': 'district',
  'district': 'district',
  'จังหวัด': 'province',
  'province': 'province',
  'รหัสไปรษณีย์': 'postalCode',
  'postal code': 'postalCode',
  'zip code': 'postalCode',
  'zipcode': 'postalCode',
  'ที่อยู่': 'address',
  'address': 'address',
  'ประเภทธุรกิจ': 'businessType',
  'business type': 'businessType',
  'แหล่งที่มา': 'source',
  'lead source': 'source',
  'source': 'source',
  'รหัสผู้ดูแล': 'caretakerId',
  'caretaker id': 'caretakerId',
  'owner id': 'caretakerId',
  'หมายเหตุ': 'notes',
  'notes': 'notes',
};
const sanitize = (value: string) => value.replace(/\ufeff/g, '').trim();

const parseDecimal = (value: string): number | undefined => {
  const cleaned = sanitize(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseInteger = (value: string): number | undefined => {
  const cleaned = sanitize(value).replace(/[^0-9-]/g, '');
  if (!cleaned) return undefined;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      const nextChar = content[i + 1];
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => sanitize(cell) !== ''));
};

const toSalesRows = (table: string[][]): SalesImportRow[] => {
  if (table.length === 0) return [];
  const headers = table[0].map((header) => {
    const normalized = sanitize(header).toLowerCase();
    return SALES_HEADER_MAP[sanitize(header)] ?? SALES_HEADER_MAP[normalized] ?? null;
  });

  if (!headers.some((header) => header !== null)) {
    throw new Error('ไม่พบหัวคอลัมน์ที่รองรับในไฟล์นำเข้าข้อมูลการขาย');
  }

  return table.slice(1).map((row) => {
    const record: SalesImportRow = {};

    headers.forEach((field, index) => {
      if (!field) return;
      const raw = sanitize(row[index] ?? '');
      if (raw === '') return;

      switch (field) {
        case 'quantity':
        case 'unitPrice':
        case 'discount':
        case 'totalAmount':
          record[field] = parseDecimal(raw);
          break;
        case 'salespersonId':
        case 'caretakerId':
          record[field] = parseInteger(raw);
          break;
        default:
          record[field] = raw;
      }
    });

    if (!record.customerFirstName && record.customerName) {
      const parts = record.customerName.split(/\s+/).filter(Boolean);
      if (parts.length > 0) {
        record.customerFirstName = parts[0];
        record.customerLastName = parts.slice(1).join(' ');
      }
    }

    return record;
  }).filter((record) => Object.values(record).some((value) => value !== undefined && value !== ''));
};

const toCustomerRows = (table: string[][]): CustomerImportRow[] => {
  if (table.length === 0) return [];
  const headers = table[0].map((header) => {
    const normalized = sanitize(header).toLowerCase();
    return CUSTOMER_HEADER_MAP[sanitize(header)] ?? CUSTOMER_HEADER_MAP[normalized] ?? null;
  });

  if (!headers.some((header) => header !== null)) {
    throw new Error('ไม่พบหัวคอลัมน์ที่รองรับในไฟล์นำเข้าข้อมูลลูกค้า');
  }

  return table.slice(1).map((row) => {
    const record: CustomerImportRow = {};

    headers.forEach((field, index) => {
      if (!field) return;
      const raw = sanitize(row[index] ?? '');
      if (raw === '') return;

      switch (field) {
        case 'caretakerId':
          record[field] = parseInteger(raw);
          break;
        default:
          record[field] = raw;
      }
    });

    if (!record.firstName && record.customerName) {
      const parts = record.customerName.split(/\s+/).filter(Boolean);
      if (parts.length > 0) {
        record.firstName = parts[0];
        record.lastName = parts.slice(1).join(' ');
      }
    }

    return record;
  }).filter((record) => Object.values(record).some((value) => value !== undefined && value !== ''));
};

interface ImportReportModalProps {
  type: ImportKind;
  summary: ImportResultSummary;
  onClose: () => void;
}

const ImportReportModal: React.FC<ImportReportModalProps> = ({ type, summary, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="relative w-full max-w-xl rounded-lg bg-white shadow-2xl">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-full p-1"
        aria-label="ปิดรายงานนำเข้า"
      >
        <X size={18} />
      </button>

      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <FileText className="h-6 w-6 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">รายงานนำเข้า</p>
          <h3 className="text-lg font-semibold text-gray-800">
            {type === 'sales' ? 'การนำเข้าข้อมูลการขาย' : 'การนำเข้าข้อมูลลูกค้า'}
          </h3>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md bg-blue-50 px-3 py-2">
            <p className="text-xs text-blue-600">จำนวนแถวทั้งหมด</p>
            <p className="text-lg font-semibold text-blue-900">{summary.totalRows}</p>
          </div>
          <div className="rounded-md bg-green-50 px-3 py-2">
            <p className="text-xs text-green-600">ลูกค้าใหม่</p>
            <p className="text-lg font-semibold text-green-900">{summary.createdCustomers}</p>
          </div>
          <div className="rounded-md bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-600">ลูกค้าที่อัปเดต</p>
            <p className="text-lg font-semibold text-amber-900">{summary.updatedCustomers}</p>
          </div>
          <div className="rounded-md bg-purple-50 px-3 py-2">
            <p className="text-xs text-purple-600">คำสั่งซื้อใหม่</p>
            <p className="text-lg font-semibold text-purple-900">{summary.createdOrders}</p>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-600">คำสั่งซื้อที่อัปเดต</p>
            <p className="text-lg font-semibold text-slate-900">{summary.updatedOrders}</p>
          </div>
          <div className="rounded-md bg-teal-50 px-3 py-2">
            <p className="text-xs text-teal-600">คงอยู่ในตะกร้าพัก</p>
            <p className="text-lg font-semibold text-teal-900">{summary.waitingBasket}</p>
          </div>
        </div>

        <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <p className="font-medium text-gray-700">บันทึกเพิ่มเติม</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>จำนวนผู้ดูแลที่มีความขัดแย้ง: {summary.caretakerConflicts}</li>
            {summary.notes.length === 0 && <li>ไม่มีข้อผิดพลาดเพิ่มเติม ระบบบันทึกข้อมูลเรียบร้อย</li>}
            {summary.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4 text-xs text-gray-500">
        <span>ระบบบันทึก Log การนำเข้าแล้วสามารถตรวจสอบย้อนหลังได้</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  </div>
);

interface ImportExportPageProps {
  allUsers: User[];
  allCustomers: Customer[];
  allOrders: Order[];
  onImportSales?: (rows: SalesImportRow[]) => ImportResultSummary | Promise<ImportResultSummary | void> | void;
  onImportCustomers?: (rows: CustomerImportRow[]) => ImportResultSummary | Promise<ImportResultSummary | void> | void;
}

const ImportExportPage: React.FC<ImportExportPageProps> = ({
  allUsers,
  allCustomers,
  allOrders,
  onImportSales,
  onImportCustomers
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [selectedFiles, setSelectedFiles] = useState<{ sales?: File; customers?: File }>({});
  const [isProcessing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<{ type: ImportKind; summary: ImportResultSummary } | null>(null);
  const salesInputRef = useRef<HTMLInputElement | null>(null);
  const customersInputRef = useRef<HTMLInputElement | null>(null);

  const resetSelectedFile = (type: TemplateKey) => {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    const input =
      type === 'sales' ? salesInputRef.current : customersInputRef.current;
    if (input) {
      input.value = '';
    }
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: TemplateKey
  ) => {
    const file = event.target.files?.[0];
    setErrorMessage(null);
    if (file) {
      setSelectedFiles((prev) => ({ ...prev, [type]: file }));
    } else {
      setSelectedFiles((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
    }
  };

  const processFile = async (file: File, type: TemplateKey) => {
    setProcessing(true);
    setErrorMessage(null);
    let succeeded = false;
    try {
      const content = await file.text();
      const table = parseCsv(content);
      if (table.length <= 1) {
        throw new Error('ไม่พบข้อมูลในไฟล์ CSV กรุณาตรวจสอบหัวคอลัมน์และข้อมูลอีกครั้ง');
      }

      if (type === 'sales') {
        const salesRows = toSalesRows(table);
        if (salesRows.length === 0) {
          throw new Error('ไม่พบข้อมูลคำสั่งซื้อที่นำเข้าได้');
        }

        if (onImportSales) {
          const result = await onImportSales(salesRows);
          if (result) {
            setReport({ type: 'sales', summary: result });
          }
        } else {
          setReport({
            type: 'sales',
            summary: {
              totalRows: salesRows.length,
              createdCustomers: 0,
              updatedCustomers: 0,
              createdOrders: 0,
              updatedOrders: 0,
              waitingBasket: 0,
              caretakerConflicts: 0,
              notes: ['ระบบยังไม่ได้กำหนดตัวจัดการสำหรับการนำเข้าข้อมูลการขาย']
            }
          });
        }
      } else {
        const customerRows = toCustomerRows(table);
        if (customerRows.length === 0) {
          throw new Error('ไม่พบข้อมูลลูกค้าที่นำเข้าได้');
        }

        if (onImportCustomers) {
          const result = await onImportCustomers(customerRows);
          if (result) {
            setReport({ type: 'customers', summary: result });
          }
        } else {
          setReport({
            type: 'customers',
            summary: {
              totalRows: customerRows.length,
              createdCustomers: 0,
              updatedCustomers: 0,
              createdOrders: 0,
              updatedOrders: 0,
              waitingBasket: 0,
              caretakerConflicts: 0,
              notes: ['ระบบยังไม่ได้กำหนดตัวจัดการสำหรับการนำเข้าข้อมูลลูกค้า']
            }
          });
        }
      }
      succeeded = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
    } finally {
      setProcessing(false);
      if (succeeded) {
        resetSelectedFile(type);
      }
    }
  };

  const handleUpload = async (type: TemplateKey) => {
    const file = selectedFiles[type];
    if (!file || isProcessing) return;
    await processFile(file, type);
  };

  const tabs = [
    {
      id: 'import' as const,
      name: 'นำเข้าข้อมูล',
      icon: FileUp
    },
    {
      id: 'export' as const,
      name: 'ส่งออกข้อมูล',
      icon: Download
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">นำเข้าและส่งออกข้อมูล</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">จำนวนลูกค้าทั้งหมด</p>
              <p className="text-2xl font-semibold text-gray-900">{allCustomers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">จำนวนคำสั่งซื้อทั้งหมด</p>
              <p className="text-2xl font-semibold text-gray-900">{allOrders.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <History className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">จำนวนผู้ใช้งานในระบบ</p>
              <p className="text-2xl font-semibold text-gray-900">{allUsers.length}</p>
            </div>
          </div>
        </div>
      </div>

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

      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">นำเข้าไม่สำเร็จ</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-6">
        {activeTab === 'import' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">นำเข้าข้อมูล</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">นำเข้าข้อมูลการขาย</h3>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => downloadCsvTemplate('sales')}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <Download size={16} className="mr-1" />
                    CSV
                  </button>
                  <input
                    ref={salesInputRef}
                    type="file"
                    accept=".csv"
                    disabled={isProcessing}
                    onChange={(event) => handleFileSelect(event, 'sales')}
                    className="text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-600
                      hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60
                      cursor-pointer"
                  />
                </div>
                {selectedFiles.sales && (
                  <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
                    <span className="truncate pr-3">{selectedFiles.sales.name}</span>
                    <button
                      type="button"
                      onClick={() => resetSelectedFile('sales')}
                      className="text-xs text-red-500 hover:text-red-600 focus:outline-none"
                    >
                      ลบไฟล์
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleUpload('sales')}
                  disabled={!selectedFiles.sales || isProcessing}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md disabled:bg-gray-300 disabled:text-gray-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  อัปโหลดไฟล์
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-4">นำเข้าข้อมูลลูกค้า</h3>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => downloadCsvTemplate('customers')}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <Download size={16} className="mr-1" />
                    CSV
                  </button>
                  <input
                    ref={customersInputRef}
                    type="file"
                    accept=".csv"
                    disabled={isProcessing}
                    onChange={(event) => handleFileSelect(event, 'customers')}
                    className="text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-600
                      hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60
                      cursor-pointer"
                  />
                </div>
                {selectedFiles.customers && (
                  <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
                    <span className="truncate pr-3">{selectedFiles.customers.name}</span>
                    <button
                      type="button"
                      onClick={() => resetSelectedFile('customers')}
                      className="text-xs text-red-500 hover:text-red-600 focus:outline-none"
                    >
                      ลบไฟล์
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleUpload('customers')}
                  disabled={!selectedFiles.customers || isProcessing}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md disabled:bg-gray-300 disabled:text-gray-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  อัปโหลดไฟล์
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mt-6">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">คำแนะนำก่อนนำเข้า</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>บรรทัดแรกต้องเป็นหัวคอลัมน์และสะกดตรงตามแม่แบบที่ดาวน์โหลดเสียง่ายที่สุด</li>
                <li>บันทึกไฟล์เป็น CSV (UTF-8 with BOM) เพื่อป้องกันภาษาไทยแสดงผลผิดพลาดในระบบ</li>
                <li>สำหรับรหัสพนักงานขายและผู้ดูแล ให้กรอกเป็นตัวเลข ID ที่ตรงกับระบบ</li>
                <li>กรณีไม่ระบุผู้ดูแล ลูกค้าจะถูกจัดเข้าตะกร้าพักอัตโนมัติ และรอการแจกใหม่ตามเงื่อนไข</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ส่งออกข้อมูล</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">ส่งออกข้อมูลการขาย</h3>
                <p className="text-sm text-gray-600 mb-4">
                  ดาวน์โหลดข้อมูลการขายทั้งหมดเป็นไฟล์ CSV เพื่อนำไปวิเคราะห์ต่อหรือผสานกับระบบอื่น
                </p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <Download size={16} className="inline mr-2" />
                  ดาวน์โหลดไฟล์การขาย
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">ส่งออกข้อมูลลูกค้า</h3>
                <p className="text-sm text-gray-600 mb-4">
                  ดาวน์โหลดข้อมูลลูกค้าล่าสุดเป็นไฟล์ CSV พร้อมรองรับภาษาไทยทุกช่องข้อมูลและ ID ผู้ดูแล
                </p>
                <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <Download size={16} className="inline mr-2" />
                  ดาวน์โหลดไฟล์ลูกค้า
                </button>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <History size={20} className="mr-2" />
                ประวัติการส่งออกล่าสุด
              </h3>
              <ExportHistoryPage />
            </div>
          </div>
        )}
      </div>

      {report && (
        <ImportReportModal
          type={report.type}
          summary={report.summary}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  );
};

export default ImportExportPage;





