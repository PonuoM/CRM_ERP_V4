import React from "react";

export type CardStatus = "great" | "good" | "warn" | "bad" | "idle";

const statusConfig: Record<CardStatus, { label: string; dot: string; ring: string; bg: string }> = {
    great: { label: "เกินเป้า",   dot: "bg-green-500",  ring: "ring-green-200",  bg: "bg-green-50/40" },
    good:  { label: "ใกล้เป้า",   dot: "bg-emerald-500", ring: "ring-emerald-200", bg: "bg-emerald-50/40" },
    warn:  { label: "ต้องเร่งมือ", dot: "bg-amber-500",  ring: "ring-amber-200",  bg: "bg-amber-50/40" },
    bad:   { label: "ต้องช่วย",   dot: "bg-red-500",    ring: "ring-red-200",    bg: "bg-red-50/40" },
    idle:  { label: "ยังไม่เริ่ม", dot: "bg-gray-400",   ring: "ring-gray-200",   bg: "bg-gray-50/40" },
};

export interface BulletItem {
    icon?: React.ReactNode;
    label: string;
    value: React.ReactNode;
    hint?: string;
    emphasize?: boolean;
}

interface MemberCardProps {
    name: string;
    role?: string;
    initial: string;
    status: CardStatus;
    bullets: BulletItem[];
    progressPercent?: number;     // 0–100+
    progressLabel?: string;
    badge?: React.ReactNode;       // optional small badge at the top right
}

const progressColor = (pct: number) =>
    pct >= 100 ? "bg-green-500" : pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";

const MemberCard: React.FC<MemberCardProps> = ({
    name,
    role,
    initial,
    status,
    bullets,
    progressPercent,
    progressLabel,
    badge,
}) => {
    const conf = statusConfig[status];
    return (
        <div
            className={`relative rounded-xl border border-gray-200 ${conf.bg} p-4 shadow-sm flex flex-col gap-3`}
        >
            {/* Header */}
            <div className="flex items-start gap-3">
                <div
                    className={`w-10 h-10 rounded-full bg-white ring-2 ${conf.ring} flex items-center justify-center font-bold text-gray-700`}
                >
                    {initial || "?"}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{name || "—"}</h3>
                        {badge}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                        <span className="text-xs text-gray-500">{conf.label}</span>
                        {role && <span className="text-xs text-gray-300 mx-1">•</span>}
                        {role && <span className="text-xs text-gray-400 truncate">{role}</span>}
                    </div>
                </div>
            </div>

            {/* Bullet summary */}
            <ul className="space-y-1.5 text-sm">
                {bullets.map((b, i) => (
                    <li
                        key={i}
                        className={`flex items-center justify-between gap-2 ${b.emphasize ? "font-semibold text-gray-800" : "text-gray-600"}`}
                    >
                        <span className="flex items-center gap-1.5 min-w-0">
                            {b.icon && <span className="flex-shrink-0">{b.icon}</span>}
                            <span className="truncate">{b.label}</span>
                        </span>
                        <span className="tabular-nums whitespace-nowrap flex items-center gap-1.5">
                            <span>{b.value}</span>
                            {b.hint && <span className="text-xs text-gray-400 font-normal">{b.hint}</span>}
                        </span>
                    </li>
                ))}
            </ul>

            {/* Progress bar */}
            {typeof progressPercent === "number" && (
                <div className="mt-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{progressLabel || "ความคืบหน้า"}</span>
                        <span className="font-semibold tabular-nums">{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200/70 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${progressColor(progressPercent)} transition-all`}
                            style={{ width: `${Math.min(100, progressPercent)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemberCard;
