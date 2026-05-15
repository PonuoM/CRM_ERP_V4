import React from "react";

// Reusable skeleton primitives for Monitor pages.
// All use Tailwind's animate-pulse for a subtle shimmer.

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// KPI card skeleton — matches the 4-up grid layout used across Monitor pages.
export const KpiCardSkeleton: React.FC = () => (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-start justify-between">
            <div className="flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-28 mt-2" />
                <Skeleton className="h-3 w-32 mt-3" />
            </div>
            <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
    </div>
);

export const KpiRowSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {Array.from({ length: count }).map((_, i) => (
            <KpiCardSkeleton key={i} />
        ))}
    </div>
);

// Chart area placeholder — keeps the same height so layout doesn't jump.
export const ChartSkeleton: React.FC<{ height?: number; title?: string }> = ({
    height = 300,
    title,
}) => (
    <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-200 mb-5">
        {title && <Skeleton className="h-4 w-48 mb-3" />}
        <div
            className="flex items-end justify-around gap-2 px-4"
            style={{ height: `${height - 40}px` }}
        >
            {Array.from({ length: 11 }).map((_, i) => {
                // Vary the bar height for a more natural look
                const h = 30 + ((i * 17) % 70);
                return <Skeleton key={i} className="flex-1" style={{ height: `${h}%` } as any} />;
            })}
        </div>
    </div>
);

// Table rows skeleton — call this inside a <tbody>. `colCount` should match the
// number of <th> in the header so the row spans correctly.
export const TableRowsSkeleton: React.FC<{ rows?: number; colCount: number }> = ({
    rows = 8,
    colCount,
}) => (
    <>
        {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-gray-100">
                {Array.from({ length: colCount }).map((_, c) => (
                    <td key={c} className="px-3 py-3">
                        {c === 0 ? (
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-7 h-7 rounded-full" />
                                <div className="flex-1">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2.5 w-16 mt-1" />
                                </div>
                            </div>
                        ) : (
                            <Skeleton className="h-3 w-12 ml-auto" />
                        )}
                    </td>
                ))}
            </tr>
        ))}
    </>
);

// Inline pill that says "กำลังโหลด..." with a spinner.
export const LoadingPill: React.FC<{ text?: string }> = ({ text = "กำลังโหลด..." }) => (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <svg
            className="w-3 h-3 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.25"
            />
            <path
                d="M22 12a10 10 0 0 1-10 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
        </svg>
        {text}
    </span>
);
