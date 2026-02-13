import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface MultiSelectAdsGroupFilterProps {
    adsGroups: string[];
    selectedAdsGroups: string[];
    onChange: (selectedAdsGroups: string[]) => void;
}

const MultiSelectAdsGroupFilter: React.FC<MultiSelectAdsGroupFilterProps> = ({
    adsGroups,
    selectedAdsGroups,
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

    const filteredGroups = adsGroups
        .filter((g) => g.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

    const handleToggle = (group: string) => {
        if (selectedAdsGroups.includes(group)) {
            onChange(selectedAdsGroups.filter((g) => g !== group));
        } else {
            onChange([...selectedAdsGroups, group]);
        }
    };

    const handleSelectAll = () => {
        onChange([...adsGroups]);
    };

    const handleClearAll = () => {
        onChange([]);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
            >
                <span className="text-gray-900">
                    {selectedAdsGroups.length === 0
                        ? "เลือก Ads Group..."
                        : selectedAdsGroups.length === adsGroups.length
                            ? "ทั้งหมด"
                            : `เลือก ${selectedAdsGroups.length} กลุ่ม`}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    <div className="p-3 border-b border-gray-200">
                        <input
                            type="text"
                            placeholder="ค้นหา Ads Group..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                    </div>

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

                    <div className="max-h-60 overflow-y-auto p-2">
                        {filteredGroups.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                                ไม่พบ Ads Group ที่ค้นหา
                            </div>
                        ) : (
                            filteredGroups.map((group) => {
                                const isSelected = selectedAdsGroups.includes(group);
                                return (
                                    <div
                                        key={group}
                                        onClick={() => handleToggle(group)}
                                        className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded transition-colors"
                                    >
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
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-gray-900">
                                                {group}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                        <div className="text-sm text-gray-600">
                            เลือกแล้ว{" "}
                            <span className="font-semibold text-gray-900">
                                {selectedAdsGroups.length}
                            </span>{" "}
                            จาก{" "}
                            <span className="font-semibold text-gray-900">
                                {adsGroups.length}
                            </span>{" "}
                            กลุ่ม
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelectAdsGroupFilter;
