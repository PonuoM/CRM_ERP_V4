import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../../services/api';
import { User } from '../../types';
import { Search, Loader2, BarChart3, CheckCircle, XCircle, Clock, DollarSign, Users, CalendarDays } from 'lucide-react';

interface AuditLog {
  id: number;
  reconcile_id?: number | null;
  transfer_at: string;
  statement_amount: number | string;
  channel: string;
  description: string;
  order_id: string | null;
  order_amount: number | string | null;
  payment_method: string | null;
  status: 'Unmatched' | 'Short' | 'Exact' | 'Over' | 'Suspense' | 'Deposit';
  diff: number;
  confirmed_at?: string | null;
  confirmed_action?: string | null;
  note?: string | null;
  is_cod_document?: boolean;
  cod_document_id?: number | null;
  created_by_name?: string | null;
  confirmed_by_name?: string | null;
  reconcile_items?: any[];
}

interface BankAccount {
  id: number;
  bank: string;
  bank_number: string;
  account_name: string;
}

interface BankAuditDashboardPageProps {
  currentUser: User;
}

// Safe number parser — handles string/number/null
const num = (v: any): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
};

const BankAuditDashboardPage: React.FC<BankAuditDashboardPageProps> = ({ currentUser }) => {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('0');
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const offset = today.getTimezoneOffset();
    return new Date(first.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const res = await apiFetch(`bank_accounts?companyId=${currentUser.companyId || (currentUser as any).company_id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = Array.isArray(res) ? res : res?.data || [];
      setBanks(data);
      // Default to "0" (All banks) if data exists, or just keep '0'. We don't force select the first bank anymore.
    } catch (error) {
      console.error('Failed to fetch banks', error);
    }
  };

  const fetchAuditLogs = async () => {
    if (!selectedBankId) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await apiFetch('Statement_DB/get_bank_statement_audit.php', {
        method: 'POST',
        body: JSON.stringify({
          company_id: currentUser.companyId || (currentUser as any).company_id,
          bank_account_id: parseInt(selectedBankId),
          start_date: startDate,
          end_date: endDate,
          matchStatement: false,
        }),
      });
      if (res.ok && res.data) {
        setLogs(res.data);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Compute Dashboard Stats ──
  const stats = useMemo(() => {
    const total = logs.length;
    const matched = logs.filter(l => l.order_id).length;
    const unmatched = logs.filter(l => l.status === 'Unmatched').length;
    const suspense = logs.filter(l => l.status === 'Suspense').length;
    const deposit = logs.filter(l => l.status === 'Deposit').length;
    const confirmed = logs.filter(l => l.confirmed_at).length;
    const pendingConfirm = matched - confirmed;

    const totalAmount = logs.reduce((sum, l) => sum + num(l.statement_amount), 0);
    const matchedAmount = logs.filter(l => l.order_id).reduce((sum, l) => sum + num(l.order_amount), 0);
    const unmatchedAmount = logs.filter(l => l.status === 'Unmatched').reduce((sum, l) => sum + num(l.statement_amount), 0);

    // Group by matchers — deduplicate per reconcile_id
    const seenReconcileIds = new Set<number>();
    const matcherMapDedup: Record<string, { count: number; amount: number }> = {};
    logs.forEach(l => {
      if (!l.reconcile_items) return;
      l.reconcile_items.forEach((item: any) => {
        const rid = item.reconcile_id;
        if (seenReconcileIds.has(rid)) return;
        seenReconcileIds.add(rid);
        const name = item.created_by_name;
        if (!name || name === 'null null') return;
        if (!matcherMapDedup[name]) matcherMapDedup[name] = { count: 0, amount: 0 };
        matcherMapDedup[name].count += 1;
        matcherMapDedup[name].amount += num(item.confirmed_amount);
      });
    });

    // Group by confirmers — deduplicate per reconcile_id
    const seenConfirmIds = new Set<number>();
    const confirmerMap: Record<string, { count: number }> = {};
    logs.forEach(l => {
      if (!l.reconcile_items) return;
      l.reconcile_items.forEach((item: any) => {
        if (!item.confirmed_at) return;
        const rid = item.reconcile_id;
        if (seenConfirmIds.has(rid)) return;
        seenConfirmIds.add(rid);
        const name = item.confirmed_by_name;
        if (!name || name === 'null null') return;
        if (!confirmerMap[name]) confirmerMap[name] = { count: 0 };
        confirmerMap[name].count += 1;
      });
    });

    const matchers = Object.entries(matcherMapDedup)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);

    const confirmers = Object.entries(confirmerMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);

    return {
      total, matched, unmatched, suspense, deposit,
      confirmed, pendingConfirm,
      totalAmount, matchedAmount, unmatchedAmount,
      matchers, confirmers,
    };
  }, [logs]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);

  const formatDateThai = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const selectedBank = banks.find(b => String(b.id) === selectedBankId);

  // Combine matchers + confirmers for the comparison chart
  const chartData = useMemo(() => {
    const allNames = new Set<string>();
    stats.matchers.forEach(m => allNames.add(m.name));
    stats.confirmers.forEach(c => allNames.add(c.name));
    return Array.from(allNames).map(name => ({
      name,
      matchCount: stats.matchers.find(m => m.name === name)?.count || 0,
      confirmCount: stats.confirmers.find(c => c.name === name)?.count || 0,
    })).sort((a, b) => (b.matchCount + b.confirmCount) - (a.matchCount + a.confirmCount));
  }, [stats]);

  const chartMax = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => Math.max(d.matchCount, d.confirmCount)), 1);
  }, [chartData]);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
            แดชบอร์ดตรวจสอบบัญชี
          </h1>
          <p className="text-gray-500 text-sm">สรุปสถิติการเทียบ Statement กับออเดอร์</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white shadow rounded-xl p-5 border border-gray-100">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-72">
            <label className="text-sm font-medium text-gray-700 block mb-1.5">เลือกธนาคาร</label>
            <select
              className="w-full px-3 py-2.5 border rounded-lg text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              value={selectedBankId}
              onChange={e => setSelectedBankId(e.target.value)}
            >
              <option value="0">ทุกบัญชีธนาคาร (ทั้งหมด)</option>
              {banks.map(bank => (
                <option key={bank.id} value={String(bank.id)}>
                  {bank.bank} - {bank.bank_number} ({bank.account_name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">ตั้งแต่วันที่</label>
            <input type="date" className="px-3 py-2.5 border rounded-lg text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">ถึงวันที่</label>
            <input type="date" className="px-3 py-2.5 border rounded-lg text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button
            onClick={fetchAuditLogs}
            disabled={loading || selectedBankId === ''}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            ค้นหา
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Empty State */}
      {!loading && hasSearched && logs.length === 0 && (
        <div className="bg-white shadow rounded-xl p-12 text-center">
          <XCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">ไม่พบข้อมูล Statement</p>
          <p className="text-gray-400 text-sm">ลองเปลี่ยนช่วงวันที่หรือบัญชีธนาคาร</p>
        </div>
      )}

      {/* Dashboard Content */}
      {!loading && logs.length > 0 && (
        <>
          {/* Date Range & Bank Info */}
          <div className="flex items-center gap-3 text-sm text-gray-600 bg-white shadow rounded-xl px-5 py-3 border border-gray-100">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            <span className="font-medium">{selectedBank ? `${selectedBank.bank} ${selectedBank.bank_number}` : ''}</span>
            <span className="text-gray-400">|</span>
            <span>{formatDateThai(startDate)} — {formatDateThai(endDate)}</span>
          </div>

          {/* Summary Cards Row 1 — Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard icon={<BarChart3 className="w-5 h-5" />} label="Statement ทั้งหมด" value={stats.total} color="gray" />
            <SummaryCard icon={<CheckCircle className="w-5 h-5" />} label="จับคู่แล้ว" value={stats.matched} color="green" />
            <SummaryCard icon={<XCircle className="w-5 h-5" />} label="ยังไม่จับคู่" value={stats.unmatched} color="red" />
            <SummaryCard icon={<CheckCircle className="w-5 h-5" />} label="ยืนยันแล้ว" value={stats.confirmed} color="blue" />
            <SummaryCard icon={<Clock className="w-5 h-5" />} label="ยังไม่ยืนยัน" value={stats.pendingConfirm} color="amber" />
          </div>

          {/* Summary Cards Row 2 — Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AmountCard label="ยอดรวม Statement" amount={stats.totalAmount} formatCurrency={formatCurrency} color="indigo" />
            <AmountCard label="ยอดรวมจับคู่แล้ว" amount={stats.matchedAmount} formatCurrency={formatCurrency} color="green" />
            <AmountCard label="ยอดรวมยังไม่จับคู่" amount={stats.unmatchedAmount} formatCurrency={formatCurrency} color="red" />
          </div>

          {/* Per-status breakdown */}
          {(stats.suspense > 0 || stats.deposit > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.suspense > 0 && (
                <SummaryCard icon={<Clock className="w-5 h-5" />} label="พักรับ (Suspense)" value={stats.suspense} color="orange" />
              )}
              {stats.deposit > 0 && (
                <SummaryCard icon={<DollarSign className="w-5 h-5" />} label="มัดจำรับ (Deposit)" value={stats.deposit} color="purple" />
              )}
            </div>
          )}

          {/* ── Bar Chart — User Activity Comparison ── */}
          {chartData.length > 0 && (
            <div className="bg-white shadow rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-gray-800">เปรียบเทียบจำนวนการจับคู่ / ยืนยัน ของแต่ละคน</h3>
              </div>
              <div className="p-5">
                {/* Legend */}
                <div className="flex gap-6 mb-5 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
                    <span className="text-gray-600">จับคู่</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                    <span className="text-gray-600">ยืนยัน</span>
                  </div>
                </div>

                {/* Bars */}
                <div className="space-y-4">
                  {chartData.map((d, i) => (
                    <div key={i}>
                      <div className="text-sm font-medium text-gray-700 mb-1.5">{d.name}</div>
                      <div className="space-y-1.5">
                        {/* Match bar */}
                        <div className="flex items-center gap-3">
                          <div className="w-16 text-xs text-gray-400 text-right flex-shrink-0">จับคู่</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
                              style={{ width: `${Math.max((d.matchCount / chartMax) * 100, d.matchCount > 0 ? 8 : 0)}%` }}
                            >
                              {d.matchCount > 0 && (
                                <span className="text-xs font-bold text-white drop-shadow-sm">{d.matchCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Confirm bar */}
                        <div className="flex items-center gap-3">
                          <div className="w-16 text-xs text-gray-400 text-right flex-shrink-0">ยืนยัน</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
                              style={{ width: `${Math.max((d.confirmCount / chartMax) * 100, d.confirmCount > 0 ? 8 : 0)}%` }}
                            >
                              {d.confirmCount > 0 && (
                                <span className="text-xs font-bold text-white drop-shadow-sm">{d.confirmCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tables Row — Matchers & Confirmers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Matchers Table */}
            <div className="bg-white shadow rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-gray-800">ผู้กดจับคู่</h3>
                <span className="ml-auto text-xs text-gray-400">{stats.matchers.length} คน</span>
              </div>
              {stats.matchers.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลผู้กดจับคู่</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50">
                      <th className="px-5 py-3">ชื่อ</th>
                      <th className="px-5 py-3 text-right">จำนวน</th>
                      <th className="px-5 py-3 text-right">ยอดรวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.matchers.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3 font-medium text-gray-800">{m.name}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{m.count}</span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Confirmers Table */}
            <div className="bg-white shadow rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <h3 className="font-semibold text-gray-800">ผู้กดยืนยัน</h3>
                <span className="ml-auto text-xs text-gray-400">{stats.confirmers.length} คน</span>
              </div>
              {stats.confirmers.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลผู้ยืนยัน</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50">
                      <th className="px-5 py-3">ชื่อ</th>
                      <th className="px-5 py-3 text-right">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stats.confirmers.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3 font-medium text-gray-800">{c.name}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{c.count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Sub-components ──

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'gray' | 'green' | 'red' | 'blue' | 'amber' | 'orange' | 'purple';
}

const colorMap: Record<string, { bg: string; text: string; icon: string; border: string }> = {
  gray:   { bg: 'bg-gray-50',   text: 'text-gray-800',   icon: 'text-gray-500',   border: 'border-gray-200' },
  green:  { bg: 'bg-emerald-50', text: 'text-emerald-800', icon: 'text-emerald-500', border: 'border-emerald-200' },
  red:    { bg: 'bg-red-50',    text: 'text-red-800',    icon: 'text-red-500',    border: 'border-red-200' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-800',   icon: 'text-blue-500',   border: 'border-blue-200' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-800',  icon: 'text-amber-500',  border: 'border-amber-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-800', icon: 'text-orange-500', border: 'border-orange-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-800', icon: 'text-purple-500', border: 'border-purple-200' },
};

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, color }) => {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={c.icon}>{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${c.text}`}>{value.toLocaleString()}</p>
    </div>
  );
};

interface AmountCardProps {
  label: string;
  amount: number;
  formatCurrency: (n: number) => string;
  color: 'indigo' | 'green' | 'red';
}

const amountColorMap: Record<string, { bg: string; text: string; border: string; label: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200', label: 'text-indigo-500' },
  green:  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', label: 'text-emerald-500' },
  red:    { bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200',    label: 'text-red-500' },
};

const AmountCard: React.FC<AmountCardProps> = ({ label, amount, formatCurrency, color }) => {
  const c = amountColorMap[color];
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className={`w-4 h-4 ${c.label}`} />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{formatCurrency(amount)}</p>
    </div>
  );
};

export default BankAuditDashboardPage;
