import React, { useState, useMemo, useRef, useEffect } from "react";
import { Customer, ModalType, Tag, TagType, User, UserRole } from "../types";
import { Eye, PhoneCall, Plus, ChevronLeft, ChevronRight, ShoppingCart, UserCog } from "lucide-react";
import { getRemainingTimeRounded } from "@/utils/time";
import usePersistentState from "@/utils/usePersistentState";


interface CustomerTableProps {
  customers: Customer[];
  onViewCustomer: (customer: Customer) => void;
  openModal?: (type: ModalType, data: Customer) => void;
  pageSizeOptions?: number[];
  showCallNotes?: boolean;
  hideGrade?: boolean;
  storageKey?: string;
  onUpsellClick?: (customer: Customer) => void;
  currentUserId?: number;
  onChangeOwner?: (customerId: string, newOwnerId: number) => Promise<void> | void;
  allUsers?: User[];
  currentUser?: User;
  // External Pagination Support
  totalCount?: number;
  controlledPage?: number;
  controlledPageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const NOOP_STORAGE: Storage = {
  get length() {
    return 0;
  },
  clear: () => { },
  getItem: () => null,
  key: () => null,
  removeItem: () => { },
  setItem: () => { },
};

const lifecycleLabel = (code: string) =>
  (
    ({
      New: "ลูกค้าใหม่",
      Old: "ลูกค้าเก่า",
      FollowUp: "ลูกค้าติดตาม",
      Old3Months: "ลูกค้าเก่า 3 เดือน",
      DailyDistribution: "ลูกค้าแจกรายวัน",
    }) as any
  )[code] || code;

const statusColorMap: { [key: string]: string } = {
  New: "bg-blue-100 text-blue-800",
  Old: "bg-gray-100 text-gray-800",
  FollowUp: "bg-yellow-100 text-yellow-800",
  Old3Months: "bg-green-100 text-green-800",
  DailyDistribution: "bg-purple-100 text-purple-800",
};

// Helper function to get contrasting text color (black or white)
const getContrastColor = (hexColor: string): string => {
  // Remove # if present
  const color = hexColor.replace('#', '');
  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  // Calculate brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  // Return black or white based on brightness
  return brightness > 128 ? '#000000' : '#FFFFFF';
};

const CustomerTable: React.FC<CustomerTableProps> = (props) => {
  const {
    customers,
    onViewCustomer,
    openModal,
    pageSizeOptions = [5, 10, 20, 50, 100, 500],
    showCallNotes = false,
    hideGrade = false,
    storageKey,
    onUpsellClick,
    currentUserId,
    onChangeOwner,
    allUsers = [],
    currentUser,

    totalCount,
    controlledPage,
    controlledPageSize,
    onPageChange,
    onPageSizeChange,
  } = props;

  const isExternal = typeof totalCount === 'number';

  const [showChangeOwnerModal, setShowChangeOwnerModal] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);

  const defaultItemsPerPage = pageSizeOptions[0] ?? 10;
  const persistenceBaseKey = storageKey
    ? `customerTable:${storageKey}`
    : null;

  const [internalItemsPerPage, setInternalItemsPerPage] = usePersistentState<number>(
    persistenceBaseKey ? `${persistenceBaseKey}:perPage` : "__customer_table:perPage",
    defaultItemsPerPage,
    { storage: persistenceBaseKey ? undefined : NOOP_STORAGE },
  );
  const [internalPage, setInternalPage] = usePersistentState<number>(
    persistenceBaseKey ? `${persistenceBaseKey}:page` : "__customer_table:page",
    1,
    { storage: persistenceBaseKey ? undefined : NOOP_STORAGE },
  );

  const itemsPerPage = (isExternal && controlledPageSize) ? controlledPageSize : internalItemsPerPage;
  const currentPage = (isExternal && controlledPage) ? controlledPage : internalPage;

  // Calculate pagination
  const safeItemsPerPage =
    itemsPerPage && itemsPerPage > 0 ? itemsPerPage : defaultItemsPerPage;

  const totalItems = isExternal ? (totalCount ?? 0) : customers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));

  // For internal: clamp page. For external: trust prop? Or clamp?
  // Use effectivePage for rendering but currentPage for highlighting
  const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);

  const startIndex = (effectivePage - 1) * safeItemsPerPage;
  const endIndex = startIndex + safeItemsPerPage;

  // If external, customers IS the current page. If internal, slice it.
  const currentCustomers = isExternal ? customers : customers.slice(startIndex, endIndex);

  useEffect(() => {
    if (!isExternal) {
      if (!pageSizeOptions.includes(itemsPerPage)) {
        const fallback = pageSizeOptions[0] ?? defaultItemsPerPage;
        setInternalItemsPerPage(fallback);
        setInternalPage(1);
      }
    }
  }, [itemsPerPage, pageSizeOptions, defaultItemsPerPage, setInternalItemsPerPage, setInternalPage, isExternal]);

  useEffect(() => {
    if (!isExternal) {
      setInternalPage((prev) => {
        const maxPage = Math.max(
          1,
          Math.ceil(customers.length / safeItemsPerPage),
        );
        if (!Number.isFinite(prev) || prev < 1) return 1;
        return prev > maxPage ? maxPage : prev;
      });
    }
  }, [customers.length, safeItemsPerPage, setInternalPage, isExternal]);

  const handlePageChange = (page: number) => {
    const maxPage = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
    const nextPage = Math.min(Math.max(page, 1), maxPage);
    if (isExternal && onPageChange) {
      onPageChange(nextPage);
    } else {
      setInternalPage(nextPage);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    if (isExternal && onPageSizeChange) {
      onPageSizeChange(newItemsPerPage);
      // Parent should reset page to 1
    } else {
      setInternalItemsPerPage(newItemsPerPage);
      setInternalPage(1);
    }
  };

  // Get eligible owners for a customer based on current user role
  const getEligibleOwners = (customer: Customer): User[] => {
    if (!currentUser || !allUsers || allUsers.length === 0) return [];

    // SuperAdmin can see everyone
    if (currentUser.role === UserRole.SuperAdmin) {
      return allUsers;
    }

    // Base: Always same company for others
    const sameCompanyUsers = allUsers.filter(
      (candidate) => candidate.companyId === currentUser.companyId
    );

    // 1. Telesale: Can only transfer to their OWN Supervisor
    if (currentUser.role === UserRole.Telesale) {
      return sameCompanyUsers.filter(
        (candidate) => candidate.id === currentUser.supervisorId
      );
    }

    // 2. Supervisor (Super Telesale): 
    //    - Other Supervisors in same company (candidate.role === Supervisor)
    //    - Their own team members (candidate.supervisorId === currentUser.id)
    if (currentUser.role === UserRole.Supervisor) {
      return sameCompanyUsers.filter((candidate) => {
        // Exclude self
        if (candidate.id === currentUser.id) return false;

        // Logic: Target is Supervisor (same company) OR Target is my subordinate
        const isSameCompanySupervisor = candidate.role === UserRole.Supervisor;
        const isMySubordinate = candidate.supervisorId === currentUser.id;

        return isSameCompanySupervisor || isMySubordinate;
      });
    }

    // 3. Other roles (Admin, etc) -> See everyone in company
    return sameCompanyUsers;
  };

  // Filter to only show Supervisor and Telesale roles
  const getFilteredEligibleOwners = (customer: Customer): User[] => {
    const eligibleOwners = getEligibleOwners(customer);
    return eligibleOwners.filter(
      (candidate) =>
        candidate.id !== currentUser?.id &&
        (candidate.role === UserRole.Supervisor ||
          candidate.role === UserRole.Telesale),
    );
  };

  const handleChangeOwnerClick = (customer: Customer) => {
    const eligibleOwners = getFilteredEligibleOwners(customer);
    if (eligibleOwners.length > 0) {
      setShowChangeOwnerModal(customer.id);
      setSelectedOwnerId(eligibleOwners[0].id);
    }
  };

  const handleConfirmChangeOwner = async () => {
    if (!showChangeOwnerModal || !selectedOwnerId || !onChangeOwner) return;

    try {
      await onChangeOwner(showChangeOwnerModal, selectedOwnerId);
      setShowChangeOwnerModal(null);
      setSelectedOwnerId(null);
    } catch (error) {
      console.error('Failed to change owner:', error);
    }
  };

  const TagColumn: React.FC<{ customer: Customer }> = ({ customer }) => {
    // Optimization: Use the pre-fetched isUpsellEligible flag from the API
    // instead of making a separate API call for each row.
    const showUpsellTag = customer.isUpsellEligible === true;

    const visibleTags = customer.tags.slice(0, 2);
    const hiddenCount = customer.tags.length - visibleTags.length;

    return (
      <div className="flex items-center flex-wrap gap-1">
        {showUpsellTag && (
          <button
            onClick={() => onUpsellClick && onUpsellClick(customer)}
            className="relative text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 animate-pulse hover:animate-none flex items-center gap-1"
            title="คลิกเพื่อเพิ่มรายการในออเดอร์เดิม (Upsell)"
          >
            <ShoppingCart size={12} className="animate-bounce" />
            <span>UPSELL</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full"></span>
          </button>
        )}
        {visibleTags.map((tag) => {
          const tagColor = tag.color || '#9333EA';
          const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
          const textColor = getContrastColor(bgColor);
          return (
            <span
              key={tag.id}
              className="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: bgColor, color: textColor }}
            >
              {tag.name}
            </span>
          );
        })}
        {hiddenCount > 0 && (
          <div className="group relative">
            <span className="bg-gray-200 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer">
              +{hiddenCount}
            </span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 p-2 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {customer.tags
                .slice(2)
                .map((t) => t.name)
                .join(", ")}
            </div>
          </div>
        )}
        <button
          title="จัดการ TAG"
          onClick={() => openModal && openModal("manageTags", customer)}
          className="p-1 rounded-full hover:bg-gray-200 text-gray-500"
        >
          <Plus size={14} />
        </button>
      </div>
    );
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // Compute dynamic column count for empty state colSpan
  const hasDoReason = customers.some((c) => c.doReason);
  const baseColumns = 5; // assigned date, name, province, ownership remaining, status
  const dynamicColumns =
    (showCallNotes ? 1 : !hideGrade ? 1 : 0) + (hasDoReason ? 1 : 0);
  const trailingColumns = 2; // TAG, actions
  const totalColumns = baseColumns + dynamicColumns + trailingColumns;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3">
                วันที่ได้รับ
              </th>
              <th scope="col" className="px-6 py-3">
                ลูกค้า
              </th>
              <th scope="col" className="px-6 py-3">
                จังหวัด
              </th>
              <th scope="col" className="px-6 py-3">
                เวลาที่เหลือ
              </th>
              <th scope="col" className="px-6 py-3">
                สถานะ
              </th>
              {showCallNotes && (
                <th scope="col" className="px-6 py-3">
                  หมายเหตุการโทร
                </th>
              )}
              {!showCallNotes && !hideGrade && (
                <th scope="col" className="px-6 py-3">
                  เกรด
                </th>
              )}
              {hasDoReason && (
                <th scope="col" className="px-6 py-3 min-w-[250px]">
                  เหตุผล Do
                </th>
              )}
              <th scope="col" className="px-6 py-3 min-w-[200px]">
                TAG
              </th>
              <th scope="col" className="px-6 py-3">
                การจัดการ
              </th>
            </tr>
          </thead>
          <tbody>
            {currentCustomers.length > 0 ? (
              currentCustomers.map((customer, index) => {
                const remainingTime = getRemainingTimeRounded(
                  customer.ownershipExpires,
                );
                const eligibleOwners = getFilteredEligibleOwners(customer);
                const canChangeOwner = onChangeOwner && eligibleOwners.length > 0;

                return (
                  <tr
                    key={
                      customer.id ||
                      customer.customerId ||
                      customer.customerRefId ||
                      `${customer.phone}-${index}`
                    }
                    className="bg-white border-b hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      {new Date(customer.dateAssigned).toLocaleDateString(
                        "th-TH",
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 whitespace-nowrap">
                          {customer.firstName} {customer.lastName}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          {customer.phone}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{customer.province}</td>
                    <td className={`px-6 py-4 ${remainingTime.color}`}>
                      {remainingTime.text}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColorMap[customer.lifecycleStatus] || "bg-gray-100 text-gray-800"}`}
                      >
                        {lifecycleLabel(customer.lifecycleStatus)}
                      </span>
                    </td>
                    {showCallNotes && (
                      <td
                        className="px-6 py-4 text-gray-700 max-w-[300px] truncate"
                        title={customer.lastCallNote || ""}
                      >
                        {customer.lastCallNote || "-"}
                      </td>
                    )}
                    {!showCallNotes && !hideGrade && (
                      <td className="px-6 py-4 font-semibold text-gray-700">
                        {customer.grade}
                      </td>
                    )}
                    {hasDoReason && (
                      <td className="px-6 py-4">
                        {customer.doReason && (
                          <span className="text-xs text-gray-700">
                            {customer.doReason}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <TagColumn customer={customer} />
                    </td>
                    <td className="px-6 py-4 flex items-center space-x-2">
                      <button
                        title="ข้อมูลลูกค้า"
                        onClick={() => onViewCustomer(customer)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        title="โทร/บันทึกการโทร"
                        onClick={() =>
                          openModal && openModal("logCall", customer)
                        }
                        className="p-2 text-green-600 hover:bg-green-100 rounded-full"
                      >
                        <PhoneCall size={16} />
                      </button>
                      {canChangeOwner && (
                        <button
                          title="เปลี่ยนผู้ดูแล"
                          onClick={() => handleChangeOwnerClick(customer)}
                          className="p-2 text-purple-600 hover:bg-purple-100 rounded-full"
                        >
                          <UserCog size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={totalColumns}
                  className="text-center py-10 text-gray-500"
                >
                  ไม่มีข้อมูลลูกค้า
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
        {/* Left side - Showing info */}
        <div className="flex items-center text-sm text-gray-700">
          <span>
            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
            {totalItems} entries
          </span>
        </div>

        {/* Right side - Pagination controls */}
        <div className="flex items-center space-x-2">
          {/* Items per page selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Lines per page</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          {/* Page navigation */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>

            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() =>
                  typeof page === "number" ? handlePageChange(page) : undefined
                }
                disabled={page === "..."}
                className={`px-3 py-1 text-sm rounded ${page === currentPage
                  ? "bg-blue-600 text-white"
                  : page === "..."
                    ? "text-gray-400 cursor-default"
                    : "text-gray-700 hover:bg-gray-100"
                  }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Change Owner Modal */}
      {showChangeOwnerModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                เปลี่ยนผู้ดูแลลูกค้า
              </h3>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เลือกผู้ดูแลใหม่
              </label>
              <select
                value={selectedOwnerId || ''}
                onChange={(e) => setSelectedOwnerId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {getFilteredEligibleOwners(
                  customers.find(c => c.id === showChangeOwnerModal)!
                ).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowChangeOwnerModal(null);
                  setSelectedOwnerId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmChangeOwner}
                disabled={!selectedOwnerId}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerTable;
