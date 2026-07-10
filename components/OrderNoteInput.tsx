import React from 'react';

interface OrderNoteInputProps {
  notes?: string;
  onNotesChange: (value: string) => void;
  className?: string;
  labelClassName?: string;
}

export const OrderNoteInput: React.FC<OrderNoteInputProps> = ({
  notes,
  onNotesChange,
  className = "",
  labelClassName = "",
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* General Note */}
      <div>
        <label className={labelClassName}>หมายเหตุทั่วไป</label>
        <input
          type="text"
          value={notes || ""}
          onChange={(e) => onNotesChange(e.target.value)}
          className={className}
          placeholder="กรอกข้อความหมายเหตุ"
        />
      </div>
    </div>
  );
};
