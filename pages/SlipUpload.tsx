import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, FileText } from "lucide-react";

interface Order {
  id: number;
  order_date: string;
  delivery_date: string;
  total_amount: number;
  first_name: string;
  last_name: string;
  phone: string;
  full_name: string;
}

const SlipUpload: React.FC = () => {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      // Get company_id from localStorage
      const sessionUser = localStorage.getItem("sessionUser");
      if (!sessionUser) {
        showMessage("error", "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        setLoadingOrders(false);
        return;
      }

      const user = JSON.parse(sessionUser);
      const companyId = user.company_id;

      if (!companyId) {
        showMessage("error", "ไม่พบข้อมูลบริษัท กรุณาติดต่อผู้ดูแลระบบ");
        setLoadingOrders(false);
        return;
      }

      const response = await fetch(
        `/api/Slip_DB/get_transfer_orders.php?company_id=${companyId}`,
      );
      const data = await response.json();

      if (data.success) {
        setOrders(data.data);
        if (data.count === 0) {
          showMessage(
            "error",
            "ไม่พบรายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน",
          );
        }
      } else {
        showMessage("error", data.message || "ไม่สามารถดึงข้อมูลคำสั่งซื้อได้");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่งซื้อ");
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch orders on component mount
  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              รายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน
            </h1>
            <p className="text-gray-600">
              แสดงรายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอนเงิน
            </p>
          </div>
        </div>
      </div>

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
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          {message.text}
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              รายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน
            </h2>
            <button
              onClick={fetchOrders}
              disabled={loadingOrders}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loadingOrders ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังโหลด...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  รีเฟรชข้อมูล
                </>
              )}
            </button>
          </div>

          {loadingOrders && orders.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      วันที่สั่งซื้อ
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      วันที่ส่ง
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      รหัสคำสั่งซื้อ
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      ชื่อลูกค้า
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">
                      เบอร์โทร
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">
                      ยอดเงิน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.order_date
                          ? new Date(order.order_date).toLocaleDateString(
                              "th-TH",
                            )
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.delivery_date
                          ? new Date(order.delivery_date).toLocaleDateString(
                              "th-TH",
                            )
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        #{order.id}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.full_name || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {order.phone || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                        ฿
                        {order.total_amount.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                ไม่พบรายการคำสั่งซื้อที่ต้องชำระเงินผ่านการโอน
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlipUpload;
