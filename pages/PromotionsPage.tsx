import React, { useState, useEffect } from 'react';
import { Promotion, Product } from '../types';
import { listPromotions, listProducts } from '../services/api';
import ActivePromotionsPage from './ActivePromotionsPage';
import PromotionHistoryPage from './PromotionHistoryPage';
import CreatePromotionPage from './CreatePromotionPage';

type PromotionsView = 'active' | 'history' | 'create';

const PromotionsPage: React.FC = () => {
  const [currentView, setCurrentView] = useState<PromotionsView>('active');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [promotionsData, productsData] = await Promise.all([
          listPromotions(),
          listProducts()
        ]);
        setPromotions(Array.isArray(promotionsData) ? promotionsData : []);
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (error) {
        console.error('Error loading promotions data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const refreshPromotions = async () => {
    try {
      const promotionsData = await listPromotions();
      setPromotions(Array.isArray(promotionsData) ? promotionsData : []);
    } catch (error) {
      console.error('Error refreshing promotions:', error);
    }
  };

  // Helper function to check if promotion is expired
  const isPromotionExpired = (promotion: Promotion) => {
    const endDate = promotion.end_date || promotion.endDate;
    if (!endDate || endDate === '0000-00-00 00:00:00' || endDate === '0000-00-00') return false;
    
    // Parse the end date and compare with current date
    const endDateObj = new Date(endDate);
    const currentDate = new Date();
    
    // Set time to end of day for end date to allow full day usage
    endDateObj.setHours(23, 59, 59, 999);
    
    console.log(`Checking expiration for promotion ${promotion.id}:`, {
      endDate: endDate,
      endDateObj: endDateObj,
      currentDate: currentDate,
      isExpired: endDateObj < currentDate
    });
    
    return endDateObj < currentDate;
  };

  // Helper function to check if promotion is truly active (not expired and active flag is true)
  const isPromotionTrulyActive = (promotion: Promotion) => {
    const expired = isPromotionExpired(promotion);
    const active = promotion.active;
    const result = active && !expired;
    
    console.log(`Promotion ${promotion.id} (${promotion.name}):`, {
      active: active,
      endDate: promotion.end_date || promotion.endDate,
      expired: expired,
      result: result
    });
    
    return result;
  };

  const renderView = () => {
    switch (currentView) {
      case 'active':
        const activePromotions = promotions.filter(p => isPromotionTrulyActive(p));
        console.log('Active promotions:', activePromotions.map(p => ({ id: p.id, name: p.name, active: p.active })));
        return (
          <ActivePromotionsPage
            promotions={activePromotions}
            products={products}
            onRefresh={refreshPromotions}
          />
        );
      case 'history':
        const historyPromotions = promotions.filter(p => !isPromotionTrulyActive(p));
        console.log('History promotions:', historyPromotions.map(p => ({ id: p.id, name: p.name, active: p.active })));
        return (
          <PromotionHistoryPage
            promotions={historyPromotions}
            products={products}
            onRefresh={refreshPromotions}
          />
        );
      case 'create':
        return (
          <CreatePromotionPage
            products={products}
            onSuccess={() => {
              refreshPromotions();
              setCurrentView('active');
            }}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">จัดการโปรโมชั่น</h1>
        <div className="flex space-x-4 border-b">
          <button
            className={`pb-2 px-1 ${
              currentView === 'active'
                ? 'border-b-2 border-green-600 text-green-600 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setCurrentView('active')}
          >
            โปรโมชั่นที่กำลังใช้งาน
          </button>
          <button
            className={`pb-2 px-1 ${
              currentView === 'history'
                ? 'border-b-2 border-green-600 text-green-600 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setCurrentView('history')}
          >
            ประวัติโปรโมชั่น
          </button>
          <button
            className={`pb-2 px-1 ${
              currentView === 'create'
                ? 'border-b-2 border-green-600 text-green-600 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setCurrentView('create')}
          >
            สร้างโปรโมชั่นใหม่
          </button>
        </div>
      </div>

      {renderView()}
    </div>
  );
};

export default PromotionsPage;
