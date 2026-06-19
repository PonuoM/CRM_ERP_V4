import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';

interface UseCallMinutesOptions {
    agentIds: string;
    companyId: string | number;
    startDate: string;
    endDate: string;
    dataSource: 'daily' | 'realtime';
    enabled?: boolean;
}

interface CallMinutesResponse {
    agents?: Record<string, number>;
    error?: string;
}

export const useCallMinutes = ({
    agentIds,
    companyId,
    startDate,
    endDate,
    dataSource,
    enabled = true
}: UseCallMinutesOptions) => {
    return useQuery<CallMinutesResponse, Error>({
        queryKey: ['callMinutes', agentIds, companyId, startDate, endDate, dataSource],
        queryFn: async () => {
            const actionEndpoint = dataSource === 'realtime' ? 'get_realtime_call_minutes' : 'get_call_minutes';
            
            const response = await apiFetch(
                `customers?action=${actionEndpoint}&assignedTo=${agentIds}&companyId=${companyId}&start_date=${startDate}&end_date=${endDate}`
            );
            
            if (response?.error) {
                throw new Error(response.error);
            }
            
            return response;
        },
        enabled: enabled && Boolean(agentIds) && Boolean(companyId),
        staleTime: dataSource === 'realtime' ? 1000 * 60 : 1000 * 60 * 5, // 1 minute for realtime, 5 mins for daily
    });
};
