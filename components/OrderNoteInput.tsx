import React, { useState, useEffect, useMemo } from 'react';

interface OrderNoteInputProps {
  notes?: string;
  monthlyDiscount?: number;
  onNotesChange: (value: string) => void;
  onMonthlyDiscountChange: (value: number) => void;
  className?: string;
  labelClassName?: string;
}

type NoteType = 'general' | 'monthly_discount';

export const OrderNoteInput: React.FC<OrderNoteInputProps> = ({
  notes,
  monthlyDiscount,
  onNotesChange,
  onMonthlyDiscountChange,
  className = "",
  labelClassName = "",
}) => {
  // Determine initially active notes based on props
  const [activeNotes, setActiveNotes] = useState<NoteType[]>(() => {
    const active: NoteType[] = [];
    if (notes || (!notes && !monthlyDiscount)) active.push('general'); // Default to general if both empty, or if notes exist
    if (monthlyDiscount && monthlyDiscount > 0) active.push('monthly_discount');
    // Ensure we don't end up empty
    if (active.length === 0) active.push('general');
    return active;
  });

  // Sync state if props change externally (like loading a saved order)
  useEffect(() => {
    setActiveNotes(prev => {
      const newActive = [...prev];
      let changed = false;
      
      if (notes && !newActive.includes('general')) {
        newActive.push('general');
        changed = true;
      }
      
      if (monthlyDiscount && monthlyDiscount > 0 && !newActive.includes('monthly_discount')) {
        newActive.push('monthly_discount');
        changed = true;
      }
      
      return changed ? newActive : prev;
    });
  }, [notes, monthlyDiscount]);

  const availableTypes: { id: NoteType; label: string }[] = useMemo(() => [
    { id: 'general', label: 'หมายเหตุทั่วไป' },
    { id: 'monthly_discount', label: 'คูปองส่วนลดประจำเดือน' },
  ], []);

  const handleAddNote = (type: NoteType) => {
    if (!activeNotes.includes(type)) {
      setActiveNotes([...activeNotes, type]);
    }
  };

  const handleRemoveNote = (type: NoteType) => {
    const updated = activeNotes.filter(t => t !== type);
    // Don't allow removing the last note completely
    if (updated.length === 0) return;
    
    setActiveNotes(updated);
    if (type === 'general') onNotesChange('');
    if (type === 'monthly_discount') onMonthlyDiscountChange(0);
  };

  const unusedTypes = availableTypes.filter(t => !activeNotes.includes(t.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <label className={labelClassName}>หมายเหตุ / ส่วนลด</label>
        {unusedTypes.length > 0 && (
          <div className="flex gap-2">
            {unusedTypes.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleAddNote(t.id)}
                className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors"
              >
                + เพิ่ม{t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {activeNotes.map((type, index) => (
          <div key={type} className="flex flex-col gap-1 p-2 bg-gray-50 rounded border border-gray-100 relative group">
            {activeNotes.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveNote(type)}
                className="absolute top-1 right-1 text-gray-400 hover:text-red-500 p-1"
                title="ลบรายการนี้"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
            <label className="text-xs text-gray-500 font-medium">
              {availableTypes.find(t => t.id === type)?.label}
            </label>
            
            {type === 'general' ? (
              <input
                type="text"
                value={notes || ""}
                onChange={(e) => onNotesChange(e.target.value)}
                className={className}
                placeholder="กรอกข้อความหมายเหตุ"
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={monthlyDiscount || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onMonthlyDiscountChange(isNaN(val) ? 0 : val);
                  }}
                  className={className}
                  placeholder="กรอกตัวเลขส่วนลด"
                  min="0"
                />
                <span className="text-sm text-gray-500">บาท</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
