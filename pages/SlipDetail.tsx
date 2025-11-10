import React, { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  User,
  DollarSign,
  ShoppingCart,
  CheckCircle,
  X,
  AlertCircle,
  Image,
  Download,
  Edit,
  Save,
  RefreshCw,
  ArrowLeft,
  Upload,
} from "lucide-react";

interface PaymentSlip {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  verifiedAt?: string;
  status: "pending" | "verified" | "rejected";
  uploadedBy: string;
  customerName: string;
  amount: number;
  notes?: string;
  orderId: string;
  orderAmount?: number;
  verificationNotes?: string;
  bankName?: string;
  accountNumber?: string;
  transactionId?: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface Order {
  id: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const SlipDetail: React.FC = () => {
  // For demo purposes, we'll get the slip ID from URL or use a default
  const [slipId] = useState<string>(
    new URLSearchParams(window.location.search).get("id") || "1",
  );
  const [slip, setSlip] = useState<PaymentSlip | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadSlipDetails();
  }, [slipId]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadSlipDetails = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock data
      const mockSlip: PaymentSlip = {
        id: slipId,
        name: "slip_001.jpg",
        url: "https://picsum.photos/seed/slip1/1200/800.jpg",
        uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        verifiedAt:
          slipId === "1"
            ? undefined
            : new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        status: slipId === "1" ? "pending" : "verified",
        uploadedBy: "สมชาย ใจดี",
        customerName: "วรรณพร สุขสันต์",
        amount: 1500,
        notes: "ลูกค้าโอนเงินเข้าบัญชี วันที่ 15 ม.ค. 2567",
        orderId: "ORD-001",
        orderAmount: 1500,
        verificationNotes: slipId === "1" ? "" : "สลิปถูกต้อง จำนวนเงินตรงกัน",
        bankName: "ธนาคารกสิกรไทย",
        accountNumber: "123-4-56789-0",
        transactionId: "TXN123456789",
      };

      const mockCustomer: Customer = {
        id: "CUST-001",
        name: "วรรณพร สุขสันต์",
        email: "wanporn@example.com",
        phone: "081-234-5678",
        address:
          "123 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร 10110",
      };

      const mockOrder: Order = {
        id: "ORD-001",
        customerName: "วรรณพร สุขสันต์",
        totalAmount: 1500,
        status: "pending_payment",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      };

      setSlip(mockSlip);
      setCustomer(mockCustomer);
      setOrder(mockOrder);
      setVerificationNotes(mockSlip.verificationNotes || "");
    } catch (error) {
      console.error("Failed to load slip details:", error);
      showMessage("error", "ไม่สามารถโหลดข้อมูลสลิปได้");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: "verified" | "rejected") => {
    if (!slip) return;

    setUpdating(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const updatedSlip = {
        ...slip,
        status: newStatus,
        verifiedAt: new Date().toISOString(),
        verificationNotes,
      };

      setSlip(updatedSlip);
      setEditing(false);
      showMessage(
        "success",
        newStatus === "verified" ? "อนุมัติสลิปสำเร็จ" : "ปฏิเสธสลิปสำเร็จ",
      );
    } catch (error) {
      showMessage("error", "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setUpdating(false);
    }
  };

  const handleDownload = () => {
    if (!slip) return;

    const link = document.createElement("a");
    link.href = slip.url;
    link.download = slip.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusIcon = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rejected":
        return <X className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusText = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "verified":
        return "ยืนยันแล้ว";
      case "rejected":
        return "ปฏิเสธ";
      default:
        return "รอตรวจสอบ";
    }
  };

  const getStatusColor = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "verified":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-600">กำลังโหลดข้อมูล...</span>
        </div>
      </div>
    );
  }

  if (!slip) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">ไม่พบข้อมูลสลิป</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Alert Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                รายละเอียดสลิป
              </h1>
              <p className="text-gray-600">รายละเอียดสลิปโอนเงิน {slip.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลด
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Slip Image */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              รูปภาพสลิป
            </h2>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <img src={(slip.url && (slip.url.startsWith('http://') || slip.url.startsWith('https://') || slip.url.startsWith('//'))) ? slip.url : (slip.url?.startsWith('/') ? slip.url : `/${slip.url}`)} alt={slip.name} className="w-full h-auto" />
            </div>
          </div>

          {/* Order Information */}
          {order && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ข้อมูลออเดอร์
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">หมายเลขออเดอร์</p>
                    <p className="font-medium text-gray-900">{order.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">ยอดรวมออเดอร์</p>
                    <p className="font-medium text-gray-900">
                      ฿{order.totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">วันที่สร้างออเดอร์</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">สถานะออเดอร์</p>
                    <p className="font-medium text-gray-900">{order.status}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Details and Actions */}
        <div className="space-y-6">
          {/* Slip Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              ข้อมูลสลิป
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  ชื่อไฟล์
                </label>
                <p className="text-gray-900">{slip.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  สถานะ
                </label>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(slip.status)}
                  <span
                    className={`text-sm px-2 py-1 rounded-full ${getStatusColor(
                      slip.status,
                    )}`}
                  >
                    {getStatusText(slip.status)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  จำนวนเงินที่โอน
                </label>
                <p className="text-lg font-semibold text-gray-900">
                  ฿{slip.amount.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  ผู้อัปโหลด
                </label>
                <p className="text-gray-900">{slip.uploadedBy}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">
                  วันที่อัปโหลด
                </label>
                <p className="text-gray-900">{formatDate(slip.uploadedAt)}</p>
              </div>

              {slip.verifiedAt && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    วันที่ตรวจสอบ
                  </label>
                  <p className="text-gray-900">{formatDate(slip.verifiedAt)}</p>
                </div>
              )}

              {slip.bankName && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    ธนาคาร
                  </label>
                  <p className="text-gray-900">{slip.bankName}</p>
                </div>
              )}

              {slip.accountNumber && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    เลขที่บัญชี
                  </label>
                  <p className="text-gray-900">{slip.accountNumber}</p>
                </div>
              )}

              {slip.transactionId && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    รหัสธุรกรรม
                  </label>
                  <p className="text-gray-900">{slip.transactionId}</p>
                </div>
              )}

              {slip.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    หมายเหตุจากผู้อัปโหลด
                  </label>
                  <p className="text-gray-900 bg-blue-50 p-3 rounded-lg border border-blue-200">
                    {slip.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
          {customer && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ข้อมูลลูกค้า
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">ชื่อลูกค้า</p>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    อีเมล
                  </label>
                  <p className="text-gray-900">{customer.email}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    เบอร์โทรศัพท์
                  </label>
                  <p className="text-gray-900">{customer.phone}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    ที่อยู่
                  </label>
                  <p className="text-gray-900 text-sm">{customer.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Verification Actions */}
          {slip.status === "pending" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                การตรวจสอบ
              </h2>

              {/* Verification Notes */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-500 block mb-2">
                  หมายเหตุการตรวจสอบ
                </label>
                {editing ? (
                  <textarea
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="กรอกหมายเหตุ (ถ้ามี)..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                ) : (
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg min-h-[80px]">
                    {verificationNotes || "-"}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("verified")}
                      disabled={updating}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {updating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          อนุมัติ
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus("rejected")}
                      disabled={updating}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {updating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4" />
                          ปฏิเสธ
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    แก้ไขการตรวจสอบ
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Status History */}
          {slip.verifiedAt && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                ประวัติการตรวจสอบ
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {slip.status === "verified"
                        ? "อนุมัติสลิป"
                        : "ปฏิเสธสลิป"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(slip.verifiedAt || "")}
                    </p>
                    {slip.verificationNotes && (
                      <p className="text-sm text-gray-600 mt-1">
                        {slip.verificationNotes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      อัปโหลดสลิป
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(slip.uploadedAt)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      โดย {slip.uploadedBy}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlipDetail;
