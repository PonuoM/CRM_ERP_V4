import React, { useState, useEffect } from 'react';
import { Product, Promotion, QuotaProduct } from '../types';
import { listQuotaProducts, getQuotaSummary } from '../services/quotaApi';

export interface QuotaInfo {
    productId: number;
    remaining: number;
    totalQuota: number;
    isQuotaProduct: boolean;
}

interface ProductSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    tab: 'products' | 'promotions' | 'quota';
    onTabChange: (tab: 'products' | 'promotions' | 'quota') => void;
    products: Product[];
    promotions: Promotion[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onSelectProduct: (productId: number) => void;
    onSelectPromotion: (promotionId: number | string) => void;
    /** Optional: quota remaining info per product (keyed by productId) */
    quotaMap?: Map<number, QuotaInfo>;
    /** Company ID for loading quota products */
    companyId?: number;
    /** Current user ID for loading personal quota data */
    currentUserId?: number;
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
    quotaMap,
    companyId,
    currentUserId,
}) => {
    const [quotaProducts, setQuotaProducts] = useState<QuotaProduct[]>([]);
    const [loadingQuota, setLoadingQuota] = useState(false);
    // Internal quota map for the quota tab (productId → { remaining, totalQuota })
    const [quotaTabMap, setQuotaTabMap] = useState<Map<number, { remaining: number; totalQuota: number }>>(new Map());

    // Load quota products when modal opens (needed to filter them from normal tab)
    useEffect(() => {
        if (isOpen && companyId && quotaProducts.length === 0) {
            listQuotaProducts(companyId)
                .then((data) => {
                    const activeProducts = data.filter(qp => qp.isActive);
                    setQuotaProducts(activeProducts);
                })
                .catch(() => {});
        }
    }, [isOpen, companyId]);

    // Load quota summary when quota tab is opened
    useEffect(() => {
        if (isOpen && companyId && tab === 'quota' && quotaProducts.length > 0) {
            setLoadingQuota(true);
            (async () => {
                const newMap = new Map<number, { remaining: number; totalQuota: number }>();
                for (const qp of quotaProducts) {
                    try {
                        const summaries = await getQuotaSummary(companyId, qp.id);
                        if (currentUserId) {
                            const userSummary = summaries.find((s: any) => Number(s.userId) === currentUserId);
                            if (userSummary) {
                                newMap.set(qp.productId, {
                                    remaining: Number(userSummary.remaining ?? 0),
                                    totalQuota: Number(userSummary.totalQuota ?? 0),
                                });
                            }
                        }
                    } catch { /* ignore per-product errors */ }
                }
                setQuotaTabMap(newMap);
            })()
                .catch(() => {})
                .finally(() => setLoadingQuota(false));
        }
    }, [isOpen, companyId, tab, quotaProducts.length]);

    // Set of product IDs that are quota products (to exclude from normal tab)
    const quotaProductIds = new Set(quotaProducts.map(qp => qp.productId));

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            setQuotaProducts([]);
            setQuotaTabMap(new Map());
        }
    }, [isOpen]);

    // Helper function to get promotion price from summing all items' price_override or product_price
    const calcPromotionPrice = (promotion: Promotion): number => {
        if (!promotion.items || promotion.items.length === 0) {
            return 0;
        }

        return promotion.items.reduce((sum, item: any) => {
            // Check for freebie status (handle both camelCase and snake_case)
            const isFreebie = item.isFreebie || item.is_freebie;
            if (isFreebie) return sum;

            const qty = Number(item.quantity || 1);

            // 1. Try price_override (camelCase or snake_case)
            const priceOverride = item.priceOverride ?? item.price_override;
            if (priceOverride !== null && priceOverride !== undefined) {
                return sum + Number(priceOverride);
            }

            // 2. Fallback to product_price (camelCase or snake_case)
            const productPrice = item.productPrice ?? item.product_price;
            const price = productPrice ? Number(productPrice) : 0;
            return sum + (price * qty);
        }, 0);
    };

    /** Render quota badge for a product */
    const renderQuotaBadge = (productId: number) => {
        if (!quotaMap) return null;
        const info = quotaMap.get(productId);
        if (!info || !info.isQuotaProduct) return null;

        const remaining = info.remaining;
        const isZero = remaining <= 0;

        return (
            <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isZero
                        ? 'bg-red-100 text-red-700'
                        : remaining <= 3
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                }`}
                title={`โควตาคงเหลือ ${remaining} / ทั้งหมด ${info.totalQuota}`}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                </svg>
                โควตา: {remaining}
            </span>
        );
    };

    /** Render quota badge for quota tab (uses internal quotaTabMap or external quotaMap as fallback) */
    const renderQuotaTabBadge = (qp: QuotaProduct) => {
        // Try internal quota tab map first, then external quotaMap
        const internalInfo = quotaTabMap.get(qp.productId);
        const externalInfo = quotaMap?.get(qp.productId);
        const remaining = internalInfo?.remaining ?? externalInfo?.remaining;
        const totalQuota = internalInfo?.totalQuota ?? externalInfo?.totalQuota;

        if (remaining === undefined || remaining === null) {
            return <span className="text-xs text-gray-400">—</span>;
        }

        const isZero = remaining <= 0;

        return (
            <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    isZero
                        ? 'bg-red-100 text-red-700'
                        : remaining <= 3
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                }`}
            >
                {isZero ? '❌' : remaining <= 3 ? '⚠️' : '✅'} {remaining} / {totalQuota ?? 0}
            </span>
        );
    };

    if (!isOpen) return null;

    const searchPlaceholder = tab === 'products'
        ? 'ค้นหา SKU, ชื่อสินค้า'
        : tab === 'promotions'
            ? 'ค้นหาชื่อโปรโมชั่น'
            : 'ค้นหาสินค้าโควตา';

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-40">
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
                        {companyId && (
                            <button
                                onClick={() => onTabChange('quota')}
                                className={`px-4 py-2 font-medium transition-colors flex items-center gap-1.5 ${tab === 'quota'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                    />
                                </svg>
                                สินค้าโควตา
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-col h-[70vh]">
                    {/* Search Input */}
                    <div className="mb-3">
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Products/Promotions/Quota Table */}
                    <div className="flex-1 overflow-auto">
                        {/* ====== Tab: Products ====== */}
                        {tab === 'products' && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[#4e7397] border-b">
                                        <th className="p-2">SKU</th>
                                        <th className="p-2">สินค้า</th>
                                        <th className="p-2">ราคาขาย</th>
                                        {quotaMap && <th className="p-2">โควตา</th>}
                                        <th className="p-2">เลือก</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products
                                        .filter(
                                            (pr) =>
                                                pr.status !== 'Inactive' &&
                                                !quotaProductIds.has(pr.id) &&
                                                (!searchTerm ||
                                                    `${pr.sku} ${pr.name}`
                                                        .toLowerCase()
                                                        .includes(searchTerm.toLowerCase()))
                                        )
                                        .map((p) => {
                                            const qInfo = quotaMap?.get(p.id);
                                            const isQuotaExhausted = qInfo?.isQuotaProduct && qInfo.remaining <= 0;

                                            return (
                                                <tr
                                                    key={p.id}
                                                    className={`border-b hover:bg-gray-50 ${isQuotaExhausted ? 'bg-red-50/50' : ''}`}
                                                >
                                                    <td className="p-2 align-top">{p.sku}</td>
                                                    <td className="p-2 align-top">{p.name}</td>
                                                    <td className="p-2 align-top">{p.price.toFixed(2)}</td>
                                                    {quotaMap && (
                                                        <td className="p-2 align-top">
                                                            {renderQuotaBadge(p.id)}
                                                        </td>
                                                    )}
                                                    <td className="p-2 align-top">
                                                        <button
                                                            onClick={() => onSelectProduct(p.id)}
                                                            className={`${isQuotaExhausted
                                                                ? 'text-red-400 hover:text-red-600'
                                                                : 'text-blue-600 hover:text-blue-800'
                                                            }`}
                                                            title={isQuotaExhausted ? 'โควตาหมดแล้ว' : undefined}
                                                        >
                                                            {isQuotaExhausted ? 'โควตาหมด' : 'เลือก'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        )}

                        {/* ====== Tab: Promotions ====== */}
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
                                        .filter((pr) => {
                                            if (!pr.active) return false;
                                            // Check end_date expiry
                                            const endDate = (pr as any).end_date ?? (pr as any).endDate;
                                            if (endDate && endDate !== '0000-00-00') {
                                                const expiry = new Date(endDate);
                                                expiry.setHours(23, 59, 59, 999);
                                                if (expiry < new Date()) return false;
                                            }
                                            // Search filter
                                            if (searchTerm && !pr.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                                            return true;
                                        })
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

                        {/* ====== Tab: Quota Products ====== */}
                        {tab === 'quota' && (
                            <>
                                {loadingQuota ? (
                                    <div className="flex items-center justify-center py-16 text-gray-400">
                                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
                                        กำลังโหลดสินค้าโควตา...
                                    </div>
                                ) : quotaProducts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                        <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                            />
                                        </svg>
                                        <p>ไม่มีสินค้าโควตา</p>
                                        <p className="text-xs mt-1">สร้างสินค้าโควตาได้ที่หน้า ตั้งค่าโควตา</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-[#4e7397] border-b">
                                                <th className="p-2">SKU</th>
                                                <th className="p-2">สินค้าในระบบ</th>
                                                <th className="p-2">ชื่อโควตา</th>
                                                <th className="p-2">ราคาขาย</th>
                                                <th className="p-2 text-center">ต้นทุนโควตา</th>
                                                <th className="p-2 text-center">โควตาคงเหลือ</th>
                                                <th className="p-2">เลือก</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {quotaProducts
                                                .filter(qp =>
                                                    !searchTerm ||
                                                    `${qp.productSku || ''} ${qp.displayName} ${qp.productName || ''}`
                                                        .toLowerCase()
                                                        .includes(searchTerm.toLowerCase())
                                                )
                                                .map(qp => {
                                                    const qInfo = quotaMap?.get(qp.productId);
                                                    const isExhausted = qInfo && qInfo.remaining <= 0;

                                                    return (
                                                        <tr
                                                            key={qp.id}
                                                            className={`border-b hover:bg-gray-50 ${isExhausted ? 'bg-red-50/50' : ''}`}
                                                        >
                                                            <td className="p-2 align-top">
                                                                <span className="font-mono text-xs text-gray-500">{qp.productSku || '-'}</span>
                                                            </td>
                                                            <td className="p-2 align-top text-gray-500 text-xs">{qp.productName || '—'}</td>
                                                            <td className="p-2 align-top">
                                                                <span className="font-medium text-gray-800">{qp.displayName}</span>
                                                            </td>
                                                            <td className="p-2 align-top">
                                                                {qp.productPrice != null ? `฿${Number(qp.productPrice).toFixed(2)}` : '—'}
                                                            </td>
                                                            <td className="p-2 align-top text-center">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                                                                    🎫 {qp.quotaCost}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 align-top text-center">
                                                                {renderQuotaTabBadge(qp)}
                                                            </td>
                                                            <td className="p-2 align-top">
                                                                <button
                                                                    onClick={() => onSelectProduct(qp.productId)}
                                                                    className={`px-3 py-1 rounded text-white text-xs font-medium ${
                                                                        isExhausted
                                                                            ? 'bg-red-400 hover:bg-red-500'
                                                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                                                    }`}
                                                                    title={isExhausted ? 'โควตาหมดแล้ว' : undefined}
                                                                >
                                                                    {isExhausted ? 'โควตาหมด' : 'เลือก'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductSelectorModal;
