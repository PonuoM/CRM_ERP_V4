import { useState, useEffect, useCallback } from 'react';
import APP_BASE_PATH from '../appBasePath';

interface AttendanceRecord {
    id: number | null;
    user_id: number;
    full_name: string;
    first_login: string | null;
    last_logout: string | null;
    current_hours: number;
    attendance_value: number;
    attendance_status: string;
    notes: string | null;
}

interface AttendanceResponse {
    success: boolean;
    date: string;
    dayName: string;
    isEditable: boolean;
    records: AttendanceRecord[];
}

interface MonthlySummaryRecord {
    user_id: number;
    full_name: string;
    total_days: number;
    work_days_count: number;
}

interface MonthlySummaryResponse {
    success: boolean;
    year: number;
    month: number;
    records: MonthlySummaryRecord[];
}

// Thai day names for calendar
const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const THAI_MONTHS = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function AttendanceManagementPage() {
    const [selectedDate, setSelectedDate] = useState(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    });
    const [data, setData] = useState<AttendanceResponse | null>(null);
    const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [editedHours, setEditedHours] = useState<Record<number, string>>({});
    const [editedNotes, setEditedNotes] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setMessage(null);
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = `${APP_BASE_PATH}api`;
            const response = await fetch(
                `${API_BASE}/User_DB/attendance_management.php?date=${selectedDate}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const result = await response.json();
            if (result.success) {
                setData(result);
                const initial: Record<number, string> = {};
                const initialNotes: Record<number, string> = {};
                result.records.forEach((r: AttendanceRecord) => {
                    initial[r.user_id] = r.current_hours.toString();
                    initialNotes[r.user_id] = r.notes || '';
                });
                setEditedHours(initial);
                setEditedNotes(initialNotes);
            } else {
                setMessage({ type: 'error', text: result.message || 'Failed to load data' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' });
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    const fetchMonthlySummary = useCallback(async () => {
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = `${APP_BASE_PATH}api`;
            const dateObj = new Date(selectedDate);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;

            const response = await fetch(
                `${API_BASE}/User_DB/attendance_management.php?action=monthly_summary&year=${year}&month=${month}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const result = await response.json();
            if (result.success) {
                setMonthlySummary(result);
            }
        } catch {
            // Silent fail for summary
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
        fetchMonthlySummary();
    }, [fetchData, fetchMonthlySummary]);

    const handleSave = async (userId: number) => {
        const hours = parseFloat(editedHours[userId] || '0');
        if (isNaN(hours) || hours < 0 || hours > 12) {
            setMessage({ type: 'error', text: 'ชั่วโมงต้องอยู่ระหว่าง 0-12' });
            return;
        }

        setSaving(userId);
        setMessage(null);
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = `${APP_BASE_PATH}api`;
            const response = await fetch(
                `${API_BASE}/User_DB/attendance_management.php`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        date: selectedDate,
                        hours: hours,
                        notes: editedNotes[userId] || null
                    })
                }
            );
            const result = await response.json();
            if (result.success) {
                setMessage({ type: 'success', text: 'บันทึกสำเร็จ' });
                fetchData();
                fetchMonthlySummary();
            } else {
                setMessage({ type: 'error', text: result.message || 'Failed to save' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error' });
        } finally {
            setSaving(null);
        }
    };

    const formatHours = (hours: number) => {
        return hours.toFixed(1).replace(/\.0$/, '');
    };

    const changeDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) {
            setSelectedDate(date.toISOString().split('T')[0]);
        }
    };

    const getStatusBadge = (status: string, hours: number) => {
        if (hours >= 8) {
            return { class: 'bg-green-100 text-green-700', label: 'เต็มวัน' };
        } else if (hours >= 4) {
            return { class: 'bg-amber-100 text-amber-700', label: 'ครึ่งวัน' };
        } else if (hours === 0 || status === 'leave') {
            return { class: 'bg-gray-100 text-gray-600', label: 'หยุด/ลา' };
        } else {
            return { class: 'bg-orange-100 text-orange-700', label: 'ไม่เต็มเวลา' };
        }
    };

    const today = new Date().toISOString().split('T')[0];

    // Calendar component
    const renderCalendar = () => {
        const dateObj = new Date(selectedDate);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days: (number | null)[] = [];
        for (let i = 0; i < startDayOfWeek; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        return (
            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={() => {
                        const newDate = new Date(year, month - 1, 1);
                        setSelectedDate(newDate.toISOString().split('T')[0]);
                    }} className="p-1 hover:bg-gray-100 rounded">◀</button>
                    <span className="font-medium">{THAI_MONTHS[month + 1]} {year + 543}</span>
                    <button onClick={() => {
                        const newDate = new Date(year, month + 1, 1);
                        if (newDate < todayDate) {
                            setSelectedDate(newDate.toISOString().split('T')[0]);
                        }
                    }} className="p-1 hover:bg-gray-100 rounded">▶</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {THAI_DAYS_SHORT.map(d => (
                        <div key={d} className="font-medium text-gray-500 py-1">{d}</div>
                    ))}
                    {days.map((day, idx) => {
                        if (day === null) return <div key={idx} />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = selectedDate === dateStr;
                        const isFuture = new Date(dateStr) >= todayDate;
                        const isToday = dateStr === today;

                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (!isFuture || isToday) {
                                        // Can't edit today, but can view
                                    }
                                    if (!isFuture) {
                                        setSelectedDate(dateStr);
                                        setShowCalendar(false);
                                    }
                                }}
                                disabled={isFuture}
                                className={`py-1 px-2 rounded text-sm ${isSelected ? 'bg-blue-600 text-white' :
                                        isToday ? 'bg-blue-100 text-blue-700' :
                                            isFuture ? 'text-gray-300 cursor-not-allowed' :
                                                'hover:bg-gray-100'
                                    }`}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Format selected date display
    const formatDateDisplay = () => {
        const d = new Date(selectedDate);
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear() + 543;
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    📋 จัดการวันมาทำงาน
                </h1>
                <p className="text-gray-500 text-sm">
                    แก้ไขชั่วโมงทำงานจริงของทีมงาน (แก้ไขได้เฉพาะวันก่อนวันนี้)
                </p>
            </div>

            {/* Date Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => changeDate(-1)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-lg font-bold"
                    >
                        ◀
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg font-medium text-blue-700 hover:bg-blue-100 flex items-center gap-2"
                        >
                            📅 {formatDateDisplay()} ({data?.dayName || '-'})
                        </button>
                        {showCalendar && renderCalendar()}
                    </div>

                    <button
                        onClick={() => changeDate(1)}
                        disabled={selectedDate >= new Date(Date.now() - 86400000).toISOString().split('T')[0]}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ▶
                    </button>

                    {selectedDate >= today && (
                        <span className="text-amber-600 text-sm bg-amber-50 px-3 py-1 rounded-full">
                            ⚠️ ไม่สามารถแก้ไขวันนี้หรือวันในอนาคต
                        </span>
                    )}
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Table */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600">#</th>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600">พนักงาน</th>
                                        <th className="px-3 py-3 text-center font-medium text-gray-600">Login</th>
                                        <th className="px-3 py-3 text-center font-medium text-gray-600">Logout</th>
                                        <th className="px-3 py-3 text-center font-medium text-gray-600">ชม.</th>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600">หมายเหตุ</th>
                                        <th className="px-3 py-3 text-center font-medium text-gray-600">สถานะ</th>
                                        <th className="px-3 py-3 text-center font-medium text-gray-600">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                                                กำลังโหลด...
                                            </td>
                                        </tr>
                                    ) : data?.records.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                                                ไม่พบข้อมูลพนักงาน
                                            </td>
                                        </tr>
                                    ) : (
                                        data?.records.map((record, idx) => {
                                            const status = getStatusBadge(record.attendance_status, record.current_hours);
                                            return (
                                                <tr key={record.user_id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                                                        {record.full_name}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-gray-600">
                                                        {record.first_login || '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-gray-600">
                                                        {record.last_logout || '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {data?.isEditable ? (
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                min="0"
                                                                max="12"
                                                                value={editedHours[record.user_id] || ''}
                                                                onChange={(e) => setEditedHours(prev => ({
                                                                    ...prev,
                                                                    [record.user_id]: e.target.value
                                                                }))}
                                                                className="w-14 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        ) : (
                                                            <span className="font-medium">
                                                                {formatHours(record.current_hours)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {data?.isEditable ? (
                                                            <input
                                                                type="text"
                                                                placeholder="หมายเหตุ..."
                                                                value={editedNotes[record.user_id] || ''}
                                                                onChange={(e) => setEditedNotes(prev => ({
                                                                    ...prev,
                                                                    [record.user_id]: e.target.value
                                                                }))}
                                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        ) : (
                                                            <span className="text-gray-500 text-sm">
                                                                {record.notes || '-'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.class}`}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {data?.isEditable && (
                                                            <button
                                                                onClick={() => handleSave(record.user_id)}
                                                                disabled={saving === record.user_id}
                                                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                                            >
                                                                {saving === record.user_id ? '...' : '💾'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 text-sm text-gray-500">
                        <p className="mb-1"><strong>💡 สถานะ:</strong></p>
                        <div className="flex flex-wrap gap-3">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">8 ชม. = เต็มวัน</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">4-7 ชม. = ครึ่งวัน</span>
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">1-3 ชม. = ไม่เต็มเวลา</span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">0 ชม. = หยุด/ลา</span>
                        </div>
                    </div>
                </div>

                {/* Monthly Summary */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h3 className="font-bold text-gray-800 mb-3">
                            📊 สรุปเดือน {monthlySummary ? THAI_MONTHS[monthlySummary.month] : '-'}
                        </h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {monthlySummary?.records.map((r) => (
                                <div key={r.user_id} className="flex justify-between items-center py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-700 truncate">{r.full_name}</span>
                                    <span className="font-bold text-blue-600">{r.total_days.toFixed(1)} วัน</span>
                                </div>
                            ))}
                            {!monthlySummary?.records.length && (
                                <p className="text-gray-400 text-sm text-center py-4">ไม่มีข้อมูล</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AttendanceManagementPage;
