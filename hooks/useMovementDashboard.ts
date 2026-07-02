import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../services/api';

export interface MovementStat {
  movement_date: string;
  agent_id: number;
  direction: 'received' | 'lost';
  transfer_type: 'from_basket' | 'from_agent' | 'to_basket' | 'to_agent';
  api_source: string;
  cnt: number;
}

export interface MovementLedgerRow {
  id: number;
  created_at: string;
  customer_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  old_value: string | null;
  new_value: string | null;
  api_source: string;
  old_agent_name: string | null;
  new_agent_name: string | null;
  changed_by: number;
  changed_by_name: string | null;
}

export function useMovementDashboard(companyId: number, startDate: string, endDate: string, agentId: string) {
  const [stats, setStats] = useState<MovementStat[]>([]);
  const [ledger, setLedger] = useState<MovementLedgerRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  useEffect(() => {
    fetchStats();
  }, [companyId, startDate, endDate, agentId]);

  useEffect(() => {
    fetchLedger();
  }, [companyId, startDate, endDate, agentId, page]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`distribution_movement/stats?start_date=${startDate}&end_date=${endDate}&agent_id=${agentId}`);
      if (data.ok) {
        setStats(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`distribution_movement/ledger?start_date=${startDate}&end_date=${endDate}&agent_id=${agentId}&page=${page}&limit=${limit}`);
      if (data.ok) {
        setLedger(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.total_pages);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const chartData = useMemo(() => {
    // 1. Summary Cards
    let totalReceived = 0;
    let totalLost = 0;
    let autoReceived = 0;
    let autoReclaimed = 0;

    stats.forEach(s => {
      if (s.direction === 'received') {
        totalReceived += s.cnt;
        if (s.api_source === 'distribution_v2' || s.api_source === 'basket_routing_v2/assign_owner') {
          autoReceived += s.cnt;
        }
      } else {
        totalLost += s.cnt;
        if (s.api_source === 'distribution_v2' || s.api_source === 'basket_routing_v2/assign_owner') {
          autoReclaimed += s.cnt;
        }
      }
    });

    // 2. Bar Chart (Daily Flow)
    const datesMap = new Map<string, { received: number, lost: number }>();
    stats.forEach(s => {
      const d = s.movement_date;
      if (!datesMap.has(d)) datesMap.set(d, { received: 0, lost: 0 });
      const obj = datesMap.get(d)!;
      if (s.direction === 'received') obj.received += s.cnt;
      else obj.lost -= s.cnt; // Negative for chart
    });

    const sortedDates = Array.from(datesMap.keys()).sort();
    const barSeries = [
      { name: 'ได้รับ', data: sortedDates.map(d => datesMap.get(d)!.received) },
      { name: 'ถูกดึงคืน/โอน', data: sortedDates.map(d => datesMap.get(d)!.lost) }
    ];

    // 3. Source Breakdown (Donut)
    const sourceMap = new Map<string, number>();
    stats.forEach(s => {
      const key = s.api_source || 'manual';
      sourceMap.set(key, (sourceMap.get(key) || 0) + s.cnt);
    });

    const donutLabels = Array.from(sourceMap.keys());
    const donutSeries = Array.from(sourceMap.values());

    return {
      summary: { totalReceived, totalLost, autoReceived, autoReclaimed },
      barChart: { categories: sortedDates, series: barSeries },
      donutChart: { labels: donutLabels, series: donutSeries }
    };
  }, [stats]);

  return {
    stats,
    ledger,
    chartData,
    loading,
    page,
    setPage,
    total,
    totalPages
  };
}
