import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface UserOption {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
}

interface MultiSelectUserFilterProps {
  users: UserOption[];
  selectedUsers: number[];
  onChange: (selectedUsers: number[]) => void;
}

const MultiSelectUserFilter: React.FC<MultiSelectUserFilterProps> = ({
  users,
  selectedUsers,
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

  const filteredUsers = users.filter(
    (user) =>
      (user.firstName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.lastName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.username || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleToggleUser = (userId: number) => {
    if (selectedUsers.includes(userId)) {
      onChange(selectedUsers.filter((id) => id !== userId));
    } else {
      onChange([...selectedUsers, userId]);
    }
  };

  const handleSelectAll = () => {
    const allUserIds = users.map((user) => user.id);
    onChange(allUserIds);
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
          {selectedUsers.length === 0
            ? "เลือกผู้ใช้..."
            : `เลือก ${selectedUsers.length} ผู้ใช้`}
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
              placeholder="ค้นหาผู้ใช้..."
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
            {filteredUsers.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                ไม่พบผู้ใช้ที่ค้นหา
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUsers.includes(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => handleToggleUser(user.id)}
                    className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded transition-colors"
                  >
                    {/* Checkbox */}
                    <div className="relative mr-3">
                      <div
                        className={`w-4 h-4 border rounded transition-colors ${isSelected
                            ? "bg-blue-500 border-blue-500"
                            : "bg-white border-gray-300 hover:border-gray-400"
                          }`}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5" />
                        )}
                      </div>
                    </div>

                    {/* User info */}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">
                        @{user.username}
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
                {selectedUsers.length}
              </span>{" "}
              จาก{" "}
              <span className="font-semibold text-gray-900">
                {users.length}
              </span>{" "}
              ผู้ใช้
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectUserFilter;
