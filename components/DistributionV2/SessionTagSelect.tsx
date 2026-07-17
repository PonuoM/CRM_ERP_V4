import React from 'react';

interface TagOption {
    id: number;
    session_tag: string;
    color: string;
}

interface SessionTagSelectProps {
    value: number | '';
    onChange: (val: number | '') => void;
    options: TagOption[];
    className?: string;
    placeholder?: string;
}

const SessionTagSelect: React.FC<SessionTagSelectProps> = ({ value, onChange, options = [], className = '', placeholder = '-- ไม่ระบุ Tag --' }) => {
    const selectedTag = options.find(o => o.id === value);

    return (
        <div className={`relative ${className}`}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                style={{
                    backgroundColor: selectedTag?.color ? `${selectedTag.color}20` : undefined,
                    borderColor: selectedTag?.color,
                    color: selectedTag?.color ? '#1f2937' : undefined,
                    fontWeight: selectedTag?.color ? '600' : 'normal'
                }}
            >
                <option value="">{placeholder}</option>
                {options.map(tag => (
                    <option key={tag.id} value={tag.id} style={{ color: '#1f2937', backgroundColor: '#fff', fontWeight: 'normal' }}>
                        {tag.session_tag}
                    </option>
                ))}
            </select>
            {selectedTag && (
                <div 
                    className="absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: selectedTag.color }}
                />
            )}
        </div>
    );
};

export default SessionTagSelect;
