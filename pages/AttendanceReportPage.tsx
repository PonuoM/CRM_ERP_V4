import React, { useState, useEffect, useMemo } from "react";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Calendar, Download, Clock, Users } from "lucide-react";

interface AttendanceReportPageProps {
    currentUser: User;
}

interface UserAttendance {
    userId: number;
    name: string;
    role: string;
    days: Record<number, number>; // day number -> seconds
    totalSeconds: number;
    workDays: number;
}

interface ReportData {
    month: number;
    year: number;
    daysInMonth: number;
    roles: string[];
    data: Record<string, UserAttendance[]>;
}

// Format seconds to HH:MM (empty string if no data)
const formatHoursMinutes = (seconds: number, showEmpty = false): string => {
    if (!seconds || seconds <= 0) return showEmpty ? "" : "-";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

// Thai month names
const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const AttendanceReportPage: React.FC<AttendanceReportPageProps> = ({ currentUser }) => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ReportData | null>(null);
    const [selectedRole, setSelectedRole] = useState<string>(""); // "" = all roles

    // Generate year options (current year and 2 years back)
    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear, currentYear - 1, currentYear - 2];
    }, []);

    // Fetch data
    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await apiFetch(
                `attendance/report?month=${month}&year=${year}${currentUser.companyId ? `&companyId=${currentUser.companyId}` : ""}`
            );
            setData(result);
            // Select first role by default if not set
            if (!selectedRole && result.roles?.length > 0) {
                setSelectedRole(result.roles[0]);
            }
        } catch (error) {
            console.error("Failed to fetch attendance report", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [month, year]);

    // Get filtered users based on selected role
    const filteredUsers = useMemo(() => {
        if (!data || !selectedRole) return [];
        return data.data[selectedRole] || [];
    }, [data, selectedRole]);

    // Export to CSV
    const exportCSV = () => {
        if (!data) return;

        const headers = ["ชื่อ", "ตำแหน่ง"];
        for (let d = 1; d <= data.daysInMonth; d++) {
            headers.push(`${d}`);
        }
        headers.push("รวม (ชม.)", "วันทำงาน");

        const rows: string[][] = [headers];

        Object.entries(data.data).forEach(([role, users]) => {
            users.forEach(user => {
                const row = [user.name, role];
                for (let d = 1; d <= data.daysInMonth; d++) {
                    row.push(formatHoursMinutes(user.days[d] || 0));
                }
                row.push(formatHoursMinutes(user.totalSeconds));
                row.push(user.workDays.toString());
                rows.push(row);
            });
        });

        const csvContent = rows.map(row => row.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `attendance_report_${year}_${month}.csv`;
        link.click();
    };

    // Calculate role summary
    const getRoleSummary = (users: UserAttendance[]) => {
        const totalSeconds = users.reduce((sum, u) => sum + u.totalSeconds, 0);
        const totalWorkDays = users.reduce((sum, u) => sum + u.workDays, 0);
        return { totalSeconds, totalWorkDays, userCount: users.length };
    };

    return (
        <div className="p-6 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Clock className="w-8 h-8 text-green-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">รายงานเวลาเข้างาน</h1>
                        <p className="text-sm text-gray-500">Attendance Report</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            {THAI_MONTHS.map((name, idx) => (
                                <option key={idx} value={idx + 1}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            {yearOptions.map(y => (
                                <option key={y} value={y}>{y + 543}</option>
                            ))}
                        </select>
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-400" />
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-[180px]"
                        >
                            {data?.roles.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={exportCSV}
                        disabled={!data}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                </div>
            )}

            {/* Table */}
            {!loading && data && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700 min-w-[180px] z-10 border-r">
                                        ชื่อ
                                    </th>
                                    <th className="sticky left-[180px] bg-green-50 px-3 py-3 text-center font-semibold text-green-700 min-w-[70px] z-10 border-r">
                                        รวม
                                    </th>
                                    <th className="sticky left-[250px] bg-blue-50 px-3 py-3 text-center font-semibold text-blue-700 min-w-[50px] z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                        วัน
                                    </th>
                                    {Array.from({ length: data.daysInMonth }, (_, i) => (
                                        <th key={i} className="px-2 py-3 text-center font-semibold text-gray-600 min-w-[55px]">
                                            {i + 1}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user, idx) => {
                                    const bgClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                                    return (
                                        <tr
                                            key={user.userId}
                                            className={`border-b hover:bg-gray-100 transition-colors ${bgClass}`}
                                        >
                                            <td className={`sticky left-0 ${bgClass} px-4 py-2 text-gray-700 font-medium border-r z-10`}>
                                                {user.name}
                                            </td>
                                            <td className={`sticky left-[180px] bg-green-50 px-3 py-2 text-center font-semibold text-green-700 border-r z-10`}>
                                                {formatHoursMinutes(user.totalSeconds)}
                                            </td>
                                            <td className={`sticky left-[250px] bg-blue-50 px-3 py-2 text-center font-semibold text-blue-700 border-r z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>
                                                {user.workDays}
                                            </td>
                                            {Array.from({ length: data.daysInMonth }, (_, i) => {
                                                const seconds = user.days[i + 1] || 0;
                                                const hours = seconds / 3600;
                                                let cellStyle = "text-gray-300";
                                                if (seconds > 0) {
                                                    if (hours >= 6) cellStyle = "bg-green-100 text-green-800 font-medium";
                                                    else if (hours >= 4) cellStyle = "bg-yellow-100 text-yellow-800 font-medium";
                                                    else cellStyle = "bg-red-100 text-red-800 font-medium";
                                                }
                                                return (
                                                    <td key={i} className={`px-2 py-2 text-center ${cellStyle}`}>
                                                        {seconds > 0 ? formatHoursMinutes(seconds) : ""}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                                {/* Summary Row */}
                                {filteredUsers.length > 0 && (
                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                        <td className="sticky left-0 bg-gray-100 px-4 py-3 text-gray-700 border-r z-10">
                                            รวม ({filteredUsers.length} คน)
                                        </td>
                                        <td className="sticky left-[180px] bg-green-100 px-3 py-3 text-center text-green-700 border-r z-10">
                                            {formatHoursMinutes(getRoleSummary(filteredUsers).totalSeconds)}
                                        </td>
                                        <td className="sticky left-[250px] bg-blue-100 px-3 py-3 text-center text-blue-700 border-r z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {getRoleSummary(filteredUsers).totalWorkDays}
                                        </td>
                                        {Array.from({ length: data.daysInMonth }, (_, i) => (
                                            <td key={i} className="px-2 py-3 text-center text-gray-500"></td>
                                        ))}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="px-4 py-3 bg-gray-50 border-t flex items-center gap-6 text-xs text-gray-600">
                        <span className="font-semibold">สี:</span>
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-4 bg-green-100 rounded"></span> ≥6 ชม.
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-4 bg-yellow-100 rounded"></span> 4-6 ชม.
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-4 bg-red-100 rounded"></span> &lt;4 ชม.
                        </span>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && data && data.roles.length === 0 && (
                <div className="text-center py-20 text-gray-500">
                    <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">ไม่พบข้อมูลการเข้างานในเดือนนี้</p>
                </div>
            )}
        </div>
    );
};

export default AttendanceReportPage;
