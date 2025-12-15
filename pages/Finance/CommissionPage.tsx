import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { User } from '../../types';
import { Calculator, CheckCircle, DollarSign, Calendar, Users, FileText, X } from 'lucide-react';

interface Period {
    id: number;
    period_month: number;
    period_year: number;
    order_month: number;
    order_year: number;
    cutoff_date: string;
    status: string;
    total_sales: number;
    total_commission: number;
    total_orders: number;
    salesperson_count: number;
    period_display: string;
    order_period_display: string;
    approved_at?: string;
    paid_at?: string;
}

interface CommissionPageProps {
    currentUser: User;
}

const CommissionPage: React.FC<CommissionPageProps> = ({ currentUser }) => {
    const [periods, setPeriods] = useState<Period[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [commissionRate, setCommissionRate] = useState(5.0);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailData, setDetailData] = useState<any>(null);

    useEffect(() => {
        fetchPeriods();
    }, []);

    const fetchPeriods = async () => {
        try {
            const res = await fetch(`api/Commission/get_periods.php?company_id=${currentUser.companyId || currentUser.company_id}`);
            const data = await res.json();
            if (data.ok) {
                setPeriods(data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch periods', error);
        }
    };

    const handleCalculate = async () => {
        if (!window.confirm(`คำนวณค่าคอมสำหรับรอบ ${selectedYear}-${String(selectedMonth).padStart(2, '0')}?`)) {
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('api/Commission/calculate_commission.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: currentUser.companyId || currentUser.company_id,
                    period_month: selectedMonth,
                    period_year: selectedYear,
                    commission_rate: commissionRate
                })
            });
            const data = await res.json();

            if (data.ok) {
                alert(`คำนวณสำเร็จ!\nยอดขายรวม: ${formatCurrency(data.data.total_sales)}\nค่าคอมรวม: ${formatCurrency(data.data.total_commission)}\nจำนวนออเดอร์: ${data.data.total_orders} รายการ`);
                fetchPeriods();
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.error || 'Unknown error'));
            }
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (periodId: number) => {
        if (!window.confirm('ยืนยันการอนุมัติรอบนี้?')) {
            return;
        }

        try {
            const res = await fetch('api/Commission/approve_period.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_id: periodId,
                    approved_by: currentUser.id
                })
            });
            const data = await res.json();

            if (data.ok) {
                alert('อนุมัติสำเร็จ!');
                fetchPeriods();
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.error || 'Unknown error'));
            }
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const handleMarkPaid = async (periodId: number) => {
        if (!window.confirm('ยืนยันว่าได้จ่ายเงินแล้ว?')) {
            return;
        }

        try {
            const res = await fetch('api/Commission/mark_paid.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_id: periodId
                })
            });
            const data = await res.json();

            if (data.ok) {
                alert('บันทึกสำเร็จ!');
                fetchPeriods();
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.error || 'Unknown error'));
            }
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const handleDelete = async (periodId: number, status: string) => {
        if (status === 'Paid') {
            alert('ไม่สามารถลบรอบที่จ่ายเงินแล้ว');
            return;
        }

        if (!window.confirm('ยืนยันการลบรอบนี้? การลบจะไม่สามารถกู้คืนได้')) {
            return;
        }

        try {
            const res = await fetch('api/Commission/delete_period.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_id: periodId
                })
            });
            const data = await res.json();

            if (data.ok) {
                alert('ลบสำเร็จ!');
                fetchPeriods();
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.error || 'Unknown error'));
            }
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const handleViewDetail = async (periodId: number) => {
        try {
            const res = await fetch(`api/Commission/get_period_detail.php?period_id=${periodId}`);
            const data = await res.json();

            if (data.ok) {
                setDetailData(data.data);
                setShowDetailModal(true);
            } else {
                alert('เกิดข้อผิดพลาด: ' + (data.error || 'Unknown error'));
            }
        } catch (error: any) {
            alert('Error: ' + error.message);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB'
        }).format(amount);
    };

    const getStatusBadge = (status: string) => {
        const colors = {
            Draft: 'bg-gray-100 text-gray-600',
            Calculated: 'bg-blue-100 text-blue-600',
            Approved: 'bg-green-100 text-green-600',
            Paid: 'bg-purple-100 text-purple-600'
        };
        return colors[status as keyof typeof colors] || colors.Draft;
    };

    const months = [
        { value: 1, label: 'มกราคม' },
        { value: 2, label: 'กุมภาพันธ์' },
        { value: 3, label: 'มีนาคม' },
        { value: 4, label: 'เมษายน' },
        { value: 5, label: 'พฤษภาคม' },
        { value: 6, label: 'มิถุนายน' },
        { value: 7, label: 'กรกฎาคม' },
        { value: 8, label: 'สิงหาคม' },
        { value: 9, label: 'กันยายน' },
        { value: 10, label: 'ตุลาคม' },
        { value: 11, label: 'พฤศจิกายน' },
        { value: 12, label: 'ธันวาคม' }
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear + 1, ...Array.from({ length: 5 }, (_, i) => currentYear - i)];

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">คำนวณค่าคอมมิชชัน</h1>
                    <p className="text-gray-500">คำนวณและจัดการค่าคอมมิชชันของทีมขาย</p>
                </div>
            </div>

            {/* Calculate New Period Card */}
            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                    <Calculator className="w-5 h-5 mr-2" />
                    คำนวณรอบใหม่
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">เดือน</label>
                        <select
                            className="w-full px-3 py-2 border rounded-md"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        >
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">ปี</label>
                        <select
                            className="w-full px-3 py-2 border rounded-md"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y + 543}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">% ค่าคอม</label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full px-3 py-2 border rounded-md"
                            value={commissionRate}
                            onChange={(e) => setCommissionRate(Number(e.target.value))}
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleCalculate}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'กำลังคำนวณ...' : 'คำนวณ'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Periods List */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">ประวัติการคำนวณ</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                                <th className="px-4 py-3 text-left">รอบที่คำนวณ</th>
                                <th className="px-4 py-3 text-left">ออเดอร์จากรอบ</th>
                                <th className="px-4 py-3 text-right">ยอดขายรวม</th>
                                <th className="px-4 py-3 text-right">ค่าคอมรวม</th>
                                <th className="px-4 py-3 text-center">จำนวนออเดอร์</th>
                                <th className="px-4 py-3 text-center">จำนวนผู้ขาย</th>
                                <th className="px-4 py-3 text-center">สถานะ</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {periods.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        ยังไม่มีข้อมูล
                                    </td>
                                </tr>
                            ) : (
                                periods.map(period => (
                                    <tr key={period.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            {period.period_display}
                                            <span className="text-xs text-gray-500 block">
                                                ตัดรอบ: {new Date(period.cutoff_date).toLocaleDateString('th-TH')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{period.order_period_display}</td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {formatCurrency(Number(period.total_sales))}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                                            {formatCurrency(Number(period.total_commission))}
                                        </td>
                                        <td className="px-4 py-3 text-center">{period.total_orders}</td>
                                        <td className="px-4 py-3 text-center">{period.salesperson_count}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(period.status)}`}>
                                                {period.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center space-x-2">
                                            {period.status === 'Calculated' && (
                                                <button
                                                    onClick={() => handleApprove(period.id)}
                                                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                >
                                                    อนุมัติ
                                                </button>
                                            )}
                                            {period.status === 'Approved' && (
                                                <button
                                                    onClick={() => handleMarkPaid(period.id)}
                                                    className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                                                >
                                                    จ่ายแล้ว
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleViewDetail(period.id)}
                                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                            >
                                                รายละเอียด
                                            </button>
                                            {period.status !== 'Paid' && (
                                                <button
                                                    onClick={() => handleDelete(period.id, period.status)}
                                                    className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                                                >
                                                    ลบ
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {showDetailModal && detailData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b flex justify-between items-center">
                            <h2 className="text-xl font-semibold">
                                รายละเอียดค่าคอม - {detailData.period.period_display}
                            </h2>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">ยอดขายรวม</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {formatCurrency(Number(detailData.period.total_sales))}
                                    </p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">ค่าคอมรวม</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {formatCurrency(Number(detailData.period.total_commission))}
                                    </p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">จำนวนออเดอร์</p>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {detailData.period.total_orders}
                                    </p>
                                </div>
                            </div>

                            <h3 className="text-lg font-semibold mb-4">รายละเอียดตามผู้ขาย</h3>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 text-gray-700 font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">ผู้ขาย</th>
                                        <th className="px-4 py-3 text-center">จำนวนออเดอร์</th>
                                        <th className="px-4 py-3 text-right">ยอดขาย</th>
                                        <th className="px-4 py-3 text-right">ค่าคอม</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {detailData.records.map((record: any) => (
                                        <tr key={record.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                {record.first_name} {record.last_name}
                                                <span className="text-xs text-gray-500 block">
                                                    @{record.username}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {record.order_count}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {formatCurrency(Number(record.total_sales))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                                                {formatCurrency(Number(record.commission_amount))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommissionPage;
