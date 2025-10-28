import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface PageOption {
  id: number;
  name: string;
  platform: string;
}

interface MultiSelectPageFilterProps {
  pages: PageOption[];
  selectedPages: number[];
  onChange: (selectedPages: number[]) => void;
}

const MultiSelectPageFilter: React.FC<MultiSelectPageFilterProps> = ({
  pages,
  selectedPages,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPages = pages.filter(
    (page) =>
      page.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.platform.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleTogglePage = (pageId: number) => {
    if (selectedPages.includes(pageId)) {
      onChange(selectedPages.filter((id) => id !== pageId));
    } else {
      onChange([...selectedPages, pageId]);
    }
  };

  const handleSelectAll = () => {
    const allPageIds = pages.map((page) => page.id);
    onChange(allPageIds);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main button */}
      <button
        onClick={toggleDropdown}
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
      >
        <span className="text-gray-900">
          {selectedPages.length === 0
            ? "เลือกเพจ..."
            : `เลือก ${selectedPages.length} เพจ`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="ค้นหาเพจ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Quick actions */}
          <div className="p-2 border-b border-gray-200 flex gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
            >
              เคลียร์ทั้งหมด
            </button>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto p-2">
            {filteredPages.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                ไม่พบเพจที่ค้นหา
              </div>
            ) : (
              filteredPages.map((page) => {
                const isSelected = selectedPages.includes(page.id);
                return (
                  <div
                    key={page.id}
                    onClick={() => handleTogglePage(page.id)}
                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded transition-colors"
                  >
                    {/* Checkbox */}
                    <div className="relative mr-3">
                      <div
                        className={`w-4 h-4 border rounded transition-colors ${
                          isSelected
                            ? "bg-blue-500 border-blue-500"
                            : "bg-white border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Page info */}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">
                        {page.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {page.platform}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with selected count */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              เลือกแล้ว{" "}
              <span className="font-semibold text-gray-900">
                {selectedPages.length}
              </span>{" "}
              จาก{" "}
              <span className="font-semibold text-gray-900">
                {pages.length}
              </span>{" "}
              เพจ
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectPageFilter;
