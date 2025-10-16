import React from 'react';
import { Promotion, Product } from '../types';

interface PromotionHistoryPageProps {
  promotions: Promotion[];
  products: Product[];
}

const PromotionHistoryPage: React.FC<PromotionHistoryPageProps> = ({
  promotions,
  products
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH');
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : `Product #${productId}`;
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
                    <div>เริ่ม: {formatDate(promotion.startDate)}</div>
                    <div>สิ้นสุด: {formatDate(promotion.endDate)}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="max-w-xs">
                    {promotion.items.slice(0, 2).map(item => (
                      <div key={item.id} className="flex justify-between">
                        <span>{getProductName(item.productId)}</span>
                        <span className="text-gray-400">
                          {item.quantity} ชิ้น
                          {item.isFreebie && <span className="ml-1 text-green-600">(ฟรี)</span>}
                        </span>
                      </div>
                    ))}
                    {promotion.items.length > 2 && (
                      <div className="text-gray-400">และอีก {promotion.items.length - 2} รายการ...</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                    หมดอายุ/ปิดใช้งาน
                  </span>
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
