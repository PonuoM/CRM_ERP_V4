import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export interface TimeTravelRow {
  group_id: string | number;
  name: string;
  snapshot_balance: number;
  current_balance: number;
  new_since: number;
  received_since: number;
  lost_since: number;
}

export function useTimeTravel(companyId: number, targetTime: string) {
  const [snapshotData, setSnapshotData] = useState<TimeTravelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = async (time: string) => {
    if (!time) return;
    try {
      setLoading(true);
      setError(null);
      // Ensure format YYYY-MM-DD HH:mm:ss
      let formattedTime = time;
      if (time.length === 16) {
        // usually YYYY-MM-DDTHH:mm from input type="datetime-local"
        formattedTime = time.replace('T', ' ') + ':00';
      }
      const data = await apiFetch(`distribution_movement/time_travel?target_time=${encodeURIComponent(formattedTime)}`);
      if (data.ok) {
        setSnapshotData(data.data);
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

  useEffect(() => {
    fetchSnapshot(targetTime);
  }, [companyId, targetTime]);

  return { snapshotData, loading, error, refetch: () => fetchSnapshot(targetTime) };
}
