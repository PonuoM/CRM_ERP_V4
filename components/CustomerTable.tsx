import React, { useState, useMemo, useRef, useEffect } from "react";
import { Customer, ModalType, Tag, TagType } from "../types";
import { Eye, PhoneCall, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { getRemainingTimeRounded } from "@/utils/time";

interface CustomerTableProps {
  customers: Customer[];
  onViewCustomer: (customer: Customer) => void;
  openModal?: (type: ModalType, data: Customer) => void;
  pageSizeOptions?: number[];
  showCallNotes?: boolean;
  hideGrade?: boolean;
}

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

const CustomerTable: React.FC<CustomerTableProps> = (props) => {
  const {
    customers,
    onViewCustomer,
    openModal,
    pageSizeOptions = [5, 10, 20, 50],
    showCallNotes = false,
    hideGrade = false,
  } = props;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(pageSizeOptions[0] ?? 10);

  // Calculate pagination
  const totalItems = customers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = customers.slice(startIndex, endIndex);

  // Reset to first page when customers change
  useEffect(() => {
    setCurrentPage(1);
  }, [customers]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const TagColumn: React.FC<{ customer: Customer }> = ({ customer }) => {
    const visibleTags = customer.tags.slice(0, 2);
    const hiddenCount = customer.tags.length - visibleTags.length;

    return (
      <div className="flex items-center flex-wrap gap-1">
        {visibleTags.map((tag) => (
          <span
            key={tag.id}
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${tag.type === TagType.System ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}
          >
            {tag.name}
          </span>
        ))}
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
              currentCustomers.map((customer) => {
                const remainingTime = getRemainingTimeRounded(
                  customer.ownershipExpires,
                );
                return (
                  <tr
                    key={customer.id}
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
                className={`px-3 py-1 text-sm rounded ${
                  page === currentPage
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
    </div>
  );
};

export default CustomerTable;
