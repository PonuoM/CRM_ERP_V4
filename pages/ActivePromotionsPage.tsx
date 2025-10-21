import React, { useState, useEffect } from 'react';
import { Promotion, Product } from '../types';
import PromotionModal from '../components/PromotionModal';
import { apiFetch } from '../services/api';

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
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [promotionUsage, setPromotionUsage] = useState<Set<number>>(new Set());

  // Check if promotion is used in any orders
  const checkPromotionUsage = async (promotionId: number): Promise<boolean> => {
    try {
      const response = await apiFetch(`orders?promotion_id=${promotionId}`);
      return Array.isArray(response) && response.length > 0;
    } catch (error) {
      console.error('Error checking promotion usage:', error);
      return false;
    }
  };

  // Load promotion usage status
  useEffect(() => {
    const loadPromotionUsage = async () => {
      const usageSet = new Set<number>();
      for (const promotion of promotions) {
        const isUsed = await checkPromotionUsage(promotion.id);
        if (isUsed) {
          usageSet.add(promotion.id);
        }
      }
      setPromotionUsage(usageSet);
    };

    if (promotions.length > 0) {
      loadPromotionUsage();
    }
  }, [promotions]);

  const handleEditPromotion = (promotion: Promotion) => {
    if (promotionUsage.has(promotion.id)) {
      alert('ไม่สามารถแก้ไขโปรโมชั่นที่มีการสั่งซื้อแล้ว กรุณาปิดใช้งานแทน');
      return;
    }
    setSelectedPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPromotion(null);
    onRefresh();
  };

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

  const isPromotionExpired = (promotion: Promotion) => {
    const endDate = promotion.end_date || promotion.endDate;
    if (!endDate || endDate === '0000-00-00 00:00:00' || endDate === '0000-00-00') return false;
    return new Date(endDate) < new Date();
  };

  const togglePromotionStatus = async (promotion: Promotion) => {
    try {
      // Handle both boolean and number values
      const currentActive = typeof promotion.active === 'boolean' ? promotion.active : promotion.active === 1;
      const newStatus = !currentActive;
      
      console.log('Toggling promotion:', promotion.id, 'from', promotion.active, 'to', newStatus);
      
      const response = await apiFetch(`promotions/${promotion.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: newStatus ? 1 : 0
        })
      });
      
      console.log('Toggle response:', response);
      onRefresh(); // Refresh the list
      setOpenDropdown(null); // Close dropdown
    } catch (error) {
      console.error('Error toggling promotion status:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะโปรโมชั่น: ' + error.message);
    }
  };

  const handleDropdownToggle = (promotionId: number) => {
    setOpenDropdown(openDropdown === promotionId ? null : promotionId);
  };

  const handleEditClick = (promotion: Promotion) => {
    setOpenDropdown(null);
    handleEditPromotion(promotion);
  };

  const handleToggleClick = (promotion: Promotion) => {
    console.log('Handle toggle click for promotion:', promotion);
    console.log('Current active status:', promotion.active);
    setOpenDropdown(null);
    togglePromotionStatus(promotion);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown !== null) {
        const target = event.target as Element;
        // Check if click is outside the dropdown menu
        if (!target.closest('.dropdown-menu') && !target.closest('.dropdown-trigger')) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openDropdown]);

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
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold text-gray-800">{promotion.name}</h3>
                  {promotionUsage.has(promotion.id) && (
                    <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full flex items-center">
                      🔒 ใช้งานแล้ว
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    expired || !promotion.active ? 'bg-red-500' : 'bg-green-500'
                  }`}></div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDropdownToggle(promotion.id);
                      }}
                      className="dropdown-trigger p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {openDropdown === promotion.id && (
                      <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                        <div className="py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(promotion);
                            }}
                            disabled={promotionUsage.has(promotion.id)}
                            className={`flex w-full px-4 py-2 text-sm ${
                              promotionUsage.has(promotion.id)
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                            title={promotionUsage.has(promotion.id) ? 'ไม่สามารถแก้ไขโปรโมชั่นที่มีการสั่งซื้อแล้ว' : 'แก้ไขโปรโมชั่น'}
                          >
                            {promotionUsage.has(promotion.id) ? (
                              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                            {promotionUsage.has(promotion.id) ? '🔒 ใช้งานแล้ว' : 'แก้ไข'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleClick(promotion);
                            }}
                            className="flex w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                            </svg>
                            ปิดใช้งาน
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
                  {formatDate(promotion.start_date || promotion.startDate)} - {formatDate(promotion.end_date || promotion.endDate)}
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-2">รายการสินค้า ({promotion.items.length} รายการ):</div>
                <div className="space-y-1">
                  {promotion.items.slice(0, 3).map(item => (
                    <div key={item.id} className="text-sm flex justify-between">
                      <span>{getProductName(item)}</span>
                      <span className="text-gray-500">
                        {item.quantity} ชิ้น
                        {(item.isFreebie || item.is_freebie) && <span className="ml-1 text-green-600">(ฟรี)</span>}
                        {(item.priceOverride || item.price_override) && <span className="ml-1 text-blue-600">(฿{item.priceOverride || item.price_override})</span>}
                      </span>
                    </div>
                  ))}
                  {promotion.items.length > 3 && (
                    <div className="text-sm text-gray-400">และอีก {promotion.items.length - 3} รายการ...</div>
                  )}
                </div>
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
