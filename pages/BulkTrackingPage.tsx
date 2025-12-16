
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { UploadCloud, CheckCircle, XCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';

type ValidationStatus = 'valid' | 'duplicate' | 'error' | 'unchecked';
interface RowData {
  id: number;
  orderId: string;
  trackingNumber: string;
  status: ValidationStatus;
  message: string;
  normalizedOrderId?: string;
  boxNumber?: number;
}

interface BulkTrackingPageProps {
  orders: Order[];
  onBulkUpdateTracking: (updates: { orderId: string; trackingNumber: string; boxNumber: number }[]) => void;
}

const createEmptyRow = (id: number): RowData => ({
  id,
  orderId: '',
  trackingNumber: '',
  status: 'unchecked',
  message: '',
  normalizedOrderId: undefined,
  boxNumber: undefined,
});

const parseOrderIdInput = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { baseId: '', boxNumber: null };
  }
  const match = trimmed.match(/^(.*)-(\d+)$/);
  if (match) {
    return { baseId: match[1], boxNumber: Number(match[2]) };
  }
  return { baseId: trimmed, boxNumber: null };
};

const detectShippingProvider = (trackingNumber: string): string => {
  const trimmed = trackingNumber.trim();
  if (!trimmed) return '-';

  // Flash Express: starts with TH, ends with A or P
  if (/^TH.*[AP]$/i.test(trimmed)) {
    return 'Flash Express';
  }

  // J&T: 12 digits
  if (/^\d{12}$/.test(trimmed)) {
    return 'J&T Express';
  }

  // Kerry Express: starts with JST, ends with A followed by digit
  if (/^JST.*A\d$/i.test(trimmed)) {
    return 'Kerry Express';
  }

  return 'Aiport';
};

const BulkTrackingPage: React.FC<BulkTrackingPageProps> = ({ orders, onBulkUpdateTracking }) => {
  const [rows, setRows] = useState<RowData[]>(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
  const [isVerified, setIsVerified] = useState(false);

  const handleInputChange = (index: number, field: 'orderId' | 'trackingNumber', value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    // Reset status on change
    newRows[index].status = 'unchecked';
    newRows[index].message = '';
    newRows[index].normalizedOrderId = undefined;
    newRows[index].boxNumber = undefined;
    setRows(newRows);
    setIsVerified(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    const pastedRows = pasteData.split('\n').filter(r => r.trim() !== '');

    if (pastedRows.length === 0) return;

    const target = e.target as HTMLInputElement;
    const rowIndex = parseInt(target.dataset.index || '0', 10);

    const newRows = [...rows];
    pastedRows.forEach((pastedRow, i) => {
      const [orderId, trackingNumber] = pastedRow.split(/[\t,]/); // Split by tab or comma
      const currentRowIndex = rowIndex + i;
      if (currentRowIndex < newRows.length) {
        newRows[currentRowIndex] = {
          ...newRows[currentRowIndex],
          orderId: orderId?.trim() || '',
          trackingNumber: trackingNumber?.trim() || '',
          status: 'unchecked',
          message: '',
          normalizedOrderId: undefined,
          boxNumber: undefined,
        };
      } else {
        newRows.push({
          id: newRows.length + 1,
          orderId: orderId?.trim() || '',
          trackingNumber: trackingNumber?.trim() || '',
          status: 'unchecked',
          message: '',
          normalizedOrderId: undefined,
          boxNumber: undefined,
        });
      }
    });

    setRows(newRows);
    setIsVerified(false);
  };

  const addRow = () => {
    setRows([...rows, createEmptyRow(rows.length + 1)]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  }

  const handleValidate = () => {
    const seenAssignments = new Map<string, Set<number>>();

    // Build a global tracking number lookup to check for duplicates across all orders
    const globalTrackingMap = new Map<string, { orderId: string; boxNumber: number }>();
    orders.forEach(order => {
      const trackingEntries = order.trackingEntries ?? [];
      trackingEntries.forEach(entry => {
        const trackingNum = entry.trackingNumber?.trim();
        if (trackingNum) {
          globalTrackingMap.set(trackingNum.toLowerCase(), {
            orderId: order.id,
            boxNumber: entry.boxNumber ?? 1
          });
        }
      });

      // Also check trackingNumbers array if exists
      const trackingNumbers = order.trackingNumbers ?? [];
      trackingNumbers.forEach(tn => {
        const trackingNum = tn?.trim();
        if (trackingNum && !globalTrackingMap.has(trackingNum.toLowerCase())) {
          globalTrackingMap.set(trackingNum.toLowerCase(), {
            orderId: order.id,
            boxNumber: 1
          });
        }
      });
    });

    // Check for duplicate tracking numbers and order+box in the current import batch
    const batchTrackingMap = new Map<string, number>(); // tracking -> row index
    const batchOrderBoxMap = new Map<string, number>(); // orderId+boxNumber -> row index

    const validatedRows = rows.map((row, rowIndex) => {
      const orderInput = row.orderId.trim();
      const trackingInput = row.trackingNumber.trim();

      if (!orderInput && !trackingInput) {
        return { ...row, status: "unchecked" as ValidationStatus, message: "" };
      }
      if (!orderInput || !trackingInput) {
        return {
          ...row,
          status: "error" as ValidationStatus,
          message: "กรุณากรอก Order ID และ Tracking ให้ครบถ้วน",
          normalizedOrderId: undefined,
          boxNumber: undefined,
        };
      }

      const { baseId, boxNumber } = parseOrderIdInput(orderInput);
      const order = orders.find(
        (o) => o.id.toLowerCase() === baseId.toLowerCase(),
      );
      if (!order) {
        return {
          ...row,
          status: "error" as ValidationStatus,
          message: "ไม่พบ Order ID นี้ในระบบ",
          normalizedOrderId: undefined,
          boxNumber: undefined,
        };
      }

      // Check Order Status
      // Allowed: Preparing, Picking, Shipping, PreApproved, Delivered, Returned
      // Disallowed: Pending, AwaitingVerification, Confirmed, Cancelled
      const allowedStatuses = [
        OrderStatus.Preparing,
        OrderStatus.Picking,
        OrderStatus.Shipping,
        OrderStatus.PreApproved,
        OrderStatus.Delivered,
        OrderStatus.Returned
      ];

      if (!allowedStatuses.includes(order.orderStatus)) {
        return {
          ...row,
          status: "error" as ValidationStatus,
          message: "Orders ยังไม่ถูกนำจัดเตรียมตรวจสอบ",
          normalizedOrderId: undefined,
          boxNumber: undefined,
        };
      }

      const trackingEntries = order.trackingEntries ?? [];
      const boxesFromConfig =
        Array.isArray(order.boxes) && order.boxes.length > 0
          ? order.boxes.length
          : 0;
      const highestExistingBox = trackingEntries.reduce(
        (max, entry) => Math.max(max, entry.boxNumber ?? 1),
        1,
      );
      const knownBoxCount = Math.max(highestExistingBox, boxesFromConfig, 1);

      let resolvedBoxNumber = boxNumber ?? undefined;
      if (!resolvedBoxNumber) {
        if (knownBoxCount > 1) {
          return {
            ...row,
            status: "error" as ValidationStatus,
            message: "กรุณาระบุหมายเลขกล่อง เช่น -1, -2, ...",
            normalizedOrderId: undefined,
            boxNumber: undefined,
          };
        }
        resolvedBoxNumber = 1;
      } else if (resolvedBoxNumber < 1) {
        resolvedBoxNumber = 1;
      }

      if (boxesFromConfig > 0 && resolvedBoxNumber > boxesFromConfig) {
        return {
          ...row,
          status: "error" as ValidationStatus,
          message: "หมายเลขกล่องมากกว่าจำนวนกล่องที่ตั้งไว้",
          normalizedOrderId: undefined,
          boxNumber: undefined,
        };
      }

      // **Collect validation errors**
      const errors: string[] = [];

      // Check if this specific box already has a tracking number in the system
      if (
        trackingEntries.some(
          (entry) => (entry.boxNumber ?? 1) === resolvedBoxNumber,
        )
      ) {
        errors.push("กล่องนี้มีเลข Tracking อยู่แล้ว");
      }

      // Check for duplicate order+box in batch
      const orderBoxKey = `${order.id.toLowerCase()}-${resolvedBoxNumber}`;
      if (batchOrderBoxMap.has(orderBoxKey)) {
        const firstOccurrenceRow = batchOrderBoxMap.get(orderBoxKey)!;
        errors.push(`Order+กล่องซ้ำกับแถวที่ ${firstOccurrenceRow + 1}`);
      } else {
        batchOrderBoxMap.set(orderBoxKey, rowIndex);
      }

      // Check if tracking number exists globally in any order
      const normalizedTracking = trackingInput.toLowerCase();
      const existingTracking = globalTrackingMap.get(normalizedTracking);
      if (existingTracking) {
        errors.push(`Tracking ถูกใช้ในออเดอร์ ${existingTracking.orderId} (กล่อง ${existingTracking.boxNumber})`);
      }

      // Check if tracking number is duplicated in the current import batch
      if (batchTrackingMap.has(normalizedTracking)) {
        const firstOccurrenceRow = batchTrackingMap.get(normalizedTracking)!;
        errors.push(`Tracking ซ้ำกับแถวที่ ${firstOccurrenceRow + 1}`);
      } else {
        batchTrackingMap.set(normalizedTracking, rowIndex);
      }

      // If there are any errors, return error status with combined message
      if (errors.length > 0) {
        return {
          ...row,
          status: "error" as ValidationStatus,
          message: errors.join(' และ '),
          normalizedOrderId: order.id,
          boxNumber: resolvedBoxNumber,
        };
      }

      const existingNumbers = order.trackingNumbers ?? [];

      // Case 1: Tracking Number already exists in this order (Duplicate) - should be caught by global check above
      if (
        existingNumbers.some(
          (tn) => tn.toLowerCase() === trackingInput.toLowerCase(),
        )
      ) {
        return {
          ...row,
          status: "duplicate" as ValidationStatus,
          message: "เลข Tracking นี้ถูกใช้งานแล้ว",
          normalizedOrderId: order.id,
          boxNumber: resolvedBoxNumber,
        };
      }

      // Case 2: Order already has SOME tracking numbers, but this is a new one (Allow with Warning)
      if (existingNumbers.length > 0) {
        // Check for duplicates in current import batch first
        const mapKey = order.id.toLowerCase();
        if (!seenAssignments.has(mapKey)) {
          seenAssignments.set(mapKey, new Set<number>());
        }
        const seenBoxes = seenAssignments.get(mapKey)!;
        if (seenBoxes.has(resolvedBoxNumber)) {
          return {
            ...row,
            status: "duplicate" as ValidationStatus,
            message: "พบหมายเลขกล่องซ้ำในไฟล์นำเข้า",
            normalizedOrderId: order.id,
            boxNumber: resolvedBoxNumber,
          };
        }
        seenBoxes.add(resolvedBoxNumber);

        return {
          ...row,
          status: "valid" as ValidationStatus,
          message: `เลข Order นี้มีการนำเข้าแล้ว (${order.id})`, // Warning message
          normalizedOrderId: order.id,
          boxNumber: resolvedBoxNumber,
        };
      }

      const mapKey = order.id.toLowerCase();
      if (!seenAssignments.has(mapKey)) {
        seenAssignments.set(mapKey, new Set<number>());
      }
      const seenBoxes = seenAssignments.get(mapKey)!;
      if (seenBoxes.has(resolvedBoxNumber)) {
        return {
          ...row,
          status: "duplicate" as ValidationStatus,
          message: "พบหมายเลขกล่องซ้ำในไฟล์นำเข้า",
          normalizedOrderId: order.id,
          boxNumber: resolvedBoxNumber,
        };
      }
      seenBoxes.add(resolvedBoxNumber);

      return {
        ...row,
        status: "valid" as ValidationStatus,
        message: "พร้อมนำเข้า",
        normalizedOrderId: order.id,
        boxNumber: resolvedBoxNumber,
      };
    });
    setRows(validatedRows);
    setIsVerified(true);
  };

  const { validCount, duplicateCount, errorCount } = useMemo(() => {
    return rows.reduce((acc, row) => {
      if (row.status === 'valid') acc.validCount++;
      if (row.status === 'duplicate') acc.duplicateCount++;
      if (row.status === 'error') acc.errorCount++;
      return acc;
    }, { validCount: 0, duplicateCount: 0, errorCount: 0 });
  }, [rows]);

  const handleImport = async () => {
    const updates = rows
      .filter(row => row.status === 'valid')
      .map(({ normalizedOrderId, orderId, trackingNumber, boxNumber }) => ({
        orderId: (normalizedOrderId || orderId).trim(),
        trackingNumber,
        boxNumber: boxNumber ?? 1,
      }));

    if (updates.length > 0) {
      if (window.confirm(`คุณต้องการนำเข้าเลข Tracking จำนวน ${updates.length} รายการใช่หรือไม่?`)) {
        try {
          // Update tracking numbers via callback
          onBulkUpdateTracking(updates);

          // Update shipping_provider for each order
          const shippingUpdates = new Map<string, string>(); // orderId -> shipping_provider

          for (const update of updates) {
            const provider = detectShippingProvider(update.trackingNumber);
            if (provider && provider !== '-') {
              // Check if orderId is a sub-order (has -1, -2 suffix)
              const match = update.orderId.match(/^(.+)-(\d+)$/);
              let parentOrderId = update.orderId;

              if (match) {
                // It's a sub-order, need to find parent order from order_boxes
                const subOrderId = update.orderId;
                try {
                  const response = await fetch(`api/Order_DB/get_parent_order.php?sub_order_id=${encodeURIComponent(subOrderId)}`);
                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.parent_order_id) {
                      parentOrderId = data.parent_order_id;
                    } else {
                      // Fallback: use base ID (remove suffix)
                      parentOrderId = match[1];
                    }
                  } else {
                    // Fallback: use base ID
                    parentOrderId = match[1];
                  }
                } catch (error) {
                  console.error('Error fetching parent order:', error);
                  // Fallback: use base ID
                  parentOrderId = match[1];
                }
              }

              // Store the provider for this parent order
              if (!shippingUpdates.has(parentOrderId)) {
                shippingUpdates.set(parentOrderId, provider);
              }
            }
          }


          // Update shipping_provider for each parent order
          console.log('Shipping updates to process:', Array.from(shippingUpdates.entries()));

          const updatePromises = [];
          for (const [orderId, provider] of shippingUpdates.entries()) {
            console.log(`Updating order ${orderId} with provider: ${provider}`);

            // Get auth token from localStorage
            const token = localStorage.getItem('authToken');
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }

            const updatePromise = fetch(`api/index.php/orders/${encodeURIComponent(orderId)}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                shipping_provider: provider,
              }),
            })
              .then(async (response) => {
                const data = await response.json();
                if (response.ok) {
                  console.log(`Successfully updated order ${orderId}:`, data);
                } else {
                  console.error(`Failed to update order ${orderId}:`, response.status, data);
                }
                return { orderId, success: response.ok, data };
              })
              .catch((error) => {
                console.error(`Error updating shipping provider for order ${orderId}:`, error);
                return { orderId, success: false, error };
              });

            updatePromises.push(updatePromise);
          }

          // Wait for all updates to complete
          const results = await Promise.all(updatePromises);
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;

          console.log(`Shipping provider updates completed: ${successCount} success, ${failCount} failed`);

          setRows(Array.from({ length: 15 }, (_, i) => createEmptyRow(i + 1)));
          setIsVerified(false);

          if (failCount > 0) {
            alert(`นำเข้าข้อมูลสำเร็จ!\nอัพเดท shipping provider: ${successCount} สำเร็จ, ${failCount} ล้มเหลว (ดู console สำหรับรายละเอียด)`);
          } else {
            alert('นำเข้าข้อมูลสำเร็จ!');
          }
        } catch (error) {
          console.error('Error during import:', error);
          alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
        }
      }
    } else {
      alert('ไม่มีข้อมูลที่พร้อมสำหรับนำเข้า');
    }
  };

  const getStatusIndicator = (status: ValidationStatus, message: string) => {
    switch (status) {
      case 'valid':
        return <div className="flex items-center text-green-600"><CheckCircle size={14} className="mr-1.5" /> {message}</div>;
      case 'duplicate':
        return <div className="flex items-center text-yellow-600"><AlertTriangle size={14} className="mr-1.5" /> {message}</div>;
      case 'error':
        return <div className="flex items-center text-red-600"><XCircle size={14} className="mr-1.5" /> {message}</div>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">จัดการ Tracking</h2>
      <p className="text-gray-600 mb-6">คัดลอกข้อมูลจากไฟล์ Excel/CSV (2 คอลัมน์: Order ID, Tracking) แล้ววางลงในตารางด้านล่าง</p>

      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center">
          {isVerified ? (
            <div className="flex items-center space-x-4 text-sm">
              <span className="flex items-center text-green-600 font-medium"><CheckCircle size={16} className="mr-2" />พร้อมนำเข้า: {validCount}</span>
              <span className="flex items-center text-yellow-600"><AlertTriangle size={16} className="mr-2" />ซ้ำซ้อน (จะถูกข้าม): {duplicateCount}</span>
              <span className="flex items-center text-red-600"><XCircle size={16} className="mr-2" />ผิดพลาด: {errorCount}</span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">วางข้อมูลแล้วกด "ตรวจสอบข้อมูล" เพื่อดำเนินการต่อ</p>
          )}
          <div className="flex items-center space-x-2">
            <button onClick={handleValidate} className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md py-2 px-3 hover:bg-gray-50">ตรวจสอบข้อมูล</button>
            <button onClick={handleImport} disabled={!isVerified || validCount === 0} className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed">
              <UploadCloud size={16} className="mr-2" />
              ยืนยันการนำเข้า ({validCount})
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-auto max-h-[calc(100vh-20rem)]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-3 w-12 text-center">#</th>
              <th className="px-6 py-3">เลข Order (เช่น ORD-2024-XXX)</th>
              <th className="px-6 py-3">เลข Tracking</th>
              <th className="px-6 py-3">ขนส่ง</th>
              <th className="px-6 py-3">สถานะ</th>
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {rows.map((row, index) => (
              <tr key={row.id} className={`border-b ${row.status === 'valid' ? 'bg-green-50' : row.status === 'error' ? 'bg-red-50' : ''}`}>
                <td className="px-2 py-1 text-center text-gray-400">{index + 1}</td>
                <td className="px-6 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.orderId}
                    onChange={(e) => handleInputChange(index, 'orderId', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="ORD-..."
                  />
                </td>
                <td className="px-6 py-1">
                  <input
                    type="text"
                    data-index={index}
                    value={row.trackingNumber}
                    onChange={(e) => handleInputChange(index, 'trackingNumber', e.target.value)}
                    onPaste={handlePaste}
                    className="w-full p-1 bg-transparent border-none focus:ring-0 focus:outline-none"
                    placeholder="TH123..."
                  />
                </td>
                <td className="px-6 py-1 text-sm text-gray-600">
                  {detectShippingProvider(row.trackingNumber)}
                </td>
                <td className="px-6 py-1 text-xs font-medium">
                  {getStatusIndicator(row.status, row.message)}
                </td>
                <td className="px-2 py-1 text-center">
                  <button onClick={() => removeRow(index)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2">
          <button onClick={addRow} className="w-full text-sm flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 py-1.5 rounded-md">
            <Plus size={16} className="mr-1" /> เพิ่มแถว
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkTrackingPage;

