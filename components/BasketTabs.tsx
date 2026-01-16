/**
 * BasketTabs - Tab navigation for V2 basket-based customer views
 * Shows count badges for each basket type
 */

import React from "react";
import { BasketType } from "@/types";
import { getBasketDisplayName, getBasketColorClasses } from "@/utils/basketUtils";

interface TabConfig {
    type: BasketType;
    count: number;
}

interface BasketTabsProps {
    tabs: TabConfig[];
    activeTab: BasketType;
    onTabChange: (tab: BasketType) => void;
    className?: string;
}

const BasketTabs: React.FC<BasketTabsProps> = ({
    tabs,
    activeTab,
    onTabChange,
    className = "",
}) => {
    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {tabs.map(({ type, count }) => {
                const isActive = activeTab === type;
                const baseClasses = getBasketColorClasses(type);

                return (
                    <button
                        key={type}
                        onClick={() => onTabChange(type)}
                        className={`
              relative px-4 py-2 rounded-xl font-medium text-sm
              transition-all duration-200 border-2
              ${isActive
                                ? `${baseClasses} shadow-md scale-105`
                                : "bg-white/50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }
            `}
                    >
                        <span>{getBasketDisplayName(type)}</span>
                        <span
                            className={`
                ml-2 px-2 py-0.5 rounded-full text-xs font-bold
                ${isActive ? "bg-white/70 text-gray-800" : "bg-gray-200 text-gray-600"}
              `}
                        >
                            {count.toLocaleString()}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default BasketTabs;
