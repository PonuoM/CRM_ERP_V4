import React, { useEffect, useMemo, useState } from "react";
import { Page, User } from "@/types";
import Modal from "@/components/Modal";
import { createPage, updatePage, listPages } from "@/services/api";
import PageIconFront from "@/components/PageIconFront";

// Function to sync pages from pages.fm API to database
const syncPagesWithDatabase = async (currentUser?: User) => {
  try {
    // Get access token from database env table using existing env_manager.php
    let accessToken = "";

    if (currentUser?.companyId) {
      try {
        const response = await fetch(
          `api/Page_DB/env_manager.php?key=ACCESS_TOKEN_PANCAKE_${currentUser.companyId}`,
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          accessToken = data.value || "";
        }
      } catch (error) {
        console.error("Failed to get access token from database:", error);
      }
    }

    if (!accessToken) {
      console.error(
        "ACCESS_TOKEN not found in database for company:",
        currentUser?.companyId,
      );
      return { success: false, error: "ACCESS_TOKEN not found" };
    }

    // Build URL with access_token parameter
    const url = new URL("https://pages.fm/api/v1/pages");
    url.searchParams.append("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Pages.fm API Response:", data);

    // Sync data with database if we have categorized pages
    if (data && data.categorized && currentUser) {
      try {
        // Combine activated and inactivated pages
        const allPages = [
          ...(data.categorized.activated || []),
          ...(data.categorized.inactivated || []),
        ];

        // Prepare pages data for sync
        const pagesToSync = allPages.map((page: any) => {
          // Count users for this page
          const userCount =
            page.users && Array.isArray(page.users) ? page.users.length : 0;

          return {
            id: page.id,
            name: page.name,
            platform: page.platform,
            is_activated: page.is_activated,
            category: page.is_activated ? "activated" : "inactivated",
            user_count: userCount,
            users: page.users || [], // Store users array for display
            page_type: "pancake", // Set page_type to 'pancake' for pages.fm sync
          };
        });

        // Sync with database using the new endpoint
        console.log("Preparing to sync pages:", pagesToSync.length, "pages");
        console.log("Company ID:", currentUser.companyId || 1);

        const response = await fetch("api/Page_DB/sync_pages.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pages: pagesToSync,
            companyId: currentUser.companyId || 1,
          }),
        });

        console.log("Sync response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Sync response error:", errorText);
          throw new Error(
            `HTTP error! status: ${response.status}, response: ${errorText}`,
          );
        }

        const result = await response.json();
        console.log("Sync response result:", result);

        // Debug: Log error details if they exist
        if (result.errorDetails && result.errorDetails.length > 0) {
          console.log("Error details:", result.errorDetails);
        } else {
          console.log("No error details found in response");
        }

        if (!result.ok) {
          throw new Error(result.error || "Database sync failed");
        }

        console.log(
          `Pages synced with database successfully. Total: ${result.synced}, Inserted: ${result.inserted}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
        );

        // Now sync page users to the page_user table
        try {
          console.log("Starting to sync page users...");
          const pageUsersResponse = await fetch(
            "api/Page_DB/sync_page_users.php",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                pages: pagesToSync,
                companyId: currentUser.companyId || 1,
              }),
            },
          );

          console.log(
            "Page users sync response status:",
            pageUsersResponse.status,
          );

          if (!pageUsersResponse.ok) {
            const errorText = await pageUsersResponse.text();
            console.error("Page users sync response error:", errorText);
            throw new Error(
              `HTTP error! status: ${pageUsersResponse.status}, response: ${errorText}`,
            );
          }

          const pageUsersResult = await pageUsersResponse.json();
          console.log("Page users sync response result:", pageUsersResult);

          if (!pageUsersResult.ok) {
            throw new Error(pageUsersResult.error || "Page users sync failed");
          }

          console.log(
            `Page users synced successfully. Deleted: ${pageUsersResult.deleted}, Inserted: ${pageUsersResult.inserted}, Updated: ${pageUsersResult.updated}, Skipped: ${pageUsersResult.skipped}, Errors: ${pageUsersResult.errors}`,
          );

          // Now sync page list user relationships
          try {
            console.log("Starting to sync page list user relationships...");
            const pageListUserResponse = await fetch(
              "api/Page_DB/sync_page_list_user.php",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  pages: pagesToSync,
                  companyId: currentUser.companyId || 1,
                }),
              },
            );

            console.log(
              "Page list user sync response status:",
              pageListUserResponse.status,
            );

            if (!pageListUserResponse.ok) {
              const errorText = await pageListUserResponse.text();
              console.error("Page list user sync response error:", errorText);
              throw new Error(
                `HTTP error! status: ${pageListUserResponse.status}, response: ${errorText}`,
              );
            }

            const pageListUserResult = await pageListUserResponse.json();
            console.log(
              "Page list user sync response result:",
              pageListUserResult,
            );

            if (!pageListUserResult.ok) {
              throw new Error(
                pageListUserResult.error || "Page list user sync failed",
              );
            }

            console.log(
              `Page list user relationships synced successfully. Deleted: ${pageListUserResult.deleted}, Inserted: ${pageListUserResult.inserted}, Skipped: ${pageListUserResult.skipped}, Errors: ${pageListUserResult.errors}`,
            );

            return {
              success: true,
              count: pagesToSync.length,
              inserted: result.inserted,
              updated: result.updated,
              skipped: result.skipped,
              errors: result.errors,
              pages: pagesToSync,
              errorDetails: result.errorDetails,
              pageUsers: {
                deleted: pageUsersResult.deleted,
                inserted: pageUsersResult.inserted,
                updated: pageUsersResult.updated,
                skipped: pageUsersResult.skipped,
                errors: pageUsersResult.errors,
                errorDetails: pageUsersResult.errorDetails,
              },
              pageListUser: {
                inserted: pageListUserResult.inserted,
                updated: pageListUserResult.updated,
                removed: pageListUserResult.removed,
                skipped: pageListUserResult.skipped,
                errors: pageListUserResult.errors,
                total_relationships: pageListUserResult.total_relationships,
              },
            };
          } catch (pageListUserError) {
            console.error(
              "Error syncing page list user relationships:",
              pageListUserError,
            );
            // Still return success for pages sync, but include error info for page list user
            return {
              success: true,
              count: pagesToSync.length,
              inserted: result.inserted,
              updated: result.updated,
              skipped: result.skipped,
              errors: result.errors,
              pages: pagesToSync,
              errorDetails: result.errorDetails,
              pageUsers: {
                deleted: pageUsersResult.deleted,
                inserted: pageUsersResult.inserted,
                updated: pageUsersResult.updated,
                skipped: pageUsersResult.skipped,
                errors: pageUsersResult.errors,
                errorDetails: pageUsersResult.errorDetails,
              },
              pageListUserError: "Page list user sync failed",
            };
          }
        } catch (pageUsersError) {
          console.error(
            "Error syncing page users with database:",
            pageUsersError,
          );
          // Still return success for pages sync, but include error info for page users
          return {
            success: true,
            count: pagesToSync.length,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            pages: pagesToSync,
            errorDetails: result.errorDetails,
            pageUsersError: "Page users sync failed",
          };
        }
      } catch (syncError) {
        console.error("Error syncing pages with database:", syncError);
        return { success: false, error: "Database sync failed" };
      }
    }

    return { success: false, error: "No categorized data found" };
  } catch (error) {
    console.error("Error fetching pages from pages.fm API:", error);
    return { success: false, error: "API fetch failed" };
  }
};

interface PagesManagementPageProps {
  pages?: Page[];
  currentUser?: User;
}

const PagesManagementPage: React.FC<PagesManagementPageProps> = ({
  pages = [],
  currentUser,
}) => {
  const [keyword, setKeyword] = useState("");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageType, setPageType] = useState("all");
  const [items, setItems] = useState<Page[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [showHiddenPages, setShowHiddenPages] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add Page modal state
  const [addPageModalOpen, setAddPageModalOpen] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPagePlatform, setNewPagePlatform] = useState("facebook");
  const [newPageUrl, setNewPageUrl] = useState("");
  const [addPageLoading, setAddPageLoading] = useState(false);

  // Page types state
  const [pageTypes, setPageTypes] = useState<{ [key: string]: string }>({});
  const [loadingPageTypes, setLoadingPageTypes] = useState(false);

  // Fetch page types from env
  const fetchPageTypes = async () => {
    setLoadingPageTypes(true);
    try {
      const response = await fetch("api/Page_DB/env_manager.php");
      if (response.ok) {
        const envVars = await response.json();
        const types: { [key: string]: string } = {};

        // Extract page type keys and values (e.g., PAGE_TYPE_BUSINESS, PAGE_TYPE_PERSONAL, etc.)
        envVars.forEach((envVar: any) => {
          if (envVar.key && envVar.key.startsWith("PAGE_TYPE_")) {
            const typeKey = envVar.key.replace("PAGE_TYPE_", "");
            types[typeKey] = envVar.value || typeKey;
          }
        });

        setPageTypes(types);
      }
    } catch (error) {
      console.error("Error fetching page types:", error);
    } finally {
      setLoadingPageTypes(false);
    }
  };

  // PageTypeDisplay component
  const PageTypeDisplay: React.FC<{ pageType?: string | null }> = ({
    pageType,
  }) => {
    if (!pageType) {
      return <span className="text-gray-400">-</span>;
    }

    // If page_type is 'pancake', show 'Pancake'
    if (pageType === "pancake") {
      return (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
          Pancake
        </span>
      );
    }

    // For other types, try to find a display name from env
    const displayName = pageTypes[pageType] || pageType;

    // Set color based on type
    const getColorClass = (type: string) => {
      switch (type.toLowerCase()) {
        case "business":
          return "bg-purple-100 text-purple-700";
        case "personal":
          return "bg-green-100 text-green-700";
        case "fan":
          return "bg-yellow-100 text-yellow-700";
        case "shop":
          return "bg-orange-100 text-orange-700";
        default:
          return "bg-gray-100 text-gray-700";
      }
    };

    return (
      <span
        className={`px-2 py-1 text-xs rounded-full ${getColorClass(pageType)}`}
      >
        {displayName}
      </span>
    );
  };

  // Fetch pages from API
  const fetchPages = async () => {
    setLoading(true);
    try {
      // Fetch all pages (not filtered by company_id)
      const allPagesData = await listPages();
      setItems(allPagesData);
      console.log("Fetched all pages:", allPagesData);
      console.log(
        "Pages with still_in_list = 0:",
        allPagesData.filter((p) => p.still_in_list === 0),
      );
    } catch (error) {
      console.error("Error fetching pages:", error);
      // Use initial pages if API fails
      setItems(pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
    fetchPageTypes();
  }, [currentUser?.companyId]);

  // Filter pages based on still_in_list
  const hiddenPagesForCompany = useMemo(() => {
    const filtered = items.filter(
      (p) => p.company_id === currentUser?.companyId && p.still_in_list === 0,
    );
    console.log("Hidden pages:", filtered);
    return filtered;
  }, [items, currentUser?.companyId]);

  // Filter pages based on current user's company_id
  const pagesForCurrentCompany = useMemo(() => {
    const filteredByCompany = items.filter(
      (p) => p.company_id === currentUser?.companyId,
    );
    console.log(
      "All pages for company:",
      currentUser?.companyId,
      "count:",
      filteredByCompany.length,
    );
    return filteredByCompany;
  }, [items, currentUser?.companyId]);

  // Filter visible pages (still_in_list = 1) for current company
  const visiblePagesForCompany = useMemo(() => {
    return pagesForCurrentCompany.filter((p) => p.still_in_list !== 0);
  }, [pagesForCurrentCompany]);

  // Filter hidden pages (still_in_list = 0) for current company
  const hiddenPages = useMemo(() => {
    const filtered = items.filter(
      (p) => p.company_id === currentUser?.companyId && p.still_in_list === 0,
    );
    console.log("Hidden pages:", filtered);
    return filtered;
  }, [items, currentUser?.companyId]);

  const filtered = useMemo(() => {
    const k = keyword.toLowerCase();
    let filteredPages = visiblePagesForCompany.filter(
      (p) =>
        (!k || p.name.toLowerCase().includes(k)) &&
        (status === "all" || (status === "active" ? p.active : !p.active)) &&
        (pageType === "all" || p.page_type === pageType),
    );

    // Sort by active status (active pages first)
    filteredPages.sort((a, b) => {
      // If both have the same active status, sort by name
      if (a.active === b.active) {
        return a.name.localeCompare(b.name);
      }
      // Active pages (true) should come before inactive pages (false)
      return b.active ? 1 : -1;
    });

    return filteredPages;
  }, [pagesForCurrentCompany, keyword, status, pageType]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">เพจ</h2>

      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">คำค้น</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="ค้นหา"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ทีม</label>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">ทั้งหมด</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">สถานะ</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">ทั้งหมด</option>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              ประเภทเพจ
            </label>
            <select
              value={pageType}
              onChange={(e) => setPageType(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">ทั้งหมด</option>
              <option value="pancake">Pancake</option>
              <option value="manual">เพจที่เพิ่มเอง</option>
              {Object.entries(pageTypes).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
              onClick={() => setAddPageModalOpen(true)}
            >
              <span className="text-lg">+</span>
              เพิ่มเพจ
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
              onClick={async () => {
                if (!currentUser) {
                  alert("ไม่พบข้อมูลผู้ใช้");
                  return;
                }

                setSyncing(true);
                try {
                  const result = await syncPagesWithDatabase(currentUser);
                  setSyncResult(result);
                  if (result.success) {
                    let message = `อัปเดตข้อมูลสำเร็จ: ${result.count} เพจ (เพิ่ม ${result.inserted}, อัปเดต ${result.updated}, ข้าม ${result.skipped}, ข้อผิดพลาด ${result.errors})`;

                    // Add page users sync info if available
                    if (result.pageUsers) {
                      message += `\nผู้ใช้เพจ: ลบ ${result.pageUsers.deleted}, เพิ่ม ${result.pageUsers.inserted}, อัปเดต ${result.pageUsers.updated}, ข้าม ${result.pageUsers.skipped}, ข้อผิดพลาด ${result.pageUsers.errors}`;
                    } else if (result.pageUsersError) {
                      message += `\nคำเตือน: ${result.pageUsersError}`;
                    }

                    // Add page list user sync info if available
                    if (result.pageListUser) {
                      message += `\nความสัมพันธ์เพจ-ผู้ใช้: เพิ่ม ${result.pageListUser.inserted}, อัปเดต ${result.pageListUser.updated}, นำออก ${result.pageListUser.removed}, ข้าม ${result.pageListUser.skipped}, ข้อผิดพลาด ${result.pageListUser.errors} (ทั้งหมด ${result.pageListUser.total_relationships} ความสัมพันธ์)`;
                    } else if (result.pageListUserError) {
                      message += `\nคำเตือน: ${result.pageListUserError}`;
                    }

                    alert(message);
                    // Refresh pages data after sync
                    fetchPages();
                  } else {
                    alert(`อัปเดตข้อมูลล้มเหลว: ${result.error}`);
                  }
                } catch (error) {
                  console.error("Sync error:", error);
                  alert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing}
            >
              {syncing ? "กำลังอัปเดต..." : "อัปเดตข้อมูล"}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              จำนวนเพจที่แสดง:{" "}
              <span className="font-semibold text-gray-800">
                {visiblePagesForCompany.length}
              </span>{" "}
              เพจ
              {loading && (
                <span className="ml-2 text-blue-600">กำลังโหลด...</span>
              )}
              {hiddenPages.length > 0 && (
                <span className="ml-4">
                  (ซ่อนอยู่:{" "}
                  <span className="font-semibold text-red-600">
                    {hiddenPages.length}
                  </span>{" "}
                  เพจ)
                </span>
              )}
            </p>
            <div className="flex space-x-2">
              <button
                className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                onClick={() => fetchPages()}
                disabled={loading}
              >
                {loading ? "กำลังโหลด..." : "รีเฟรช"}
              </button>
              {hiddenPages.length > 0 && (
                <button
                  className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                  onClick={() => setShowHiddenPages(!showHiddenPages)}
                >
                  {showHiddenPages ? "ซ่อนเพจที่ถูกซ่อน" : "แสดงเพจที่ถูกซ่อน"}
                </button>
              )}
            </div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 px-3 font-medium">ชื่อเพจ</th>
              <th className="py-2 px-3 font-medium">ประเภทเพจ</th>
              <th className="py-2 px-3 font-medium">URL</th>
              <th className="py-2 px-3 font-medium">สถานะ</th>
              <th className="py-2 px-3 font-medium">ผู้ดูแล</th>
              <th className="py-2 px-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2 px-3 flex items-center gap-2">
                  <PageIconFront platform={p.platform || "unknown"} />
                  {p.name}
                </td>
                <td className="py-2 px-3">
                  <PageTypeDisplay pageType={p.page_type} />
                </td>
                <td className="py-2 px-3">
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {p.url}
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={
                      p.active
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {p.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </td>
                <td className="py-2 px-3">{p.user_count || 0} คน</td>
                <td className="py-2 px-3 text-right">
                  <ManagePageButton
                    page={p}
                    onSaved={(updatedPage) =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === updatedPage.id ? updatedPage : x,
                        ),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="border-t">
                <td colSpan={5} className="py-6 text-center text-gray-500">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Add Page Modal */}
        {addPageModalOpen && (
          <Modal
            title="เพิ่มเพจใหม่"
            onClose={() => setAddPageModalOpen(false)}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  ชื่อเพจ
                </label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="กรอกชื่อเพจ"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Platform
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newPagePlatform}
                  onChange={(e) => setNewPagePlatform(e.target.value)}
                >
                  <option value="facebook">Facebook</option>
                  <option value="line">LINE</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="website">Website</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">URL</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newPageUrl}
                  onChange={(e) => setNewPageUrl(e.target.value)}
                  placeholder="https://facebook.com/pagename"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                  onClick={() => setAddPageModalOpen(false)}
                  disabled={addPageLoading}
                >
                  ยกเลิก
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                  onClick={async () => {
                    if (!newPageName.trim()) {
                      alert("กรุณากรอกชื่อเพจ");
                      return;
                    }
                    if (!currentUser?.companyId) {
                      alert("ไม่พบข้อมูลบริษัท");
                      return;
                    }

                    setAddPageLoading(true);
                    try {
                      // Call the new insert_manual_page API
                      const response = await fetch(
                        "api/Marketing_DB/insert_manual_page.php",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            name: newPageName.trim(),
                            platform: newPagePlatform,
                            url: newPageUrl.trim() || null,
                            company_id: currentUser.companyId,
                          }),
                        },
                      );

                      const data = await response.json();

                      if (!response.ok || !data.success) {
                        throw new Error(data.error || "Failed to create page");
                      }

                      // Refresh pages list
                      fetchPages();

                      // Reset form and close modal
                      setNewPageName("");
                      setNewPagePlatform("facebook");
                      setNewPageUrl("");
                      setAddPageModalOpen(false);

                      alert("เพิ่มเพจสำเร็จ");
                    } catch (error) {
                      console.error("Error creating page:", error);
                      alert(
                        "เกิดข้อผิดพลาดในการเพิ่มเพจ: " +
                          (error instanceof Error
                            ? error.message
                            : "Unknown error"),
                      );
                    } finally {
                      setAddPageLoading(false);
                    }
                  }}
                  disabled={addPageLoading}
                >
                  {addPageLoading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Hidden Pages Section */}
        {showHiddenPages && hiddenPages.length > 0 && (
          <div className="border-t">
            <div className="p-4 bg-gray-50">
              <h3 className="text-md font-semibold text-gray-700 mb-3">
                เพจที่ถูกซ่อน ({hiddenPages.length} เพจ)
              </h3>
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-2 px-3 font-medium">ชื่อเพจ</th>
                    <th className="py-2 px-3 font-medium">ประเภทเพจ</th>
                    <th className="py-2 px-3 font-medium">URL</th>
                    <th className="py-2 px-3 font-medium">สถานะ</th>
                    <th className="py-2 px-3 font-medium">ผู้ดูแล</th>
                    <th className="py-2 px-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {hiddenPages.map((p) => (
                    <tr key={p.id} className="border-t opacity-60">
                      <td className="py-2 px-3 flex items-center gap-2">
                        <PageIconFront platform={p.platform || "facebook"} />
                        {p.name}
                      </td>
                      <td className="py-2 px-3">
                        <PageTypeDisplay pageType={p.page_type} />
                      </td>
                      <td className="py-2 px-3">
                        {p.url ? (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {p.url}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={
                            p.active
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {p.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </td>
                      <td className="py-2 px-3">{p.user_count || 0} คน</td>
                      <td className="py-2 px-3 text-right">
                        <ManagePageButton
                          page={p}
                          onSaved={(updatedPage) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === updatedPage.id ? updatedPage : x,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PagesManagementPage;

const ManagePageButton: React.FC<{
  page: Page;
  onSaved: (updatedPage: Page) => void;
}> = ({ page, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(page.name);
  const [url, setUrl] = useState(page.url || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePage(page.id, { name, url: url || undefined });
      onSaved({ ...page, name, url: url || undefined });
      setOpen(false);
    } catch (error) {
      console.error("Failed to update page:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        className="text-blue-600 hover:underline"
        onClick={() => setOpen(true)}
      >
        จัดการ
      </button>
      {open && (
        <Modal title={`จัดการเพจ: ${page.name}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อ</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 border rounded-md text-sm"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
