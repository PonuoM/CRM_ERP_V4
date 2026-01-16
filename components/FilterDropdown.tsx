import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const FilterDropdown: React.FC<{ title: string; options: { id: string | number, name: string }[]; selected: (string | number)[]; onSelect: (id: string | number) => void; }> = ({ title, options, selected, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef} style={{ minWidth: '120px' }}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm">
                <span>{title} {selected.length > 0 ? `(${selected.length})` : ''}</span>
                <ChevronDown size={14} />
            </button>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {options.map(opt => (
                        <div key={opt.id} className="flex items-center p-2 hover:bg-gray-100">
                            <input
                                type="checkbox"
                                id={`filter-${title}-${opt.id}`}
                                checked={selected.includes(opt.id)}
                                onChange={() => onSelect(opt.id)}
                                className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <label htmlFor={`filter-${title}-${opt.id}`} className="ml-2 text-xs text-gray-700">{opt.name}</label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FilterDropdown;
