import React, { useEffect, useMemo, useState } from 'react';
import { UserX } from 'lucide-react';
import { AgentWithBaskets, BasketConfig } from '../../types/distribution';

interface DepartedAgentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    departedAgents: AgentWithBaskets[];
    dashboardBaskets: BasketConfig[];
    onAction: (agent: AgentWithBaskets, presetBaskets: string[], mode: 'reclaim' | 'transfer') => void;
}

const statusLabel = (status?: string) => (status === 'resigned' ? 'ลาออก' : 'ไม่ใช้งาน');

const DepartedAgentsModal: React.FC<DepartedAgentsModalProps> = ({
    isOpen,
    onClose,
    departedAgents,
    dashboardBaskets,
    onAction
}) => {
    // ถังที่ผู้ใช้ติ๊กเลือกไว้ แยกตามพนักงาน 1 คน { agentId: [basket_key, ...] }
    const [picked, setPicked] = useState<Record<number, string[]>>({});

    useEffect(() => {
        if (isOpen) setPicked({});
    }, [isOpen]);

    const shownBaskets = useMemo(
        () => dashboardBaskets.filter(b => b.basket_key !== 'upsell_dis'),
        [dashboardBaskets]
    );

    const totalStuck = useMemo(
        () => departedAgents.reduce((sum, a) => sum + (a.totalCustomers || 0), 0),
        [departedAgents]
    );

    if (!isOpen) return null;

    // ถังที่ไม่มี linked_basket_key ดึงคืนเข้าถังไม่ได้ — โอนให้พนักงานได้อย่างเดียว
    const isReclaimable = (basket: BasketConfig) => !!basket.linked_basket_key;

    const togglePick = (agentId: number, basketKey: string) => {
        setPicked(prev => {
            const cur = prev[agentId] || [];
            return {
                ...prev,
                [agentId]: cur.includes(basketKey)
                    ? cur.filter(k => k !== basketKey)
                    : [...cur, basketKey]
            };
        });
    };

    const pickableKeysFor = (agent: AgentWithBaskets) =>
        shownBaskets
            .filter(b => (agent.basketCounts?.[b.basket_key] || 0) > 0)
            .map(b => b.basket_key);

    const toggleAllFor = (agent: AgentWithBaskets) => {
        const all = pickableKeysFor(agent);
        setPicked(prev => {
            const cur = prev[agent.id] || [];
            return { ...prev, [agent.id]: cur.length === all.length ? [] : all };
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3">
            <div className="bg-gray-50 rounded-2xl w-full max-w-[96vw] max-h-[94vh] overflow-hidden shadow-2xl flex flex-col">

                {/* Header */}
                <div className="px-5 py-3 bg-white border-b flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-50 rounded-lg">
                            <UserX size={18} className="text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">รายชื่อค้างกับพนักงานที่พ้นสภาพ</h3>
                            <p className="text-xs text-gray-500">
                                {departedAgents.length} คน ถือลูกค้าค้างรวม {totalStuck.toLocaleString()} ราย
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden p-4 flex flex-col">
                    <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
                        พนักงานเหล่านี้ถูกปิดสถานะแล้ว จึงไม่แสดงในตารางแจกงานหลักและรับรายชื่อใหม่ไม่ได้ แต่ลูกค้าที่เคยถืออยู่ยังค้างในมืออยู่
                        <br />
                        <strong>คลิกตัวเลขในถัง</strong> เพื่อเลือกถังที่ต้องการ (ไม่เลือกเลย = ไปเลือกต่อในหน้าถัดไป) ·{' '}
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500 align-middle" />{' '}
                        ถังสีส้ม เช่น <strong>ส่วนตัว 1-2 เดือน</strong> และ <strong>ส่วนตัวโอกาสสุดท้าย</strong> ไม่มีถังปลายทางผูกไว้
                        จึง <strong>โอนให้พนักงานได้อย่างเดียว ดึงคืนเข้าถังไม่ได้</strong>
                    </div>

                    {departedAgents.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 border rounded-lg bg-white">
                            ไม่มีรายชื่อค้างกับพนักงานที่พ้นสภาพแล้ว 🎉
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto border rounded-lg bg-white">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="sticky left-0 top-0 z-30 bg-gray-100 p-2 text-left font-semibold text-gray-600 border-r whitespace-nowrap min-w-[140px]">
                                            พนักงาน
                                        </th>
                                        <th className="sticky top-0 z-20 bg-gray-100 p-2 text-center font-semibold text-gray-600 whitespace-nowrap">
                                            ลูกค้า<br />ทั้งหมด
                                        </th>
                                        {shownBaskets.map(basket => (
                                            <th
                                                key={basket.basket_key}
                                                className={`sticky top-0 z-20 bg-gray-100 p-2 text-center font-semibold whitespace-nowrap ${
                                                    isReclaimable(basket) ? 'text-gray-600' : 'text-amber-700'
                                                }`}
                                            >
                                                <div
                                                    className="truncate max-w-[76px] mx-auto"
                                                    title={
                                                        isReclaimable(basket)
                                                            ? basket.basket_name
                                                            : `${basket.basket_name} — โอนให้พนักงานได้อย่างเดียว (ไม่มีถังปลายทางผูกไว้)`
                                                    }
                                                >
                                                    {basket.basket_name}
                                                </div>
                                            </th>
                                        ))}
                                        <th className="sticky right-0 top-0 z-30 bg-gray-100 p-2 text-center font-semibold text-gray-600 border-l whitespace-nowrap">
                                            จัดการ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departedAgents.map(agent => {
                                        const rowPicked = picked[agent.id] || [];
                                        const pickable = pickableKeysFor(agent);
                                        const pickedTotal = rowPicked.reduce(
                                            (sum, k) => sum + (agent.basketCounts?.[k] || 0),
                                            0
                                        );
                                        // แยกว่าที่เลือกไว้ ดึงคืนเข้าถังได้กี่ถัง / ต้องโอนอย่างเดียวกี่ถัง
                                        const pickedReclaimable = rowPicked.filter(k =>
                                            shownBaskets.some(b => b.basket_key === k && isReclaimable(b))
                                        );
                                        const pickedTransferOnly = rowPicked.filter(k =>
                                            shownBaskets.some(b => b.basket_key === k && !isReclaimable(b))
                                        );
                                        // เลือกไว้แต่ไม่มีถังไหนดึงคืนได้เลย → ปิดปุ่มดึงคืน
                                        const reclaimDisabled = rowPicked.length > 0 && pickedReclaimable.length === 0;

                                        return (
                                            <tr key={agent.id} className="group border-t hover:bg-gray-50 transition-colors">
                                                {/* ชื่อ — ตรึงซ้าย */}
                                                <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 p-2 border-r align-top">
                                                    <div className="whitespace-nowrap font-medium text-gray-800">
                                                        {agent.firstName} {agent.lastName}
                                                        <span className="ml-1.5 px-1 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 rounded">
                                                            {statusLabel(agent.status)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-gray-400">{agent.username}</span>
                                                        {pickable.length > 0 && (
                                                            <button
                                                                onClick={() => toggleAllFor(agent)}
                                                                className="text-[10px] text-blue-600 hover:underline"
                                                            >
                                                                {rowPicked.length === pickable.length ? 'ล้าง' : 'เลือกทุกถัง'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* ยอดรวม */}
                                                <td className="p-2 text-center align-top">
                                                    <div className="font-bold text-red-600">
                                                        {(agent.totalCustomers || 0).toLocaleString()}
                                                    </div>
                                                    {pickedTotal > 0 && (
                                                        <div className="text-[10px] text-blue-600 font-semibold whitespace-nowrap">
                                                            เลือก {pickedTotal.toLocaleString()}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* ถัง — คลิกเพื่อเลือก */}
                                                {shownBaskets.map(basket => {
                                                    const count = agent.basketCounts?.[basket.basket_key] || 0;
                                                    const canPick = count > 0;
                                                    const isPicked = rowPicked.includes(basket.basket_key);
                                                    const transferOnly = !isReclaimable(basket);

                                                    let cls = 'text-gray-300 cursor-not-allowed';
                                                    if (canPick && isPicked) {
                                                        cls = transferOnly
                                                            ? 'bg-amber-500 text-white'
                                                            : 'bg-blue-600 text-white';
                                                    } else if (canPick) {
                                                        cls = transferOnly
                                                            ? 'text-amber-700 border border-amber-200 hover:bg-amber-50'
                                                            : 'text-gray-700 border border-transparent hover:bg-blue-50 hover:border-blue-200';
                                                    }

                                                    return (
                                                        <td key={basket.basket_key} className="p-1 text-center align-top">
                                                            <button
                                                                disabled={!canPick}
                                                                onClick={() => togglePick(agent.id, basket.basket_key)}
                                                                title={
                                                                    count === 0
                                                                        ? 'ไม่มีลูกค้าในถังนี้'
                                                                        : transferOnly
                                                                            ? 'ถังนี้ดึงคืนเข้าถังไม่ได้ — โอนให้พนักงานเท่านั้น'
                                                                            : isPicked
                                                                                ? 'คลิกเพื่อยกเลิกการเลือก'
                                                                                : 'คลิกเพื่อเลือกถังนี้'
                                                                }
                                                                className={`w-full px-2 py-1 rounded font-semibold transition-colors ${cls}`}
                                                            >
                                                                {count.toLocaleString()}
                                                            </button>
                                                        </td>
                                                    );
                                                })}

                                                {/* ปุ่ม — ตรึงขวา */}
                                                <td className="sticky right-0 z-10 bg-white group-hover:bg-gray-50 p-2 border-l align-top">
                                                    <div className="flex flex-col gap-1 min-w-[120px]">
                                                        <button
                                                            disabled={reclaimDisabled}
                                                            onClick={() => onAction(agent, pickedReclaimable, 'reclaim')}
                                                            title={
                                                                reclaimDisabled
                                                                    ? 'ถังที่เลือกไว้ไม่มีถังปลายทางผูกไว้ ดึงคืนไม่ได้ — ใช้ปุ่มโอนแทน'
                                                                    : 'ดึงลูกค้ากลับเข้าถังแจก'
                                                            }
                                                            className="px-2 py-1.5 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                                                        >
                                                            ดึงคืนเข้าถัง{pickedReclaimable.length > 0 ? ` (${pickedReclaimable.length})` : ''}
                                                        </button>
                                                        <button
                                                            onClick={() => onAction(agent, rowPicked, 'transfer')}
                                                            title="โอนลูกค้าให้พนักงานคนอื่นโดยตรง"
                                                            className="px-2 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                                                        >
                                                            โอนให้พนักงาน{rowPicked.length > 0 ? ` (${rowPicked.length})` : ''}
                                                        </button>
                                                        {pickedTransferOnly.length > 0 && (
                                                            <div className="text-[10px] text-amber-700 leading-tight">
                                                                {pickedTransferOnly.length} ถังโอนได้อย่างเดียว
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-white border-t flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DepartedAgentsModal;
