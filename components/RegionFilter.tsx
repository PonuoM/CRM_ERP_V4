/**
 * RegionFilter - Multi-select region filter for Thai provinces
 * Used in V2 distribution page for regional targeting
 */

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, MapPin, X } from "lucide-react";
import { THAI_REGIONS } from "@/utils/basketUtils";

interface RegionFilterProps {
    selectedRegions: string[];
    onRegionChange: (regions: string[]) => void;
    className?: string;
}

const REGION_COLORS: Record<string, string> = {
    "เหนือ": "bg-emerald-100 text-emerald-700",
    "อีสาน": "bg-amber-100 text-amber-700",
    "กลาง": "bg-blue-100 text-blue-700",
    "ใต้": "bg-cyan-100 text-cyan-700",
    "ตะวันตก": "bg-purple-100 text-purple-700",
};

const RegionFilter: React.FC<RegionFilterProps> = ({
    selectedRegions,
    onRegionChange,
    className = "",
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const toggleRegion = (region: string) => {
        if (selectedRegions.includes(region)) {
            onRegionChange(selectedRegions.filter((r) => r !== region));
        } else {
            onRegionChange([...selectedRegions, region]);
        }
    };

    const clearAll = () => {
        onRegionChange([]);
    };

    const selectAll = () => {
        onRegionChange(Object.keys(THAI_REGIONS));
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center gap-2 px-4 py-2 rounded-xl border-2 
          transition-all duration-200
          ${selectedRegions.length > 0
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }
        `}
            >
                <MapPin size={16} />
                <span>ภูมิภาค</span>
                {selectedRegions.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                        {selectedRegions.length}
                    </span>
                )}
                <ChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                        <span className="text-sm font-medium text-gray-700">เลือกภูมิภาค</span>
                        <div className="flex gap-2">
                            <button
                                onClick={selectAll}
                                className="text-xs text-blue-600 hover:text-blue-800"
                            >
                                เลือกทั้งหมด
                            </button>
                            <button
                                onClick={clearAll}
                                className="text-xs text-gray-500 hover:text-gray-700"
                            >
                                ล้าง
                            </button>
                        </div>
                    </div>

                    {/* Region List */}
                    <div className="p-2 max-h-60 overflow-y-auto">
                        {Object.entries(THAI_REGIONS).map(([region, provinces]) => {
                            const isSelected = selectedRegions.includes(region);
                            const colorClass = REGION_COLORS[region] || "bg-gray-100 text-gray-700";

                            return (
                                <button
                                    key={region}
                                    onClick={() => toggleRegion(region)}
                                    className={`
                    w-full flex items-center justify-between p-3 rounded-lg mb-1
                    transition-colors duration-150
                    ${isSelected ? colorClass : "hover:bg-gray-50"}
                  `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`
                      w-5 h-5 rounded-md flex items-center justify-center
                      ${isSelected ? "bg-white/80" : "border-2 border-gray-300"}
                    `}>
                                            {isSelected && <Check size={14} className="text-gray-800" />}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium">{region}</div>
                                            <div className="text-xs text-gray-500">{provinces.length} จังหวัด</div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected Tags (shown below button) */}
            {selectedRegions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {selectedRegions.map((region) => (
                        <span
                            key={region}
                            className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                ${REGION_COLORS[region] || "bg-gray-100 text-gray-700"}
              `}
                        >
                            {region}
                            <button
                                onClick={() => toggleRegion(region)}
                                className="hover:opacity-70"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RegionFilter;
