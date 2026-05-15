import React from "react";
import { Lightbulb, TrendingUp, AlertTriangle, Star, Info } from "lucide-react";

export type InsightTone = "good" | "warn" | "bad" | "info" | "highlight";

export interface InsightItem {
    tone: InsightTone;
    text: React.ReactNode;
}

const toneConfig: Record<InsightTone, { icon: React.ReactNode; pillBg: string; pillText: string }> = {
    good:      { icon: <TrendingUp className="w-3.5 h-3.5" />,    pillBg: "bg-green-100",   pillText: "text-green-700" },
    warn:      { icon: <AlertTriangle className="w-3.5 h-3.5" />, pillBg: "bg-amber-100",   pillText: "text-amber-700" },
    bad:       { icon: <AlertTriangle className="w-3.5 h-3.5" />, pillBg: "bg-red-100",     pillText: "text-red-700" },
    info:      { icon: <Info className="w-3.5 h-3.5" />,          pillBg: "bg-blue-100",    pillText: "text-blue-700" },
    highlight: { icon: <Star className="w-3.5 h-3.5" />,          pillBg: "bg-yellow-100",  pillText: "text-yellow-700" },
};

const TeamInsights: React.FC<{
    title?: string;
    items: InsightItem[];
    subtitle?: string;
}> = ({ title = "สรุปและสิ่งที่ต้องให้ความสนใจ", items, subtitle }) => {
    if (items.length === 0) return null;
    return (
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-4 sm:p-5 mb-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-gray-800">{title}</h2>
            </div>
            {subtitle && <p className="text-xs text-gray-500 mb-3 -mt-1">{subtitle}</p>}
            <ul className="space-y-2">
                {items.map((it, i) => {
                    const c = toneConfig[it.tone];
                    return (
                        <li key={i} className="flex items-start gap-2 text-sm">
                            <span
                                className={`flex-shrink-0 w-6 h-6 rounded-full inline-flex items-center justify-center ${c.pillBg} ${c.pillText}`}
                            >
                                {c.icon}
                            </span>
                            <span className="text-gray-700 leading-snug pt-0.5">{it.text}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default TeamInsights;
