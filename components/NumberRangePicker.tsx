import React, { useState, useEffect, useRef } from 'react';

interface NumberRange {
    min: string;
    max: string;
}

interface NumberRangePickerProps {
    value: NumberRange;
    onChange: (range: NumberRange) => void;
    placeholder?: string;
}

const NumberRangePicker: React.FC<NumberRangePickerProps> = ({ value, onChange, placeholder = "ระบุช่วงตัวเลข" }) => {
    const [open, setOpen] = useState(false);
    const [minVal, setMinVal] = useState(value.min);
    const [maxVal, setMaxVal] = useState(value.max);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        setMinVal(value.min);
        setMaxVal(value.max);
    }, [value]);

    const handleApply = () => {
        onChange({ min: minVal, max: maxVal });
        setOpen(false);
    };

    const handleClear = () => {
        setMinVal('');
        setMaxVal('');
        onChange({ min: '', max: '' });
        setOpen(false);
    };

    const displayValue = () => {
        if (!value.min && !value.max) return placeholder;
        if (value.min && value.max) return `${value.min} - ${value.max}`;
        if (value.min) return `>= ${value.min}`;
        if (value.max) return `<= ${value.max}`;
        return placeholder;
    };

    return (
        <div className="relative" ref={ref}>
            <div
                onClick={() => setOpen(!open)}
                className="w-full px-3 py-2 border rounded-md text-sm cursor-pointer bg-white flex justify-between items-center"
            >
                <span className={!value.min && !value.max ? "text-gray-400" : "text-gray-900"}>
                    {displayValue()}
                </span>
            </div>

            {open && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg p-3 min-w-[200px]">
                    <div className="flex gap-2 items-center mb-3">
                        <input
                            type="number"
                            step="1"
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Min"
                            value={minVal}
                            onChange={(e) => setMinVal(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === '.' || e.key === ',') e.preventDefault();
                            }}
                        />
                        <span className="text-gray-500">-</span>
                        <input
                            type="number"
                            step="1"
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Max"
                            value={maxVal}
                            onChange={(e) => setMaxVal(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === '.' || e.key === ',') e.preventDefault();
                            }}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={handleClear}
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NumberRangePicker;
