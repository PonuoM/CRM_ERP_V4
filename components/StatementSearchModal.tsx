import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import Modal from './Modal';
import DateRangePicker, { DateRange } from './DateRangePicker';
import NumberRangePicker from './NumberRangePicker';

interface StatementLog {
    id: number;
    transfer_at: string;
    amount: number;
    bank_account_id: number | null;
    bank_display_name?: string | null;
    channel?: string | null;
    description?: string | null;
}

interface BankAccount {
    id: number;
    bank?: string;
    bank_number?: string;
    display_name: string;
}

interface StatementSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (statement: StatementLog) => void;
    companyId: number;
    initialAmount?: number;
    initialDate?: string;
    bankAccounts?: BankAccount[];
}

const StatementSearchModal: React.FC<StatementSearchModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    companyId,
    initialAmount,
    initialDate,
    bankAccounts = []
}) => {
    // Default to today
    const [dateRange, setDateRange] = useState<DateRange>({
        start: new Date().toISOString(),
        end: new Date().toISOString()
    });

    const [amountRange, setAmountRange] = useState<{ min: string; max: string }>({
        min: '',
        max: ''
    });

    const [selectedBankId, setSelectedBankId] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<StatementLog[]>([]);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset or pre-fill when opened
            if (initialDate) {
                // Ensure we cover the whole day of the initial date if it's just a YYYY-MM-DD
                // Or if it's a specific time, maybe just default to that day 00:00 to 23:59
                const d = new Date(initialDate);
                const start = new Date(d);
                start.setHours(0, 0, 0, 0);
                const end = new Date(d);
                end.setHours(23, 59, 59, 999);

                setDateRange({
                    start: start.toISOString(),
                    end: end.toISOString()
                });
            } else {
                // Default to today
                const now = new Date();
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                setDateRange({
                    start: start.toISOString(),
                    end: end.toISOString()
                });
            }

            if (initialAmount) {
                setAmountRange({
                    min: String(initialAmount),
                    max: String(initialAmount)
                });
            } else {
                setAmountRange({ min: '', max: '' });
            }

            setSelectedBankId('');
            setResults([]);
            setSearched(false);
        }
    }, [isOpen, initialAmount, initialDate]);

    const handleSearch = async () => {
        setLoading(true);
        setSearched(false);
        try {
            // API expects strictly YYYY-MM-DD for start_date and end_date usually?
            // Checking previous code: `start_date=${startDate}&end_date=${endDate}` where startDate was YYYY-MM-DD.
            // DateRangePicker gives ISO strings.
            const sDate = dateRange.start.split('T')[0];
            const eDate = dateRange.end.split('T')[0];

            let url = `Statement_DB/reconcile_list.php?company_id=${companyId}&start_date=${sDate}&end_date=${eDate}`;

            // Add amount parameters if present
            if (amountRange.min) {
                url += `&min_amount=${amountRange.min}`;
            }
            if (amountRange.max) {
                url += `&max_amount=${amountRange.max}`;
            }

            // Add bank filter
            if (selectedBankId) {
                url += `&bank_account_id=${selectedBankId}`;
            }

            const res: any = await apiFetch(url);

            if (res.ok && Array.isArray(res.statements)) {
                let found: StatementLog[] = res.statements.map((s: any) => ({
                    id: Number(s.id),
                    transfer_at: s.transfer_at,
                    amount: Number(s.amount),
                    bank_account_id: s.bank_account_id ? Number(s.bank_account_id) : null,
                    bank_display_name: s.bank_display_name,
                    channel: s.channel,
                    description: s.description
                }));

                // Client-side filtering is no longer needed as API handles it
                // found = found.filter(...) 

                // Sort by date desc
                found.sort((a, b) => new Date(b.transfer_at).getTime() - new Date(a.transfer_at).getTime());

                setResults(found);
            } else {
                setResults([]);
            }
        } catch (err) {
            console.error(err);
            setResults([]);
        } finally {
            setLoading(false);
            setSearched(true);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
    const formatDateTime = (val: string) => new Date(val).toLocaleString('th-TH');

    if (!isOpen) return null;

    return (
        <Modal
            title="ค้นหา Statement (Manual Search)"
            onClose={onClose}
            size="lg"
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg items-end">
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงวันที่</label>
                        <DateRangePicker
                            value={dateRange}
                            onApply={setDateRange}
                        />
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงยอดเงิน</label>
                        <NumberRangePicker
                            value={amountRange}
                            onChange={setAmountRange}
                            placeholder="ระบุช่วงยอดเงิน"
                        />
                    </div>
                    <div className="w-full md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">บัญชีธนาคาร</label>
                        <select
                            value={selectedBankId}
                            onChange={e => setSelectedBankId(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3 bg-white"
                        >
                            <option value="">ทั้งหมด</option>
                            {bankAccounts.map(bank => (
                                <option key={bank.id} value={bank.id}>
                                    {bank.display_name} {bank.bank_number ? `(${bank.bank_number})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2 flex justify-end mt-2">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> : <Search className="-ml-1 mr-2 h-4 w-4" />}
                            ค้นหา
                        </button>
                    </div>
                </div>

                <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ธนาคาร</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วัน-เวลา</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ยอดเงิน</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">เลือก</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {results.map((st) => (
                                <tr key={st.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {st.bank_display_name || '-'}
                                        <div className="text-xs text-gray-500">{st.channel}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDateTime(st.transfer_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                        {formatCurrency(st.amount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <button
                                            onClick={() => onSelect(st)}
                                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                                        >
                                            เลือก
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {searched && results.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                                        ไม่พบข้อมูลตามเงื่อนไข
                                    </td>
                                </tr>
                            )}
                            {!searched && results.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                                        กรอกเงื่อนไขและกดค้นหา
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

export default StatementSearchModal;
