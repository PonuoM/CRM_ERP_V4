import React from 'react';
import { Loader2 } from 'lucide-react';
import { BasketConfig } from '../../types/distribution';

interface DistributionStatsCardsProps {
    baskets: BasketConfig[];
    basketCounts: Record<string, number>;
    activeBasket: string;
    setActiveBasket: (basketKey: string) => void;
    totalInAllBaskets: number;
    handleBlockedBasketClick: () => void;
    forceDistributeHolding: boolean;
    setForceDistributeHolding: (val: boolean) => void;
    setTargetBasket: (val: string) => void;
    loadingBasketCounts?: boolean;
}

const DistributionStatsCards: React.FC<DistributionStatsCardsProps> = ({
    baskets,
    basketCounts,
    activeBasket,
    setActiveBasket,
    totalInAllBaskets,
    handleBlockedBasketClick,
    forceDistributeHolding,
    setForceDistributeHolding,
    setTargetBasket,
    loadingBasketCounts = false
}) => {
    return (
        <>
            <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                {baskets.map(basket => {
                    const isHolding = basket.basket_key === 'holding_before_redistribute';
                    const isActive = activeBasket === basket.basket_key;
                    return (
                        <button
                            key={basket.basket_key}
                            onClick={() => {
                                if (basket.basket_key === 'block_customer') {
                                    handleBlockedBasketClick();
                                    return;
                                }
                                setActiveBasket(basket.basket_key);
                            }}
                            className={`p-3 rounded-xl shadow-sm border-2 transition-all hover:shadow-md text-left ${isHolding
                                ? (isActive
                                    ? 'border-amber-500 bg-amber-50'
                                    : 'border-amber-200 bg-amber-50/50 hover:border-amber-400')
                                : (isActive
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-100 bg-white hover:border-blue-200')
                                }`}
                        >
                            <p className={`text-[11px] font-medium mb-0.5 truncate ${basket.basket_key === 'block_customer' ? 'text-red-600' : isHolding ? 'text-amber-600' : 'text-gray-500'}`}>
                                {basket.basket_key === 'block_customer' ? '🚫 ' : isHolding ? '⏳ ' : ''}{basket.basket_name}
                            </p>
                            <div className={`text-xl font-bold flex items-center h-7 ${isHolding
                                ? (isActive ? 'text-amber-600' : 'text-amber-700')
                                : (isActive ? 'text-blue-600' : 'text-gray-900')
                                }`}>
                                {loadingBasketCounts ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                ) : (
                                    basketCounts[basket.basket_key]?.toLocaleString() || 0
                                )}
                            </div>
                        </button>
                    );
                })}

                {/* Total Card */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl shadow-md text-white flex flex-col justify-center">
                    <p className="text-[11px] font-medium text-green-100 mb-0.5">รวมทั้งหมด</p>
                    <div className="text-xl font-bold flex items-center h-7">
                        {loadingBasketCounts ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                            totalInAllBaskets.toLocaleString()
                        )}
                    </div>
                </div>
            </div>

            {/* Holding Basket Notice */}
            {activeBasket === 'holding_before_redistribute' && !forceDistributeHolding && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6 text-center">
                    <div className="text-amber-500 text-5xl mb-3">⏳</div>
                    <h3 className="text-lg font-bold text-amber-800">ถังพักรอแจก</h3>
                    <p className="text-amber-700 mt-2">
                        ลูกค้าในถังนี้กำลังอยู่ระหว่างช่วงพัก 30 วัน
                        ก่อนจะถูกย้ายไปถัง "หาคนดูแลใหม่" โดยอัตโนมัติ
                    </p>
                    <p className="text-amber-600 text-sm mt-3 font-medium">ไม่สามารถแจกลูกค้าจากถังนี้ตาม Flow ปกติได้</p>
                    <button 
                        onClick={() => {
                            setForceDistributeHolding(true);
                            setTargetBasket('find_new_owner_dash');
                        }}
                        className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium transition-colors shadow-sm"
                    >
                        ยืนยันที่จะแจก (แจกไป "หาคนดูแลใหม่")
                    </button>
                </div>
            )}
        </>
    );
};

export default DistributionStatsCards;
