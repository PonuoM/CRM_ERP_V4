
import React, { useState, useMemo } from 'react';
import { Customer, Order, User } from '../types';
import { UploadCloud, FileDown, Database, CheckCircle, XCircle, AlertTriangle, Users, ShoppingCart, Repeat, Truck, Award } from 'lucide-react';

type ImportType = 'sales' | 'customers';
type ValidationStatus = 'valid-new' | 'valid-update' | 'skipped' | 'error' | 'unchecked';
type ActiveTab = 'import' | 'export';
type ReportType = 'product_movement' | 'sales_movement' | 'returns' | 'top_selling';

interface DataRow {
  [key: string]: string;
}

interface ValidatedRow {
  data: DataRow;
  status: ValidationStatus;
  message: string;
}

interface DataManagementPageProps {
  allUsers: User[];
  allCustomers: Customer[];
  allOrders: Order[];
  onImportSales: (data: DataRow[], options: { updateExpiry: boolean }) => void;
  onImportCustomers: (data: DataRow[]) => void;
}

const DataManagementPage: React.FC<DataManagementPageProps> = (props) => {
    const { allUsers, allCustomers, allOrders, onImportSales, onImportCustomers } = props;

    const [activeTab, setActiveTab] = useState<ActiveTab>('import');
    const [importType, setImportType] = useState<ImportType>('sales');
    const [file, setFile] = useState<File | null>(null);
    const [validatedData, setValidatedData] = useState<ValidatedRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [updateExpiry, setUpdateExpiry] = useState(false);
    
    // Export state
    const [reportType, setReportType] = useState<ReportType>('sales_movement');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setValidatedData([]);
            setHeaders([]);
        }
    };
    
    const parseCSV = (csvText: string): { headers: string[], data: DataRow[] } => {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {} as DataRow);
        });
        return { headers, data };
    };


    const handleValidateData = () => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const { headers, data } = parseCSV(text);
            setHeaders(headers);
            
            let validationResult: ValidatedRow[] = [];
            
            if(importType === 'sales') {
                validationResult = data.map(row => {
                    const phone = row['เบอร์โทร']?.replace(/[^0-9]/g, '');
                    if(!phone || phone.length < 9) return { data: row, status: 'error', message: 'เบอร์โทรไม่ถูกต้อง' };
                    
                    const existingCustomer = allCustomers.find(c => c.phone.includes(phone.slice(-9)));
                    return {
                        data: row,
                        status: existingCustomer ? 'valid-update' : 'valid-new',
                        message: existingCustomer ? 'อัปเดตข้อมูลลูกค้าและสร้างออเดอร์' : 'สร้างลูกค้าใหม่และสร้างออเดอร์'
                    };
                });
            } else { // customers only
                validationResult = data.map(row => {
                    const phone = row['เบอร์โทร']?.replace(/[^0-9]/g, '');
                    if(!phone || phone.length < 9) return { data: row, status: 'error', message: 'เบอร์โทรไม่ถูกต้อง' };
                    
                    const existingCustomer = allCustomers.find(c => c.phone.includes(phone.slice(-9)));
                    return {
                        data: row,
                        status: existingCustomer ? 'skipped' : 'valid-new',
                        message: existingCustomer ? 'ข้าม (มีเบอร์โทรนี้ในระบบแล้ว)' : 'สร้างลูกค้าใหม่'
                    };
                });
            }
            setValidatedData(validationResult);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleImport = () => {
        const dataToImport = validatedData.filter(v => v.status === 'valid-new' || v.status === 'valid-update').map(v => v.data);
        if (dataToImport.length === 0) {
            alert('ไม่มีข้อมูลที่ถูกต้องสำหรับนำเข้า');
            return;
        }

        if(importType === 'sales') {
            onImportSales(dataToImport, { updateExpiry });
        } else {
            onImportCustomers(dataToImport);
        }
        alert(`นำเข้าข้อมูล ${dataToImport.length} รายการสำเร็จ!`);
        setFile(null);
        setValidatedData([]);
        setHeaders([]);
    };

    const handleExport = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        let headers: string[] = [];
        let rows: string[][] = [];

        const { start, end } = dateRange;
        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;
        if(startDate) startDate.setHours(0,0,0,0);
        if(endDate) endDate.setHours(23,59,59,999);

        const filteredOrders = allOrders.filter(order => {
            if (!startDate || !endDate) return true;
            const orderDate = new Date(order.orderDate);
            return orderDate >= startDate && orderDate <= endDate;
        });

        switch(reportType) {
            case 'sales_movement':
                headers = ["OrderID", "OrderDate", "CustomerID", "CustomerName", "ProductID", "ProductName", "Quantity", "PricePerUnit", "Discount", "LineTotal", "SellerName"];
                filteredOrders.forEach(order => {
                    const customer = allCustomers.find(c => c.id === order.customerId);
                    const seller = allUsers.find(u => u.id === order.creatorId);
                    order.items.forEach(item => {
                        rows.push([
                            order.id,
                            order.orderDate,
                            customer?.id || '',
                            customer ? `${customer.firstName} ${customer.lastName}` : 'N/A',
                            item.id.toString(),
                            item.productName,
                            item.quantity.toString(),
                            item.pricePerUnit.toString(),
                            item.discount.toString(),
                            ((item.quantity * item.pricePerUnit) - item.discount).toString(),
                            seller ? `${seller.firstName} ${seller.lastName}` : 'N/A'
                        ]);
                    });
                });
                break;
            // Add other report types logic here
            default:
                alert("ประเภทรายงานนี้ยังไม่พร้อมใช้งาน");
                return;
        }

        csvContent += headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusIndicator = (status: ValidationStatus) => {
        switch(status) {
            case 'valid-new': return <CheckCircle size={16} className="text-green-500"/>;
            case 'valid-update': return <CheckCircle size={16} className="text-blue-500"/>;
            case 'skipped': return <AlertTriangle size={16} className="text-yellow-500"/>;
            case 'error': return <XCircle size={16} className="text-red-500"/>;
            default: return null;
        }
    };

    return (
    <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">นำเข้าและส่งออกข้อมูล</h2>
        <div className="flex border-b border-gray-200 mb-6">
            <button onClick={() => setActiveTab('import')} className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium ${activeTab === 'import' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><UploadCloud size={16}/><span>นำเข้าข้อมูล</span></button>
            <button onClick={() => setActiveTab('export')} className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium ${activeTab === 'export' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}><FileDown size={16}/><span>ส่งออกข้อมูล</span></button>
        </div>

        {activeTab === 'import' && (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center"><Database className="mr-2"/>1. เลือกประเภทและไฟล์</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทการนำเข้า</label>
                        <div className="flex space-x-4">
                            <label className="flex items-center"><input type="radio" value="sales" checked={importType === 'sales'} onChange={() => setImportType('sales')} className="h-4 w-4 text-green-600"/> <span className="ml-2 text-gray-800">นำเข้ายอดขาย</span></label>
                            <label className="flex items-center"><input type="radio" value="customers" checked={importType === 'customers'} onChange={() => setImportType('customers')} className="h-4 w-4 text-green-600"/> <span className="ml-2 text-gray-800">นำเข้าเฉพาะรายชื่อ</span></label>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">อัปโหลดไฟล์ CSV</label>
                        <input type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"/>
                     </div>
                </div>
                {importType === 'sales' && (
                    <div className="mt-4 flex items-center">
                        <input type="checkbox" id="update-expiry" checked={updateExpiry} onChange={e => setUpdateExpiry(e.target.checked)} className="h-4 w-4 text-green-600"/>
                        <label htmlFor="update-expiry" className="ml-2 text-sm text-gray-600">อัปเดตวันคงเหลือของลูกค้าเป็น 90 วัน</label>
                    </div>
                )}
            </div>
             <div className="flex justify-center">
                <button onClick={handleValidateData} disabled={!file} className="bg-blue-100 text-blue-700 font-semibold py-2 px-6 rounded-lg hover:bg-blue-200 disabled:bg-gray-200">ตรวจสอบข้อมูล</button>
            </div>
            {validatedData.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">2. ตรวจสอบข้อมูล ({validatedData.length} แถว)</h3>
                    <div className="max-h-80 overflow-auto border rounded-lg">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0"><tr className="text-left text-gray-600">
                                <th className="p-2 w-12">สถานะ</th>
                                {headers.map(h => <th key={h} className="p-2 font-medium">{h}</th>)}
                                <th className="p-2 font-medium">ผลการตรวจสอบ</th>
                            </tr></thead>
                            <tbody>
                                {validatedData.map((row, index) => (
                                <tr key={index} className="border-b last:border-0">
                                    <td className="p-2 text-center">{getStatusIndicator(row.status)}</td>
                                    {headers.map(h => <td key={h} className="p-2 text-gray-700">{row.data[h]}</td>)}
                                    <td className="p-2 text-gray-500">{row.message}</td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-center mt-6">
                        <button onClick={handleImport} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700">ยืนยันการนำเข้า</button>
                    </div>
                </div>
            )}
        </div>
        )}
        
        {activeTab === 'export' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ส่งออกรายงาน</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทรายงาน</label>
                    <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" style={{ colorScheme: 'light' }}>
                        <option value="product_movement" className="text-black">รายงานการเคลื่อนไหวสินค้า</option>
                        <option value="sales_movement" className="text-black">รายงานการเคลื่อนไหวยอดขาย</option>
                        <option value="returns" className="text-black">รายงานสินค้าตีกลับ</option>
                        <option value="top_selling" className="text-black">รายงานสินค้าขายได้</option>
                    </select>
                </div>
                <div className="flex items-end gap-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่วันที่</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" style={{ colorScheme: 'light' }}/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-green-500 focus:border-green-500" style={{ colorScheme: 'light' }}/>
                    </div>
                </div>
                 <div>
                    <button onClick={handleExport} className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center">
                        <FileDown className="mr-2"/> ส่งออกเป็น CSV
                    </button>
                </div>
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
                <p className="font-semibold mb-2">ตัวอย่างข้อมูลที่จะได้รับ (รายงานการเคลื่อนไหวยอดขาย):</p>
                <p>ไฟล์ CSV จะมีข้อมูลแต่ละรายการสินค้าอยู่ในคนละแถว พร้อมข้อมูลออเดอร์และลูกค้าที่เกี่ยวข้อง เพื่อให้ง่ายต่อการนำไปวิเคราะห์ต่อ</p>
            </div>
        </div>
        )}
    </div>
    );
};

export default DataManagementPage;