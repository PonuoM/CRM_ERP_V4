import React, { useEffect, useMemo, useState } from "react";
import { Page, Promotion, AdSpend, User, UserRole } from "@/types";
import {
  listPages,
  createPage,
  updatePage,
  listPromotions,
  listAdSpend,
  createAdSpend,
  listUsers,
  updateUser,
  getPageUsers,
  getPagesWithUsers,
  updatePageUserConnection,
  PageUser,
  PageWithUsers,
} from "@/services/api";

// Function to fetch active pages where still_in_list = 1
async function listActivePages(companyId?: number) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("company_id", String(companyId));
  const res = await fetch(
    `api/Marketing_DB/get_active_pages.php${companyId ? `?${qs}` : ""}`,
    {
      headers: { "Content-Type": "application/json" },
    },
  );
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${data?.error || "API error"}`);
  }
  return data;
}

interface MarketingPageProps {
  currentUser: User;
}

// Types are now imported from @/services/api

const inputClass =
  "w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

// Check if user has admin access
const hasAdminAccess = (user: User) => {
  return (
    user.role === UserRole.SuperAdmin ||
    user.role === UserRole.AdminControl ||
    user.role === UserRole.Marketing
  );
};

const MarketingPage: React.FC<MarketingPageProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<"ads" | "userManagement">("ads");
  const [pages, setPages] = useState<Page[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [adSpend, setAdSpend] = useState<AdSpend[]>([]);
  const [pageUsers, setPageUsers] = useState<PageUser[]>([]);
  const [pagesWithUsers, setPagesWithUsers] = useState<PageWithUsers[]>([]);
  const [marketingUsers, setMarketingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userManagementLoading, setUserManagementLoading] = useState(false);

  // States for marketing user page management
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());
  const [marketingPageUsers, setMarketingPageUsers] = useState<any[]>([]);
  const [selectedPageForUser, setSelectedPageForUser] = useState<number | null>(
    null,
  );

  // New page form
  const [newPage, setNewPage] = useState<{
    name: string;
    platform: string;
    url?: string;
    active: boolean;
  }>({ name: "", platform: "Facebook", url: "", active: true });
  const [filterPageId, setFilterPageId] = useState<number | "">("");
  const [newSpend, setNewSpend] = useState<{
    pageId: number | "";
    date: string;
    amount: string;
    notes: string;
  }>({
    pageId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [pg, promo] = await Promise.all([
          listActivePages(currentUser.companyId),
          listPromotions(),
        ]);
        if (cancelled) return;
        setPages(
          Array.isArray(pg?.data)
            ? pg.data.map((r: any) => ({
                id: r.id,
                name: r.name,
                platform: r.platform,
                url: r.url ?? undefined,
                companyId: r.company_id ?? r.companyId ?? currentUser.companyId,
                active: Boolean(r.active),
              }))
            : [],
        );
        setPromotions(Array.isArray(promo) ? promo : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser.companyId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSpend() {
      const pid = typeof filterPageId === "number" ? filterPageId : undefined;
      const rows = await listAdSpend(pid);
      if (cancelled) return;
      const mapped: AdSpend[] = Array.isArray(rows)
        ? rows.map((r: any) => ({
            id: Number(r.id),
            pageId: Number(r.page_id),
            spendDate: r.spend_date,
            amount: Number(r.amount),
            notes: r.notes ?? undefined,
          }))
        : [];
      setAdSpend(mapped);
    }
    loadSpend();
    return () => {
      cancelled = true;
    };
  }, [filterPageId]);

  const totalSpend = useMemo(
    () => adSpend.reduce((s, r) => s + (r.amount || 0), 0),
    [adSpend],
  );

  const handleAddPage = async () => {
    if (!newPage.name.trim()) return alert("กรุณากรอกชื่อเพจ");
    try {
      const created = await createPage({
        name: newPage.name.trim(),
        platform: newPage.platform,
        url: newPage.url,
        companyId: currentUser.companyId,
        active: newPage.active,
      });
      // Reload pages
      const pg = await listPages(currentUser.companyId);
      setPages(
        Array.isArray(pg)
          ? pg.map((r: any) => ({
              id: r.id,
              name: r.name,
              platform: r.platform,
              url: r.url ?? undefined,
              companyId: r.company_id ?? r.companyId ?? currentUser.companyId,
              active: Boolean(r.active),
            }))
          : [],
      );
      setNewPage({
        name: "",
        platform: newPage.platform,
        url: "",
        active: true,
      });
    } catch (e) {
      console.error("create page failed", e);
      alert("เพิ่มเพจไม่สำเร็จ");
    }
  };

  const togglePageActive = async (p: Page) => {
    try {
      await updatePage(p.id, { active: !p.active });
      setPages((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)),
      );
    } catch (e) {
      console.error("update page failed", e);
      alert("อัปเดตสถานะเพจไม่สำเร็จ");
    }
  };

  const handleAddSpend = async () => {
    if (!newSpend.pageId || !newSpend.amount)
      return alert("กรุณาเลือกเพจและกรอกจำนวนเงิน");
    try {
      await createAdSpend({
        pageId: Number(newSpend.pageId),
        date: newSpend.date,
        amount: Number(newSpend.amount),
        notes: newSpend.notes || undefined,
      });
      setNewSpend({
        pageId: newSpend.pageId,
        date: newSpend.date,
        amount: "",
        notes: "",
      });
      // reload spend list
      const rows = await listAdSpend(
        typeof filterPageId === "number" ? filterPageId : undefined,
      );
      const mapped: AdSpend[] = Array.isArray(rows)
        ? rows.map((r: any) => ({
            id: Number(r.id),
            pageId: Number(r.page_id),
            spendDate: r.spend_date,
            amount: Number(r.amount),
            notes: r.notes ?? undefined,
          }))
        : [];
      setAdSpend(mapped);
    } catch (e) {
      console.error("create ad spend failed", e);
      alert("บันทึกค่าโฆษณาไม่สำเร็จ");
    }
  };

  // Load page users and marketing users for admin access
  const loadUserManagementData = async () => {
    if (!hasAdminAccess(currentUser)) return;

    setUserManagementLoading(true);
    try {
      // Load page users
      const users = await getPageUsers();
      setPageUsers(users);

      // Load pages with users
      const data = await getPagesWithUsers(currentUser.companyId);
      setPagesWithUsers(data);

      // Load marketing users
      const allUsers = await listUsers();
      const marketingRoleUsers = Array.isArray(allUsers)
        ? allUsers.filter(
            (u: any) =>
              u.role === UserRole.Marketing &&
              u.companyId === currentUser.companyId,
          )
        : [];
      setMarketingUsers(marketingRoleUsers);
    } catch (e) {
      console.error("Failed to load user management data:", e);
    } finally {
      setUserManagementLoading(false);
    }
  };

  useEffect(() => {
    if (hasAdminAccess(currentUser)) {
      loadUserManagementData();
    }
  }, [currentUser.companyId]);

  // Load marketing page users
  useEffect(() => {
    loadMarketingPageUsers();
  }, []);

  // Toggle page expand/collapse
  const togglePageExpand = (pageId: number) => {
    setExpandedPages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pageId)) {
        newSet.delete(pageId);
      } else {
        newSet.add(pageId);
      }
      return newSet;
    });
  };

  // Load marketing page users from marketing_user_page table
  const loadMarketingPageUsers = async () => {
    try {
      const res = await fetch("api/Marketing_DB/get_marketing_page_users.php");
      const data = await res.json();
      if (data.success) {
        setMarketingPageUsers(data.data);
      }
    } catch (e) {
      console.error("Failed to load marketing page users:", e);
    }
  };

  // Handle add user to page
  const handleAddUser = (pageId: number) => {
    setSelectedPageForUser(pageId);
  };

  // Handle remove user from page
  const handleRemoveUser = async (userId: number, pageId: number) => {
    if (!confirm("คุณต้องการลบผู้ใช้นี้จากเพจใช่หรือไม่?")) return;

    try {
      const res = await fetch("api/Marketing_DB/remove_user_from_page.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pageId }),
      });
      const data = await res.json();
      if (data.success) {
        loadMarketingPageUsers();
        alert("ลบผู้ใช้จากเพจสำเร็จ");
      } else {
        alert("ลบผู้ใช้จากเพจไม่สำเร็จ: " + data.error);
      }
    } catch (e) {
      console.error("Failed to remove user:", e);
      alert("ลบผู้ใช้จากเพจไม่สำเร็จ");
    }
  };

  // Handle submit user to page
  const handleSubmitUserToPage = async (userId: number) => {
    if (!selectedPageForUser) return;

    try {
      const res = await fetch("api/Marketing_DB/add_user_to_page.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: selectedPageForUser,
          userId: userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadMarketingPageUsers();
        setSelectedPageForUser(null);
        alert("เพิ่มผู้ใช้สำเร็จ");
      } else {
        alert("เพิ่มผู้ใช้ไม่สำเร็จ: " + data.error);
      }
    } catch (e) {
      console.error("Failed to add user:", e);
      alert("เพิ่มผู้ใช้ไม่สำเร็จ");
    }
  };

  // Connect page user to internal user
  const handleConnectUser = async (
    pageUserId: number,
    internalUserId: number,
  ) => {
    try {
      await updatePageUserConnection(pageUserId, internalUserId);
      await loadUserManagementData();
      alert("เชื่อมต่อผู้ใช้สำเร็จ");
    } catch (e: any) {
      console.error("Failed to connect user:", e);
      alert("เชื่อมต่อผู้ใช้ไม่สำเร็จ: " + (e.message || "Unknown error"));
    }
  };

  // Disconnect page user
  const handleDisconnectUser = async (pageUserId: number) => {
    try {
      await updatePageUserConnection(pageUserId, null);
      await loadUserManagementData();
      alert("ยกเลิกการเชื่อมต่อผู้ใช้สำเร็จ");
    } catch (e: any) {
      console.error("Failed to disconnect user:", e);
      alert(
        "ยกเลิกการเชื่อมต่อผู้ใช้ไม่สำเร็จ: " + (e.message || "Unknown error"),
      );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Marketing</h2>
        <p className="text-gray-600">
          จัดการเพจ ช่องทางการขาย โปรโมชัน และค่าโฆษณารายวัน
        </p>
      </div>
      {/* Admin Tabs */}
      {hasAdminAccess(currentUser) && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("ads")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "ads"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              บันทึก Ads
            </button>
            <button
              onClick={() => setActiveTab("userManagement")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "userManagement"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              จัดการผู้ใช้การตลาด-เพจ
            </button>
          </nav>
        </div>
      )}

      {/* Content based on active tab */}
      {(!hasAdminAccess(currentUser) || activeTab === "ads") && (
        <>
          {/* Pages management */}
          <section className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                เพจ (Facebook/TikTok)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className={labelClass}>ชื่อเพจ</label>
                <input
                  className={inputClass}
                  value={newPage.name}
                  onChange={(e) =>
                    setNewPage((v) => ({ ...v, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>แพลตฟอร์ม</label>
                <select
                  className={inputClass}
                  value={newPage.platform}
                  onChange={(e) =>
                    setNewPage((v) => ({ ...v, platform: e.target.value }))
                  }
                >
                  <option value="Facebook">Facebook</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Line">Line</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>URL (ถ้ามี)</label>
                <input
                  className={inputClass}
                  value={newPage.url || ""}
                  onChange={(e) =>
                    setNewPage((v) => ({ ...v, url: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddPage}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  เพิ่มเพจ
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">ชื่อ</th>
                    <th className="px-3 py-2 text-left">แพลตฟอร์ม</th>
                    <th className="px-3 py-2 text-left">URL</th>
                    <th className="px-3 py-2 text-left">ใช้งาน</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-3 py-2">{p.id}</td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2">{p.platform}</td>
                      <td className="px-3 py-2 truncate max-w-xs">
                        <a
                          className="text-blue-600 hover:underline"
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.url || "-"}
                        </a>
                      </td>
                      <td className="px-3 py-2">{p.active ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => togglePageActive(p)}
                          className="px-3 py-1 border rounded-md"
                        >
                          {p.active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pages.length === 0 && (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-gray-500"
                        colSpan={6}
                      >
                        ยังไม่มีเพจ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Ad spend management */}
          <section className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                ค่าโฆษณารายวัน
              </h3>
              <div className="text-sm text-gray-600">
                รวม: ฿{totalSpend.toFixed(2)}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <div>
                <label className={labelClass}>เลือกเพจ (กรอง/บันทึก)</label>
                <select
                  className={inputClass}
                  value={filterPageId}
                  onChange={(e) =>
                    setFilterPageId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                >
                  <option value="">ทุกเพจ</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>วันที่</label>
                <input
                  type="date"
                  className={inputClass}
                  value={newSpend.date}
                  onChange={(e) =>
                    setNewSpend((v) => ({ ...v, date: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  className={inputClass}
                  value={newSpend.amount}
                  onChange={(e) =>
                    setNewSpend((v) => ({ ...v, amount: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>หมายเหตุ</label>
                <input
                  className={inputClass}
                  value={newSpend.notes}
                  onChange={(e) =>
                    setNewSpend((v) => ({ ...v, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    if (typeof filterPageId === "number")
                      setNewSpend((v) => ({ ...v, pageId: filterPageId }));
                    handleAddSpend();
                  }}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  บันทึก
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">วันที่</th>
                    <th className="px-3 py-2 text-left">เพจ</th>
                    <th className="px-3 py-2 text-left">จำนวนเงิน</th>
                    <th className="px-3 py-2 text-left">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {adSpend.map((row) => {
                    const p = pages.find((x) => x.id === row.pageId);
                    return (
                      <tr key={row.id} className="border-b">
                        <td className="px-3 py-2">{row.spendDate}</td>
                        <td className="px-3 py-2">{p?.name || row.pageId}</td>
                        <td className="px-3 py-2">฿{row.amount.toFixed(2)}</td>
                        <td className="px-3 py-2">{row.notes || "-"}</td>
                      </tr>
                    );
                  })}
                  {adSpend.length === 0 && (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-gray-500"
                        colSpan={4}
                      >
                        ยังไม่มีรายการ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Promotions list (read-only) */}
          <section className="bg-white rounded-lg shadow p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              โปรโมชัน
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {promotions.map((pr) => (
                <div key={pr.id} className="border rounded p-3">
                  <div className="font-medium text-gray-800">{pr.name}</div>
                  <div className="text-gray-600 text-sm">
                    สถานะ: {pr.active ? "Active" : "Inactive"}
                  </div>
                  {pr.sku && (
                    <div className="text-gray-600 text-sm">SKU: {pr.sku}</div>
                  )}
                </div>
              ))}
              {promotions.length === 0 && (
                <div className="text-gray-500">ยังไม่มีโปรโมชัน</div>
              )}
            </div>
          </section>
        </>
      )}

      {/* User Management Tab - Admin Only */}
      {hasAdminAccess(currentUser) && activeTab === "userManagement" && (
        <>
          {/* Active Pages List */}
          <section className="bg-white rounded-lg shadow p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              รายการเพจที่ใช้งานอยู่ (Active Pages)
            </h3>
            {loading ? (
              <div className="text-center py-4">กำลังโหลด...</div>
            ) : pages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ไม่มีเพจที่ใช้งานอยู่
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">ชื่อเพจ</th>
                      <th className="px-3 py-2 text-left">แพลตฟอร์ม</th>
                      <th className="px-3 py-2 text-left">จำนวนผู้ใช้</th>
                      <th className="px-3 py-2 text-left">สถานะ</th>
                      <th className="px-3 py-2 text-left">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((page) => (
                      <React.Fragment key={page.id}>
                        <tr
                          className="border-b cursor-pointer hover:bg-gray-50"
                          onClick={() => togglePageExpand(page.id)}
                        >
                          <td className="px-3 py-2">{page.id}</td>
                          <td className="px-3 py-2 font-medium">{page.name}</td>
                          <td className="px-3 py-2">{page.platform}</td>
                          <td className="px-3 py-2">
                            {
                              marketingPageUsers.filter(
                                (user) => user.page_id === page.id,
                              ).length
                            }
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                page.active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {page.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddUser(page.id);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              +เพิ่มผู้ใช้
                            </button>
                          </td>
                        </tr>
                        {expandedPages.has(page.id) && (
                          <tr>
                            <td colSpan={6} className="px-3 py-4 bg-gray-50">
                              <div className="space-y-2">
                                <h4 className="font-medium text-gray-700">
                                  ผู้ใช้ที่เชื่อมต่อกับเพจนี้:
                                </h4>
                                {marketingPageUsers
                                  .filter((user) => user.page_id === page.id)
                                  .map((user) => (
                                    <div
                                      key={user.id}
                                      className="flex items-center justify-between bg-white p-3 rounded border"
                                    >
                                      <div>
                                        <span className="font-medium">
                                          {user.first_name} {user.last_name}
                                        </span>
                                        <span className="text-sm text-gray-600 ml-2">
                                          ({user.username})
                                        </span>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleRemoveUser(user.id, page.id)
                                        }
                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                      >
                                        ลบ
                                      </button>
                                    </div>
                                  ))}
                                {marketingPageUsers.filter(
                                  (user) => user.page_id === page.id,
                                ).length === 0 && (
                                  <div className="text-gray-500">
                                    ยังไม่มีผู้ใช้ที่เชื่อมต่อกับเพจนี้
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Add User Modal */}
      {selectedPageForUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">เพิ่มผู้ใช้ไปยังเพจ</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {marketingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSubmitUserToPage(user.id)}
                >
                  <div>
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-sm text-gray-600">{user.username}</div>
                  </div>
                  <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                    เลือก
                  </button>
                </div>
              ))}
              {marketingUsers.length === 0 && (
                <div className="text-gray-500">ไม่มีผู้ใช้ Marketing</div>
              )}
            </div>
            <button
              onClick={() => setSelectedPageForUser(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingPage;
