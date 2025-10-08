// FIX: Import 'useMemo' from 'react'
import React, { useMemo } from 'react';
import { CustomerGrade, OrderStatus } from '../types';

export const MonthlyOrdersChart: React.FC = () => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-semibold text-gray-700">คำสั่งซื้อรายเดือน</h3>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">จำนวนคำสั่งซื้อ</span>
                    <div className="w-4 h-1 bg-green-400 rounded-full"></div>
                </div>
            </div>
            {/* This is a simplified SVG representation for UI purposes */}
            <svg width="100%" height="250" viewBox="0 0 500 250" className="w-full">
                 {/* Grid lines */}
                <line x1="30" y1="220" x2="480" y2="220" stroke="#E5E7EB" strokeWidth="1" />
                <line x1="30" y1="170" x2="480" y2="170" stroke="#E5E7EB" strokeWidth="1" />
                <line x1="30" y1="120" x2="480" y2="120" stroke="#E5E7EB" strokeWidth="1" />
                <line x1="30" y1="70" x2="480" y2="70" stroke="#E5E7EB" strokeWidth="1" />
                <line x1="30" y1="20" x2="480" y2="20" stroke="#E5E7EB" strokeWidth="1" />

                {/* Y-axis labels */}
                <text x="0" y="225" fill="#9CA3AF" fontSize="12">0</text>
                <text x="0" y="125" fill="#9CA3AF" fontSize="12">30k</text>
                <text x="0" y="25" fill="#9CA3AF" fontSize="12">60k</text>

                 {/* Data line */}
                <path d="M 50 100 Q 150 50, 250 150 T 450 80" stroke="#6EE7B7" fill="none" strokeWidth="3" strokeLinecap="round" />

                {/* X-axis labels */}
                <text x="50" y="240" fill="#9CA3AF" fontSize="12">2025-09</text>
                <text x="430" y="240" fill="#9CA3AF" fontSize="12">2025-08</text>
            </svg>
        </div>
    );
};

interface CustomerGradeChartProps {
    grades: { label: string, value: number, total: number }[];
}

const gradeColors: Record<string, string> = {
    [CustomerGrade.APlus]: '#6EE7B7', // light green
    [CustomerGrade.A]: '#34D399', // green
    [CustomerGrade.B]: '#A7F3D0', // lighter green
    [CustomerGrade.C]: '#FCD34D', // amber
    [CustomerGrade.D]: '#FCA5A5', // red
}

export const CustomerGradeChart: React.FC<CustomerGradeChartProps> = ({ grades }) => {
    const conicGradient = useMemo(() => {
        if (grades.length === 0 || grades[0].total === 0) return 'conic-gradient(#E5E7EB 0% 100%)';
        let cumulativePercent = 0;
        const gradientParts = grades.map(grade => {
            const percent = (grade.value / grade.total) * 100;
            const startAngle = cumulativePercent;
            cumulativePercent += percent;
            const endAngle = cumulativePercent;
            return `${gradeColors[grade.label] || '#E5E7EB'} ${startAngle}% ${endAngle}%`;
        });
        return `conic-gradient(${gradientParts.join(', ')})`;
    }, [grades]);
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
            <h3 className="text-md font-semibold text-gray-700 mb-4">เกรดลูกค้า</h3>
            <div className="flex items-center justify-center space-x-8">
                <div className="relative w-48 h-48">
                    <div 
                        className="w-full h-full rounded-full"
                        style={{ background: conicGradient }}
                    ></div>
                    <div className="absolute inset-8 bg-white rounded-full"></div>
                </div>
                <div className="space-y-2">
                    {grades.map(grade => (
                         <div key={grade.label} className="flex items-center text-sm">
                            <div className="w-3 h-3 rounded-sm mr-2" style={{backgroundColor: gradeColors[grade.label] || '#E5E7EB'}}></div>
                            <span className="text-gray-700">{grade.label}</span>
                         </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


interface OrderStatusChartProps {
    title: string;
    data: { label: string, value: number, total: number }[];
}

const statusColors: Record<string, string> = {
    [OrderStatus.Pending]: '#FBBF24', // Amber 400
    [OrderStatus.Picking]: '#F97316', // Orange 500
    [OrderStatus.Shipping]: '#3B82F6', // Blue 500
    [OrderStatus.Delivered]: '#22C55E', // Green 500
    [OrderStatus.Returned]: '#EF4444', // Red 500
    [OrderStatus.Cancelled]: '#6B7280', // Gray 500
}

export const OrderStatusChart: React.FC<OrderStatusChartProps> = ({ title, data }) => {
     const conicGradient = useMemo(() => {
        if (data.length === 0 || data[0].total === 0) return 'conic-gradient(#E5E7EB 0% 100%)';
        let cumulativePercent = 0;
        const gradientParts = data.map(item => {
            const percent = (item.value / item.total) * 100;
            const startAngle = cumulativePercent;
            cumulativePercent += percent;
            const endAngle = cumulativePercent;
            return `${statusColors[item.label] || '#E5E7EB'} ${startAngle}% ${endAngle}%`;
        });
        return `conic-gradient(${gradientParts.join(', ')})`;
    }, [data]);

    return (
         <div className="bg-white p-6 rounded-lg shadow-sm border h-full">
            <h3 className="text-md font-semibold text-gray-700 mb-4">{title}</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <div className="relative w-40 h-40 flex-shrink-0">
                    <div 
                        className="w-full h-full rounded-full"
                        style={{ background: conicGradient }}
                    ></div>
                    <div className="absolute inset-7 bg-white rounded-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-gray-800">{data.reduce((sum, item) => sum + item.value, 0)}</p>
                            <p className="text-xs text-gray-500">ทั้งหมด</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-2 w-full">
                     {data.map(item => (
                         <div key={item.label} className="flex items-center text-xs justify-between">
                            <div className="flex items-center">
                                <div className="w-2.5 h-2.5 rounded-full mr-2" style={{backgroundColor: statusColors[item.label] || '#E5E7EB'}}></div>
                                <span className="text-gray-600">{item.label}</span>
                            </div>
                            <span className="font-medium text-gray-800">{item.value}</span>
                         </div>
                    ))}
                </div>
            </div>
        </div>
    );
}