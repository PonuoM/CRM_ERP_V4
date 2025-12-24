import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface ProductOption {
    id: number;
    sku: string;
    name: string;
}

interface MultiSelectProductFilterProps {
    products: ProductOption[];
    selectedProducts: number[];
    onChange: (selectedProducts: number[]) => void;
}

const MultiSelectProductFilter: React.FC<MultiSelectProductFilterProps> = ({
    products,
    selectedProducts,
    onChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredProducts = products
        .filter(
            (p) =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleToggleProduct = (productId: number) => {
        if (selectedProducts.includes(productId)) {
            onChange(selectedProducts.filter((id) => id !== productId));
        } else {
            onChange([...selectedProducts, productId]);
        }
    };

    const handleSelectAll = () => {
        onChange(products.map((p) => p.id));
    };

    const handleClearAll = () => {
        onChange([]);
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Main button */}
            <button
                onClick={toggleDropdown}
                className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
            >
                <span className="text-gray-900">
                    {selectedProducts.length === 0
                        ? "เลือกสินค้า..."
                        : selectedProducts.length === products.length
                            ? "ทั้งหมด"
                            : `เลือก ${selectedProducts.length} รายการ`}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                    {/* Search bar */}
                    <div className="p-3 border-b border-gray-200">
                        <input
                            type="text"
                            placeholder="ค้นหาสินค้า (ชื่อ หรือ SKU)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                    </div>

                    {/* Quick actions */}
                    <div className="p-2 border-b border-gray-200 flex gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="px-3 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                        >
                            เลือกทั้งหมด
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                        >
                            เคลียร์ทั้งหมด
                        </button>
                    </div>

                    {/* Options list */}
                    <div className="max-h-60 overflow-y-auto p-2">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                                ไม่พบสินค้าที่ค้นหา
                            </div>
                        ) : (
                            filteredProducts.map((p) => {
                                const isSelected = selectedProducts.includes(p.id);
                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => handleToggleProduct(p.id)}
                                        className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded transition-colors"
                                    >
                                        {/* Checkbox */}
                                        <div className="relative mr-3">
                                            <div
                                                className={`w-4 h-4 border rounded transition-colors ${isSelected
                                                        ? "bg-blue-500 border-blue-500"
                                                        : "bg-white border-gray-300 hover:border-gray-400"
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Product info */}
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-gray-900">
                                                {p.name}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {p.sku}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer with selected count */}
                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                        <div className="text-sm text-gray-600">
                            เลือกแล้ว{" "}
                            <span className="font-semibold text-gray-900">
                                {selectedProducts.length}
                            </span>{" "}
                            จาก{" "}
                            <span className="font-semibold text-gray-900">
                                {products.length}
                            </span>{" "}
                            รายการ
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiSelectProductFilter;
