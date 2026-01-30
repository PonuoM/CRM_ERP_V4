import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Customer, Order, User, Address, UserRole, Page } from "../types";
import { listOrders, listCustomers, listPages } from "../services/api";
import { mapOrderFromApi } from "../utils/orderMapper";
import { mapCustomerFromApi } from "../utils/customerMapper";
import {
  Search,
  Trash2,
  User as UserIcon,
  Calendar,
  Facebook,
  MessageSquare,
  UserPlus,

} from "lucide-react";

interface CustomerSearchPageProps {
  customers: Customer[];
  orders: Order[];
  users: User[];
  currentUser?: User;
  onTakeCustomer?: (customer: Customer) => void;
  pages?: Page[];
}

const CustomerSearchPage: React.FC<CustomerSearchPageProps> = ({
  customers,
  orders,
  users,
  currentUser,
  onTakeCustomer,
  pages: propPages,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchedOrders, setFetchedOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [pages, setPages] = useState<Page[]>(propPages || []);

  // Fetch pages for mapping salesChannelPageId to page name
  useEffect(() => {
    if (!propPages || propPages.length === 0) {
      listPages(currentUser?.companyId).then((res) => {
        if (Array.isArray(res)) {
          setPages(res);
        }
      }).catch((err) => console.error("Failed to fetch pages", err));
    }
  }, [currentUser?.companyId, propPages]);

  // Helper function to get page name from page ID
  const getPageName = useCallback((pageId?: number): string => {
    if (!pageId) return "-";
    const page = pages.find((p) => p.id === pageId);
    return page?.name || "-";
  }, [pages]);

  const fetchCustomerOrders = useCallback(async (customer: Customer) => {
    setLoadingOrders(true);
    try {
      // Fetch specifically for this customer by phone (most reliable unique key exposed)
      const res = await listOrders({
        companyId: currentUser?.companyId,
        customerPhone: customer.phone,
        pageSize: 100 // Reasonable limit for history
      });
      if (res.ok && Array.isArray(res.orders)) {
        // Filter out sub-orders if any, similar to App.tsx logic
        const mainOrders = res.orders.filter((order: any) => {
          const orderId = String(order.id || "");
          return !/-\d+$/.test(orderId);
        });
        setFetchedOrders(mainOrders.map(mapOrderFromApi));
      } else {
        setFetchedOrders([]);
      }
    } catch (error) {
      console.error("Failed to fetch customer orders", error);
      setFetchedOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [currentUser?.companyId]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerOrders(selectedCustomer);
    } else {
      setFetchedOrders([]);
    }
  }, [selectedCustomer, fetchCustomerOrders]);

  const handleSearch = async () => {
    setSelectedCustomer(null);
    setHighlightedOrderId(null);
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    setHasSearched(true);
    setIsSearching(true);

    try {
      // Search via API instead of filtering local prop
      const companyId = currentUser?.companyId;
      const response = await listCustomers({
        q: searchTerm.trim(),
        companyId: companyId,
        pageSize: 100, // Reasonable limit for search results
      });

      const foundCustomers = (response.data || []).map((c: any) => mapCustomerFromApi(c));

      if (foundCustomers.length === 1) {
        setSelectedCustomer(foundCustomers[0]);
        setSearchResults([]);
      } else if (foundCustomers.length > 1) {
        setSearchResults(foundCustomers);
      } else {
        // No customer found by name/phone, try searching by Order ID
        try {
          const res = await listOrders({ orderId: searchTerm.trim(), companyId: companyId });
          if (res.ok && Array.isArray(res.orders) && res.orders.length > 0) {
            const order = res.orders[0]; // Assuming unique order ID matches or taking first
            // Search for the customer by phone from the order
            if (order.customer_phone) {
              const customerRes = await listCustomers({
                phone: order.customer_phone,
                companyId: companyId,
              });
              const matchedCustomers = (customerRes.data || []).map((c: any) => mapCustomerFromApi(c));
              if (matchedCustomers.length > 0) {
                setSelectedCustomer(matchedCustomers[0]);
                setHighlightedOrderId(String(order.id));
                setSearchResults([]);
              } else {
                setSearchResults([]);
              }
            } else {
              setSearchResults([]);
            }
          } else {
            setSearchResults([]);
          }
        } catch (e) {
          console.error("Order search failed", e);
          setSearchResults([]);
        }
      }
    } catch (error) {
      console.error("Customer search failed", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setSearchTerm("");
    setSearchResults([]);
    setSelectedCustomer(null);
    setHasSearched(false);
    setHighlightedOrderId(null);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setHighlightedOrderId(null);
  };

  const customerDetails = useMemo(() => {
    if (!selectedCustomer) return null;

    // Use fetched orders if available, otherwise fallback to props (though props likely empty)
    // We prioritize fetchedOrders because they are loaded on demand for the search result
    const sourceOrders = fetchedOrders.length > 0 ? fetchedOrders : orders;

    const customerOrders = sourceOrders
      .filter((o) => String(o.customerId) === String(selectedCustomer.id) || String(o.customerId) === String(selectedCustomer.pk) || o.shippingAddress?.province === selectedCustomer.province) // Loose match fallback? No, strict is better. stick to ID match if possible, but phone fetch is source of truth.
      // Actually, since we fetch BY PHONE, fetchedOrders are already filtered.
      // We just need to sort them.
      .filter(o => fetchedOrders.length > 0 ? true : (String(o.customerId) === String(selectedCustomer.id) || String(o.customerId) === String(selectedCustomer.pk)))
      .sort(
        (a, b) =>
          new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
      );

    const totalPurchase = customerOrders.reduce(
      (sum, order) => {
        const orderTotal = order.items.reduce((itemSum, item) => {
          // ไม่รวมของแถม (isFreebie) ในยอดขาย
          if (item.isFreebie) return itemSum;
          return itemSum + (item.quantity * item.pricePerUnit - (item.discount || 0));
        }, 0);
        return sum + orderTotal;
      },
      0,
    );
    const assignedUser = users.find(
      (u) => u.id === selectedCustomer.assignedTo,
    );

    const assignedManagerName = assignedUser
      ? `${assignedUser.firstName} ${assignedUser.lastName}`
      : "ไม่มีผู้ดูแล";

    return {
      ...selectedCustomer,
      orders: customerOrders,
      totalPurchase,
      orderCount: customerOrders.length,
      assignedManager: assignedManagerName,
    };
  }, [selectedCustomer, orders, users, fetchedOrders]);

  const isOrderRecent = (orderDate: string) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return new Date(orderDate) > ninetyDaysAgo;
  };

  const formatAddress = (address?: Address) => {
    if (!address) return "-";
    return `${address.street}, ต.${address.subdistrict}, อ.${address.district}, จ.${address.province}`;
  };

  const getThaiBuddhistDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const openNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };



  return (
    <div className="p-6 bg-[#EBF4FA] min-h-full">
      <div className="">
        {/* Header with New Tab Button */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">ค้นหาลูกค้า</h1>

        </div>
        {/*
        {searchResults.length > 0 && (
          <div className="mt-6 bg-white p-4 rounded-2xl shadow-lg">
            <h3 className="font-semibold text-gray-700 mb-2">ผลการค้นหาลูกค้า:</h3>
            <ul className="space-y-2">
              {searchResults.map((customer) => (
                <li
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer border"
                >
                  <p className="font-bold text-blue-700" style={{ color: "#000000" }}>
                    {`${customer.firstName} ${customer.lastName}`}
                  </p>
                  <p className="text-sm text-gray-600" style={{ color: "#000000" }}>
                    {customer.phone}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        */}

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-lg">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if ((e as any).key === "Enter") handleSearch();
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Search className="w-4 h-4" />
                ค้นหา
              </button>
              {searchTerm && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-6 bg-white p-4 rounded-2xl shadow-lg">
            <h3 className="font-semibold text-gray-700 mb-2">ผลการค้นหาลูกค้า {searchResults.length} รายการ</h3>
            <ul className="space-y-2">
              {searchResults.map((customer) => (
                <li
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer border"
                >
                  <p className="font-bold text-blue-700" style={{ color: "#000000" }}>
                    {`${customer.firstName} ${customer.lastName}`}
                  </p>
                  <p className="text-sm text-gray-600" style={{ color: "#000000" }}>
                    {customer.phone}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Search Result */}
        {customerDetails && selectedCustomer ? (
          <div className="mt-6">
            {/* Customer Card */}
            <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 flex justify-between items-start">
              <div className="flex items-center">
                <div className="bg-blue-100 p-4 rounded-full mr-5">
                  <UserIcon className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{`${customerDetails.firstName} ${customerDetails.lastName}`}</h2>
                  <p className="text-gray-600 mt-1">{customerDetails.phone}</p>
                  <p className="text-gray-500 text-sm mt-1">
                    {formatAddress(customerDetails.address)}
                  </p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-sm text-gray-500">ยอดรวม</p>
                <p className="text-2xl font-bold text-green-600">
                  {customerDetails.totalPurchase.toLocaleString("th-TH")} บาท
                </p>
                <p className="text-sm text-gray-500 mt-2">จำนวนครั้งที่สั่ง</p>
                <p className="text-lg font-semibold text-blue-600">
                  {customerDetails.orderCount}
                </p>
                {currentUser &&
                  currentUser.role !== UserRole.Backoffice &&
                  onTakeCustomer &&
                  !customerDetails.assignedTo && (
                    <button
                      onClick={() => onTakeCustomer(selectedCustomer)}
                      className="mt-4 bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm"
                    >
                      <UserPlus size={16} className="mr-2" />
                      รับลูกค้า
                    </button>
                  )}
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <p className="text-gray-700 md:col-span-1">
                <strong className="font-medium text-gray-800">
                  ผู้ดูแลปัจจุบัน:
                </strong>{" "}
                {customerDetails.assignedManager}
              </p>
              <p className="text-gray-700 flex items-center">
                <Facebook size={16} className="text-blue-600 mr-2" />{" "}
                <strong className="font-medium text-gray-800 mr-2">
                  Facebook:
                </strong>{" "}
                {customerDetails.facebookName || "-"}
              </p>
              <p className="text-gray-700 flex items-center">
                <MessageSquare size={16} className="text-green-500 mr-2" />{" "}
                <strong className="font-medium text-gray-800 mr-2">
                  LINE:
                </strong>{" "}
                {customerDetails.lineId || "-"}
              </p>
            </div>

            {/* Order History */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <h3 className="text-xl font-semibold text-gray-800 p-6 flex items-center border-b">
                <Calendar className="w-6 h-6 mr-3 text-gray-500" />
                ประวัติการสั่งซื้อ
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">เลขที่ Order</th>
                      <th className="px-6 py-3 font-medium">วันที่ขาย</th>
                      <th className="px-6 py-3 font-medium">สินค้า</th>
                      <th className="px-6 py-3 font-medium text-center">
                        จำนวน
                      </th>
                      <th className="px-6 py-3 font-medium text-right">ราคา</th>
                      <th className="px-6 py-3 font-medium">พนักงานขาย</th>
                      <th className="px-6 py-3 font-medium">แผนก</th>
                      <th className="px-6 py-3 font-medium">ช่องทางการขาย</th>
                      <th className="px-6 py-3 font-medium">เพจ</th>
                      <th className="px-6 py-3 font-medium">สถานะออเดอร์</th>
                      <th className="px-6 py-3 font-medium">Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDetails.orders.length > 0 ? (
                      customerDetails.orders.map((order, orderIndex) => {
                        const isHighlighted = highlightedOrderId === String(order.id);
                        // สลับสีตาม order index เพื่อให้เห็นกลุ่มออเดอร์ชัดเจน
                        const orderBgColor = isHighlighted
                          ? 'bg-yellow-50'
                          : orderIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                        return (
                          <React.Fragment key={order.id}>
                            {/* แถวย่อย - แต่ละรายการสินค้า */}
                            {order.items.map((item, itemIndex) => {
                              // หา creator ของ item นี้ (รองรับ Upsell ที่มีหลายคนขาย)
                              const itemCreatorId = item.creatorId || order.creatorId;
                              const itemCreator = users.find((u) => {
                                if (!itemCreatorId) return false;
                                if (typeof u.id === 'number' && typeof itemCreatorId === 'number') {
                                  return u.id === itemCreatorId;
                                }
                                return String(u.id) === String(itemCreatorId);
                              });
                              const itemCreatorName = itemCreator
                                ? `${itemCreator.firstName} ${itemCreator.lastName}`
                                : "N/A";

                              return (
                                <tr
                                  key={`${order.id}-item-${itemIndex}`}
                                  id={itemIndex === 0 ? `order-${order.id}` : undefined}
                                  className={`${itemIndex === 0 ? 'border-t-2 border-gray-300' : 'border-t border-gray-100'} ${orderBgColor} ${item.isFreebie ? 'text-green-700' : ''}`}
                                >
                                  {/* Order ID - แสดงเฉพาะแถวแรก, แถวอื่นเว้นว่าง */}
                                  <td className="px-6 py-2 text-gray-800 font-mono text-sm">
                                    {itemIndex === 0 ? order.id : ''}
                                  </td>
                                  {/* วันที่ - แสดงเฉพาะแถวแรก */}
                                  <td className="px-6 py-2 text-gray-800">
                                    {itemIndex === 0 ? getThaiBuddhistDate(order.orderDate) : ''}
                                  </td>
                                  {/* สินค้า */}
                                  <td className="px-6 py-2 text-gray-800">
                                    <span className={item.isFreebie ? 'text-green-600' : ''}>
                                      {item.productName}
                                      {item.isFreebie && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">แถม</span>}
                                    </span>
                                  </td>
                                  {/* จำนวน */}
                                  <td className="px-6 py-2 text-center text-gray-800">
                                    {item.quantity}
                                  </td>
                                  {/* ราคา */}
                                  <td className="px-6 py-2 text-right font-medium text-gray-800">
                                    {item.isFreebie
                                      ? <span className="text-green-600 text-sm">ฟรี</span>
                                      : (item.quantity * item.pricePerUnit - (item.discount || 0)).toLocaleString()
                                    }
                                  </td>
                                  {/* พนักงาน - แสดงทุกแถว (รองรับ Upsell) */}
                                  <td className="px-6 py-2 text-gray-800">
                                    {itemCreatorName}
                                  </td>
                                  {/* แผนก - แสดงทุกแถว */}
                                  <td className="px-6 py-2 text-gray-800">
                                    {itemCreator?.role || "N/A"}
                                  </td>
                                  {/* ช่องทางขาย - แสดงทุกแถว (role 6/7 = โทร) */}
                                  <td className="px-6 py-2 text-gray-800">
                                    {(() => {
                                      // Role 6 หรือ 7 = Telesale → แสดง "โทร"
                                      const roleId = item.creatorRoleId;
                                      if (roleId === 6 || roleId === 7) {
                                        return "โทร";
                                      }
                                      return order.salesChannel || "-";
                                    })()}
                                  </td>
                                  {/* เพจ - แสดงทุกแถว (ถ้าไม่ใช่โทร) */}
                                  <td className="px-6 py-2 text-gray-800">
                                    {(() => {
                                      const roleId = item.creatorRoleId;
                                      // Role 6/7 = โทร → ไม่มีเพจ
                                      if (roleId === 6 || roleId === 7) {
                                        return "-";
                                      }
                                      if (order.salesChannel && order.salesChannel.toLowerCase() !== 'โทร' && order.salesChannel.toLowerCase() !== 'phone') {
                                        return getPageName(order.salesChannelPageId);
                                      }
                                      return "-";
                                    })()}
                                  </td>
                                  {/* สถานะ - แสดงเฉพาะแถวแรก */}
                                  <td className="px-6 py-2 text-gray-800">
                                    {itemIndex === 0 ? (order.orderStatus || "-") : ''}
                                  </td>
                                  {/* Tracking - แสดงตาม boxNumber ของ item */}
                                  <td className="px-6 py-2 text-gray-800 font-mono text-sm">
                                    {(() => {
                                      // หา tracking ที่ตรงกับ box_number ของ item
                                      const td = order.trackingDetails || [];
                                      const itemBox = item.boxNumber;
                                      const matchedTracking = td.find(t => t.boxNumber === itemBox);
                                      if (matchedTracking?.trackingNumber) {
                                        return matchedTracking.trackingNumber;
                                      }
                                      // Fallback: ถ้าไม่เจอ แสดง tracking แรก (เฉพาะแถวแรก)
                                      if (itemIndex === 0 && td.length > 0) {
                                        return td[0].trackingNumber || "-";
                                      }
                                      if (itemIndex === 0) {
                                        return order.trackingNumbers?.join(', ') || "-";
                                      }
                                      return '';
                                    })()}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={11}
                          className="text-center p-8 text-gray-500"
                        >
                          ไม่มีประวัติการสั่งซื้อ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          searchResults.length === 0 && hasSearched && !isSearching && (
            <div className="mt-6 text-center text-gray-500">
              <p>ไม่พบข้อมูลลูกค้าที่ตรงกับคำค้นหา: "{searchTerm}"</p>
              <p className="text-xs mt-2">ลองค้นหาด้วยเบอร์โทรหรือชื่อลูกค้า</p>
            </div>
          )
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="mt-6 text-center text-gray-500">
            <p>กำลังค้นหา...</p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-10 text-xs text-gray-500">
          <p>Powered by Thanu Suriwong</p>
          <p>© 2025 Customer Service. All rights reserved.</p>
          <p>อัปเดตล่าสุด: 22/12/2568 10:13 • เวอร์ชั่น 0.1.1</p>
        </footer>
      </div>
    </div >
  );
};
export default CustomerSearchPage;


