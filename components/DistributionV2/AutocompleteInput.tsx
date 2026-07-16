import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';

interface AutocompleteInputProps {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
    value,
    onChange,
    options,
    placeholder = 'ระบุ Session Tag',
    className = '',
    autoFocus = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes((value || '').toLowerCase())
    );
    
    // Check if the current typed value exactly matches any option
    const exactMatch = options.find(opt => opt.toLowerCase() === (value || '').toLowerCase());
    const isNew = value.trim() !== '' && !exactMatch;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setIsOpen(true);
            }
            return;
        }

        const maxIndex = filteredOptions.length + (isNew ? 0 : -1);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < maxIndex ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
                onChange(filteredOptions[activeIndex]);
                setIsOpen(false);
            } else if (activeIndex === filteredOptions.length && isNew) {
                onChange(value.trim());
                setIsOpen(false);
            } else if (activeIndex === -1 && value.trim() !== '') {
                // Just enter whatever is typed if no active index
                onChange(value.trim());
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
        }
    };

    // Helper to highlight matched text
    const renderHighlighted = (text: string, highlight: string) => {
        if (!highlight.trim()) return text;
        const regex = new RegExp(`(${highlight})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) => 
            regex.test(part) ? <strong key={i} className="text-blue-600 bg-blue-50 font-bold">{part}</strong> : part
        );
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setIsOpen(true);
                    setActiveIndex(-1);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={`w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow ${className}`}
                autoFocus={autoFocus}
                autoComplete="off"
            />
            
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {filteredOptions.length === 0 && !isNew ? (
                        <div className="px-3 py-2 text-sm text-gray-500 italic text-center">ไม่มีรายการแนะนำ</div>
                    ) : (
                        <ul className="py-1">
                            {filteredOptions.map((opt, index) => (
                                <li
                                    key={opt}
                                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                        index === activeIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                    }}
                                    onMouseEnter={() => setActiveIndex(index)}
                                >
                                    {renderHighlighted(opt, value)}
                                </li>
                            ))}
                            {isNew && (
                                <li
                                    className={`px-3 py-2 text-sm cursor-pointer border-t border-gray-100 flex items-center gap-2 transition-colors ${
                                        activeIndex === filteredOptions.length ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-emerald-50 text-emerald-600'
                                    }`}
                                    onClick={() => {
                                        onChange(value.trim());
                                        setIsOpen(false);
                                    }}
                                    onMouseEnter={() => setActiveIndex(filteredOptions.length)}
                                >
                                    <Plus size={16} />
                                    <span>เพิ่มแท็กใหม่: <strong>{value}</strong></span>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default AutocompleteInput;
