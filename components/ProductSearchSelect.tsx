import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Product } from '@/types';

interface ProductSearchSelectProps {
  products: Product[];
  value: number | '';
  onChange: (productId: number | '') => void;
  placeholder?: string;
  className?: string;
}

const productLabel = (p: Product) => `${p.sku} - ${p.name}`;

const ProductSearchSelect: React.FC<ProductSearchSelectProps> = ({ products, value, onChange, placeholder, className }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = products.find(p => p.id === value) || null;

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return products;
    return products.filter(p => `${p.sku} ${p.name}`.toLowerCase().includes(term));
  }, [products, searchTerm]);

  const updatePosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? searchTerm : (selected ? productLabel(selected) : '')}
        onChange={e => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setSearchTerm('');
          setIsOpen(true);
        }}
        onBlur={() => setIsOpen(false)}
        placeholder={placeholder ?? '-- เลือกสินค้า (พิมพ์เพื่อค้นหา) --'}
        className={className ?? 'w-full border rounded-lg px-2 py-1.5 text-sm'}
      />

      {isOpen && position && createPortal(
        <div
          style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto"
        >
          {value !== '' && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange('');
                setSearchTerm('');
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-gray-400"
            >
              -- ล้างการเลือก --
            </button>
          )}
          {filteredProducts.map(p => (
            <button
              type="button"
              key={p.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange(p.id);
                setSearchTerm('');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-gray-100 text-sm ${p.id === value ? 'bg-blue-50 text-blue-700' : ''}`}
            >
              {productLabel(p)}
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">ไม่พบสินค้า</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProductSearchSelect;
