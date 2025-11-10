import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  CheckCircle,
  X,
  AlertCircle,
  Image,
  RefreshCw,
} from "lucide-react";

interface PaymentSlip {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  status: "pending" | "verified" | "rejected";
  uploadedBy?: string;
  customerName?: string;
  amount?: number;
  notes?: string;
  orderId?: string;
}

const SlipAll: React.FC = () => {
  const toAbsoluteApiUrl = (u: string | undefined | null) => {
    if (!u) return u as any;
    const s = String(u);
    if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("//")) return s;
    return s.startsWith("/") ? s : "/" + s;
  };
  const [slips, setSlips] = useState<PaymentSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "verified" | "rejected"
  >("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "week" | "month"
  >("all");
  const [selectedSlip, setSelectedSlip] = useState<PaymentSlip | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Mock data loading
  useEffect(() => {
    loadSlips();
  }, []);

  const loadSlips = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock data
      const mockSlips: PaymentSlip[] = [
        {
          id: "1",
          name: "slip_001.jpg",
          url: "https://picsum.photos/seed/slip1/800/600.jpg",
          uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: "pending",
          uploadedBy: "สมชาย ใจดี",
          customerName: "วรรณพร สุขสันต์",
          amount: 1500,
          orderId: "ORD-001",
        },
        {
          id: "2",
          name: "slip_002.jpg",
          url: "https://picsum.photos/seed/slip2/800/600.jpg",
          uploadedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          status: "verified",
          uploadedBy: "สมศรี มีความ",
          customerName: "อนุชิต รักษาดี",
          amount: 3200,
          orderId: "ORD-002",
        },
        {
          id: "3",
          name: "slip_003.jpg",
          url: "https://picsum.photos/seed/slip3/800/600.jpg",
          uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: "rejected",
          uploadedBy: "สมหญิง แจ่มใส",
          customerName: "ธิติวัฒน์ รุ่งเรือง",
          amount: 2800,
          orderId: "ORD-003",
          notes: "รูปภาพไม่ชัดเจน ไม่สามารถอ่านข้อมูลได้",
        },
        {
          id: "4",
          name: "slip_004.jpg",
          url: "https://picsum.photos/seed/slip4/800/600.jpg",
          uploadedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          status: "verified",
          uploadedBy: "สมฤทธิ์ มั่งคั่ง",
          customerName: "นาตาลี่ จันทร์เจริญ",
          amount: 5000,
          orderId: "ORD-004",
        },
      ];

      setSlips(mockSlips);
    } catch (error) {
      console.error("Failed to load slips:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSlips = slips.filter((slip) => {
    const matchesSearch =
      slip.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.uploadedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.orderId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || slip.status === statusFilter;

    const slipDate = new Date(slip.uploadedAt);
    const now = new Date();
    let matchesDate = true;

    if (dateFilter === "today") {
      matchesDate = slipDate.toDateString() === now.toDateString();
    } else if (dateFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = slipDate >= weekAgo;
    } else if (dateFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = slipDate >= monthAgo;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

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
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePreview = (slip: PaymentSlip) => {
    setSelectedSlip(slip);
    setShowPreview(true);
  };

  const handleExport = () => {
    // Simulate export functionality
    const csvContent = [
      [
        "ID",
        "ชื่อไฟล์",
        "สถานะ",
        "ลูกค้า",
        "จำนวนเงิน",
        "วันที่อัปโหลด",
        "ผู้อัปโหลด",
      ],
      ...filteredSlips.map((slip) => [
        slip.id,
        slip.name,
        getStatusText(slip.status),
        slip.customerName || "",
        slip.amount || "",
        formatDate(slip.uploadedAt),
        slip.uploadedBy || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payment_slips_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">สลิปทั้งหมด</h1>
              <p className="text-gray-600">
                ดูและจัดการสลิปการโอนเงินทั้งหมดในระบบ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSlips}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              รีเฟรช
            </button>
            <button
              onClick={handleExport}
              disabled={filteredSlips.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              ส่งออก
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="ค้นหาตามชื่อไฟล์, ลูกค้า, ผู้อัปโหลด..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="pending">รอตรวจสอบ</option>
              <option value="verified">ยืนยันแล้ว</option>
              <option value="rejected">ปฏิเสธ</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">ทุกช่วงเวลา</option>
              <option value="today">วันนี้</option>
              <option value="week">7 วันล่าสุด</option>
              <option value="month">30 วันล่าสุด</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          พบ {filteredSlips.length} รายการ (จากทั้งหมด {slips.length} รายการ)
        </div>
      </div>

      {/* Slips List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
            <span className="text-gray-600">กำลังโหลดข้อมูล...</span>
          </div>
        ) : filteredSlips.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">ไม่พบข้อมูลสลิป</p>
            <p className="text-sm text-gray-500 mt-2">
              ลองปรับเปลี่ยนเงื่อนไขการค้นหา
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ข้อมูลสลิป
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ลูกค้า
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    จำนวนเงิน
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ผู้อัปโหลด
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    การจัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSlips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border border-gray-200 rounded-lg overflow-hidden">
                          <img
                            src={toAbsoluteApiUrl(slip.url)}
                            alt={slip.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {slip.name}
                          </div>
                          {slip.orderId && (
                            <div className="text-xs text-gray-500">
                              {slip.orderId}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {slip.customerName || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {slip.amount ? `฿${slip.amount.toLocaleString()}` : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(slip.status)}
                        <span
                          className={`text-sm px-2 py-1 rounded-full ${getStatusColor(slip.status)}`}
                        >
                          {getStatusText(slip.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {slip.uploadedBy || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {formatDate(slip.uploadedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handlePreview(slip)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedSlip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  รายละเอียดสลิป
                </h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    รูปภาพสลิป
                  </h3>
                  <img
                    src={toAbsoluteApiUrl(selectedSlip.url)}
                    alt={selectedSlip.name}
                    className="w-full border border-gray-200 rounded-lg"
                  />
                </div>

                {/* Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    ข้อมูลรายละเอียด
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        ชื่อไฟล์
                      </label>
                      <p className="text-gray-900">{selectedSlip.name}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        หมายเลขออเดอร์
                      </label>
                      <p className="text-gray-900">
                        {selectedSlip.orderId || "-"}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        ชื่อลูกค้า
                      </label>
                      <p className="text-gray-900">
                        {selectedSlip.customerName || "-"}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        จำนวนเงิน
                      </label>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedSlip.amount
                          ? `฿${selectedSlip.amount.toLocaleString()}`
                          : "-"}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        สถานะ
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(selectedSlip.status)}
                        <span
                          className={`text-sm px-2 py-1 rounded-full ${getStatusColor(selectedSlip.status)}`}
                        >
                          {getStatusText(selectedSlip.status)}
                        </span>
                      </div>
                    </div>

                    {selectedSlip.notes && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          หมายเหตุ
                        </label>
                        <p className="text-gray-900 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                          {selectedSlip.notes}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        ผู้อัปโหลด
                      </label>
                      <p className="text-gray-900">
                        {selectedSlip.uploadedBy || "-"}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        วันที่อัปโหลด
                      </label>
                      <p className="text-gray-900">
                        {formatDate(selectedSlip.uploadedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlipAll;
