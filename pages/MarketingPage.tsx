import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  Download,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  ChevronDown,
} from "lucide-react";
import { Page, Promotion, AdSpend, User, UserRole } from "@/types";
import {
  listPages,
  listPlatforms,
  createPage,
  updatePage,
  listPromotions,
  listAdSpend,
  createAdSpend,
  listUsers,
  updateUser,
  apiFetch,
} from "@/services/api";
import MarketingDatePicker, {
  DateRange,
} from "@/components/Dashboard/MarketingDatePicker";
import MultiSelectPageFilter from "@/components/Dashboard/MultiSelectPageFilter";
import MultiSelectProductFilter from "@/components/Dashboard/MultiSelectProductFilter";
import MultiSelectUserFilter from "@/components/Dashboard/MultiSelectUserFilter";
import resolveApiBasePath from "@/utils/apiBasePath";

const API_BASE = resolveApiBasePath();

// Function to fetch active pages where still_in_list = 1
async function listActivePages(companyId?: number) {
  const qs = new URLSearchParams();
  if (companyId) qs.set("company_id", String(companyId));
  const res = await fetch(
    `${API_BASE}/Marketing_DB/get_active_pages.php${companyId ? `?${qs}` : ""}`,
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
  view?: "dashboard" | "adsInput" | "adsHistory" | "userManagement";
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

// Helper function to check if page is inactive
const isPageInactive = (page?: {
  active?: boolean | number | string | null;
}) => {
  // A page is inactive if active is falsy (false, 0, "0", null, undefined)
  return !page?.active;
};

const getPageTypeBadgeClasses = (rawType?: string | null): { label: string; className: string } => {
  if (!rawType) {
    return {
      label: "-",
      className: "bg-gray-100 text-gray-600 border border-gray-200",
    };
  }
  const t = String(rawType).toLowerCase().trim();
  switch (t) {
    case "pancake":
      return {
        label: "Pancake",
        className: "bg-blue-100 text-blue-700 border border-blue-200",
      };
    case "manual":
      return {
        label: "Manual",
        className: "bg-gray-100 text-gray-700 border border-gray-200",
      };
    case "business":
      return {
        label: "Business",
        className: "bg-purple-100 text-purple-700 border border-purple-200",
      };
    case "personal":
      return {
        label: "Personal",
        className: "bg-green-100 text-green-700 border border-green-200",
      };
    case "fan":
      return {
        label: "Fan",
        className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
      };
    case "shop":
      return {
        label: "Shop",
        className: "bg-orange-100 text-orange-700 border border-orange-200",
      };
    default:
      return {
        label: rawType,
        className: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
};

const MarketingPage: React.FC<MarketingPageProps> = ({ currentUser, view }) => {
  const [activeTab, setActiveTab] = useState<
    "ads" | "userManagement" | "adsInput" | "dashboard" | "adsHistory"
  >(view || "dashboard");

  useEffect(() => {
    if (view) {
      setActiveTab(view);
    }
  }, [view]);

  const [pages, setPages] = useState<Page[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [adSpend, setAdSpend] = useState<AdSpend[]>([]);
  // Pages user has access to for filters
  const [userAccessiblePages, setUserAccessiblePages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  // States for dashboard
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Product Ads Tracking States
  const [adsInputMode, setAdsInputMode] = useState<"page" | "product">("page");
  const [products, setProducts] = useState<any[]>([]);
  const [productAdsInputData, setProductAdsInputData] = useState<any[]>([]);
  const [selectedProductPageId, setSelectedProductPageId] = useState<number | "">("");
  const [productDashboardData, setProductDashboardData] = useState<any[]>([]);

  const [dateRange, setDateRange] = useState<DateRange>({
    start: "",
    end: "",
  });
  // Filters
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showInactivePages, setShowInactivePages] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempStart, setTempStart] = useState(dateRange.start);
  const [tempEnd, setTempEnd] = useState(dateRange.end);
  const [datePickerRef, setDatePickerRef] = useState<HTMLDivElement | null>(
    null,
  );

  // Export modal states
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    start: "",
    end: "",
  });
  const [exportSelectedPages, setExportSelectedPages] = useState<number[]>([]);
  const [exportTempStart, setExportTempStart] = useState("");
  const [exportTempEnd, setExportTempEnd] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportDatePickerOpen, setExportDatePickerOpen] = useState(false);
  const exportDatePickerRef = useRef<HTMLDivElement>(null);

  // Aggregated dashboard data by page and date
  const aggregatedByPage = useMemo(() => {
    if (!Array.isArray(dashboardData) || dashboardData.length === 0) return [];
    const map = new Map<string, any>();
    for (const row of dashboardData) {
      const pid = Number(row.page_id);
      const date = row.log_date || "";
      const key = `${pid}_${date}`;
      const prev = map.get(key);
      if (prev) {
        prev.ads_cost += Number(row.ads_cost || 0);
        prev.impressions += Number(row.impressions || 0);
        prev.reach += Number(row.reach || 0);
        prev.clicks += Number(row.clicks || 0);
      } else {
        const pancakeStats = row.pancake_stats ? { ...row.pancake_stats } : {};
        map.set(key, {
          page_id: pid,
          log_date: date,
          page_name: row.page_name,
          platform: row.platform,
          external_page_id: row.external_page_id,
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
  const [editingLog, setEditingLog] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
  // Filters for Ads History - default to show all data
  const [adsHistoryDateRange, setAdsHistoryDateRange] = useState({
    start: "",
    end: "",
  });
  const [adsHistorySelectedPages, setAdsHistorySelectedPages] = useState<
    number[]
  >([]);
  const [showInactivePagesAdsHistory, setShowInactivePagesAdsHistory] =
    useState(false);
  const [adsHistorySelectedUsers, setAdsHistorySelectedUsers] = useState<number[]>([]);
  const [adsHistoryDatePickerOpen, setAdsHistoryDatePickerOpen] =
    useState(false);
  const [adsHistoryTempStart, setAdsHistoryTempStart] = useState(
    adsHistoryDateRange.start,
  );
  const [adsHistoryTempEnd, setAdsHistoryTempEnd] = useState(
    adsHistoryDateRange.end,
  );
  const adsHistoryDatePickerRef = useRef<HTMLDivElement>(null);
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
  // Reset to first page when data, page size, or filters change
  useEffect(() => {
    setAdsHistoryPage(1);
  }, [adsHistoryPageSize, adsHistoryDateRange, adsHistorySelectedPages]);

  // Handle clicks outside date picker for Ads History
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        adsHistoryDatePickerRef.current &&
        !adsHistoryDatePickerRef.current.contains(event.target as Node)
      ) {
        setAdsHistoryDatePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle clicks outside export date dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportDatePickerRef.current &&
        !exportDatePickerRef.current.contains(event.target as Node)
      ) {
        setExportDatePickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper function to map background colors to hover equivalents
  const getHoverColor = (bgColor: string): string => {
    const hoverMap: { [key: string]: string } = {
      "bg-emerald-50": "hover:bg-emerald-100",
      "bg-blue-50": "hover:bg-blue-100",
      "bg-yellow-50": "hover:bg-yellow-100",
      "bg-purple-50": "hover:bg-purple-100",
      "bg-pink-50": "hover:bg-pink-100",
      "bg-orange-50": "hover:bg-orange-100",
      "bg-sky-50": "hover:bg-sky-100",
      "bg-rose-50": "hover:bg-rose-100",
      "": "hover:bg-gray-50", // fallback for rows with no background
    };
    return hoverMap[bgColor] || "hover:bg-gray-50";
  };

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

  // Load pages with user access info
  const loadPagesWithUserAccess = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/Marketing_DB/get_pages_with_user_access.php`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id }),
        },
      );

      const data = await res.json();
      if (data.success) {
        return Array.isArray(data.data.accessible_pages)
          ? data.data.accessible_pages.map((p: any) => ({
            id: p.id,
            name: p.name,
            platform: p.platform,
            url: p.url ?? undefined,
            active: Boolean(p.active),
          }))
          : [];
      }
      return [];
    } catch (e) {
      console.error("Failed to load pages with user access:", e);
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [pg, plats, promo, userPages] = await Promise.all([
          listActivePages(currentUser.companyId),
          listPlatforms(currentUser.companyId, true, currentUser.role),
          listPromotions(),
          loadPagesWithUserAccess(),
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
              page_type: r.page_type ?? r.pageType ?? undefined,
            }))
            : [],
        );
        setPlatforms(
          Array.isArray(plats)
            ? plats.map((p: any) => ({
              id: p.id,
              name: p.name,
              displayName: p.display_name,
              description: p.description,
              active: p.active,
              sortOrder: p.sort_order,
            }))
            : [],
        );
        setPromotions(Array.isArray(promo) ? promo : []);
        setUserAccessiblePages(userPages);
        // Set default filters for ads history to show all data (active pages only)
        // Set default filters for ads history to show all data (active pages only)
        setAdsHistoryDateRange({ start: "", end: "" });

        // Setup pages list for logic usage
        const allPages = Array.isArray(pg?.data)
          ? pg.data.map((r: any) => ({
            id: r.id,
            name: r.name,
            active: Boolean(r.active),
          }))
          : [];

        if (currentUser.role === "Super Admin" || currentUser.role === "Admin Control") {
          setAdsHistorySelectedPages(
            allPages
              .filter((page: any) => page.active !== false)
              .map((page: any) => page.id)
          );
        } else {
          setAdsHistorySelectedPages(
            userPages
              .filter((page: Page) => page.active !== false)
              .map((page: Page) => page.id),
          );
        }
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


  // Product Ads State


  // Calculate totals for ads input
  const totalSpend = useMemo(() => {
    return adSpend.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [adSpend]);

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
    loadMarketingUserProducts();
  }, []);

  const [marketingUserProducts, setMarketingUserProducts] = useState<any[]>([]);

  const loadMarketingUserProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/Marketing_DB/get_all_marketing_user_products.php`);
      const data = await res.json();
      if (data.success) {
        setMarketingUserProducts(data.data || []);
      }
    } catch (e) {
      console.error("Failed to load marketing user products:", e);
    }
  };

  // Actually, I'll implement fetch logic inside the component using Promise.all if I have users list.
  // But wait, I need to display "Managed Products".
  // Let's update the useEffect to include products fetching.

  useEffect(() => {
    if (activeTab === "userManagement") {
      const fetchProducts = async () => {
        try {
          const data = await apiFetch(`products?companyId=` + currentUser.companyId);
          if (Array.isArray(data)) {
            setProducts(data);
          }
        } catch (err) {
          console.error("Failed to load products", err);
        }
      };
      fetchProducts();


      // Reload mappings when entering tab
      loadMarketingUserProducts();
    }
  }, [activeTab, currentUser.companyId]);

  // Handle add user to product
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());

  const toggleProductExpand = (productId: number) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const handleAddUserToProduct = (productId: number) => {
    setSelectedProductForUser(products.find(p => p.id === productId));
  };

  // User Management Section Expand/Collapse State
  const [showActivePages, setShowActivePages] = useState(true);
  const [showManagedProducts, setShowManagedProducts] = useState(true);




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

  // Load ads history when switching to adsHistory tab or when pagination/filters change
  useEffect(() => {
    const loadHistory = async () => {
      if (activeTab !== "adsHistory") return;
      setAdsLogsLoading(true);
      try {
        const offset = (adsHistoryPage - 1) * adsHistoryPageSize;

        // Determine user filter based on role and selection
        let userFilter: number | number[] | undefined;
        if (currentUser.role === "Super Admin" || currentUser.role === "Admin Control") {
          // For admins: use selected users if any, otherwise show all
          userFilter = adsHistorySelectedUsers.length > 0 ? adsHistorySelectedUsers : undefined;
        } else {
          // For non-admins: always filter by their own ID
          userFilter = currentUser.id;
        }

        const result = await loadAdsLogs(
          adsHistorySelectedPages.length > 0
            ? adsHistorySelectedPages
            : undefined,
          adsHistoryDateRange.start || undefined,
          adsHistoryDateRange.end || undefined,
          userFilter,
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
  }, [
    activeTab,
    adsHistoryPage,
    adsHistoryPageSize,
    adsHistoryDateRange,
    adsHistorySelectedPages,
    adsHistorySelectedUsers,
  ]);

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
      const res = await fetch(`${API_BASE}/Marketing_DB/get_marketing_page_users.php`);
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
      const res = await fetch(`${API_BASE}/Marketing_DB/remove_user_from_page.php`, {
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
      const res = await fetch(`${API_BASE}/Marketing_DB/add_user_to_page.php`, {
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
      const res = await fetch(`${API_BASE}/Marketing_DB/get_user_pages.php`, {
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
    // Validate that if any field is filled, all 4 must be filled
    for (const row of adsInputData) {
      const hasAdsCost = row.adsCost !== undefined && row.adsCost !== null && row.adsCost.toString().trim() !== "";
      const hasImpressions = row.impressions !== undefined && row.impressions !== null && row.impressions.toString().trim() !== "";
      const hasReach = row.reach !== undefined && row.reach !== null && row.reach.toString().trim() !== "";
      const hasClicks = row.clicks !== undefined && row.clicks !== null && row.clicks.toString().trim() !== "";

      const filledCount = (hasAdsCost ? 1 : 0) + (hasImpressions ? 1 : 0) + (hasReach ? 1 : 0) + (hasClicks ? 1 : 0);

      if (filledCount > 0 && filledCount < 4) {
        const pageName = userPages.find(p => p.id.toString() === row.pageId.toString())?.name || "Unknown Page";
        alert(`กรุณากรอกข้อมูลให้ครบทั้ง 4 ช่องสำหรับเพจ "${pageName}" (ค่า Ads, อิมเพรสชั่น, การเข้าถึง, ทัก/คลิก)`);
        return;
      }
    }

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
        undefined, // no page filter
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
          res = await fetch(`${API_BASE}/Marketing_DB/ads_log_update.php`, {
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
          res = await fetch(`${API_BASE}/Marketing_DB/ads_log_insert.php`, {
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
    pageIds?: number[],
    dateFrom?: string,
    dateTo?: string,
    userId?: number | number[],
    limit?: number,
    offset?: number,
  ) => {
    try {
      const params = new URLSearchParams();
      if (pageIds && pageIds.length > 0) {
        params.set("page_ids", pageIds.join(","));
      }
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (userId) {
        // Handle both single user ID and array of user IDs
        const userIdStr = Array.isArray(userId) ? userId.join(",") : String(userId);
        params.set("user_id", userIdStr);
      }
      if (limit) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));

      const token = localStorage.getItem("authToken");
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${API_BASE}/Marketing_DB/ads_log_get.php${params.toString() ? `?${params}` : ""}`,
        {
          headers,
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
      const token = localStorage.getItem("authToken");
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/Marketing_DB/ads_log_update.php`, {
        method: "POST",
        headers,
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

  // Handle edit log save
  const handleEditLogSave = async (updatedLog: any) => {
    // Only send fields that are allowed to be updated
    const updates = {
      ads_cost: Number(updatedLog.ads_cost),
      impressions: Number(updatedLog.impressions),
      reach: Number(updatedLog.reach),
      clicks: Number(updatedLog.clicks),
    };

    const res = await updateAdsLog(updatedLog.id, updates);
    if (res.success) {
      alert("แก้ไขข้อมูลเรียบร้อยแล้ว");
      setIsEditModalOpen(false);
      setEditingLog(null);
      // Refresh current page
      const offset = (adsHistoryPage - 1) * adsHistoryPageSize;

      // Use same user filter logic as main useEffect
      let userFilter: number | number[] | undefined;
      if (currentUser.role === "Super Admin" || currentUser.role === "Admin Control") {
        userFilter = adsHistorySelectedUsers.length > 0 ? adsHistorySelectedUsers : undefined;
      } else {
        userFilter = currentUser.id;
      }

      const result = await loadAdsLogs(
        adsHistorySelectedPages.length > 0
          ? adsHistorySelectedPages
          : undefined,
        adsHistoryDateRange.start || undefined,
        adsHistoryDateRange.end || undefined,
        userFilter,
        adsHistoryPageSize,
        offset,
      );
      setAdsLogs(result.data || []);
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "Failed to update"));
    }
  };

  // Delete ads log
  const deleteAdsLog = async (id: number) => {
    if (!confirm("คุณต้องการลบข้อมูลนี้ใช่หรือไม่?")) return false;

    try {
      const res = await fetch(`${API_BASE}/Marketing_DB/ads_log_delete.php`, {
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
        undefined, // no page filter
        selectedDate,
        selectedDate, // single date
        currentUser.id, // current user ID
      );

      // Convert logs to input data format
      const existingData = logs.data.reduce((acc: any[], log) => {
        acc.push({
          pageId: log.page_id.toString(),
          id: log.id, // Store ID to track if it's an existing record
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
  const [selectedProductForUser, setSelectedProductForUser] = useState<any | null>(null);

  const fetchUserProducts = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/Marketing_DB/get_user_products.php?user_id=${userId}`);
      const data = await res.json();
      if (data.success) {
        return data.data || [];
      } else {
        console.error("Failed to load user products:", data.error);
        return [];
      }
    } catch (error) {
      console.error("Error loading user products:", error);
      return [];
    }
  };

  const handleRemoveUserFromProduct = async (userId: number, productId: number) => {
    if (!confirm("คุณต้องการลบสิทธิ์การเข้าถึงสินค้านี้ของผู้ใช้ใช่หรือไม่?")) return;

    try {
      const response = await fetch(`${API_BASE}/Marketing_DB/remove_user_from_product.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, product_id: productId }),
      });
      const result = await response.json();
      if (result.success) {
        alert("ลบสิทธิ์สำเร็จ");
        loadMarketingUserProducts();
      } else {
        alert("เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      console.error("Error removing user from product:", error);
      alert("เกิดข้อผิดพลาดในการลบสิทธิ์");
    }
  };

  const handleSubmitUserToProduct = async (userId: number) => {
    if (!selectedProductForUser) return;
    try {
      const response = await fetch(`${API_BASE}/Marketing_DB/add_user_to_product.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          product_id: selectedProductForUser.id
        })
      });
      const result = await response.json();
      if (result.success) {
        alert("เพิ่มผู้ใช้ไปยังสินค้าเรียบร้อยแล้ว");
        setSelectedProductForUser(null);
        loadMarketingUserProducts();
      } else {
        alert("เกิดข้อผิดพลาด: " + result.error);
      }
    } catch (error) {
      console.error("Error adding user to product:", error);
      alert("เกิดข้อผิดพลาดในการเพิ่มผู้ใช้");
    }
  };

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

      // Add company_id to fetch all pages for this company
      params.set("company_id", String(currentUser.companyId));

      const res = await fetch(
        `${API_BASE}/Marketing_DB/dashboard_data.php?${params.toString()}`,
        {
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data || []);
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

    // Set default to select all active pages only
    if (pages.length > 0) {
      setSelectedPages(
        pages.filter((p) => p.active !== false).map((p) => p.id),
      );
    }
  }, [pages]);

  // Dashboard data loads only when clicking the search button.

  // Removed pagination reset effect

  // Load dashboard data when dependencies change
  useEffect(() => {
    const ready =
      activeTab === "dashboard" &&
      !!dateRange.start &&
      !!dateRange.end &&
      selectedPages.length > 0;

    if (ready) {
      loadDashboardData();
    }
  }, [
    activeTab,
    dateRange,
    dateRange.end,
    selectedPages,
  ]);

  const getHeaderTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return "Marketing Dashboard (แดชบอร์ด)";
      case "adsInput":
        return "Ads Input (กรอกค่า Ads)";
      case "adsHistory":
        return "Ads History (ประวัติการกรอก Ads)";
      case "userManagement":
        return "Marketing User Management (จัดการผู้ใช้การตลาด-เพจ)";
      default:
        return "Marketing";
    }
  };
  // Product Ads Functions

  // Load Products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await apiFetch(`products?companyId=` + currentUser.companyId);
        if (Array.isArray(data)) {
          setProducts(data);
        }
      } catch (err) {
        console.error("Failed to load products", err);
      }
    };
    if ((activeTab === "adsInput" || activeTab === "dashboard") && adsInputMode === "product") {
      fetchProducts();
    }
  }, [activeTab, adsInputMode, currentUser.companyId]);

  const loadExistingProductAdsData = async () => {
    if (!selectedDate) return;
    setIsLoadingData(true);
    try {
      const response = await fetch(`${API_BASE}/Marketing_DB/product_ads_log_get.php?date=${selectedDate}&user_id=${currentUser.id}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        // Map existing data to products
        const mergedData = products.map(product => {
          const existingLog = result.data.find((log: any) => log.product_id === product.id);
          return {
            productId: product.id,
            sku: product.sku,
            productName: product.name,
            adsCost: existingLog ? existingLog.ads_cost : "",
            impressions: existingLog ? existingLog.impressions : "",
            reach: existingLog ? existingLog.reach : "",
            clicks: existingLog ? existingLog.clicks : ""
          };
        });
        setProductAdsInputData(mergedData);
      } else {
        // Initialize with empty values if no data exists
        const initialData = products.map(product => ({
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          adsCost: "",
          impressions: "",
          reach: "",
          clicks: ""
        }));
        setProductAdsInputData(initialData);
      }
    } catch (error) {
      console.error("Error loading product ads data:", error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setIsLoadingData(false);
    }
  };

  // Trigger load when page or date changes in product mode
  useEffect(() => {
    if (adsInputMode === 'product' && selectedDate && products.length > 0) {
      loadExistingProductAdsData();
    }
  }, [adsInputMode, selectedDate, products]);

  const handleProductAdsInputChange = (productId: number, field: string, value: string) => {
    setProductAdsInputData(prevData =>
      prevData.map(item =>
        item.productId === productId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSaveProductAdsData = async () => {
    if (!selectedDate) {
      alert("กรุณาเลือกวันที่");
      return;
    }

    const dataToSave = productAdsInputData.filter(item =>
      item.adsCost || item.impressions || item.reach || item.clicks
    ).map(item => ({
      user_id: currentUser.id,
      product_id: item.productId,
      date: selectedDate,
      ads_cost: item.adsCost || 0,
      impressions: item.impressions || 0,
      reach: item.reach || 0,
      clicks: item.clicks || 0
    }));

    if (dataToSave.length === 0) {
      alert("ไม่พบข้อมูลที่ต้องบันทึก");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/Marketing_DB/product_ads_log_insert.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: dataToSave }),
      });
      const result = await response.json();
      if (result.success) {
        alert("บันทึกข้อมูลเรียบร้อยแล้ว");
      } else {
        alert("เกิดข้อผิดพลาด: " + result.message);
      }
    } catch (error) {
      console.error("Error saving product ads data:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsSaving(false);
    }
  };

  const loadProductDashboardData = async () => {
    setDashboardLoading(true);
    try {
      const pageIds = selectedPages.join(',');
      const productIds = selectedProducts.join(',');
      const queryParams = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
        page_ids: pageIds,
        product_ids: productIds,
        company_id: currentUser.companyId.toString()
      });

      const response = await fetch(`${API_BASE}/Marketing_DB/product_ads_dashboard_data.php?${queryParams.toString()}`);
      const result = await response.json();

      if (result.success) {
        setProductDashboardData(result.data);
      } else {
        console.error("Failed to load product dashboard data:", result.message);
      }
    } catch (error) {
      console.error("Error loading product dashboard data:", error);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Trigger dashboard load
  useEffect(() => {
    if (activeTab === 'dashboard' && adsInputMode === 'product') {
      loadProductDashboardData();
    }
  }, [activeTab, adsInputMode, dateRange, selectedPages, selectedProducts]);

  // Product Ads History Logic
  const [adsHistoryMode, setAdsHistoryMode] = useState<"page" | "product">("page");
  const [productAdsLogs, setProductAdsLogs] = useState<any[]>([]);
  const [productAdsLogsLoading, setProductAdsLogsLoading] = useState(false);
  const [productAdsLogsTotal, setProductAdsLogsTotal] = useState(0);
  const [productAdsHistoryPage, setProductAdsHistoryPage] = useState(1);
  const [productAdsHistoryPageSize, setProductAdsHistoryPageSize] = useState(10);
  const [productAdsHistoryServerPagination, setProductAdsHistoryServerPagination] = useState({
    total: 0,
    totalPages: 0,
    hasMore: false,
    hasPrevious: false,
  });

  // Expand/Collapse state for History
  const [historyExpanded, setHistoryExpanded] = useState<Set<string>>(new Set());
  const toggleHistoryExpand = (id: string) => {
    const newSet = new Set(historyExpanded);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setHistoryExpanded(newSet);
  };

  const loadProductAdsLogs = async () => {
    setProductAdsLogsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        start_date: adsHistoryDateRange.start,
        end_date: adsHistoryDateRange.end,
        page: productAdsHistoryPage.toString(),
        limit: productAdsHistoryPageSize.toString()
      });

      if (currentUser.role !== "Super Admin" && currentUser.role !== "Admin Control") {
        queryParams.append("user_ids", currentUser.id.toString());
      } else if (adsHistorySelectedUsers.length > 0) {
        queryParams.append("user_ids", adsHistorySelectedUsers.map(u => u.id).join(','));
      }

      /*
      if (adsHistorySelectedPages.length > 0) {
        queryParams.append("page_ids", adsHistorySelectedPages.join(','));
      }
      */

      const response = await fetch(`${API_BASE}/Marketing_DB/product_ads_log_get_history.php?${queryParams.toString()}`);
      const result = await response.json();

      if (result.success) {
        setProductAdsLogs(result.data);
        setProductAdsLogsTotal(result.pagination.total);
        setProductAdsHistoryServerPagination({
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasMore: productAdsHistoryPage < result.pagination.totalPages,
          hasPrevious: productAdsHistoryPage > 1,
        });
      }
    } catch (error) {
      console.error("Error loading product ads logs:", error);
    } finally {
      setProductAdsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'adsHistory' && adsHistoryMode === 'product') {
      loadProductAdsLogs();
    }
  }, [activeTab, adsHistoryMode, adsHistoryDateRange, adsHistorySelectedPages, adsHistorySelectedUsers, productAdsHistoryPage, productAdsHistoryPageSize]);

  const exportDashboard = () => {
    let dataToExport: any[] = [];
    let headers: string[] = [];

    if (adsInputMode === 'product') {
      headers = ["SKU", "Product Name", "Ads Cost", "Sales", "Qty", "Orders", "ROAS", "%Ads"];
      dataToExport = productDashboardData.map(row => ({
        SKU: row.sku,
        "Product Name": row.product_name,
        "Ads Cost": row.ads_cost,
        "Sales": row.total_sales,
        "Qty": row.total_qty,
        "Orders": row.total_orders,
        "ROAS": Number(row.ads_cost) > 0 ? (Number(row.total_sales) / Number(row.ads_cost)).toFixed(2) : "0.00",
        "%Ads": Number(row.total_sales) > 0 ? ((Number(row.ads_cost) / Number(row.total_sales)) * 100).toFixed(2) + "%" : "0.00%"
      }));
    } else {
      headers = ["Page", "Ads Cost", "Sales", "New Cust Sales", "Reorder Sales", "Total Cust", "Clicks", "ROAS", "%Ads"];
      dataToExport = dashboardData.map(row => ({
        Page: row.page_name,
        "Ads Cost": row.ads_cost,
        "Sales": row.total_sales,
        "New Cust Sales": row.new_customer_sales,
        "Reorder Sales": row.reorder_customer_sales,
        "Total Cust": row.total_customers,
        "Clicks": row.clicks,
        "ROAS": Number(row.ads_cost) > 0 ? (Number(row.total_sales) / Number(row.ads_cost)).toFixed(2) : "0.00",
        "%Ads": Number(row.total_sales) > 0 ? ((Number(row.ads_cost) / Number(row.total_sales)) * 100).toFixed(2) + "%" : "0.00%"
      }));
    }

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + dataToExport.map(e => Object.values(e).map(v => `"${v}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `marketing_dashboard_${adsInputMode}_${dateRange.start}_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{getHeaderTitle()}</h2>
      </div>


      {/* Content based on active tab */}
      {
        (!hasAdminAccess(currentUser) || activeTab === "ads") && (
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
                    {platforms
                      .filter((p) => p.active)
                      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                      .map((platform) => (
                        <option key={platform.id} value={platform.name}>
                          {platform.displayName || platform.name}
                        </option>
                      ))}
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
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span>{p?.name || row.pageId}</span>
                              {isPageInactive(p) && (
                                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </td>
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
        )
      }

      {/* User Management Tab - Admin Only */}
      {
        hasAdminAccess(currentUser) && activeTab === "userManagement" && (
          <>
            {/* Active Pages List */}
            <section className="bg-white rounded-lg shadow p-5">
              <div
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setShowActivePages(!showActivePages)}
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  รายการเพจที่ใช้งานอยู่ (Active Pages)
                </h3>
                {showActivePages ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
              </div>

              {showActivePages && (
                <>
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
                            <th className="px-3 py-2 text-left w-10"></th>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">ชื่อเพจ</th>
                            <th className="px-3 py-2 text-left">แพลตฟอร์ม</th>
                            <th className="px-3 py-2 text-left">จำนวนผู้ใช้</th>
                            <th className="px-3 py-2 text-left">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pages.map((page) => (
                            <React.Fragment key={page.id}>
                              <tr
                                className="border-b cursor-pointer hover:bg-gray-50 bg-white"
                                onClick={() => togglePageExpand(page.id)}
                              >
                                <td className="px-3 py-2 text-center w-10">
                                  {expandedPages.has(page.id) ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                  )}
                                </td>
                                <td className="px-3 py-2 text-gray-500">{page.id}</td>
                                <td className="px-3 py-2">
                                  {(() => {
                                    const { label, className } = getPageTypeBadgeClasses(
                                      page.page_type ?? page.pageType ?? null,
                                    );
                                    return (
                                      <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
                                      >
                                        {label}
                                      </span>
                                    );
                                  })()}
                                </td>
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
                                  <td colSpan={7} className="px-3 py-4 bg-gray-50">
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
                </>
              )}
            </section>

            {/* Managed Products List */}
            <section className="bg-white rounded-lg shadow p-5 mt-6">
              <div
                className="flex items-center justify-between mb-4 cursor-pointer"
                onClick={() => setShowManagedProducts(!showManagedProducts)}
              >
                <h3 className="text-lg font-semibold text-gray-800">
                  รายการสินค้า (Managed Products)
                </h3>
                {showManagedProducts ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
              </div>

              {showManagedProducts && (
                <>
                  {loading ? (
                    <div className="text-center py-4">กำลังโหลด...</div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      ไม่มีสินค้า
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left w-10"></th>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-left">ชื่อสินค้า</th>
                            <th className="px-3 py-2 text-left">จำนวนผู้ใช้</th>
                            <th className="px-3 py-2 text-left">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((product) => (
                            <React.Fragment key={product.id}>
                              <tr
                                className="border-b cursor-pointer hover:bg-gray-50"
                                onClick={() => toggleProductExpand(product.id)}
                              >
                                <td className="px-3 py-2 text-center w-10">
                                  {expandedProducts.has(product.id) ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                  )}
                                </td>
                                <td className="px-3 py-2">{product.sku}</td>
                                <td className="px-3 py-2 font-medium">{product.name}</td>
                                <td className="px-3 py-2">
                                  {marketingUserProducts.filter(m => m.product_id === product.id).length}
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddUserToProduct(product.id);
                                    }}
                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                  >
                                    +เพิ่มผู้ใช้
                                  </button>
                                </td>
                              </tr>
                              {expandedProducts.has(product.id) && (
                                <tr>
                                  <td colSpan={5} className="px-3 py-4 bg-gray-50">
                                    <div className="space-y-2">
                                      <h4 className="font-medium text-gray-700">ผู้ใช้ที่ดูแลสินค้านี้:</h4>
                                      {marketingUserProducts
                                        .filter(m => m.product_id === product.id)
                                        .map(m => (
                                          <div key={m.user_id} className="flex items-center justify-between bg-white p-3 rounded border">
                                            <div>
                                              <span className="font-medium">{m.first_name} {m.last_name}</span>
                                              <span className="text-sm text-gray-600 ml-2">({m.username})</span>
                                            </div>
                                            <button
                                              onClick={() => handleRemoveUserFromProduct(m.user_id, product.id)}
                                              className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                            >
                                              ลบ
                                            </button>
                                          </div>
                                        ))
                                      }
                                      {marketingUserProducts.filter(m => m.product_id === product.id).length === 0 && (
                                        <div className="text-gray-500">ยังไม่มีผู้ใช้ดูแลสินค้านี้</div>
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
                </>
              )}
            </section>
          </>
        )
      }

      {/* Ads Input Tab */}
      {
        hasAdminAccess(currentUser) && activeTab === "adsInput" && (
          <>
            <section className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    กรอกค่า Ads
                  </h3>
                  <div className="flex bg-gray-100 rounded p-1">
                    <button
                      className={`px-3 py-1 text-sm rounded ${adsInputMode === 'page' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                      onClick={() => setAdsInputMode('page')}
                    >
                      รายเพจ
                    </button>
                    <button
                      className={`px-3 py-1 text-sm rounded ${adsInputMode === 'product' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                      onClick={() => setAdsInputMode('product')}
                    >
                      รายสินค้า
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <button
                    onClick={() => adsInputMode === 'page' ? loadExistingAdsData() : loadExistingProductAdsData()}
                    disabled={isLoadingData || (adsInputMode === 'product' && !selectedDate)}
                    className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    title="โหลดข้อมูลที่มีอยู่แล้ว"
                  >
                    {isLoadingData ? "กำลังโหลด..." : "โหลดข้อมูล"}
                  </button>
                  <button
                    onClick={adsInputMode === 'page' ? handleSaveAllAdsData : handleSaveProductAdsData}
                    disabled={isSaving || (adsInputMode === 'product' && !selectedDate)}
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
                  {adsInputMode === 'page' ? (
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
                              <td className="px-3 py-2 font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{page.name}</span>
                                  {isPageInactive(page) && (
                                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">{page.platform}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  className={`w-full p-2 border border-gray-300 rounded ${getInputValue(page.id, "id") ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                                  placeholder="0"
                                  value={getInputValue(page.id, "adsCost")}
                                  disabled={!!getInputValue(page.id, "id")}
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
                                  className={`w-full p-2 border border-gray-300 rounded ${getInputValue(page.id, "id") ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                                  placeholder="0"
                                  value={getInputValue(page.id, "impressions")}
                                  disabled={!!getInputValue(page.id, "id")}
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
                                  className={`w-full p-2 border border-gray-300 rounded ${getInputValue(page.id, "id") ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                                  placeholder="0"
                                  value={getInputValue(page.id, "reach")}
                                  disabled={!!getInputValue(page.id, "id")}
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
                                  className={`w-full p-2 border border-gray-300 rounded ${getInputValue(page.id, "id") ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                                  placeholder="0"
                                  value={getInputValue(page.id, "clicks")}
                                  disabled={!!getInputValue(page.id, "id")}
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
                  ) : (
                    /* Product Ads Input Table */
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">รหัสสินค้า (SKU)</th>
                          <th className="px-3 py-2 text-left">ชื่อสินค้า</th>
                          <th className="px-3 py-2 text-left">ค่า Ads</th>
                          <th className="px-3 py-2 text-left">อิมเพรสชั่น</th>
                          <th className="px-3 py-2 text-left">การเข้าถึง</th>
                          <th className="px-3 py-2 text-left">ทัก/คลิก</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!selectedProductPageId ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-500">กรุณาเลือกเพจเพื่อกรอกข้อมูล</td>
                          </tr>
                        ) : productAdsInputData.length > 0 ? (
                          productAdsInputData.map((item) => (
                            <tr key={item.productId} className="border-b">
                              <td className="px-3 py-2">{item.sku}</td>
                              <td className="px-3 py-2 font-medium">{item.productName}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  className="w-full p-2 border border-gray-300 rounded"
                                  placeholder="0"
                                  value={item.adsCost}
                                  onChange={(e) => handleProductAdsInputChange(item.productId, 'adsCost', e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  className="w-full p-2 border border-gray-300 rounded"
                                  placeholder="0"
                                  value={item.impressions}
                                  onChange={(e) => handleProductAdsInputChange(item.productId, 'impressions', e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  className="w-full p-2 border border-gray-300 rounded"
                                  placeholder="0"
                                  value={item.reach}
                                  onChange={(e) => handleProductAdsInputChange(item.productId, 'reach', e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  className="w-full p-2 border border-gray-300 rounded"
                                  placeholder="0"
                                  value={item.clicks}
                                  onChange={(e) => handleProductAdsInputChange(item.productId, 'clicks', e.target.value)}
                                />
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-500">ไม่พบรายการสินค้า</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          </>
        )
      }

      {/* Dashboard Tab */}
      {
        hasAdminAccess(currentUser) && activeTab === "dashboard" && (
          <section className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  แดชบอร์ดข้อมูล Ads
                </h3>
              </div>
              <button
                onClick={() => {
                  setExportModalOpen(true);
                  setExportDateRange(dateRange);
                  setExportSelectedPages(selectedPages);
                  setExportTempStart(dateRange.start);
                  setExportTempEnd(dateRange.end);
                }}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md shadow-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ส่งออก CSV
              </button>
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
                        : "ทั้งหมด"}
                    </span>
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1">
                  {adsInputMode === 'page' ? (
                    <>
                      <label className={labelClass}>เลือกเพจ</label>
                      <MultiSelectPageFilter
                        pages={pages.map((page) => ({
                          id: page.id,
                          name: page.name,
                          platform: page.platform,
                          active: page.active,
                        }))}
                        selectedPages={selectedPages}
                        onChange={setSelectedPages}
                        showInactivePages={showInactivePages}
                        onToggleInactivePages={setShowInactivePages}
                      />
                    </>
                  ) : (
                    <>
                      <label className={labelClass}>เลือกสินค้า</label>
                      <MultiSelectProductFilter
                        products={products.map((p) => ({
                          id: p.id,
                          sku: p.sku || "",
                          name: p.name,
                        }))}
                        selectedProducts={selectedProducts}
                        onChange={setSelectedProducts}
                      />
                    </>
                  )}
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
                            const newRange = { start: "", end: "" };
                            setTempStart("");
                            setTempEnd("");
                            setDateRange(newRange);
                            setDatePickerOpen(false);
                          }}
                          className="px-3 py-2 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center"
                        >
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          ทั้งหมด
                        </button>
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
                          setDateRange({ start: tempStart, end: tempEnd });
                          setDatePickerOpen(false);
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

            {/* Dashboard Header with Toggle and Export */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 rounded p-1">
                  <button
                    className={`px-3 py-1 text-sm rounded ${adsInputMode === 'page' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                    onClick={() => setAdsInputMode('page')}
                  >
                    รายเพจ
                  </button>
                  <button
                    className={`px-3 py-1 text-sm rounded ${adsInputMode === 'product' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
                    onClick={() => setAdsInputMode('product')}
                  >
                    รายสินค้า
                  </button>
                </div>
                <button
                  onClick={exportDashboard}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-2"
                >
                  Export CSV
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
                  {adsInputMode === 'page' ? (
                    /* Page Dashboard Table */
                    <>
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">เพจ</th>
                          <th className="px-3 py-2 text-left">ประเภทเพจ</th>
                          <th className="px-3 py-2 text-left">พนักงาน</th>
                          <th className="px-3 py-2 text-right">ค่าแอด</th>
                          <th className="px-3 py-2 text-right">ยอดขาย</th>
                          <th className="px-3 py-2 text-right">ยอดขาย ลค.ใหม่</th>
                          <th className="px-3 py-2 text-right">รีออเดอร์</th>
                          <th className="px-3 py-2 text-right">จำนวนลูกค้า</th>
                          <th className="px-3 py-2 text-right">ทัก/คลิก</th>
                          <th className="px-3 py-2 text-right">ROAS</th>
                          <th className="px-3 py-2 text-right">ราคาต่อทัก</th>
                          <th className="px-3 py-2 text-right">%Ads/ยอด ลค.ใหม่</th>
                          <th className="px-3 py-2 text-right">%Ads</th>
                          <th className="px-3 py-2 text-right">%ปิดการขาย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.length > 0 ? (
                          <>
                            {dashboardData.map((row, index) => {
                              const roas = row.ads_cost > 0 ? row.total_sales / row.ads_cost : 0;
                              const costPerInbox = row.clicks > 0 ? row.ads_cost / row.clicks : 0;
                              const pctAdsNewSales = row.new_customer_sales > 0 ? (row.ads_cost / row.new_customer_sales) * 100 : 0;
                              const pctAds = row.total_sales > 0 ? (row.ads_cost / row.total_sales) * 100 : 0;
                              const closeRate = row.clicks > 0 ? (row.total_orders / row.clicks) * 100 : 0;

                              return (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <span>{row.page_name}</span>
                                      {(() => {
                                        const page = pages.find(
                                          (p) => p.name === row.page_name,
                                        );
                                        return isPageInactive(page) ? (
                                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                            Inactive
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{row.page_type || "-"}</td>
                                  <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]" title={row.staff_names}>{row.staff_names || "-"}</td>
                                  <td className="px-3 py-2 text-right">
                                    {Number(row.ads_cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {Number(row.total_sales || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {Number(row.new_customer_sales || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {Number(row.reorder_customer_sales || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-2 text-right">{Number(row.total_customers || 0).toLocaleString('th-TH')}</td>
                                  <td className="px-3 py-2 text-right font-medium">{Number(row.clicks || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-right text-blue-600 font-medium">{roas.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right">{costPerInbox.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right relative">
                                    {pctAdsNewSales.toFixed(2)}%
                                    {/* Show warning if > 100% or high? keeping simple for now */}
                                  </td>
                                  <td className="px-3 py-2 text-right">{pctAds.toFixed(2)}%</td>
                                  <td className="px-3 py-2 text-right">{closeRate.toFixed(2)}%</td>
                                </tr>
                              );
                            })}
                            {/* Summary Row */}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                              <td className="px-3 py-2" colSpan={3}>รวมทั้งสิ้น</td>
                              <td className="px-3 py-2 text-right">
                                {dashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {dashboardData.reduce((acc, row) => acc + Number(row.total_sales || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {dashboardData.reduce((acc, row) => acc + Number(row.new_customer_sales || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {dashboardData.reduce((acc, row) => acc + Number(row.reorder_customer_sales || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {dashboardData.reduce((acc, row) => acc + Number(row.total_customers || 0), 0).toLocaleString('th-TH')}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {dashboardData.reduce((acc, row) => acc + Number(row.clicks || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-3 py-2 text-right text-blue-700">
                                {(() => {
                                  const totalAds = dashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalSales = dashboardData.reduce((acc, row) => acc + Number(row.total_sales || 0), 0);
                                  return totalAds > 0 ? (totalSales / totalAds).toFixed(2) : "0.00";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalAds = dashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalClicks = dashboardData.reduce((acc, row) => acc + Number(row.clicks || 0), 0);
                                  return totalClicks > 0 ? (totalAds / totalClicks).toFixed(2) : "0.00";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalAds = dashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalNewSales = dashboardData.reduce((acc, row) => acc + Number(row.new_customer_sales || 0), 0);
                                  return totalNewSales > 0 ? ((totalAds / totalNewSales) * 100).toFixed(2) + "%" : "0.00%";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalAds = dashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalSales = dashboardData.reduce((acc, row) => acc + Number(row.total_sales || 0), 0);
                                  return totalSales > 0 ? ((totalAds / totalSales) * 100).toFixed(2) + "%" : "0.00%";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalOrders = dashboardData.reduce((acc, row) => acc + Number(row.total_orders || 0), 0);
                                  const totalClicks = dashboardData.reduce((acc, row) => acc + Number(row.clicks || 0), 0);
                                  return totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) + "%" : "0.00%";
                                })()}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td
                              colSpan={14}
                              className="text-center py-8 text-gray-500"
                            >
                              ไม่มีข้อมูลในช่วงวันที่ที่เลือก
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </>
                  ) : (
                    /* Create Product Dashboard Table */
                    <>
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-left">สินค้า</th>
                          <th className="px-3 py-2 text-right">ค่าแอด</th>
                          <th className="px-3 py-2 text-right">ยอดขาย</th>
                          <th className="px-3 py-2 text-right">ยอดขาย ลค.ใหม่</th>
                          <th className="px-3 py-2 text-right">รีออเดอร์</th>
                          <th className="px-3 py-2 text-right">จำนวนลูกค้า</th>
                          <th className="px-3 py-2 text-right">ทัก/คลิก</th>
                          <th className="px-3 py-2 text-right">ROAS</th>
                          <th className="px-3 py-2 text-right">ราคาต่อทัก</th>
                          <th className="px-3 py-2 text-right">%Ads/ยอด ลค.ใหม่</th>
                          <th className="px-3 py-2 text-right">%Ads</th>
                          <th className="px-3 py-2 text-right">%ปิดการขาย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productDashboardData.length > 0 ? (
                          <>
                            {productDashboardData.map((row, index) => {
                              const roas = Number(row.ads_cost) > 0 ? Number(row.total_sales) / Number(row.ads_cost) : 0;
                              const costPerInbox = Number(row.clicks) > 0 ? Number(row.ads_cost) / Number(row.clicks) : 0;
                              const pctAdsNewSales = Number(row.new_customer_sales) > 0 ? (Number(row.ads_cost) / Number(row.new_customer_sales)) * 100 : 0;
                              const pctAds = Number(row.total_sales) > 0 ? (Number(row.ads_cost) / Number(row.total_sales)) * 100 : 0;
                              const closeRate = Number(row.clicks) > 0 ? (Number(row.total_orders) / Number(row.clicks)) * 100 : 0;

                              return (
                                <tr key={index} className="border-b hover:bg-gray-50">
                                  <td className="px-3 py-2">{row.sku}</td>
                                  <td className="px-3 py-2 font-medium">{row.product_name}</td>
                                  <td className="px-3 py-2 text-right">{Number(row.ads_cost).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-right">{Number(row.total_sales).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-right">{Number(row.new_customer_sales || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-right">{Number(row.reorder_customer_sales || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-right">{Number(row.total_customers || 0).toLocaleString('th-TH')}</td>
                                  <td className="px-3 py-2 text-right font-medium">{Number(row.clicks || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                  <td className="px-3 py-2 text-right text-blue-600 font-medium">{roas.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right">{costPerInbox.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right">{pctAdsNewSales.toFixed(2)}%</td>
                                  <td className="px-3 py-2 text-right">{pctAds.toFixed(2)}%</td>
                                  <td className="px-3 py-2 text-right">{closeRate.toFixed(2)}%</td>
                                </tr>
                              );
                            })}
                            {/* Summary Row for Products */}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                              <td className="px-3 py-2" colSpan={2}>รวมทั้งสิ้น</td>
                              <td className="px-3 py-2 text-right">
                                {productDashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {productDashboardData.reduce((acc, row) => acc + Number(row.total_sales || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {productDashboardData.reduce((acc, row) => acc + Number(row.new_customer_sales || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {productDashboardData.reduce((acc, row) => acc + Number(row.reorder_customer_sales || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {productDashboardData.reduce((acc, row) => acc + Number(row.total_customers || 0), 0).toLocaleString('th-TH')}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {productDashboardData.reduce((acc, row) => acc + Number(row.clicks || 0), 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-3 py-2 text-right text-blue-700">
                                {(() => {
                                  const totalAds = productDashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalSales = productDashboardData.reduce((acc, row) => acc + Number(row.total_sales || 0), 0);
                                  return totalAds > 0 ? (totalSales / totalAds).toFixed(2) : "0.00";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalAds = productDashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalClicks = productDashboardData.reduce((acc, row) => acc + Number(row.clicks || 0), 0);
                                  return totalClicks > 0 ? (totalAds / totalClicks).toFixed(2) : "0.00";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalAds = productDashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalNewSales = productDashboardData.reduce((acc, row) => acc + Number(row.new_customer_sales || 0), 0);
                                  return totalNewSales > 0 ? ((totalAds / totalNewSales) * 100).toFixed(2) + "%" : "0.00%";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalAds = productDashboardData.reduce((acc, row) => acc + Number(row.ads_cost || 0), 0);
                                  const totalSales = productDashboardData.reduce((acc, row) => acc + Number(row.total_sales || 0), 0);
                                  return totalSales > 0 ? ((totalAds / totalSales) * 100).toFixed(2) + "%" : "0.00%";
                                })()}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(() => {
                                  const totalOrders = productDashboardData.reduce((acc, row) => acc + Number(row.total_orders || 0), 0);
                                  const totalClicks = productDashboardData.reduce((acc, row) => acc + Number(row.clicks || 0), 0);
                                  return totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) + "%" : "0.00%";
                                })()}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan={13} className="text-center py-8 text-gray-500">
                              ไม่พบข้อมูลสินค้าในช่วงที่เลือก
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </>
                  )}

                </table>
              </div>
            )}
          </section>
        )
      }

      {/* Export CSV Modal */}
      {
        exportModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  ส่งออกข้อมูล CSV
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>เลือกช่วงวันที่</label>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setExportDatePickerOpen(!exportDatePickerOpen)
                        }
                        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                      >
                        <span
                          className={
                            exportTempStart && exportTempEnd
                              ? "text-gray-900"
                              : "text-gray-500"
                          }
                        >
                          {exportTempStart && exportTempEnd
                            ? `${new Date(exportTempStart + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} - ${new Date(exportTempEnd + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`
                            : "ทั้งหมด"}
                        </span>
                        <Calendar className="w-4 h-4 text-gray-400" />
                      </button>

                      {/* Export Date Picker Dropdown */}
                      {exportDatePickerOpen && (
                        <div
                          className="absolute z-50 w-80 mt-2 bg-white rounded-lg shadow-xl border border-gray-200"
                          ref={exportDatePickerRef}
                        >
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">
                                  วันที่เริ่มต้น
                                </label>
                                <input
                                  type="date"
                                  value={exportTempStart}
                                  onChange={(e) =>
                                    setExportTempStart(e.target.value)
                                  }
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">
                                  วันที่สิ้นสุด
                                </label>
                                <input
                                  type="date"
                                  value={exportTempEnd}
                                  onChange={(e) =>
                                    setExportTempEnd(e.target.value)
                                  }
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
                                    setExportTempStart("");
                                    setExportTempEnd("");
                                    setExportDatePickerOpen(false);
                                  }}
                                  className="px-3 py-2 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center"
                                >
                                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                  ทั้งหมด
                                </button>
                                <button
                                  onClick={() => {
                                    const now = new Date();
                                    const dayOfWeek = now.getDay();
                                    const startDate = new Date(now);
                                    startDate.setDate(now.getDate() - dayOfWeek);
                                    const endDate = new Date(startDate);
                                    endDate.setDate(startDate.getDate() + 6);
                                    setExportTempStart(
                                      startDate.toISOString().slice(0, 10),
                                    );
                                    setExportTempEnd(
                                      endDate.toISOString().slice(0, 10),
                                    );
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
                                    setExportTempStart(
                                      startDate.toISOString().slice(0, 10),
                                    );
                                    setExportTempEnd(
                                      endDate.toISOString().slice(0, 10),
                                    );
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
                                    setExportTempStart(
                                      startDate.toISOString().slice(0, 10),
                                    );
                                    setExportTempEnd(
                                      endDate.toISOString().slice(0, 10),
                                    );
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
                                    setExportTempStart(
                                      startDate.toISOString().slice(0, 10),
                                    );
                                    setExportTempEnd(
                                      endDate.toISOString().slice(0, 10),
                                    );
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
                                  setExportDateRange({
                                    start: exportTempStart,
                                    end: exportTempEnd,
                                  });
                                  setExportDatePickerOpen(false);
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
                  </div>

                  <div>
                    <label className={labelClass}>เลือกเพจ</label>
                    <MultiSelectPageFilter
                      pages={pages.map((page) => ({
                        id: page.id,
                        name: page.name,
                        platform: page.platform,
                        active: page.active,
                      }))}
                      selectedPages={exportSelectedPages}
                      onChange={setExportSelectedPages}
                      showInactivePages={showInactivePages}
                      onToggleInactivePages={setShowInactivePages}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setExportModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={exporting}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const params = new URLSearchParams();
                        if (exportTempStart)
                          params.set("date_from", exportTempStart);
                        if (exportTempEnd) params.set("date_to", exportTempEnd);
                        if (exportSelectedPages.length > 0) {
                          params.set("page_ids", exportSelectedPages.join(","));
                        }

                        const response = await fetch(
                          `${API_BASE}/Marketing_DB/ads_log_export_csv.php?${params}`,
                        );

                        if (!response.ok) {
                          throw new Error("Export failed");
                        }

                        // Get the filename from the response headers or create a default one
                        const contentDisposition = response.headers.get(
                          "content-disposition",
                        );
                        let filename = "marketing_ads_log.csv";
                        if (contentDisposition) {
                          const filenameMatch =
                            contentDisposition.match(/filename="?([^"]+)"?/);
                          if (filenameMatch) {
                            filename = filenameMatch[1];
                          }
                        }

                        // Create blob and download
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);

                        setExportModalOpen(false);
                      } catch (error) {
                        console.error("Export error:", error);
                        alert("การส่งออกข้อมูลล้มเหลว กรุณาลองใหม่");
                      } finally {
                        setExporting(false);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={exporting}
                  >
                    <Download className="w-4 h-4" />
                    {exporting ? "กำลังส่งออก..." : "ยืนยันและดาวน์โหลด"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Ads History Tab */}
      {
        hasAdminAccess(currentUser) && activeTab === "adsHistory" && (
          <section className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between mb-2">
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

            <div className="flex items-center gap-4 mb-4">
              <div className="text-sm text-gray-500">
                สิทธิ์เข้าถึง {userAccessiblePages.length} เพจ
              </div>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setAdsHistoryMode('page')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${adsHistoryMode === 'page'
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Page Ads
                </button>
                <button
                  onClick={() => setAdsHistoryMode('product')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${adsHistoryMode === 'product'
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Product Ads
                </button>
              </div>
            </div>

            {/* Ads History Filters */}
            <div className="mb-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className={labelClass}>เลือกช่วงวันที่</label>
                  <button
                    onClick={() =>
                      setAdsHistoryDatePickerOpen(!adsHistoryDatePickerOpen)
                    }
                    className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                  >
                    <span
                      className={
                        adsHistoryDateRange.start && adsHistoryDateRange.end
                          ? "text-gray-900"
                          : "text-gray-900 font-medium"
                      }
                    >
                      {adsHistoryDateRange.start && adsHistoryDateRange.end
                        ? `${new Date(adsHistoryDateRange.start + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} - ${new Date(adsHistoryDateRange.end + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`
                        : "ทั้งหมด"}
                    </span>
                    <Calendar className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1">
                  <label className={labelClass}>เลือกเพจ</label>
                  <MultiSelectPageFilter
                    pages={(currentUser.role === "Super Admin" ||
                      currentUser.role === "Admin Control"
                      ? pages
                      : userAccessiblePages
                    ).map((page) => ({
                      id: page.id,
                      name: page.name,
                      platform: page.platform,
                      active: page.active,
                    }))}
                    selectedPages={adsHistorySelectedPages}
                    onChange={setAdsHistorySelectedPages}
                    showInactivePages={showInactivePagesAdsHistory}
                    onToggleInactivePages={setShowInactivePagesAdsHistory}
                  />
                </div>

                {/* User Filter - Only for Super Admin and Admin Control */}
                {(currentUser.role === "Super Admin" || currentUser.role === "Admin Control") && (
                  <div className="flex-1">
                    <label className={labelClass}>เลือกผู้ใช้</label>
                    <MultiSelectUserFilter
                      users={marketingUsersList.map((user) => ({
                        id: user.id,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        username: user.username,
                      }))}
                      selectedUsers={adsHistorySelectedUsers}
                      onChange={setAdsHistorySelectedUsers}
                    />
                  </div>
                )}

                <div className="">
                  <button
                    onClick={() => setAdsHistoryPage(1)}
                    disabled={adsLogsLoading}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md shadow-sm h-[42px]"
                  >
                    {adsLogsLoading ? "กำลังโหลด..." : "ค้นหา"}
                  </button>
                </div>
              </div>

              {/* Ads History Date Picker Dropdown */}
              {adsHistoryDatePickerOpen && (
                <div
                  className="absolute z-50 w-80 mt-2 bg-white rounded-lg shadow-xl border border-gray-200"
                  ref={adsHistoryDatePickerRef}
                >
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          วันที่เริ่มต้น
                        </label>
                        <input
                          type="date"
                          value={adsHistoryTempStart}
                          onChange={(e) => setAdsHistoryTempStart(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          วันที่สิ้นสุด
                        </label>
                        <input
                          type="date"
                          value={adsHistoryTempEnd}
                          onChange={(e) => setAdsHistoryTempEnd(e.target.value)}
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
                            const newRange = { start: "", end: "" };
                            setAdsHistoryTempStart("");
                            setAdsHistoryTempEnd("");
                            setAdsHistoryDateRange(newRange);
                            setAdsHistoryDatePickerOpen(false);
                          }}
                          className="px-3 py-2 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 flex items-center"
                        >
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          ทั้งหมด
                        </button>
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
                            setAdsHistoryTempStart(newRange.start);
                            setAdsHistoryTempEnd(newRange.end);
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
                            setAdsHistoryTempStart(newRange.start);
                            setAdsHistoryTempEnd(newRange.end);
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
                            setAdsHistoryTempStart(newRange.start);
                            setAdsHistoryTempEnd(newRange.end);
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
                            setAdsHistoryTempStart(newRange.start);
                            setAdsHistoryTempEnd(newRange.end);
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
                          setAdsHistoryDateRange({
                            start: adsHistoryTempStart,
                            end: adsHistoryTempEnd,
                          });
                          setAdsHistoryDatePickerOpen(false);
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

            {adsHistoryMode === 'page' ? (
              // Page Ads History
              adsLogsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className="mt-2 text-gray-600">กำลังโหลดประวัติ...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Group by Page */}
                  {(() => {
                    const groupedByPage: Record<string, any[]> = {};
                    adsLogs.forEach(log => {
                      const key = log.page_id;
                      if (!groupedByPage[key]) groupedByPage[key] = [];
                      groupedByPage[key].push(log);
                    });

                    const pageKeys = Object.keys(groupedByPage);

                    return (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left w-8"></th>
                            <th className="px-3 py-2 text-left">เพจ</th>
                            <th className="px-3 py-2 text-right">จำนวนรายการ</th>
                            <th className="px-3 py-2 text-right">รวมค่า Ads</th>
                            <th className="px-3 py-2 text-right">รวม Impressions</th>
                            <th className="px-3 py-2 text-right">รวม Reach</th>
                            <th className="px-3 py-2 text-right">รวม Clicks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageKeys.length > 0 ? pageKeys.map(pageId => {
                            const groupLogs = groupedByPage[pageId];
                            const firstLog = groupLogs[0];
                            const isExpanded = historyExpanded.has('page-' + pageId);
                            const totalCost = groupLogs.reduce((acc, l) => acc + Number(l.ads_cost || 0), 0);
                            const totalImp = groupLogs.reduce((acc, l) => acc + Number(l.impressions || 0), 0);
                            const totalReach = groupLogs.reduce((acc, l) => acc + Number(l.reach || 0), 0);
                            const totalClicks = groupLogs.reduce((acc, l) => acc + Number(l.clicks || 0), 0);

                            return (
                              <React.Fragment key={pageId}>
                                <tr className="bg-white border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleHistoryExpand('page-' + pageId)}>
                                  <td className="px-3 py-2 text-center">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </td>
                                  <td className="px-3 py-2 font-medium">
                                    {firstLog.page_name || pages.find(p => p.id === Number(pageId))?.name || pageId}
                                    {(() => {
                                      const page = pages.find(p => p.name === firstLog.page_name || p.id === Number(pageId));
                                      return isPageInactive(page) ? (
                                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactive</span>
                                      ) : null;
                                    })()}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-500">{groupLogs.length}</td>
                                  <td className="px-3 py-2 text-right font-medium">฿{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-right">{totalImp.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-right">{totalReach.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-right">{totalClicks.toLocaleString()}</td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="p-0">
                                      <div className="bg-gray-50 p-2 pl-8 border-b shadow-inner">
                                        <table className="w-full text-xs">
                                          <thead className="text-gray-500 bg-gray-100">
                                            <tr>
                                              <th className="px-3 py-1 text-left">วันที่</th>
                                              <th className="px-3 py-1 text-left">ผู้บันทึก</th>
                                              <th className="px-3 py-1 text-right">ค่า Ads</th>
                                              <th className="px-3 py-1 text-right">Imp.</th>
                                              <th className="px-3 py-1 text-right">Reach</th>
                                              <th className="px-3 py-1 text-right">Clicks</th>
                                              {(currentUser.role === "Super Admin" || currentUser.role === "Admin Control") && (
                                                <th className="px-3 py-1 text-center">จัดการ</th>
                                              )}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {groupLogs.map(log => {
                                              const d = log.date || log.log_date || "";
                                              return (
                                                <tr key={log.id} className="border-b border-gray-100 bg-white">
                                                  <td className="px-3 py-1">{d}</td>
                                                  <td className="px-3 py-1 text-gray-600">{log.user_fullname || log.user_username || "-"}</td>
                                                  <td className="px-3 py-1 text-right">฿{Number(log.ads_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                  <td className="px-3 py-1 text-right">{Number(log.impressions).toLocaleString()}</td>
                                                  <td className="px-3 py-1 text-right">{Number(log.reach).toLocaleString()}</td>
                                                  <td className="px-3 py-1 text-right">{Number(log.clicks).toLocaleString()}</td>
                                                  {(currentUser.role === "Super Admin" || currentUser.role === "Admin Control") && (
                                                    <td className="px-3 py-1 text-center">
                                                      <button
                                                        className="p-1 hover:bg-gray-200 rounded"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setEditingLog({ ...log });
                                                          setIsEditModalOpen(true);
                                                        }}
                                                      >
                                                        <Pencil className="w-3 h-3" />
                                                      </button>
                                                    </td>
                                                  )}
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          }) : (
                            <tr><td colSpan={7} className="text-center py-8 text-gray-500">ไม่พบข้อมูล</td></tr>
                          )}
                        </tbody>
                      </table>
                    );
                  })()}

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
              )
            ) : (
              // Product Ads History
              productAdsLogsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className="mt-2 text-gray-600">กำลังโหลดประวัติสินค้า...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Group by Product */}
                  {(() => {
                    const groupedByProduct: Record<string, any[]> = {};
                    productAdsLogs.forEach(log => {
                      const key = log.product_id;
                      if (!groupedByProduct[key]) groupedByProduct[key] = [];
                      groupedByProduct[key].push(log);
                    });
                    const prodKeys = Object.keys(groupedByProduct);

                    return (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                          <tr>
                            <th className="px-3 py-2 text-left w-8"></th>
                            <th className="px-3 py-2 text-left">สินค้า (SKU)</th>
                            <th className="px-3 py-2 text-right">จำนวนรายการ</th>
                            <th className="px-3 py-2 text-right">รวมค่า Ads</th>
                            <th className="px-3 py-2 text-right">รวม Imp.</th>
                            <th className="px-3 py-2 text-right">รวม Reach</th>
                            <th className="px-3 py-2 text-right">รวม Clicks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prodKeys.length > 0 ? (
                            prodKeys.map((pId) => {
                              const groupLogs = groupedByProduct[pId];
                              const firstLog = groupLogs[0];
                              const isExpanded = historyExpanded.has('prod-' + pId);
                              // toggleProductExpand uses number.
                              // I should probably separate expand states or use strings 'p-1', 'pr-1'.
                              // For now I will assume toggleProductExpand works with numbers and I will map product IDs to unique numbers if needed, OR better, change toggleProductExpand to use strings?
                              // Existing toggleProductExpand (I need to check definition) is for "Manage Users - Add User to Product".
                              // I should CREATE A NEW expand state for HISTORY.

                              const totalCost = groupLogs.reduce((acc, l) => acc + Number(l.ads_cost || 0), 0);
                              const totalImp = groupLogs.reduce((acc, l) => acc + Number(l.impressions || 0), 0);
                              const totalReach = groupLogs.reduce((acc, l) => acc + Number(l.reach || 0), 0);
                              const totalClicks = groupLogs.reduce((acc, l) => acc + Number(l.clicks || 0), 0);

                              // Use negative IDs for product history expansion to differentiating from page history?
                              // Or just use a new function.

                              return (
                                <React.Fragment key={pId}>
                                  <tr className="bg-white border-b hover:bg-gray-50 cursor-pointer" onClick={() => toggleHistoryExpand('prod-' + pId)}>
                                    <td className="px-3 py-2 text-center">
                                      {historyExpanded.has('prod-' + pId) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="font-medium">{firstLog.product_sku}</div>
                                      <div className="text-xs text-gray-500">{firstLog.product_name}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-500">{groupLogs.length}</td>
                                    <td className="px-3 py-2 text-right font-medium">฿{totalCost.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right">{totalImp.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right">{totalReach.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right">{totalClicks.toLocaleString()}</td>
                                  </tr>
                                  {historyExpanded.has('prod-' + pId) && (
                                    <tr>
                                      <td colSpan={7} className="p-0">
                                        <div className="bg-gray-50 p-2 pl-8 border-b shadow-inner">
                                          <table className="w-full text-xs">
                                            <thead className="bg-gray-100 text-gray-500">
                                              <tr>
                                                <th className="px-3 py-1 text-left">วันที่</th>
                                                <th className="px-3 py-1 text-left">เพจ</th>
                                                <th className="px-3 py-1 text-left">ผู้บันทึก</th>
                                                <th className="px-3 py-1 text-right">ค่า Ads</th>
                                                <th className="px-3 py-1 text-right">Imp.</th>
                                                <th className="px-3 py-1 text-right">Reach</th>
                                                <th className="px-3 py-1 text-right">Clicks</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {groupLogs.map(l => (
                                                <tr key={l.id} className="border-b border-gray-100 bg-white">
                                                  <td className="px-3 py-1">{l.date}</td>
                                                  <td className="px-3 py-1">{l.page_name}</td>
                                                  <td className="px-3 py-1 text-gray-600">{l.user_fullname}</td>
                                                  <td className="px-3 py-1 text-right">฿{Number(l.ads_cost).toLocaleString()}</td>
                                                  <td className="px-3 py-1 text-right">{Number(l.impressions).toLocaleString()}</td>
                                                  <td className="px-3 py-1 text-right">{Number(l.reach).toLocaleString()}</td>
                                                  <td className="px-3 py-1 text-right">{Number(l.clicks).toLocaleString()}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-8 text-gray-500">
                                ไม่พบข้อมูลประวัติ Ads สินค้า
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    );
                  })()}
                  {productAdsLogs.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const start = (productAdsHistoryPage - 1) * productAdsHistoryPageSize + 1;
                          const end = Math.min(start + productAdsHistoryPageSize - 1, productAdsLogsTotal);
                          return `แสดง ${start}-${end} จาก ${productAdsLogsTotal} รายการ`;
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                          onClick={() => setProductAdsHistoryPage(p => Math.max(1, p - 1))}
                          disabled={!productAdsHistoryServerPagination.hasPrevious}
                        >
                          ก่อนหน้า
                        </button>
                        <span className="text-sm text-gray-700">
                          หน้า {productAdsHistoryPage} / {productAdsHistoryServerPagination.totalPages}
                        </span>
                        <button
                          className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                          onClick={() => setProductAdsHistoryPage(p => Math.min(productAdsHistoryServerPagination.totalPages, p + 1))}
                          disabled={!productAdsHistoryServerPagination.hasMore}
                        >
                          ถัดไป
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </section>
        )
      }

      {/* Add User Modal */}
      {
        selectedPageForUser && (
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
        )
      }

      {/* Add User to Product Modal */}
      {
        selectedProductForUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">เพิ่มผู้ใช้ไปยังสินค้า: {selectedProductForUser.name}</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {marketingUsersList.map((user) => {
                  const isAlreadyAssigned = marketingUserProducts.some(
                    m => m.user_id === user.id && m.product_id === selectedProductForUser.id
                  );

                  if (isAlreadyAssigned) return null;

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSubmitUserToProduct(user.id)}
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
                  );
                })}
                {marketingUsersList.every(user => marketingUserProducts.some(m => m.user_id === user.id && m.product_id === selectedProductForUser.id)) && (
                  <div className="text-gray-500 text-center py-4">ผู้ใช้ทุกคนได้รับสิทธิ์แล้ว</div>
                )}
              </div>
              <button
                onClick={() => setSelectedProductForUser(null)}
                className="mt-4 w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )
      }

      {/* Edit Ads Log Modal */}
      {
        isEditModalOpen && editingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 overflow-hidden">
              <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-800">
                  แก้ไขข้อมูล Ads
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      วันที่
                    </label>
                    <input
                      type="text"
                      value={editingLog.date || ""}
                      disabled
                      className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      เพจ
                    </label>
                    <input
                      type="text"
                      value={
                        editingLog.page_name ||
                        pages.find(
                          (p) => p.id === Number(editingLog.page_id),
                        )?.name ||
                        editingLog.page_id
                      }
                      disabled
                      className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ค่า Ads (บาท)
                  </label>
                  <input
                    type="number"
                    value={editingLog.ads_cost}
                    onChange={(e) =>
                      setEditingLog({
                        ...editingLog,
                        ads_cost: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Impressions
                    </label>
                    <input
                      type="number"
                      value={editingLog.impressions}
                      onChange={(e) =>
                        setEditingLog({
                          ...editingLog,
                          impressions: e.target.value,
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Reach
                    </label>
                    <input
                      type="number"
                      value={editingLog.reach}
                      onChange={(e) =>
                        setEditingLog({
                          ...editingLog,
                          reach: e.target.value,
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Clicks
                    </label>
                    <input
                      type="number"
                      value={editingLog.clicks}
                      onChange={(e) =>
                        setEditingLog({
                          ...editingLog,
                          clicks: e.target.value,
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleEditLogSave(editingLog)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );


};

export default MarketingPage;
