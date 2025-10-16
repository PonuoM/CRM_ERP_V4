import React, { useState } from 'react';
import { Promotion, Product } from '../types';
import PromotionModal from '../components/PromotionModal';

interface ActivePromotionsPageProps {
  promotions: Promotion[];
  products: Product[];
  onRefresh: () => void;
}

const ActivePromotionsPage: React.FC<ActivePromotionsPageProps> = ({
  promotions,
  products,
  onRefresh
}) => {
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleEditPromotion = (promotion: Promotion) => {
    setSelectedPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPromotion(null);
    onRefresh();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('th-TH');
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : `Product #${productId}`;
  };

  const isPromotionExpired = (promotion: Promotion) => {
    if (!promotion.endDate) return false;
    return new Date(promotion.endDate) < new Date();
  };

  if (promotions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 text-lg">ไม่มีโปรโมชั่นที่กำลังใช้งานอยู่</div>
        <p className="text-gray-400 mt-2">คุณสามารถสร้างโปรโมชั่นใหม่ได้จากแท็บ "สร้างโปรโมชั่นใหม่"</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {promotions.map(promotion => {
          const expired = isPromotionExpired(promotion);
          return (
            <div
              key={promotion.id}
              className={`bg-white rounded-lg shadow-md border ${expired ? 'border-red-200 bg-red-50' : 'border-gray-200'} p-6`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{promotion.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  expired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {expired ? 'หมดอายุ' : 'ใช้งานอยู่'}
                </span>
              </div>
              
              {promotion.sku && (
                <div className="mb-2">
                  <span className="text-sm text-gray-500">รหัสโปรโมชั่น:</span>
                  <span className="ml-2 text-sm font-medium">{promotion.sku}</span>
                </div>
              )}
              
              {promotion.description && (
                <p className="text-gray-600 text-sm mb-4">{promotion.description}</p>
              )}
              
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">ระยะเวลา:</div>
                <div className="text-sm">
                  {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-2">รายการสินค้า ({promotion.items.length} รายการ):</div>
                <div className="space-y-1">
                  {promotion.items.slice(0, 3).map(item => (
                    <div key={item.id} className="text-sm flex justify-between">
                      <span>{getProductName(item.productId)}</span>
                      <span className="text-gray-500">
                        {item.quantity} ชิ้น
                        {item.isFreebie && <span className="ml-1 text-green-600">(ฟรี)</span>}
                        {item.priceOverride && <span className="ml-1 text-blue-600">(฿{item.priceOverride})</span>}
                      </span>
                    </div>
                  ))}
                  {promotion.items.length > 3 && (
                    <div className="text-sm text-gray-400">และอีก {promotion.items.length - 3} รายการ...</div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => handleEditPromotion(promotion)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  แก้ไข
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <PromotionModal
          promotion={selectedPromotion}
          products={products}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default ActivePromotionsPage;
