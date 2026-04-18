import React, { useState, useEffect, useMemo } from "react";
import { User as UserIcon, Search, Calendar, ChevronUp, ChevronDown } from "lucide-react";
import { User } from "@/types";
import resolveApiBasePath from "@/utils/apiBasePath";
import OnecallLoginSidebar from "@/components/common/OnecallLoginSidebar";

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
    <span className="relative inline-flex ml-1 group cursor-help">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-300 text-[10px] font-bold text-gray-600 leading-none">!</span>
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:block w-48 px-2.5 py-1.5 text-xs text-white bg-gray-800 rounded-lg shadow-lg z-50 text-left font-normal whitespace-normal">{text}</span>
    </span>
);

interface CallDetailsPageV2Props {
    currentUser: User;
}

interface EmployeeCallData {
    user_id: number;
    first_name: string;
    role: string;
    phone: string;
    working_days: number;
    total_minutes: number;
    connected_calls: number;
    missed_calls: number;
    talked_calls: number;
    total_calls: number;
    inbound_calls: number;
    outbound_calls: number;
    answer_rate: number;
    outbound_rate: number;
    minutes_per_workday: number;
}

const CallDetailsPageV2: React.FC<CallDetailsPageV2Props> = ({
    currentUser,
}) => {
    const [employeeCallData, setEmployeeCallData] = useState<EmployeeCallData[]>(
        [],
    );
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().toISOString().slice(0, 7),
    );
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchEmployeeCallData = async () => {
        setIsLoading(true);
        try {
            const companyId = (() => {
                if (currentUser && typeof (currentUser as any).companyId === "number")
                    return (currentUser as any).companyId as number;
                try {
                    const s = localStorage.getItem("sessionUser");
                    if (s) {
                        const su = JSON.parse(s);
                        if (su && typeof su.company_id === "number")
                            return su.company_id as number;
                    }
                } catch { }
                return undefined as number | undefined;
            })();

            const companyQs =
                companyId != null
                    ? `&companyId=${encodeURIComponent(String(companyId))}`
                    : "";
            const supervisorQs = currentUser
                ? `&currentUserId=${encodeURIComponent(String(currentUser.id))}&role=${encodeURIComponent(currentUser.role)}`
                : "";
            const apiBase = resolveApiBasePath();
            const response = await fetch(
                `${apiBase}/Onecall_DB/get_call_overview_v2.php?month=${selectedMonth}${companyQs}${supervisorQs}`,
            );

            if (response.ok) {
                const data = await response.json();
                setEmployeeCallData(data || []);
            } else {
                setEmployeeCallData([]);
            }
        } catch (error) {
            console.error("Error fetching employee call data:", error);
            setEmployeeCallData([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployeeCallData();
    }, [selectedMonth]);

    const [sortKey, setSortKey] = useState<string>("total_calls");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const toggleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const filteredEmployees = employeeCallData.filter(
        (employee) =>
            employee.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            employee.phone?.includes(searchTerm),
    );

    const sortedFiltered = useMemo(() => {
        if (!filteredEmployees.length) return [];
        return [...filteredEmployees].sort((a, b) => {
            const av = (a as any)[sortKey] ?? 0;
            const bv = (b as any)[sortKey] ?? 0;
            if (typeof av === "string" && typeof bv === "string") {
                return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            }
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [filteredEmployees, sortKey, sortDir]);

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="w-full">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <UserIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                            รายละเอียดการโทร V2
                        </h1>
                    </div>
                    <p className="text-gray-500 ml-11 text-sm">
                        ข้อมูลการโทรจากการ Import CSV
                    </p>
                </div>

                {/* Filter Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-gray-500" />
                            <label className="text-sm font-medium text-gray-700">
                                เดือน:
                            </label>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                            <button
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                onClick={fetchEmployeeCallData}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <Search className="w-4 h-4" />
                                )}
                                {isLoading ? "กำลังโหลด..." : "ดึงข้อมูล"}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Search className="w-5 h-5 text-gray-500" />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ, ตำแหน่ง หรือเบอร์โทร"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-full md:w-64"
                            />
                        </div>
                    </div>
                </div>

                {/* Employee Call Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    {[
                                        { key: "first_name", label: "รายชื่อพนักงาน", align: "left" },
                                        { key: "role", label: "ตำแหน่ง", align: "left" },
                                        { key: "phone", label: "เบอร์โทร", align: "left" },
                                        { key: "working_days", label: "วันทำงาน", tip: "จำนวนวันที่เข้ามาทำงานในเดือนที่เลือก" },
                                        { key: "total_calls", label: "สายทั้งหมด", tip: "จำนวนสายทั้งหมดในช่วงเดือนที่เลือก" },
                                        { key: "connected_calls", label: "รับสาย", tip: "จำนวนสายที่มีการรับสนทนา" },
                                        { key: "missed_calls", label: "ไม่ได้รับ", tip: "จำนวนสายที่ไม่มีการรับสนทนา" },
                                        { key: "talked_calls", label: "ได้คุย", tip: "สายที่รับและสนทนาตั้งแต่ 40 วินาทีขึ้นไป" },
                                        { key: "answer_rate", label: "% รับ", tip: "อัตราการรับสาย = สายที่รับ ÷ สายทั้งหมด × 100" },
                                        { key: "inbound_calls", label: "สายเข้า", tip: "สายที่โทรเข้ามา" },
                                        { key: "outbound_calls", label: "สายออก", tip: "สายที่โทรออกไป" },
                                        { key: "outbound_rate", label: "% สายออก", tip: "อัตราสายออก = สายออก ÷ สายทั้งหมด × 100" },
                                        { key: "total_minutes", label: "เวลาโทร (นาที)", tip: "เวลาสนทนาสะสมของทุกสายรวมกัน" },
                                        { key: "minutes_per_workday", label: "นาที/วัน", tip: "เวลาโทรรวม ÷ วันทำงาน (คิดเฉพาะสายที่รับ)" },
                                    ].map(col => (
                                        <th
                                            key={col.key}
                                            className={`py-3 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${col.align === "left" ? "text-left" : "text-center"}`}
                                            onClick={() => toggleSort(col.key)}
                                        >
                                            <span className="inline-flex items-center gap-0.5">
                                                {col.label}
                                                {col.tip && <InfoTip text={col.tip} />}
                                                {sortKey === col.key && (
                                                    sortDir === "asc"
                                                        ? <ChevronUp className="w-3 h-3 text-emerald-600" />
                                                        : <ChevronDown className="w-3 h-3 text-emerald-600" />
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={14} className="py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-3"></div>
                                                <p className="text-gray-500 text-sm font-medium">
                                                    กำลังโหลดข้อมูล...
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {sortedFiltered.length > 0 ? (
                                            sortedFiltered.map((employee) => (
                                                <tr
                                                    key={employee.user_id}
                                                    className="hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                                                        {employee.first_name}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-gray-600">
                                                        {employee.role}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-gray-600">
                                                        {employee.phone}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-gray-600 text-center">
                                                        {employee.working_days}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center font-semibold">
                                                        {employee.total_calls}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center text-emerald-600 font-medium">
                                                        {employee.connected_calls}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center text-red-500 font-medium">
                                                        {employee.missed_calls}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center text-violet-600 font-medium">
                                                        {employee.talked_calls ?? 0}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center">
                                                        <span
                                                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${employee.answer_rate >= 80
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : employee.answer_rate >= 50
                                                                    ? "bg-amber-100 text-amber-700"
                                                                    : "bg-red-100 text-red-700"
                                                                }`}
                                                        >
                                                            {employee.answer_rate}%
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center text-blue-600">
                                                        {employee.inbound_calls}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center text-amber-600">
                                                        {employee.outbound_calls}
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center text-gray-500">
                                                        {employee.outbound_rate}%
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center">
                                                        {employee.total_minutes} นาที
                                                    </td>
                                                    <td className="py-3 px-3 text-sm text-center text-gray-500">
                                                        {employee.minutes_per_workday != null ? `${employee.minutes_per_workday} นาที` : "-"}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={14} className="py-12 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                                            <UserIcon className="w-6 h-6 text-gray-400" />
                                                        </div>
                                                        <p className="text-gray-500 text-sm font-medium">
                                                            ไม่พบข้อมูล
                                                        </p>
                                                        <p className="text-gray-400 text-xs mt-1">
                                                            {searchTerm
                                                                ? "ลองปรับเปลี่ยนคำค้นหา"
                                                                : 'ลองเลือกเดือนอื่นหรือกดปุ่ม "ดึงข้อมูล"'}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* Floating button and sidebar for pbX PBX Login */}
            <OnecallLoginSidebar currentUser={currentUser} />
        </div >
    );
};

export default CallDetailsPageV2;
