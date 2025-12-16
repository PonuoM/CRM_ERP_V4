import React from 'react';
import { Product, Promotion } from '../types';

interface ProductSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    tab: 'products' | 'promotions';
    onTabChange: (tab: 'products' | 'promotions') => void;
    products: Product[];
    promotions: Promotion[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onSelectProduct: (productId: number) => void;
    onSelectPromotion: (promotionId: number | string) => void;
}

const ProductSelectorModal: React.FC<ProductSelectorModalProps> = ({
    isOpen,
    onClose,
    tab,
    onTabChange,
    products,
    promotions,
    searchTerm,
    onSearchChange,
    onSelectProduct,
    onSelectPromotion,
}) => {




    // Helper function to get promotion price from first item's price_override
    const calcPromotionPrice = (promotion: Promotion): number => {
        if (!promotion.items || promotion.items.length === 0) {
            return 0;
        }

        // Get the first item's price_override
        const firstItem = promotion.items[0];

        // Try both camelCase and snake_case field names
        const priceOverride = (firstItem as any).priceOverride ?? (firstItem as any).price_override;

        if (priceOverride !== null && priceOverride !== undefined) {
            return Number(priceOverride);
        }

        // If price_override is null, calculate from non-freebie items
        const totalPrice = promotion.items.reduce((sum, item: any) => {
            if (item.isFreebie || item.is_freebie) return sum;
            const qty = item.quantity || 0;
            // Try both camelCase and snake_case
            const productPrice = item.productPrice ?? item.product_price;
            const price = productPrice ? Number(productPrice) : 0;
            return sum + (qty * price);
        }, 0);

        return totalPrice;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg w-full max-w-[1200px] p-4 shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header with Tabs */}
                <div className="mb-4 border-b">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">เลือกสินค้า/โปรโมชั่น</h3>
                        <button
                            onClick={onClose}
                            className="px-3 py-1 border rounded hover:bg-gray-50"
                        >
                            ปิด
                        </button>
                    </div>

                    {/* Tab Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onTabChange('products')}
                            className={`px-4 py-2 font-medium transition-colors ${tab === 'products'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                                }`}
                        >
                            สินค้า
                        </button>
                        <button
                            onClick={() => onTabChange('promotions')}
                            className={`px-4 py-2 font-medium transition-colors ${tab === 'promotions'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                                }`}
                        >
                            โปรโมชั่น
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-col h-[70vh]">
                    {/* Search Input */}
                    <div className="mb-3">
                        <input
                            type="text"
                            placeholder={`ค้นหา ${tab === 'products' ? 'SKU, ชื่อสินค้า' : 'ชื่อโปรโมชั่น'}`}
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Products/Promotions Table */}
                    <div className="flex-1 overflow-auto">
                        {tab === 'products' && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[#4e7397] border-b">
                                        <th className="p-2">SKU</th>
                                        <th className="p-2">สินค้า</th>
                                        <th className="p-2">ราคาขาย</th>
                                        <th className="p-2">เลือก</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products
                                        .filter(
                                            (pr) =>
                                                !searchTerm ||
                                                `${pr.sku} ${pr.name}`
                                                    .toLowerCase()
                                                    .includes(searchTerm.toLowerCase())
                                        )
                                        .map((p) => (
                                            <tr key={p.id} className="border-b hover:bg-gray-50">
                                                <td className="p-2 align-top">{p.sku}</td>
                                                <td className="p-2 align-top">{p.name}</td>
                                                <td className="p-2 align-top">{p.price.toFixed(2)}</td>
                                                <td className="p-2 align-top">
                                                    <button
                                                        onClick={() => onSelectProduct(p.id)}
                                                        className="text-blue-600 hover:text-blue-800"
                                                    >
                                                        เลือก
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        )}

                        {tab === 'promotions' && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[#4e7397] border-b">
                                        <th className="p-2">ชื่อโปรโมชั่น</th>
                                        <th className="p-2">รายการ</th>
                                        <th className="p-2">ราคาขาย</th>
                                        <th className="p-2">เลือก</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {promotions
                                        .filter(
                                            (pr) =>
                                                // Only show active promotions
                                                pr.active &&
                                                (!searchTerm ||
                                                    pr.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                        )
                                        .map((p) => (
                                            <tr key={p.id} className="border-b hover:bg-gray-50">
                                                <td className="p-2 align-top">{p.name}</td>
                                                <td className="p-2 align-top text-xs text-gray-600">
                                                    {p.items && p.items.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {p.items.map((item: any, idx: number) => {
                                                                const productName = item.product_name || item.product?.name || item.sku || item.product_sku || '';
                                                                const qty = item.quantity || 1;

                                                                return (
                                                                    <div key={idx}>
                                                                        {qty} x {productName}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="p-2 align-top font-medium">
                                                    ฿{calcPromotionPrice(p).toFixed(2)}
                                                </td>
                                                <td className="p-2 align-top">
                                                    <button
                                                        onClick={() => onSelectPromotion(p.id)}
                                                        className={`px-3 py-1 rounded text-white ${p.active
                                                            ? 'bg-blue-600 hover:bg-blue-700'
                                                            : 'bg-gray-400 cursor-not-allowed'
                                                            }`}
                                                        disabled={!p.active}
                                                    >
                                                        เลือก
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductSelectorModal;
