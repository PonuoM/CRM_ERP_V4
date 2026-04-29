import * as XLSX from 'xlsx';

/**
 * Downloads data as a CSV or Excel file.
 * @param data Array of Arrays (2D array) representing rows and columns, or Array of Objects.
 * @param filename Without the extension (e.g., 'sales_report')
 * @param type 'csv' | 'xlsx'
 */
export const downloadDataFile = (data: any[], filename: string, type: 'csv' | 'xlsx') => {
  if (!data || data.length === 0) {
    alert("ไม่มีข้อมูลสำหรับ Export");
    return;
  }

  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Create worksheet based on data type
  let ws: XLSX.WorkSheet;
  if (Array.isArray(data[0])) {
    ws = XLSX.utils.aoa_to_sheet(data);
  } else {
    ws = XLSX.utils.json_to_sheet(data);
  }

  // Append worksheet
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // Format the filename with current date
  const dateStr = new Date().toISOString().split('T')[0];
  const finalFilename = `${filename}_${dateStr}.${type}`;

  if (type === 'csv') {
    // Generate CSV and force UTF-8 BOM to display Thai characters correctly in Excel
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", finalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Download as XLSX
    XLSX.writeFile(wb, finalFilename);
  }
};
