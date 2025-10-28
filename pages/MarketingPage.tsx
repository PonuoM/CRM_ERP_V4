import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Pencil } from "lucide-react";
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
} from "@/services/api";
import MarketingDatePicker, {
  DateRange,
} from "@/components/Dashboard/MarketingDatePicker";
import MultiSelectPageFilter from "@/components/Dashboard/MultiSelectPageFilter";
import MultiSelectUserFilter from "@/components/Dashboard/MultiSelectUserFilter";

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
  const [activeTab, setActiveTab] = useState<
    "ads" | "userManagement" | "adsInput" | "dashboard" | "adsHistory"
  >("dashboard");
  const [pages, setPages] = useState<Page[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [adSpend, setAdSpend] = useState<AdSpend[]>([]);
  const [loading, setLoading] = useState(true);

  // States for dashboard
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardView, setDashboardView] = useState<"user" | "page">("user");
  const [dateRange, setDateRange] = useState<DateRange>({
    start: "",
    end: "",
  });
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempStart, setTempStart] = useState(dateRange.start);
  const [tempEnd, setTempEnd] = useState(dateRange.end);
  const [datePickerRef, setDatePickerRef] = useState<HTMLDivElement | null>(
    null,
  );

  // Aggregated dashboard data by page
  const aggregatedByPage = useMemo(() => {
    if (!Array.isArray(dashboardData) || dashboardData.length === 0) return [];
    const map = new Map<number, any>();
    for (const row of dashboardData) {
      const pid = Number(row.page_id);
      const prev = map.get(pid);
      if (prev) {
        prev.ads_cost += Number(row.ads_cost || 0);
        prev.impressions += Number(row.impressions || 0);
        prev.reach += Number(row.reach || 0);
        prev.clicks += Number(row.clicks || 0);
      } else {
        map.set(pid, {
          page_id: pid,
          page_name: row.page_name,
          platform: row.platform,
          ads_cost: Number(row.ads_cost || 0),
          impressions: Number(row.impressions || 0),
          reach: Number(row.reach || 0),
          clicks: Number(row.clicks || 0),
        });
      }
    }
    return Array.from(map.values());
  }, [dashboardData]);

  // States for marketing user page management
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set());
  const [marketingPageUsers, setMarketingPageUsers] = useState<any[]>([]);
  const [marketingUsersList, setMarketingUsersList] = useState<any[]>([]);
  const [selectedPageForUser, setSelectedPageForUser] = useState<number | null>(
    null,
  );

  // States for ads input
  const [userPages, setUserPages] = useState<any[]>([]);
  const [adsInputData, setAdsInputData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Ads history list
  const [adsLogs, setAdsLogs] = useState<any[]>([]);
  const [adsLogsLoading, setAdsLogsLoading] = useState(false);
  const [adsLogsTotal, setAdsLogsTotal] = useState(0);
  // Server pagination info from API
  const [serverPagination, setServerPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    hasPrevious: false,
    hasMore: false,
  });
  // Pagination for Ads History
  const [adsHistoryPage, setAdsHistoryPage] = useState(1);
  const [adsHistoryPageSize, setAdsHistoryPageSize] = useState(10);
  const totalAdsHistoryPages = useMemo(
    () => Math.max(1, Math.ceil((adsLogsTotal || 0) / adsHistoryPageSize)),
    [adsLogsTotal, adsHistoryPageSize],
  );
  // No longer need client-side pagination since we're using server-side pagination
  // const paginatedAdsLogs = useMemo(() => {
  //   const start = (adsHistoryPage - 1) * adsHistoryPageSize;
  //   const end = start + adsHistoryPageSize;
  //   return (adsLogs || []).slice(start, end);
  // }, [adsLogs, adsHistoryPage, adsHistoryPageSize]);
  // Reset to first page when data or page size changes
  useEffect(() => {
    setAdsHistoryPage(1);
  }, [adsHistoryPageSize]);

  // Map each date to a background color for consistent grouping in tables
  const adsLogsDateBgMap = useMemo(() => {
    const palette = [
      "bg-emerald-50",
      "bg-blue-50",
      "bg-yellow-50",
      "bg-purple-50",
      "bg-pink-50",
      "bg-orange-50",
      "bg-sky-50",
      "bg-rose-50",
    ];
    const map = new Map<string, string>();
    let idx = 0;
    for (const log of adsLogs) {
      const d = log?.date || log?.log_date || "";
      if (!d) continue;
      if (!map.has(d)) {
        map.set(d, palette[idx % palette.length]);
        idx++;
      }
    }
    return map;
  }, [adsLogs]);

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

  // Load marketing page users and marketing users list
  useEffect(() => {
    loadMarketingPageUsers();
    loadMarketingUsers();
  }, []);

  // Set selectedUsers to all marketing users by default
  useEffect(() => {
    if (marketingUsersList.length > 0 && selectedUsers.length === 0) {
      const allUserIds = marketingUsersList.map((user) => user.id);
      setSelectedUsers(allUserIds);
    }
  }, [marketingUsersList]);

  // Load user pages from marketing_user_page table
  useEffect(() => {
    loadUserPages();
  }, [currentUser.id]);

  useEffect(() => {
    setTempStart(dateRange.start);
    setTempEnd(dateRange.end);
  }, [dateRange]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        datePickerOpen &&
        datePickerRef &&
        !datePickerRef.contains(e.target as Node)
      ) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [datePickerOpen, datePickerRef]);

  // Load existing ads data only when on Ads Input tab
  useEffect(() => {
    if (activeTab === "adsInput" && selectedDate && userPages.length > 0) {
      loadExistingAdsData();
    }
  }, [activeTab, selectedDate, userPages]);

  // Initial data loading for Ads Input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "adsInput" && selectedDate && userPages.length > 0) {
        loadExistingAdsData();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [activeTab, selectedDate]);

  // Load ads history when switching to adsHistory tab or when pagination changes
  useEffect(() => {
    const loadHistory = async () => {
      if (activeTab !== "adsHistory") return;
      setAdsLogsLoading(true);
      try {
        const offset = (adsHistoryPage - 1) * adsHistoryPageSize;
        const result = await loadAdsLogs(
          undefined,
          undefined,
          undefined,
          currentUser.id,
          adsHistoryPageSize,
          offset,
        );

        // No need to sort on client side since server already sorts by date DESC
        setAdsLogs(result.data || []);
        setAdsLogsTotal(result.total || 0);

        // Update server pagination info
        setServerPagination({
          currentPage: result.currentPage || 1,
          totalPages: result.totalPages || 1,
          hasPrevious: result.hasPrevious || false,
          hasMore: result.hasMore || false,
        });
      } catch (e) {
        console.error("Failed to load ads history:", e);
        setAdsLogs([]);
        setAdsLogsTotal(0);
      } finally {
        setAdsLogsLoading(false);
      }
    };
    loadHistory();
  }, [activeTab, adsHistoryPage, adsHistoryPageSize]);

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

  // Load all marketing users for selection in modal
  const loadMarketingUsers = async () => {
    try {
      const allUsers = await listUsers();
      const marketingRoleUsers = Array.isArray(allUsers)
        ? allUsers.filter(
            (u: any) =>
              u.role === "Marketing" &&
              (u.company_id === currentUser.companyId ||
                u.companyId === currentUser.companyId),
          )
        : [];
      setMarketingUsersList(marketingRoleUsers);
    } catch (e) {
      console.error("Failed to load marketing users:", e);
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

  // Load user pages from marketing_user_page table
  const loadUserPages = async () => {
    try {
      const res = await fetch("api/Marketing_DB/get_user_pages.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setUserPages(data.data);
      }
    } catch (e) {
      console.error("Failed to load user pages:", e);
    }
  };

  // Handle ads input change
  const handleAdsInputChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    const newData = [...adsInputData];
    if (!newData[index]) {
      newData[index] = {};
    }
    newData[index][field] = value;
    setAdsInputData(newData);
  };

  // Handle save all ads data - ใช้ ads_log_insert.php และ ads_log_update.php
  const handleSaveAllAdsData = async () => {
    if (adsInputData.length === 0) {
      alert("ไม่มีข้อมูลที่ต้องการบันทึก");
      return;
    }

    // แสดงข้อความยืนยัน
    const confirmed = confirm(
      `คุณต้องการบันทึกข้อมูลค่า Ads จำนวน ${adsInputData.length} รายการ ในวันที่ ${selectedDate} ใช่หรือไม่?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      // โหลดข้อมูลที่มีอยู่แล้วสำหรับตรวจสอบ (เฉพาะของผู้ใช้ปัจจุบัน)
      const existingLogsResult = await loadAdsLogs(
        undefined,
        selectedDate,
        selectedDate, // single date
        currentUser.id, // current user ID
      );
      const existingLogs = existingLogsResult.data || [];

      // สร้าง Map ของ existing logs โดยใช้ page_id เป็น key
      const existingLogsMap = new Map();
      existingLogs.forEach((log) => {
        // ตรวจสอบว่า log เป็นของผู้ใช้ปัจจุบันก่อนเพิ่มลง map
        if (log.user_id === currentUser.id) {
          existingLogsMap.set(log.page_id, log);
        }
      });

      const savePromises = adsInputData.map(async (row) => {
        // ตรวจสอบว่ามีข้อมูลที่จำเป็นหรือไม่
        if (!row.adsCost && !row.impressions && !row.reach && !row.clicks) {
          return { success: true, message: "Skipped empty record" }; // ข้ามรายการที่ไม่มีข้อมูล
        }

        const pageId = Number(row.pageId);
        const existingLog = existingLogsMap.get(pageId);

        const payload = {
          page_id: pageId,
          user_id: currentUser.id,
          date: selectedDate,
          ads_cost: row.adsCost ? parseFloat(row.adsCost) : null,
          impressions: row.impressions ? parseInt(row.impressions) : null,
          reach: row.reach ? parseInt(row.reach) : null,
          clicks: row.clicks ? parseInt(row.clicks) : null,
        };

        let res;
        if (existingLog) {
          // ถ้ามีข้อมูลอยู่แล้ว ให้อัปเดต
          res = await fetch("api/Marketing_DB/ads_log_update.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existingLog.id,
              user_id: currentUser.id, // เพิ่ม user_id สำหรับตรวจสอบสิทธิ์
              ...payload,
            }),
          });
        } else {
          // ถ้าไม่มีข้อมูล ให้สร้างใหม่
          res = await fetch("api/Marketing_DB/ads_log_insert.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
        return await res.json();
      });

      // รอให้ทุก request เสร็จสิ้น
      const results = await Promise.all(savePromises);

      // ตรวจสอบผลลัพธ์
      const successCount = results.filter(
        (r) => r && r.success === true,
      ).length;
      const skippedCount = results.filter(
        (r) => r && r.message === "Skipped empty record",
      ).length;
      const errorCount = results.length - successCount - skippedCount;

      if (successCount > 0) {
        let message = `บันทึกข้อมูลสำเร็จ ${successCount} รายการ`;
        if (skippedCount > 0) {
          message += ` ข้าม ${skippedCount} รายการที่ไม่มีข้อมูล`;
        }
        if (errorCount > 0) {
          message += ` และผิดพลาด ${errorCount} รายการ`;
        }
        alert(message);
        // โหลดข้อมูลใหม่หลังบันทึกเสร็จ
        loadExistingAdsData();
      } else if (skippedCount > 0) {
        alert(`ข้าม ${skippedCount} รายการที่ไม่มีข้อมูล`);
      } else {
        alert("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
    } catch (e) {
      console.error("Failed to save ads data:", e);
      alert("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSaving(false);
    }
  };

  // Load ads log data for display with pagination
  const loadAdsLogs = async (
    pageId?: number,
    dateFrom?: string,
    dateTo?: string,
    userId?: number,
    limit?: number,
    offset?: number,
  ) => {
    try {
      const params = new URLSearchParams();
      if (pageId) params.set("page_id", String(pageId));
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      // เพิ่มเงื่อนไข user_id ให้แสดงเฉพาะข้อมูลของผู้ใช้ที่ระบุ
      if (userId) {
        params.set("user_id", String(userId));
      } else {
        params.set("user_id", String(currentUser.id));
      }
      if (limit) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));

      const res = await fetch(
        `api/Marketing_DB/ads_log_get.php${params.toString() ? `?${params}` : ""}`,
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json();
      if (data.success) {
        return {
          data: data.data,
          total: data.pagination?.total || 0,
          currentPage: data.pagination?.current_page || 1,
          totalPages: data.pagination?.total_pages || 1,
          hasPrevious: data.pagination?.has_previous || false,
          hasMore: data.pagination?.has_more || false,
        };
      }
      return {
        data: [],
        total: 0,
        currentPage: 1,
        totalPages: 1,
        hasPrevious: false,
        hasMore: false,
      };
    } catch (e) {
      console.error("Failed to load ads logs:", e);
      return {
        data: [],
        total: 0,
        currentPage: 1,
        totalPages: 1,
        hasPrevious: false,
        hasMore: false,
      };
    }
  };

  // Update existing ads log
  const updateAdsLog = async (id: number, updates: any) => {
    try {
      const res = await fetch("api/Marketing_DB/ads_log_update.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_id: currentUser.id, // เพิ่ม user_id สำหรับตรวจสอบสิทธิ์
          ...updates,
        }),
      });
      return await res.json();
    } catch (e) {
      console.error("Failed to update ads log:", e);
      return { success: false, error: "Failed to update" };
    }
  };

  // Delete ads log
  const deleteAdsLog = async (id: number) => {
    if (!confirm("คุณต้องการลบข้อมูลนี้ใช่หรือไม่?")) return false;

    try {
      const res = await fetch("api/Marketing_DB/ads_log_delete.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          user_id: currentUser.id, // เพิ่ม user_id สำหรับตรวจสอบสิทธิ์
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("ลบข้อมูลสำเร็จ");
        return true;
      } else {
        alert("ลบข้อมูลไม่สำเร็จ: " + data.error);
        return false;
      }
    } catch (e) {
      console.error("Failed to delete ads log:", e);
      alert("ลบข้อมูลไม่สำเร็จ");
      return false;
    }
  };

  // Load existing ads data for the selected date (current user only)
  const loadExistingAdsData = async () => {
    if (!selectedDate) return;

    setIsLoadingData(true);
    try {
      const logs = await loadAdsLogs(
        undefined, // all pages
        selectedDate,
        selectedDate, // single date
        currentUser.id, // current user ID
      );

      // Convert logs to input data format
      const existingData = logs.data.reduce((acc: any[], log) => {
        acc.push({
          pageId: log.page_id.toString(),
          adsCost: log.ads_cost ? log.ads_cost.toString() : "",
          impressions: log.impressions ? log.impressions.toString() : "",
          reach: log.reach ? log.reach.toString() : "",
          clicks: log.clicks ? log.clicks.toString() : "",
        });
        return acc;
      }, []);

      setAdsInputData(existingData);

      // แสดงข้อความแจ้งเตือน
      if (existingData.length > 0) {
        const filledCount = existingData.filter(
          (d) => d.adsCost || d.impressions || d.reach || d.clicks,
        ).length;
        console.log(
          `โหลดข้อมูลสำเร็จ ${filledCount} รายการจาก ${existingData.length} เพจ`,
        );
      }
    } catch (e) {
      console.error("Failed to load existing ads data:", e);
      alert("โหลดข้อมูลผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Get input value for specific page and field (always returns string)
  const getInputValue = (pageId: number, field: string) => {
    const row = adsInputData.find((r) => r.pageId === pageId.toString());
    return row?.[field] || "";
  };

  // Handle ads input change for user pages
  const handleUserPageInputChange = (
    pageId: number,
    field: string,
    value: string,
  ) => {
    setAdsInputData((prev) => {
      const newData = [...prev];
      const existingIndex = newData.findIndex(
        (row) => row.pageId === pageId.toString(),
      );

      if (existingIndex >= 0) {
        newData[existingIndex] = { ...newData[existingIndex], [field]: value };
      } else {
        newData.push({ pageId: pageId.toString(), [field]: value });
      }

      return newData;
    });
  };

  // Connect page user to internal user

  // Function to load dashboard data
  const loadDashboardData = async () => {
    setDashboardLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set("date_from", dateRange.start);
      if (dateRange.end) params.set("date_to", dateRange.end);
      if (selectedPages.length > 0) {
        params.set("page_ids", selectedPages.join(","));
      }
      if (selectedUsers.length > 0) {
        params.set("user_ids", selectedUsers.join(","));
      }

      const res = await fetch(
        `api/Marketing_DB/dashboard_data.php${params.toString() ? `?${params}` : ""}`,
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data);
      } else {
        setDashboardData([]);
        console.error("Failed to load dashboard data:", data.error);
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
      setDashboardData([]);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Set default dates to current week
  useEffect(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    setDateRange({
      start: startOfWeek.toISOString().slice(0, 10),
      end: endOfWeek.toISOString().slice(0, 10),
    });

    // Set default to select all pages
    if (pages.length > 0) {
      setSelectedPages(pages.map((p) => p.id));
    }
  }, [pages]);

  // Dashboard data loads only when clicking the search button.

  // Trigger initial load for dashboard when filters are ready
  useEffect(() => {
    const ready =
      activeTab === "dashboard" &&
      !!dateRange.start &&
      !!dateRange.end &&
      selectedPages.length > 0 &&
      selectedUsers.length > 0;
    if (ready) {
      loadDashboardData();
    }
  }, [activeTab, dateRange.start, dateRange.end, selectedPages, selectedUsers]);

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
              onClick={() => setActiveTab("dashboard")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "dashboard"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              แดชบอร์ด
            </button>
            <button
              onClick={() => setActiveTab("ads")}
              className={`hidden py-2 px-1 border-b-2 font-medium text-sm ${
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
            <button
              onClick={() => setActiveTab("adsInput")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "adsInput"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              กรอกค่า Ads
            </button>
            <button
              onClick={() => setActiveTab("adsHistory")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "adsHistory"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              ประวัติการกรอก Ads
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
                                          handleRemoveUser(
                                            user.user_id,
                                            page.id,
                                          )
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

      {/* Ads Input Tab */}
      {hasAdminAccess(currentUser) && activeTab === "adsInput" && (
        <>
          <section className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                กรอกค่า Ads
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <button
                  onClick={() => loadExistingAdsData()}
                  disabled={isLoadingData}
                  className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title="โหลดข้อมูลที่มีอยู่แล้ว"
                >
                  {isLoadingData ? "กำลังโหลด..." : "โหลดข้อมูล"}
                </button>
                <button
                  onClick={handleSaveAllAdsData}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
                </button>
              </div>
            </div>
            {isLoadingData ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="mt-2 text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">เพจ</th>
                      <th className="px-3 py-2 text-left">แพลตฟอร์ม</th>
                      <th className="px-3 py-2 text-left">ค่า Ads</th>
                      <th className="px-3 py-2 text-left">อิมเพรสชั่น</th>
                      <th className="px-3 py-2 text-left">การเข้าถึง</th>
                      <th className="px-3 py-2 text-left">ทัก/คลิก</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Display all user pages */}
                    {userPages.length > 0 &&
                      userPages.map((page, index) => (
                        <tr key={page.id} className="border-b">
                          <td className="px-3 py-2 font-medium">{page.name}</td>
                          <td className="px-3 py-2">{page.platform}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full p-2 border border-gray-300 rounded"
                              placeholder="0"
                              value={getInputValue(page.id, "adsCost")}
                              onChange={(e) =>
                                handleUserPageInputChange(
                                  page.id,
                                  "adsCost",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full p-2 border border-gray-300 rounded"
                              placeholder="0"
                              value={getInputValue(page.id, "impressions")}
                              onChange={(e) =>
                                handleUserPageInputChange(
                                  page.id,
                                  "impressions",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full p-2 border border-gray-300 rounded"
                              placeholder="0"
                              value={getInputValue(page.id, "reach")}
                              onChange={(e) =>
                                handleUserPageInputChange(
                                  page.id,
                                  "reach",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full p-2 border border-gray-300 rounded"
                              placeholder="0"
                              value={getInputValue(page.id, "clicks")}
                              onChange={(e) =>
                                handleUserPageInputChange(
                                  page.id,
                                  "clicks",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    {userPages.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center py-8 text-gray-500"
                        >
                          ไม่มีเพจที่คุณมีสิทธิ์จัดการ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Dashboard Tab */}
      {hasAdminAccess(currentUser) && activeTab === "dashboard" && (
        <section className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                แดชบอร์ดข้อมูล Ads
              </h3>
            </div>
          </div>

          {/* Marketing Date Range Picker and Page Filter */}
          <div className="mb-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className={labelClass}>เลือกช่วงวันที่</label>
                <button
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                  className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                >
                  <span
                    className={
                      dateRange.start && dateRange.end
                        ? "text-gray-900"
                        : "text-gray-500"
                    }
                  >
                    {dateRange.start && dateRange.end
                      ? `${new Date(dateRange.start + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} - ${new Date(dateRange.end + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`
                      : "เลือกช่วงวันที่"}
                  </span>
                  <Calendar className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="flex-1">
                <label className={labelClass}>เลือกเพจ</label>
                <MultiSelectPageFilter
                  pages={pages.map((page) => ({
                    id: page.id,
                    name: page.name,
                    platform: page.platform,
                  }))}
                  selectedPages={selectedPages}
                  onChange={setSelectedPages}
                />
              </div>

              <div className="flex-1">
                <label className={labelClass}>เลือกผู้ใช้</label>
                <MultiSelectUserFilter
                  users={marketingUsersList.map((user) => ({
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    username: user.username,
                  }))}
                  selectedUsers={selectedUsers}
                  onChange={setSelectedUsers}
                />
              </div>

              <div className="">
                <button
                  onClick={() => loadDashboardData()}
                  disabled={dashboardLoading}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md shadow-sm h-[42px]"
                >
                  {dashboardLoading ? "กำลังโหลด..." : "ค้นหา"}
                </button>
              </div>
            </div>

            {/* Date Picker Dropdown */}
            {datePickerOpen && (
              <div
                className="absolute z-50 w-80 mt-2 bg-white rounded-lg shadow-xl border border-gray-200"
                ref={datePickerRef}
              >
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        วันที่เริ่มต้น
                      </label>
                      <input
                        type="date"
                        value={tempStart}
                        onChange={(e) => setTempStart(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        วันที่สิ้นสุด
                      </label>
                      <input
                        type="date"
                        value={tempEnd}
                        onChange={(e) => setTempEnd(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      เลือกช่วงเวลาด่วน:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const now = new Date();
                          const dayOfWeek = now.getDay();
                          const startDate = new Date(now);
                          startDate.setDate(now.getDate() - dayOfWeek);
                          const endDate = new Date(startDate);
                          endDate.setDate(startDate.getDate() + 6);
                          const newRange = {
                            start: startDate.toISOString().slice(0, 10),
                            end: endDate.toISOString().slice(0, 10),
                          };
                          setTempStart(newRange.start);
                          setTempEnd(newRange.end);
                        }}
                        className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                      >
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        อาทิตย์นี้
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const startDate = new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            1,
                          );
                          const endDate = new Date(
                            now.getFullYear(),
                            now.getMonth() + 1,
                            0,
                          );
                          const newRange = {
                            start: startDate.toISOString().slice(0, 10),
                            end: endDate.toISOString().slice(0, 10),
                          };
                          setTempStart(newRange.start);
                          setTempEnd(newRange.end);
                        }}
                        className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                      >
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        เดือนนี้
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const startDate = new Date(now);
                          startDate.setDate(now.getDate() - 6);
                          const endDate = new Date(now);
                          const newRange = {
                            start: startDate.toISOString().slice(0, 10),
                            end: endDate.toISOString().slice(0, 10),
                          };
                          setTempStart(newRange.start);
                          setTempEnd(newRange.end);
                        }}
                        className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                      >
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                        7 วันล่าสุด
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const startDate = new Date(now);
                          startDate.setDate(now.getDate() - 29);
                          const endDate = new Date(now);
                          const newRange = {
                            start: startDate.toISOString().slice(0, 10),
                            end: endDate.toISOString().slice(0, 10),
                          };
                          setTempStart(newRange.start);
                          setTempEnd(newRange.end);
                        }}
                        className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                      >
                        <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                        30 วันล่าสุด
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        if (tempStart && tempEnd) {
                          setDateRange({ start: tempStart, end: tempEnd });
                          setDatePickerOpen(false);
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                    >
                      ตกลง
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-end mb-3">
            <div className="inline-flex rounded-md shadow-sm border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setDashboardView("user")}
                className={`px-3 py-1.5 text-sm ${
                  dashboardView === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                รายบุคคล
              </button>
              <button
                type="button"
                onClick={() => setDashboardView("page")}
                className={`px-3 py-1.5 text-sm border-l border-gray-300 ${
                  dashboardView === "page"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                รายเพจ
              </button>
            </div>
          </div>

          {/* Dashboard Table */}
          {dashboardLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">วันที่</th>
                    <th className="px-3 py-2 text-left">เพจ</th>
                    <th className="px-3 py-2 text-left">ผู้ใช้</th>
                    <th className="px-3 py-2 text-left">ค่า Ads</th>
                    <th className="px-3 py-2 text-left">อิมเพรสชั่น</th>
                    <th className="px-3 py-2 text-left">การเข้าถึง</th>
                    <th className="px-3 py-2 text-left">ทัก/คลิก</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboardView === "user" ? dashboardData : aggregatedByPage)
                    .length > 0 ? (
                    (dashboardView === "user"
                      ? dashboardData
                      : aggregatedByPage
                    ).map((row, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">
                          {dashboardView === "user"
                            ? row.log_date
                            : `${dateRange.start || ""}${dateRange.start && dateRange.end ? " - " : ""}${dateRange.end || ""}`}
                        </td>
                        <td className="px-3 py-2">{row.page_name}</td>
                        <td className="px-3 py-2">
                          {dashboardView === "user"
                            ? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()
                            : "ทุกคน"}
                        </td>
                        <td className="px-3 py-2">
                          ฿{Number(row.ads_cost || 0).toFixed(0)}
                        </td>
                        <td className="px-3 py-2">{row.impressions || 0}</td>
                        <td className="px-3 py-2">{row.reach || 0}</td>
                        <td className="px-3 py-2">{row.clicks || 0}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-gray-500"
                      >
                        ไม่มีข้อมูลในช่วงวันที่ที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Ads History Tab */}
      {hasAdminAccess(currentUser) && activeTab === "adsHistory" && (
        <section className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              ประวัติการกรอก Ads
            </h3>
            <div className="text-sm text-gray-600">
              ผู้ใช้:{" "}
              {currentUser.firstName && currentUser.lastName
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : currentUser.username}
            </div>
          </div>
          {adsLogsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              <p className="mt-2 text-gray-600">กำลังโหลดประวัติ...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">วันที่</th>
                    <th className="px-3 py-2 text-left">เพจ</th>
                    <th className="px-3 py-2 text-left">ค่า Ads</th>
                    <th className="px-3 py-2 text-left">Impressions</th>
                    <th className="px-3 py-2 text-left">Reach</th>
                    <th className="px-3 py-2 text-left">Clicks</th>
                    <th className="px-3 py-2 text-left">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {adsLogs.length > 0 ? (
                    adsLogs.map((log: any) => {
                      const d = log.date || log.log_date || "";
                      const bg = d ? adsLogsDateBgMap.get(d) || "" : "";
                      return (
                        <tr
                          key={log.id}
                          className={`border-b ${bg} hover:bg-gray-50`}
                        >
                          <td className="px-3 py-2">{d}</td>
                          <td className="px-3 py-2">
                            {log.page_name ||
                              pages.find((p) => p.id === Number(log.page_id))
                                ?.name ||
                              log.page_id}
                          </td>
                          <td className="px-3 py-2">
                            ฿{Number(log.ads_cost || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">{log.impressions ?? 0}</td>
                          <td className="px-3 py-2">{log.reach ?? 0}</td>
                          <td className="px-3 py-2">{log.clicks ?? 0}</td>
                          <td className="px-3 py-2">
                            <button
                              className="inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-100"
                              title="แก้ไขรายการนี้"
                              onClick={() => {
                                const editDate = log.date || log.log_date || "";
                                if (editDate) setSelectedDate(editDate);
                                setActiveTab("adsInput");
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-gray-500"
                        colSpan={7}
                      >
                        ไม่พบบันทึกประวัติการกรอก Ads ของคุณ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {adsLogs.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                  <div className="text-sm text-gray-600">
                    {(() => {
                      const start =
                        (adsHistoryPage - 1) * adsHistoryPageSize + 1;
                      const end = Math.min(
                        start + adsHistoryPageSize - 1,
                        adsLogsTotal,
                      );
                      return adsLogsTotal > 0
                        ? `แสดง ${start}-${end} จาก ${adsLogsTotal} รายการ (ทั้งหมด ${serverPagination.totalPages} หน้า)`
                        : "ไม่มีข้อมูล";
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">แถวต่อหน้า</label>
                    <select
                      className="border rounded px-2 py-1 text-sm bg-white"
                      value={adsHistoryPageSize}
                      onChange={(e) =>
                        setAdsHistoryPageSize(Number(e.target.value))
                      }
                    >
                      {[10, 20, 50, 100].map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}
                        </option>
                      ))}
                    </select>
                    <button
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                      onClick={() =>
                        setAdsHistoryPage((p) => Math.max(1, p - 1))
                      }
                      disabled={
                        !serverPagination.hasPrevious || adsHistoryPage === 1
                      }
                    >
                      ก่อนหน้า
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-700">หน้า</span>
                      <input
                        type="number"
                        min="1"
                        max={serverPagination.totalPages}
                        value={adsHistoryPage}
                        onChange={(e) => {
                          const page = Math.max(
                            1,
                            Math.min(
                              serverPagination.totalPages,
                              Number(e.target.value) || 1,
                            ),
                          );
                          setAdsHistoryPage(page);
                        }}
                        className="w-16 px-2 py-1 border rounded text-sm text-center"
                      />
                      <span className="text-sm text-gray-700">
                        / {serverPagination.totalPages}
                      </span>
                    </div>
                    <button
                      className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                      onClick={() =>
                        setAdsHistoryPage((p) =>
                          Math.min(serverPagination.totalPages, p + 1),
                        )
                      }
                      disabled={
                        !serverPagination.hasMore ||
                        adsHistoryPage === serverPagination.totalPages
                      }
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Add User Modal */}
      {selectedPageForUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">เพิ่มผู้ใช้ไปยังเพจ</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {marketingUsersList.map((user) => (
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
              {marketingUsersList.length === 0 && (
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
