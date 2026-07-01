import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export interface MonthlySummaryRow {
  group_id: string | number;
  name: string;
  start_balance: number;
  new_created: number;
  received: number;
  lost: number;
  current_balance: number;
}

export function useMonthlySummary(companyId: number, month: string) {
  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, [companyId, month]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch(`distribution_movement/monthly_summary?month=${month}`);
      if (data.ok) {
        setSummary(data.data);
      } else {
        setError(data.message || 'Unknown error');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  return { summary, loading, error, refetch: fetchSummary };
}
