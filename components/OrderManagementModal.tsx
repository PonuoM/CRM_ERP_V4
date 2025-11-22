import React, { useState, useEffect, useMemo } from 'react';
import { Order, OrderStatus, Customer, PaymentStatus, PaymentMethod, Address, Activity, ActivityType, User, UserRole } from '../types';
import Modal from './Modal';
import { User as UserIcon, Phone, MapPin, Package, CreditCard, Truck, Paperclip, CheckCircle, Image, Trash2, Eye, History, Repeat, XCircle, Calendar } from 'lucide-react';
import { getPaymentStatusChip, getStatusChip, ORDER_STATUS_LABELS } from './OrderTable';
import { apiFetch, createOrderSlip, deleteOrderSlip, listBankAccounts } from '../services/api';

interface OrderManagementModalProps {
  order: Order;
  customers: Customer[];
  activities: Activity[];
  onSave: (updatedOrder: Order) => void;
  onClose: () => void;
  currentUser?: User;
}

const InfoCard: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
    <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center">
      <Icon className="w-5 h-5 mr-2 text-gray-400" />
      {title}
    </h3>
    {children}
  </div>
);

const activityIconMap: Record<ActivityType, React.ElementType> = {
  [ActivityType.OrderStatusChanged]: Repeat,
  [ActivityType.OrderCancelled]: XCircle,
  [ActivityType.TrackingAdded]: Truck,
  [ActivityType.PaymentVerified]: CheckCircle,
  [ActivityType.OrderCreated]: Package,
  [ActivityType.OrderNoteAdded]: Paperclip,
  // Add other relevant types if needed
  [ActivityType.Assignment]: UserIcon,
  [ActivityType.GradeChange]: UserIcon,
  [ActivityType.StatusChange]: UserIcon,
  [ActivityType.AppointmentSet]: UserIcon,
  [ActivityType.CallLogged]: Phone,
};

const ActivityIcon: React.FC<{ type: ActivityType }> = ({ type }) => {
  const Icon = activityIconMap[type] || History;
  return (
    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
      <Icon className="w-4 h-4 text-gray-500" />
    </div>
  );
}

const getRelativeTime = (timestamp: string) => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds} วินาทีที่แล้ว`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} ชั่วโมงที่แล้ว`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} วันที่แล้ว`;
};

const OrderManagementModal: React.FC<OrderManagementModalProps> = ({ order, customers, activities, onSave, onClose, currentUser }) => {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const sanitizeAddressPart = (value?: string | null) => {
    if (!value) return '';
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || lower === 'undefined' || lower === 'null') {
      return '';
    }
    return trimmed;
  };
  const mergeAddressPart = (incoming: any, previous?: string | null) => {
    const incomingString =
      typeof incoming === 'string'
        ? incoming
        : incoming == null
          ? ''
          : String(incoming);
    const cleanedIncoming = sanitizeAddressPart(incomingString);
    if (cleanedIncoming) return cleanedIncoming;
    return sanitizeAddressPart(previous ?? '');
  };
  const canVerifySlip =
    currentUser?.role === UserRole.Backoffice ||
    currentUser?.role === UserRole.Admin ||
    currentUser?.role === UserRole.SuperAdmin;
  const [slipPreview, setSlipPreview] = useState<string | null>(order.slipUrl || null);
  const [slips, setSlips] = useState<{ id: number; url: string }[]>(Array.isArray((order as any).slips) ? (order as any).slips.map((s: any) => ({ id: Number(s.id), url: String(s.url) })) : []);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);


  useEffect(() => {
    setCurrentOrder(order);
    setSlipPreview(order.slipUrl || null);
    setSlips(Array.isArray((order as any).slips) ? (order as any).slips.map((s: any) => ({ id: Number(s.id), url: String(s.url) })) : []);
  }, [order]);

  // Fetch bank accounts for display
  useEffect(() => {
    if (!currentUser?.companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const accounts = await listBankAccounts(currentUser.companyId, true);
        if (!cancelled) {
          setBankAccounts(accounts || []);
        }
      } catch (e) {
        console.error('Failed to load bank accounts', e);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.companyId]);

  // Fetch full order details if minimal data is passed in
  useEffect(() => {
    let cancelled = false;
    const needsItems = !order.items || order.items.length === 0;
    const needsBoxes = (order as any).boxes == null;
    const needsSlip = typeof order.slipUrl === 'undefined';
    if (!needsItems && !needsBoxes && !needsSlip) return;
    (async () => {
      try {
        const r: any = await apiFetch(`orders/${encodeURIComponent(order.id)}`);
        if (cancelled) return;
        setCurrentOrder(prev => ({
          ...prev,
          slipUrl: r.slip_url ?? prev.slipUrl,
          amountPaid: typeof r.amount_paid !== 'undefined' ? Number(r.amount_paid) : prev.amountPaid,
          codAmount: typeof r.cod_amount !== 'undefined' ? Number(r.cod_amount) : (prev as any).codAmount,
          bankAccountId: typeof r.bank_account_id !== 'undefined' ? Number(r.bank_account_id) : prev.bankAccountId,
          transferDate: r.transfer_date ?? prev.transferDate,
          shippingAddress: {
            recipientFirstName: mergeAddressPart(r.recipient_first_name, prev.shippingAddress?.recipientFirstName),
            recipientLastName: mergeAddressPart(r.recipient_last_name, prev.shippingAddress?.recipientLastName),
            street: mergeAddressPart(r.street, prev.shippingAddress?.street),
            subdistrict: mergeAddressPart(r.subdistrict, prev.shippingAddress?.subdistrict),
            district: mergeAddressPart(r.district, prev.shippingAddress?.district),
            province: mergeAddressPart(r.province, prev.shippingAddress?.province),
            postalCode: mergeAddressPart(r.postal_code, prev.shippingAddress?.postalCode),
          },
          items: Array.isArray(r.items) ? r.items.map((it: any, i: number) => ({
            id: Number(it.id ?? i + 1),
            productName: String(it.product_name ?? ''),
            quantity: Number(it.quantity ?? 0),
            pricePerUnit: Number(it.price_per_unit ?? 0),
            discount: Number(it.discount ?? 0),
            isFreebie: !!(it.is_freebie ?? 0),
            boxNumber: Number(it.box_number ?? 0),
          })) : prev.items,
          boxes: Array.isArray(r.boxes) ? r.boxes.map((b: any) => ({ boxNumber: Number(b.box_number ?? 0), codAmount: Number(b.cod_amount ?? 0) })) : (prev as any).boxes,
          trackingNumbers: Array.isArray(r.trackingNumbers)
            ? r.trackingNumbers
            : (typeof r.tracking_numbers === 'string' ? String(r.tracking_numbers).split(',').filter(Boolean) : prev.trackingNumbers),
        }));
        if (Array.isArray(r.slips)) {
          try {
            setSlips(r.slips.map((s: any) => ({ id: Number(s.id), url: String(s.url) })));
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.error('Failed loading order details', e);
      }
    })();
    return () => { cancelled = true; };
  }, [order]);

  const customer = useMemo(() => {
    return customers.find(c => {
      if (c.pk && typeof order.customerId === 'number') {
        return c.pk === order.customerId;
      }
      return String(c.id) === String(order.customerId) || 
             String(c.pk) === String(order.customerId);
    });
  }, [customers, order.customerId]);

  const orderActivities = useMemo(() => {
    return activities
      .filter(a => a.description.includes(order.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, order.id]);
  const slipUploadInputId = useMemo(() => `slip-upload-${order.id}`, [order.id]);

  const handleFieldChange = (field: keyof Order, value: any) => {
    setCurrentOrder(prev => ({ ...prev, [field]: value }));
  };

  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget as HTMLInputElement | null;
    const files = inputEl?.files ? Array.from(inputEl.files) : [];
    if (!files || files.length === 0) return;
    for (const file of files) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          try {
            const res = await createOrderSlip(currentOrder.id, dataUrl);
            if (res && res.id && res.url) {
              setSlips(prev => [{ id: Number(res.id), url: String(res.url) }, ...prev]);
            }
          } catch (err) { console.error('upload slip', err); }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    if (inputEl) inputEl.value = '';
    handleFieldChange('paymentStatus', PaymentStatus.PendingVerification);
  };

  const removeSlip = () => {
    setSlipPreview(null);
    handleFieldChange('slipUrl', undefined);
    handleFieldChange('paymentStatus', PaymentStatus.Unpaid);
  };
  const handleDeleteSlip = async (slipId: number) => {
    try {
      await deleteOrderSlip(slipId);
      setSlips(prev => prev.filter(s => s.id !== slipId));
    } catch (e) { console.error('delete slip', e); }
  };

  const hasTransferSlip = Boolean(slipPreview || currentOrder.slipUrl || slips.length > 0);

  const handleAcceptSlip = () => {
    const totalAmount = Number(currentOrder.totalAmount || 0);
    const paidAmount =
      currentOrder.amountPaid && currentOrder.amountPaid > 0
        ? currentOrder.amountPaid
        : totalAmount > 0
          ? totalAmount
          : 0;
    if (paidAmount <= 0) {
      alert("กรุณาระบุจำนวนเงินที่ได้รับก่อนยืนยันสลิป");
      return;
    }

    // สำหรับ Backoffice: อัปเดตสถานะเป็น Verified แทน Paid
    // สำหรับ Telesale: อัปเดตสถานะเป็น Paid ตามเดิม
    const newPaymentStatus = PaymentStatus.Verified;

    // เพิ่มข้อมูลผู้ตรวจสอบและเวลา
    const verificationInfo = {
      verifiedBy: currentUser?.id,
      verifiedByName: `${currentUser?.firstName} ${currentUser?.lastName}`,
      verifiedAt: new Date().toISOString(),
    };

    const updated: Order = {
      ...currentOrder,
      amountPaid: paidAmount,
      paymentStatus: newPaymentStatus,
      verificationInfo: verificationInfo,
    };
    setCurrentOrder(updated);
    onSave(updated);
  };


  const handleAmountPaidChange = (amount: number) => {
    const newAmount = Math.max(0, amount);
    let newPaymentStatus = currentOrder.paymentStatus;
    if (newAmount === 0) {
      newPaymentStatus = PaymentStatus.Unpaid;
    } else if (newAmount < currentOrder.totalAmount) {
      newPaymentStatus = PaymentStatus.PendingVerification; // partial
    } else {
      newPaymentStatus = PaymentStatus.Verified; // paid or overpaid (Verified)
    }
    setCurrentOrder(prev => ({
      ...prev,
      amountPaid: newAmount,
      paymentStatus: newPaymentStatus,
      codAmount: prev.paymentMethod === PaymentMethod.COD ? newAmount : prev.codAmount,
    }));
  };

  // Removed manual confirm button: payment status derives from amountPaid

  const handleSave = () => {
    onSave(currentOrder);
  };

  const formatAddress = (address?: Address | null) => {
    const sanitize = (value?: string | null) => {
      if (!value) return '';
      const trimmed = value.trim();
      const lower = trimmed.toLowerCase();
      if (!trimmed || lower === 'undefined' || lower === 'null') {
        return '';
      }
      return trimmed;
    };

    const recipientFirst = sanitize(address?.recipientFirstName);
    const recipientLast = sanitize(address?.recipientLastName);
    const street = sanitize(address?.street);
    const subdistrict = sanitize(address?.subdistrict);
    const district = sanitize(address?.district);
    const province = sanitize(address?.province);
    const postalCode = sanitize(address?.postalCode);

    const parts: string[] = [];
    if (recipientFirst || recipientLast)
      parts.push(
        `Recipient: ${[recipientFirst, recipientLast].filter(Boolean).join(" ").trim()}`,
      );
    if (street) parts.push(street);
    if (subdistrict) parts.push(subdistrict);
    if (district) parts.push(district);
    if (province) parts.push(province);
    if (postalCode) parts.push(postalCode);

    return parts.length > 0 ? parts.join(", ") : "-";
  }

  const remainingBalance = useMemo(() => {
    const paid = currentOrder.amountPaid || 0;
    return currentOrder.totalAmount - paid; // negative means overpaid
  }, [currentOrder.totalAmount, currentOrder.amountPaid]);

  const derivedAmountStatus = useMemo(() => {
    const diff = remainingBalance;
    const paid = currentOrder.amountPaid || 0;
    if (!paid || paid === 0) return 'Unpaid';
    if (diff > 0) return 'Partial';
    if (diff === 0) return 'Paid';
    return 'Overpaid';
  }, [remainingBalance, currentOrder.amountPaid]);

  return (
    <Modal title={`จัดการออเดอร์: ${order.id}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <InfoCard icon={Calendar} title="รายละเอียดคำสั่งซื้อ">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-gray-500">วันที่สั่งซื้อ</p>
              <p className="font-medium text-gray-800">{currentOrder.orderDate ? new Date(currentOrder.orderDate).toLocaleString('th-TH') : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">วันที่จัดส่ง</p>
              <p className="font-medium text-gray-800">{currentOrder.deliveryDate ? new Date(currentOrder.deliveryDate).toLocaleDateString('th-TH') : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ช่องทางการขาย</p>
              <p className="font-medium text-gray-800">{currentOrder.salesChannel || '-'}</p>
            </div>
          </div>
        </InfoCard>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoCard icon={UserIcon} title="ข้อมูลลูกค้า">
            <p className="font-semibold text-gray-800">{customer ? `${customer.firstName} ${customer.lastName}` : 'ไม่พบข้อมูล'}</p>
            <p className="text-gray-600 flex items-center mt-1"><Phone size={12} className="mr-2" />{customer?.phone}</p>
            <p className="text-gray-600 flex items-start mt-1"><MapPin size={12} className="mr-2 mt-0.5" />{formatAddress(currentOrder.shippingAddress)}</p>
          </InfoCard>

          <InfoCard icon={Package} title="รายการสินค้า">
            <div className="space-y-1 max-h-24 overflow-y-auto pr-2">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <span className="text-gray-700">{item.productName} (x{item.quantity})</span>
                  <span className="font-medium text-gray-800">฿{(item.pricePerUnit * item.quantity - item.discount).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-2 pt-2 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-gray-500">รวม</span><span className="font-medium text-gray-900">฿{(order.totalAmount - order.shippingCost + order.billDiscount).toLocaleString()}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">ค่าส่ง</span><span className="font-medium text-gray-900">฿{order.shippingCost.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs"><span className="text-red-500">ส่วนลด</span><span className="font-medium text-gray-900">-฿{order.billDiscount.toLocaleString()}</span></div>
              <div className="flex justify-between font-bold"><span className="text-gray-800">ยอดสุทธิ</span><span className="text-gray-900">฿{order.totalAmount.toLocaleString()}</span></div>
            </div>
          </InfoCard>
        </div>

        <InfoCard icon={CreditCard} title="การชำระเงิน">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-600">วิธีชำระ: {order.paymentMethod}</span>
            {getPaymentStatusChip(currentOrder.paymentStatus, currentOrder.paymentMethod, currentOrder.amountPaid, currentOrder.totalAmount)}
          </div>
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-gray-500">สถานะการชำระ</span>
            <span className={`px-2 py-0.5 rounded-full ${derivedAmountStatus === 'Paid' ? 'bg-green-100 text-green-700' : derivedAmountStatus === 'Unpaid' ? 'bg-gray-100 text-gray-700' : derivedAmountStatus === 'Partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>{derivedAmountStatus === 'Paid' ? 'ชำระแล้ว' : derivedAmountStatus === 'Unpaid' ? 'ยังไม่ชำระ' : derivedAmountStatus === 'Partial' ? 'ชำระบางส่วน' : 'ชำระเกิน'}</span>
          </div>
          {(order.paymentMethod === PaymentMethod.Transfer || order.paymentMethod === PaymentMethod.COD) && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">จำนวนเงินที่ได้รับ</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={currentOrder.amountPaid ?? ''}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => handleAmountPaidChange(Number(e.target.value))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="flex justify-between font-semibold text-xs">
                <span className="text-gray-600">คงเหลือ</span>
                <span className={`${remainingBalance < 0 ? 'text-purple-600' : remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{remainingBalance === 0 ? '0' : (remainingBalance > 0 ? `-${remainingBalance.toLocaleString()}` : `+${Math.abs(remainingBalance).toLocaleString()}`)}</span>
              </div>
            </div>
          )}

          {order.paymentMethod === PaymentMethod.Transfer && (
            <>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">หลักฐานการชำระเงิน</label>
                  {(slipPreview || currentOrder.slipUrl) ? (
                    <div className="group relative w-32 h-32 border rounded-md p-1">
                      <img onClick={() => setLightboxUrl(slipPreview || (currentOrder.slipUrl as string))} src={slipPreview || (currentOrder.slipUrl as string)} alt="Slip preview" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center space-x-2">
                        <a href={slipPreview || (currentOrder.slipUrl as string)} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/80 rounded-full text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"><Eye size={16} /></a>
                        <button onClick={removeSlip} className="p-2 bg-white/80 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">ยังไม่มีหลักฐานการชำระเงิน</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    <label htmlFor={slipUploadInputId} className="cursor-pointer w-full text-center py-2 px-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 flex items-center justify-center">
                      <Image size={16} className="mr-2" />
                      อัปโหลดสลิปเพิ่มเติม
                    </label>
                    <input id={slipUploadInputId} type="file" accept="image/*" multiple onChange={handleSlipUpload} className="hidden" />
                  </div>
                </div>
                {/* แสดงข้อมูลธนาคารและเวลาโอน */}
                {(currentOrder.bankAccountId || currentOrder.transferDate) && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">ข้อมูลการโอนเงิน</h4>
                    <div className="text-xs text-blue-700 space-y-1">
                      {currentOrder.bankAccountId && (() => {
                        const bankAccount = bankAccounts.find(ba => ba.id === currentOrder.bankAccountId);
                        return (
                          <p>
                            ธนาคาร: {bankAccount ? `${bankAccount.bank} ${bankAccount.bank_number}` : `ID: ${currentOrder.bankAccountId}`}
                          </p>
                        );
                      })()}
                      {currentOrder.transferDate && (
                        <p>
                          เวลาโอน: {new Date(currentOrder.transferDate).toLocaleString('th-TH', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* แสดงข้อมูลการตรวจสอบสลิป */}
              {currentOrder.verificationInfo && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <h4 className="text-sm font-medium text-green-800 mb-2">ข้อมูลการตรวจสอบสลิป</h4>
                  <div className="text-xs text-green-700 space-y-1">
                    <p>ผู้ตรวจสอบ: {currentOrder.verificationInfo.verifiedByName}</p>
                    <p>วันที่ตรวจสอบ: {new Date(currentOrder.verificationInfo.verifiedAt).toLocaleString('th-TH')}</p>
                  </div>
                </div>
              )}
              {canVerifySlip &&
                (currentOrder.paymentMethod === PaymentMethod.Transfer || currentOrder.paymentMethod === PaymentMethod.PayAfter) &&
                hasTransferSlip &&
                currentOrder.paymentStatus !== PaymentStatus.Paid && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleAcceptSlip}
                      className="mt-2 inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      ยืนยันสลิป
                    </button>
                  </div>
                )}
            </>
          )}

          {order.paymentMethod === PaymentMethod.PayAfter && (
            <>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">บันทึกยอดชำระ</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={currentOrder.amountPaid ?? ''}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => handleAmountPaidChange(Number(e.target.value))}
                    className="w-full p-2 border rounded-md"
                    disabled={currentOrder.paymentStatus === PaymentStatus.Paid}
                  />
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-red-600">ยอดค้างชำระ</span>
                  <span className="text-red-600">฿{remainingBalance.toLocaleString()}</span>
                </div>
              </div>

              {/* ส่วนอัปโหลดสลิปสำหรับ PayAfter */}
              <div className="space-y-2 mt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">หลักฐานการชำระเงิน</label>
                  {slips.length > 0 ? (
                    <div className="flex flex-wrap gap-3 mb-2">
                      {slips.map(slip => (
                        <div key={slip.id} className="relative w-32 h-32 border rounded-md p-1 group">
                          <img
                            onClick={() => setLightboxUrl(slip.url)}
                            src={slip.url}
                            alt="Slip preview"
                            className="w-full h-full object-contain cursor-pointer"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center space-x-2">
                            <a
                              href={slip.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white/80 rounded-full text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Eye size={16} />
                            </a>
                            <button
                              onClick={() => handleDeleteSlip(slip.id)}
                              className="p-2 bg-white/80 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-2">ยังไม่มีหลักฐานการชำระเงิน</p>
                  )}
                  <div className="flex items-center space-x-2">
                    <label
                      htmlFor={`${slipUploadInputId}-payafter`}
                      className={`cursor-pointer w-full text-center py-2 px-4 bg-white border border-gray-300 rounded-lg text-gray-600 flex items-center justify-center ${currentOrder.paymentStatus === PaymentStatus.Paid
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50'
                        }`}
                    >
                      <Image size={16} className="mr-2" />
                      อัปโหลดสลิป
                    </label>
                    <input
                      id={`${slipUploadInputId}-payafter`}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleSlipUpload}
                      disabled={currentOrder.paymentStatus === PaymentStatus.Paid}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* แสดงข้อมูลธนาคารและเวลาโอน (ถ้ามี) */}
                {(currentOrder.bankAccountId || currentOrder.transferDate) && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">ข้อมูลการโอนเงิน</h4>
                    <div className="text-xs text-blue-700 space-y-1">
                      {currentOrder.bankAccountId && (() => {
                        const bankAccount = bankAccounts.find(ba => ba.id === currentOrder.bankAccountId);
                        return (
                          <p>
                            ธนาคาร: {bankAccount ? `${bankAccount.bank} ${bankAccount.bank_number}` : `ID: ${currentOrder.bankAccountId}`}
                          </p>
                        );
                      })()}
                      {currentOrder.transferDate && (
                        <p>
                          เวลาโอน: {new Date(currentOrder.transferDate).toLocaleString('th-TH', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* แสดงข้อมูลการตรวจสอบสลิป (ถ้ามี) */}
                {currentOrder.verificationInfo && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <h4 className="text-sm font-medium text-green-800 mb-2">ข้อมูลการตรวจสอบสลิป</h4>
                    <div className="text-xs text-green-700 space-y-1">
                      <p>ผู้ตรวจสอบ: {currentOrder.verificationInfo.verifiedByName}</p>
                      <p>วันที่ตรวจสอบ: {new Date(currentOrder.verificationInfo.verifiedAt).toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                )}

                {/* ปุ่มยืนยันสลิปสำหรับ Backoffice/Admin */}
                {canVerifySlip && slips.length > 0 && currentOrder.paymentStatus !== PaymentStatus.Paid && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleAcceptSlip}
                      className="mt-2 inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      ยืนยันสลิป
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {order.paymentMethod === PaymentMethod.COD && order.boxes && order.boxes.length > 0 && (
            <div className="space-y-2 border-t mt-3 pt-3">
              <h4 className="text-xs font-medium text-gray-500 mb-1">รายละเอียดการเก็บเงินปลายทาง</h4>
              <div className="p-3 bg-gray-50 rounded-md space-y-1">
                {order.boxes.map(box => (
                  <div key={box.boxNumber} className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">กล่องที่ {box.boxNumber}</span>
                    <span className="font-semibold text-gray-800">฿{box.codAmount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-xs font-bold border-t pt-1 mt-1">
                  <span className="text-gray-800">รวม ({order.boxes.length} กล่อง)</span>
                  <span className="text-gray-800">฿{order.boxes.reduce((sum, b) => sum + b.codAmount, 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* แสดงสลิปที่อัปโหลดสำหรับ payment methods อื่นๆ (ที่ไม่ใช่ Transfer หรือ PayAfter) */}
          {slips.length > 0 &&
            order.paymentMethod !== PaymentMethod.Transfer &&
            order.paymentMethod !== PaymentMethod.PayAfter && (
              <div className="mt-2">
                <h4 className="text-xs font-medium text-gray-500 mb-1">สลิปที่อัปโหลด</h4>
                <div className="flex flex-wrap gap-3">
                  {slips.map(slip => (
                    <div key={slip.id} className="relative w-24 h-24 border rounded-md overflow-hidden group">
                      <img onClick={() => setLightboxUrl(slip.url)} src={slip.url} alt="Slip" className="w-full h-full object-cover" />
                      <button onClick={() => handleDeleteSlip(slip.id)} title="ลบ"
                        className="absolute top-1 right-1 bg-white/80 rounded-full text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

        </InfoCard>

        <InfoCard icon={Truck} title="การจัดส่ง">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">สถานะออเดอร์</label>
              <select
                value={currentOrder.orderStatus}
                onChange={(e) => handleFieldChange('orderStatus', e.target.value as OrderStatus)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
              >
                {Object.values(OrderStatus).map(status => (
                  <option key={status} value={status}>{ORDER_STATUS_LABELS[status] ?? status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">เลข Tracking (คั่นด้วย ,)</label>
              <input
                type="text"
                value={currentOrder.trackingNumbers.join(', ')}
                onChange={(e) => {
                  const parts = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  const deduped = Array.from(new Set(parts));
                  handleFieldChange('trackingNumbers', deduped);
                }}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                placeholder="TH123, TH456"
              />
            </div>
          </div>
        </InfoCard>

        <InfoCard icon={History} title="ประวัติออเดอร์">
          <div className="space-y-4 max-h-40 overflow-y-auto pr-2">
            {orderActivities.length > 0 ? orderActivities.map(activity => (
              <div key={activity.id} className="flex">
                <div className="flex-shrink-0 w-8 text-center pt-0.5">
                  <ActivityIcon type={activity.type} />
                </div>
                <div className="ml-2">
                  <p className="text-xs text-gray-700">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{activity.actorName} • {getRelativeTime(activity.timestamp)}</p>
                </div>
              </div>
            )) : (
              <p className="text-xs text-gray-400 text-center py-4">ไม่มีประวัติการเปลี่ยนแปลง</p>
            )}
          </div>
        </InfoCard>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200"
          >
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </div>
      {lightboxUrl && (<div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setLightboxUrl(null)}><img src={lightboxUrl} className="max-w-[90vw] max-h-[90vh] rounded" /></div>)}
    </Modal>
  );
};

export default OrderManagementModal;







