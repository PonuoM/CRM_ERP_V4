export interface AgentData {
    id: number;
    totalCustomers: number;
    callMinutes: number;
}

export interface QuotaCalculationParams {
    selectedAgents: number[];
    agents: AgentData[];
    totalToDistribute: number;
    distributionMode: 'equal' | 'load_balance' | 'performance';
    distributeRemainder: boolean;
    remainderMode?: 'sequential' | 'performance';
}

export function calculateQuotas(params: QuotaCalculationParams): Record<number, number> {
    const { selectedAgents, agents, totalToDistribute, distributionMode, distributeRemainder, remainderMode = 'sequential' } = params;

    if (selectedAgents.length === 0 || totalToDistribute <= 0) {
        const zeros: Record<number, number> = {};
        selectedAgents.forEach(id => zeros[id] = 0);
        return zeros;
    }

    const newQuotas: Record<number, number> = {};
    selectedAgents.forEach(id => newQuotas[id] = 0);
    let remainder = totalToDistribute;

    if (distributionMode === 'equal') {
        const base = Math.floor(totalToDistribute / selectedAgents.length);
        selectedAgents.forEach(id => newQuotas[id] = base);
        remainder = totalToDistribute - (base * selectedAgents.length);

        if (distributeRemainder && remainder > 0) {
            let agentsToReceive = [...selectedAgents];
            if (remainderMode === 'performance') {
                agentsToReceive.sort((a, b) => {
                    const minsA = agents.find(ag => ag.id === a)?.callMinutes || 0;
                    const minsB = agents.find(ag => ag.id === b)?.callMinutes || 0;
                    if (minsB !== minsA) return minsB - minsA;
                    return a - b; // Fallback sequential
                });
            }

            for (let i = 0; i < agentsToReceive.length && remainder > 0; i++) {
                newQuotas[agentsToReceive[i]]++;
                remainder--;
            }
        }
    } else if (distributionMode === 'load_balance') {
        const currentLoads: Record<number, number> = {};
        selectedAgents.forEach(id => {
            currentLoads[id] = agents.find(ag => ag.id === id)?.totalCustomers || 0;
        });

        for (let i = 0; i < totalToDistribute; i++) {
            let minLoad = Infinity;
            let minAgentId = selectedAgents[0];
            for (const id of selectedAgents) {
                if (currentLoads[id] < minLoad) {
                    minLoad = currentLoads[id];
                    minAgentId = id;
                }
            }
            newQuotas[minAgentId]++;
            currentLoads[minAgentId]++;
        }
    } else if (distributionMode === 'performance') {
        const stats: Record<number, number> = {};
        let totalCallMinutes = 0;
        selectedAgents.forEach(id => {
            const mins = agents.find(ag => ag.id === id)?.callMinutes || 0;
            stats[id] = mins > 0 ? mins : 0;
            totalCallMinutes += stats[id];
        });

        if (totalCallMinutes === 0) {
            // Fallback to equal
            const base = Math.floor(totalToDistribute / selectedAgents.length);
            selectedAgents.forEach(id => newQuotas[id] = base);
            remainder = totalToDistribute - (base * selectedAgents.length);
            if (distributeRemainder && remainder > 0) {
                let agentsToReceive = [...selectedAgents];
                if (remainderMode === 'performance') {
                    agentsToReceive.sort((a, b) => {
                        const minsA = agents.find(ag => ag.id === a)?.callMinutes || 0;
                        const minsB = agents.find(ag => ag.id === b)?.callMinutes || 0;
                        if (minsB !== minsA) return minsB - minsA;
                        return a - b;
                    });
                }
                for (let i = 0; i < agentsToReceive.length && remainder > 0; i++) {
                    newQuotas[agentsToReceive[i]]++;
                    remainder--;
                }
            }
        } else {
            selectedAgents.forEach(id => {
                const share = Math.floor((stats[id] / totalCallMinutes) * totalToDistribute);
                newQuotas[id] = share;
                remainder -= share;
            });

            if (remainder > 0) {
                const sortedAgents = [...selectedAgents].sort((a, b) => {
                    if (stats[b] !== stats[a]) return stats[b] - stats[a];
                    return a - b;
                });
                for (let i = 0; i < sortedAgents.length && remainder > 0; i++) {
                    newQuotas[sortedAgents[i]]++;
                    remainder--;
                }
            }
        }
    }

    return newQuotas;
}
