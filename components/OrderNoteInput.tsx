import React from 'react';

interface OrderNoteInputProps {
  notes?: string;
  monthlyDiscount?: number;
  onNotesChange: (value: string) => void;
  onMonthlyDiscountChange: (value: number) => void;
  className?: string;
  labelClassName?: string;
}

export const OrderNoteInput: React.FC<OrderNoteInputProps> = ({
  notes,
  monthlyDiscount,
  onNotesChange,
  onMonthlyDiscountChange,
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

      {/* Monthly Discount Note */}
      <div>
        <label className={labelClassName}>
          คูปองส่วนลดประจำเดือน <span className="text-gray-400 text-xs font-normal">(บันทึกเป็นข้อมูลอ้างอิงเท่านั้น)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={monthlyDiscount || ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onMonthlyDiscountChange(isNaN(val) ? 0 : val);
            }}
            onWheel={(e) => e.currentTarget.blur()}
            className={className}
            placeholder="กรอกตัวเลขส่วนลด"
            min="0"
          />
          <span className="text-sm text-gray-500 whitespace-nowrap">บาท</span>
        </div>
      </div>
    </div>
  );
};
