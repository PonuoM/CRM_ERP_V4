import React from 'react';
import { Promotion, Product } from '../types';
import { apiFetch } from '../services/api';

interface PromotionHistoryPageProps {
  promotions: Promotion[];
  products: Product[];
  onRefresh: () => void;
}

const PromotionHistoryPage: React.FC<PromotionHistoryPageProps> = ({
  promotions,
  products,
  onRefresh
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === '0000-00-00 00:00:00' || dateString === '0000-00-00') return '-';
    return new Date(dateString).toLocaleDateString('th-TH');
  };

  const getProductName = (item: any) => {
    // Use product_name from API if available, otherwise fallback to products array
    if (item.product_name) {
      return item.product_name;
    }
    const product = products.find(p => p.id === item.productId);
    return product ? product.name : `Product #${item.productId}`;
  };

  // Helper function to check if promotion is expired
  const isPromotionExpired = (promotion: Promotion) => {
    const endDate = promotion.end_date || promotion.endDate;
    if (!endDate || endDate === '0000-00-00 00:00:00' || endDate === '0000-00-00') return false;
    return new Date(endDate) < new Date();
  };

  // Helper function to get promotion status
  const getPromotionStatus = (promotion: Promotion) => {
    const expired = isPromotionExpired(promotion);
    const active = promotion.active;
    
    if (expired) {
      return { text: 'หมดอายุ', color: 'bg-red-100 text-red-800' };
    } else if (!active) {
      return { text: 'ปิดใช้งาน', color: 'bg-gray-100 text-gray-800' };
    } else {
      return { text: 'ใช้งาน', color: 'bg-green-100 text-green-800' };
    }
  };

  const activatePromotion = async (promotion: Promotion) => {
    try {
      await apiFetch(`promotions/${promotion.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: 1
        })
      });
      
      onRefresh(); // Refresh the list
    } catch (error) {
      console.error('Error activating promotion:', error);
      alert('เกิดข้อผิดพลาดในการเปิดใช้งานโปรโมชั่น');
    }
  };

  if (promotions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 text-lg">ไม่มีประวัติโปรโมชั่น</div>
        <p className="text-gray-400 mt-2">โปรโมชั่นที่หมดอายุหรือถูกปิดใช้งานจะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ชื่อโปรโมชั่น
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                รหัสโปรโมชั่น
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ระยะเวลา
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                จำนวนสินค้า
              </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  การจัดการ
                </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {promotions.map(promotion => (
              <tr key={promotion.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{promotion.name}</div>
                    {promotion.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">{promotion.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {promotion.sku || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    <div>เริ่ม: {formatDate(promotion.start_date || promotion.startDate)}</div>
                    <div>สิ้นสุด: {formatDate(promotion.end_date || promotion.endDate)}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="max-w-xs">
                    {promotion.items.slice(0, 2).map(item => (
                      <div key={item.id} className="flex justify-between">
                        <span>{getProductName(item)}</span>
                        <span className="text-gray-400">
                          {item.quantity} ชิ้น
                          {(item.isFreebie || item.is_freebie) && <span className="ml-1 text-green-600">(ฟรี)</span>}
                        </span>
                      </div>
                    ))}
                    {promotion.items.length > 2 && (
                      <div className="text-gray-400">และอีก {promotion.items.length - 2} รายการ...</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {(() => {
                    const status = getPromotionStatus(promotion);
                    return (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}`}>
                        {status.text}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(() => {
                    const expired = isPromotionExpired(promotion);
                    const active = promotion.active;
                    
                    if (expired) {
                      return (
                        <span className="px-3 py-1 bg-gray-300 text-gray-600 text-sm rounded cursor-not-allowed">
                          หมดอายุแล้ว
                        </span>
                      );
                    } else if (!active) {
                      return (
                        <button
                          onClick={() => activatePromotion(promotion)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          เปิดใช้งาน
                        </button>
                      );
                    } else {
                      return (
                        <span className="px-3 py-1 bg-green-100 text-green-600 text-sm rounded">
                          ใช้งานอยู่
                        </span>
                      );
                    }
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PromotionHistoryPage;
