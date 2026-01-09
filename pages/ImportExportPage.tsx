import React, { useRef, useState } from "react";
import {
  User,
  Customer,
  Order,
  SalesImportRow,
  CustomerImportRow,
  ImportResultSummary,
} from "@/types";
import {
  FileUp,
  Download,
  History,
  X,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../services/api";

type TemplateKey = "sales" | "customers";
type ImportKind = "sales" | "customers";

const SALES_HEADERS = [
  "วันที่ขาย",
  "วันที่จัดส่ง",
  "ชื่อลูกค้า",
  "นามสกุลลูกค้า",
  "เบอร์โทรลูกค้า",
  "อีเมลลูกค้า",
  "แขวง/ตำบลจัดส่ง",
  "เขต/อำเภอจัดส่ง",
  "จังหวัดจัดส่ง",
  "รหัสไปรษณีย์จัดส่ง",
  "ที่อยู่จัดส่ง",
  "รหัสสินค้า",
  "ชื่อสินค้า",
  "จำนวน",
  "ราคาต่อหน่วย",
  "ส่วนลด",
  "ยอดรวมรายการ",
  "รหัสพนักงานขาย",
  "รหัสผู้ดูแล",
  "รหัสผู้ดูแล",
  "วิธีชำระเงิน",
  "หมายเหตุคำสั่งซื้อ",
];

const CUSTOMER_HEADERS = [
  "ชื่อลูกค้า (First Name)",
  "นามสกุลลูกค้า (Last Name)",
  "เบอร์โทร (Phone)",
  "อีเมล",
  "แขวง/ตำบล",
  "เขต/อำเภอ",
  "จังหวัด",
  "รหัสไปรษณีย์",
  "ที่อยู่",
  "รหัสผู้ดูแล",
  "หมายเหตุ",
];

const CSV_TEMPLATES: Record<
  TemplateKey,
  { headers: string[]; rows: string[][] }
> = {
  sales: {
    headers: SALES_HEADERS,
    rows: [
      [
        "2024-12-01",
        "2024-12-02",
        "สมชาย",
        "ใจดี",
        "0812345678",
        "somchai@example.com",
        "แขวงวังใหม่",
        "เขตปทุมวัน",
        "กรุงเทพมหานคร",
        "10330",
        "123 ถนนพระราม 1",
        "PROD001",
        "สินค้าตัวอย่าง",
        "2",
        "150.00",
        "10.00",
        "290.00",
        "SALES001",
        "CARE001",
        "โอน",
        "จัดส่งภายใน 3 วัน",
      ],
    ],
  },
  customers: {
    headers: CUSTOMER_HEADERS,
    rows: [
      [
        "สมชาย",
        "ใจดี",
        "0812345678",
        "somchai@example.com",
        "แขวงวังใหม่",
        "เขตปทุมวัน",
        "กรุงเทพมหานคร",
        "10330",
        "123 ถนนพระราม 1",
        "ร้านค้า",
        "เว็บไซต์",
        "CARE001",
        "ลูกค้าประจำ",
      ],
    ],
  },
};

const createCsvContent = (template: {
  headers: string[];
  rows: string[][];
}) => {
  const allRows = [template.headers, ...template.rows];
  return allRows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
};

const downloadCsvTemplate = (type: TemplateKey) => {
  const template = CSV_TEMPLATES[type];
  const csvContent = createCsvContent(template);
  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${type}_template.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const SALES_HEADER_MAP: Record<string, keyof SalesImportRow> = {
  วันที่ขาย: "saleDate",
  วันที่จัดส่ง: "deliveryDate",
  วันที่ส่งของ: "deliveryDate",
  "delivery date": "deliveryDate",
  วันที่สั่งซื้อ: "saleDate",
  "sale date": "saleDate",
  "order date": "saleDate",
  หมายเลขคำสั่งซื้อ: "orderNumber",
  "order number": "orderNumber",
  "order no": "orderNumber",
  "order id": "orderNumber",
  รหัสลูกค้า: "customerId",
  "customer id": "customerId",
  "customer code": "customerId",
  ชื่อลูกค้า: "customerFirstName",
  "customer first name": "customerFirstName",
  "first name": "customerFirstName",
  นามสกุลลูกค้า: "customerLastName",
  "customer last name": "customerLastName",
  "last name": "customerLastName",
  "customer name": "customerName",
  เบอร์โทรลูกค้า: "customerPhone",
  "customer phone": "customerPhone",
  phone: "customerPhone",
  mobile: "customerPhone",
  อีเมลลูกค้า: "customerEmail",
  "customer email": "customerEmail",
  email: "customerEmail",
  "แขวง/ตำบลจัดส่ง": "subdistrict",
  "shipping subdistrict": "subdistrict",
  subdistrict: "subdistrict",
  tambon: "subdistrict",
  "เขต/อำเภอจัดส่ง": "district",
  "shipping district": "district",
  district: "district",
  amphoe: "district",
  จังหวัดจัดส่ง: "province",
  "shipping province": "province",
  province: "province",
  รหัสไปรษณีย์จัดส่ง: "postalCode",
  "shipping postal code": "postalCode",
  "postal code": "postalCode",
  "zip code": "postalCode",
  zipcode: "postalCode",
  ที่อยู่จัดส่ง: "address",
  "shipping address": "address",
  address: "address",
  รหัสสินค้า: "productCode",
  "product sku": "productCode",
  "product code": "productCode",
  sku: "productCode",
  ชื่อสินค้า: "productName",
  "product name": "productName",
  จำนวน: "quantity",
  quantity: "quantity",
  qty: "quantity",
  ราคาต่อหน่วย: "unitPrice",
  "unit price": "unitPrice",
  price: "unitPrice",
  ส่วนลด: "discount",
  discount: "discount",
  ยอดรวมรายการ: "totalAmount",
  "line total": "totalAmount",
  "total amount": "totalAmount",
  "sales total": "totalAmount",
  รหัสพนักงานขาย: "salespersonId",
  "salesperson id": "salespersonId",
  รหัสผู้ดูแล: "caretakerId",
  "caretaker id": "caretakerId",
  "owner id": "caretakerId",
  วิธีชำระเงิน: "paymentMethod",
  "payment method": "paymentMethod",
  หมายเหตุคำสั่งซื้อ: "notes",
  "order notes": "notes",
  notes: "notes",
  หมายเหตุ: "notes",
};

const CUSTOMER_HEADER_MAP: Record<string, keyof CustomerImportRow> = {
  ชื่อลูกค้า: "firstName",
  "ชื่อลูกค้า (first name)": "firstName",
  "customer first name": "firstName",
  "first name": "firstName",
  นามสกุลลูกค้า: "lastName",
  "namสกุลลูกค้า (last name)": "lastName",
  "นามสกุลลูกค้า (last name)": "lastName",
  "customer last name": "lastName",
  "last name": "lastName",
  "customer name": "customerName",
  เบอร์โทร: "phone",
  "เบอร์โทร (phone)": "phone",
  phone: "phone",
  mobile: "phone",
  อีเมล: "email",
  email: "email",
  "แขวง/ตำบล": "subdistrict",
  subdistrict: "subdistrict",
  "เขต/อำเภอ": "district",
  district: "district",
  จังหวัด: "province",
  province: "province",
  รหัสไปรษณีย์: "postalCode",
  "postal code": "postalCode",
  "zip code": "postalCode",
  zipcode: "postalCode",
  ที่อยู่: "address",
  address: "address",
  รหัสผู้ดูแล: "caretakerId",
  "caretaker id": "caretakerId",
  "owner id": "caretakerId",
  หมายเหตุ: "notes",
  notes: "notes",
  "date registered": "dateRegistered",
  date_joined: "dateRegistered",
  joined_date: "dateRegistered",
  ทุน: "capital",
  total_purchases: "totalPurchases",
  "purchase total": "totalPurchases",
};

const sanitize = (str: string) =>
  str
    .trim()
    .replace(/^\ufeff/, "")
    .replace(/^"(.*)"$/, "$1");

const parseDecimal = (val: string) => {
  const cleaned = val.replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const parseInteger = (val: string) => {
  const cleaned = val.replace(/,/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
};

const parseCsv = (text: string) => {
  const lines = text.split("\n").filter((line) => line.trim());
  const result: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const row: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(sanitize(current));
        current = "";
      } else {
        current += char;
      }
    }
    row.push(sanitize(current));
    if (row.some((cell) => cell)) {
      result.push(row);
    }
  }
  return result;
};

const toSalesRows = (table: string[][]): SalesImportRow[] => {
  const [headersRaw, ...rawRows] = table;
  if (!headersRaw || headersRaw.length === 0) {
    throw new Error("ไม่พบหัวคอลัมน์ที่รองรับในไฟล์นำเข้าข้อมูลการขาย");
  }
  const headers = headersRaw.map(
    (h) => SALES_HEADER_MAP[h.trim().toLowerCase()] || null,
  );
  if (!headers.some((header) => header !== null)) {
    throw new Error("ไม่พบหัวคอลัมน์ที่รองรับในไฟล์นำเข้าข้อมูลการขาย");
  }

  return rawRows.map((row, i) => {
    const obj: any = {};
    headers.forEach((key, j) => {
      if (!key) return;
      const value = row[j]?.trim() || "";
      if (key === "saleDate" || key === "dateRegistered") {
        obj[key] = value;
      } else if (key === "quantity") {
        obj[key] = parseInteger(value);
      } else if (
        key === "unitPrice" ||
        key === "discount" ||
        key === "totalAmount" ||
        key === "capital" ||
        key === "totalPurchases"
      ) {
        obj[key] = parseDecimal(value);
      } else {
        obj[key] = value;
      }
    });
    return obj as SalesImportRow;
  });
};

const toCustomerRows = (table: string[][]): CustomerImportRow[] => {
  const [headersRaw, ...rawRows] = table;
  if (!headersRaw || headersRaw.length === 0) {
    throw new Error("ไม่พบหัวคอลัมน์ที่รองรับในไฟล์นำเข้าข้อมูลลูกค้า");
  }
  const headers = headersRaw.map(
    (h) => CUSTOMER_HEADER_MAP[h.trim().toLowerCase()] || null,
  );
  if (!headers.some((header) => header !== null)) {
    throw new Error("ไม่พบหัวคอลัมน์ที่รองรับในไฟล์นำเข้าข้อมูลลูกค้า");
  }

  return rawRows.map((row, i) => {
    const obj: any = {};
    headers.forEach((key, j) => {
      if (!key) return;
      const value = row[j]?.trim() || "";
      if (key === "dateRegistered") {
        obj[key] = value;
      } else if (key === "capital" || key === "totalPurchases") {
        obj[key] = parseDecimal(value);
      } else {
        obj[key] = value;
      }
    });
    return obj as CustomerImportRow;
  });
};

interface ImportReportModalProps {
  type: ImportKind;
  summary: ImportResultSummary;
  onClose: () => void;
}

const ImportReportModal: React.FC<ImportReportModalProps> = ({
  type,
  summary,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-full p-1"
            aria-label="ปิดรายงานนำเข้า"
          >
            <X size={24} />
          </button>

          <div className="mb-6">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
              รายงานนำเข้า
            </p>
            <h3 className="text-lg font-semibold text-gray-800">
              {type === "sales"
                ? "การนำเข้าข้อมูลการขาย"
                : "การนำเข้าข้อมูลลูกค้า"}
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-md bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-600">จำนวนแถวทั้งหมด</p>
              <p className="text-lg font-semibold text-blue-900">
                {summary.totalRows}
              </p>
            </div>
            <div className="rounded-md bg-green-50 px-3 py-2">
              <p className="text-xs text-green-600">ลูกค้าใหม่</p>
              <p className="text-lg font-semibold text-green-900">
                {summary.createdCustomers}
              </p>
            </div>
            <div className="rounded-md bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-600">ลูกค้าที่อัปเดต</p>
              <p className="text-lg font-semibold text-amber-900">
                {summary.updatedCustomers}
              </p>
            </div>
            <div className="rounded-md bg-purple-50 px-3 py-2">
              <p className="text-xs text-purple-600">คำสั่งซื้อใหม่</p>
              <p className="text-lg font-semibold text-purple-900">
                {summary.createdOrders}
              </p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">คำสั่งซื้อที่อัปเดต</p>
              <p className="text-lg font-semibold text-slate-900">
                {summary.updatedOrders}
              </p>
            </div>
            <div className="rounded-md bg-teal-50 px-3 py-2">
              <p className="text-xs text-teal-600">คงอยู่ในตะกร้าพัก</p>
              <p className="text-lg font-semibold text-teal-900">
                {summary.waitingBasket}
              </p>
            </div>
          </div>

          {summary.caretakerConflicts > 0 && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700 mb-4">
              <p className="font-medium">
                ⚠️ พบผู้ดูแลซ้ำกัน {summary.caretakerConflicts} รายการ
              </p>
              <p className="mt-1">
                กรุณาตรวจสอบและแก้ไขข้อมูลผู้ดูแลให้ถูกต้อง
              </p>
            </div>
          )}

          <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <p className="font-medium text-gray-700">บันทึกเพิ่มเติม</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                จำนวนผู้ดูแลที่มีความขัดแย้ง: {summary.caretakerConflicts}
              </li>
              {summary.notes.length === 0 && (
                <li>ไม่มีข้อผิดพลาดเพิ่มเติม ระบบบันทึกข้อมูลเรียบร้อย</li>
              )}
              {summary.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
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
    </div>
  );
};

interface ImportExportPageProps {
  allUsers: User[];
  allCustomers: Customer[];
  allOrders: Order[];
  onImportSales?: (
    rows: SalesImportRow[],
  ) => ImportResultSummary | Promise<ImportResultSummary | void> | void;
  onImportCustomers?: (
    rows: CustomerImportRow[],
  ) => ImportResultSummary | Promise<ImportResultSummary | void> | void;
}

const ImportExportPage: React.FC<ImportExportPageProps> = ({
  allUsers,
  allCustomers,
  allOrders,
  onImportSales,
  onImportCustomers,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<{
    sales?: File;
    customers?: File;
  }>({});
  const [isProcessing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<{
    type: ImportKind;
    summary: ImportResultSummary;
  } | null>(null);
  const salesInputRef = useRef<HTMLInputElement | null>(null);
  const customersInputRef = useRef<HTMLInputElement | null>(null);

  const resetSelectedFile = (type: TemplateKey) => {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    if (type === "sales" && salesInputRef.current) {
      salesInputRef.current.value = "";
    } else if (type === "customers" && customersInputRef.current) {
      customersInputRef.current.value = "";
    }
    setErrorMessage(null);
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: TemplateKey,
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
        throw new Error(
          "ไม่พบข้อมูลในไฟล์ CSV กรุณาตรวจสอบหัวคอลัมน์และข้อมูลอีกครั้ง",
        );
      }

      if (type === "sales") {
        const salesRows = toSalesRows(table);
        if (salesRows.length === 0) {
          throw new Error("ไม่พบข้อมูลคำสั่งซื้อที่นำเข้าได้");
        }

        // Use API instead of prop
        // if (onImportSales) { ... }
        try {
          const result = await apiFetch('import/sales.php', {
            method: 'POST',
            body: JSON.stringify({ rows: salesRows })
          }) as ImportResultSummary;

          if (result) {
            setReport({ type: "sales", summary: result });
          }
        } catch (apiErr) {
          throw new Error('นำเข้าล้มเหลว: ' + (apiErr as Error).message);
        }
      } else {
        const customerRows = toCustomerRows(table);
        if (customerRows.length === 0) {
          throw new Error("ไม่พบข้อมูลลูกค้าที่นำเข้าได้");
        }

        // Use API instead of prop
        // if (onImportCustomers) { ... }
        try {
          const result = await apiFetch('import/customers.php', {
            method: 'POST',
            body: JSON.stringify({ rows: customerRows })
          }) as ImportResultSummary;

          if (result) {
            setReport({ type: "customers", summary: result });
          }
        } catch (apiErr) {
          throw new Error('นำเข้าล้มเหลว: ' + (apiErr as Error).message);
        }
      }
      succeeded = true;
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
      );
    } finally {
      setProcessing(false);
    }
    return succeeded;
  };

  const handleUpload = async (type: TemplateKey) => {
    const file = selectedFiles[type];
    if (!file) return;
    await processFile(file, type);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          นำเข้าข้อมูล
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                จำนวนลูกค้าทั้งหมด
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {allCustomers.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                จำนวนคำสั่งซื้อทั้งหมด
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {allOrders.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <History className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                จำนวนผู้ใช้งานในระบบ
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {allUsers.length}
              </p>
            </div>
          </div>
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
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            นำเข้าข้อมูล
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-4">
                นำเข้าข้อมูลการขาย
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => downloadCsvTemplate("sales")}
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
                  onChange={(event) => handleFileSelect(event, "sales")}
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
                  <span className="truncate pr-3">
                    {selectedFiles.sales.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => resetSelectedFile("sales")}
                    className="text-xs text-red-500 hover:text-red-600 focus:outline-none"
                  >
                    ลบไฟล์
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleUpload("sales")}
                disabled={!selectedFiles.sales || isProcessing}
                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md disabled:bg-gray-300 disabled:text-gray-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                อัปโหลดไฟล์
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-4">
                นำเข้าข้อมูลลูกค้า
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => downloadCsvTemplate("customers")}
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
                  onChange={(event) => handleFileSelect(event, "customers")}
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
                  <span className="truncate pr-3">
                    {selectedFiles.customers.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => resetSelectedFile("customers")}
                    className="text-xs text-red-500 hover:text-red-600 focus:outline-none"
                  >
                    ลบไฟล์
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleUpload("customers")}
                disabled={!selectedFiles.customers || isProcessing}
                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md disabled:bg-gray-300 disabled:text-gray-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                อัปโหลดไฟล์
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mt-6">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              คำแนะนำก่อนนำเข้า
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                บรรทัดแรกต้องเป็นหัวคอลัมน์และสะกดตรงตามแม่แบบที่ดาวน์โหลดเสมอ
              </li>
              <li>
                บันทึกไฟล์เป็น CSV (UTF-8 with BOM)
                เพื่อป้องกันภาษาไทยแสดงผลผิดพลาดในระบบ
              </li>
              <li>
                สำหรับรหัสพนักงานขายและผู้ดูแล ให้กรอกเป็นตัวเลข ID
                ที่ตรงกับระบบ
              </li>
              <li>
                กรณีไม่ระบุผู้ดูแล ลูกค้าจะถูกจัดเข้าตะกร้าพักอัตโนมัติ
                และรอการจัดสรรใหม่ตามเงื่อนไข
              </li>
            </ul>
          </div>
        </div>
      </div>

      {report && (
        <ImportReportModal
          type={report.type}
          summary={report.summary}
          onClose={() => {
            setReport(null);
            setSelectedFiles({});
            if (salesInputRef.current) salesInputRef.current.value = "";
            if (customersInputRef.current) customersInputRef.current.value = "";
          }}
        />
      )}
    </div>
  );
};

export default ImportExportPage;
