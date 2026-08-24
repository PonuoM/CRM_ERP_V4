import React from 'react';
import HoverTooltip from '@/components/HoverTooltip';
import { StockPlanRow, STATUS_META, movedFromLabel } from './types';
import { buildMonthWeeks, weekLabelOf, calendarItemLabel, WEEKDAY_NAMES_TH } from './calendarGrid';

interface StockPlanCalendarProps {
  year: number;
  month: number;
  itemsByDay: Record<string, StockPlanRow[]>;
  selectedDay: string | null;
  onDayClick: (day: string) => void;
  holidays: string[];
}

const StockPlanCalendar: React.FC<StockPlanCalendarProps> = ({
  year, month, itemsByDay, selectedDay, onDayClick, holidays
}) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const holidaySet = new Set(holidays);

  // ตารางสัปดาห์/วันเติมหัวท้ายเดือน — ใช้ตัวเดียวกับที่ Export Excel ใช้ (calendarGrid.ts)
  const weeks = buildMonthWeeks(year, month);

  const rowStatus = (row: StockPlanRow) => (row.kind === 'pending' ? 'pending' : row.status);
  const rowQty = (row: StockPlanRow) => (row.kind === 'pending' ? row.remaining_qty : (row.actual_qty ?? row.expected_qty));
  const calendarLabel = (row: StockPlanRow) => calendarItemLabel(row.item.product_name ?? row.item.sku ?? row.item.product_id, rowQty(row));
  const shortStamp = (ts?: string | null) => (ts ? ts.slice(0, 16) : '');

  const renderTooltipContent = (row: StockPlanRow) => {
    const meta = STATUS_META[rowStatus(row)] ?? STATUS_META.pending;
    const movedFrom = movedFromLabel(row);
    return (
      <div className="space-y-1">
        <div className="font-semibold text-white">
          {row.item.product_name ?? row.item.sku ?? row.item.product_id}
        </div>
        {row.item.sku && <div className="text-gray-400">SKU: {row.item.sku}</div>}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          <span>{meta.label}</span>
        </div>
        {row.kind === 'pending' ? (
          <div className="text-gray-300">แพลนรวม {row.item.planned_qty} · ยังไม่กำหนดวันที่ {row.remaining_qty}</div>
        ) : (
          <>
            <div className="text-gray-300">
              คาดว่าจะเข้า {row.expected_qty}
              {row.actual_qty !== null ? ` · จริง ${row.actual_qty}` : ''}
            </div>
            {row.so_number && <div className="text-gray-300">SO: {row.so_number}</div>}
            {row.note && <div className="text-gray-400 italic">"{row.note}"</div>}
            {movedFrom && <div className="text-orange-300 text-xs mt-1">{movedFrom}</div>}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm p-3">
      {/* 
        Grid Setup: 
        Week Col: 45px
        Mon-Sat: 1fr
        Sun: 0.6fr (smaller as it's non-working day)
      */}
      <div className="grid grid-cols-[45px_1fr_1fr_1fr_1fr_1fr_1fr_0.6fr] text-center text-xs font-semibold text-gray-500 mb-2 gap-1.5">
        <div className="py-1 flex items-center justify-center border-b pb-2">Week</div>
        {WEEKDAY_NAMES_TH.map((w, i) => (
          <div key={w} className={`py-1 border-b pb-2 ${i === 6 ? 'text-red-400' : ''}`}>{w}</div>
        ))}
      </div>
      
      <div className="space-y-1.5">
        {weeks.map((week, wIdx) => {
          // Calculate week label based on the Monday of this week
          const { monthNo: mMonth, weekNo: weekNum } = weekLabelOf(week[0].dateStr);
          
          return (
            <div key={wIdx} className="grid grid-cols-[45px_1fr_1fr_1fr_1fr_1fr_1fr_0.6fr] gap-1.5">
              
              {/* Week Number Cell */}
              <div className="flex flex-col items-center justify-center text-xs font-bold text-gray-400 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-[10px] text-gray-400 font-normal leading-tight">M{mMonth}</div>
                <div>W{weekNum}</div>
              </div>

              {/* Day Cells */}
              {week.map((dayObj, dIdx) => {
                const dayStr = dayObj.dateStr;
                const isCurrentMonth = dayObj.isCurrentMonth;
                const isSelected = selectedDay === dayStr;
                const isToday = dayStr === todayStr;
                const isHoliday = holidaySet.has(dayStr);
                const dayNum = Number(dayStr.slice(8, 10));
                const dayItems = itemsByDay[dayStr] ?? [];

                return (
                  <button
                    key={dayStr}
                    onClick={() => onDayClick(dayStr)}
                    className={`min-h-[130px] rounded-lg border p-1.5 text-left align-top transition-colors relative overflow-hidden
                      ${!isCurrentMonth ? 'bg-gray-50/40 opacity-70 border-dashed' : ''}
                      ${isHoliday ? 'bg-red-50/50 border-red-100' : ''}
                      ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : (isHoliday ? 'hover:border-red-300' : 'border-gray-200 hover:border-blue-400')}
                    `}
                  >
                    {isHoliday && (
                      <div className="absolute top-0 right-0 w-8 h-8 bg-red-100 rounded-bl-full -z-10" />
                    )}
                    <div className="flex justify-between items-start">
                      <div className={`text-xs font-semibold 
                        ${isToday ? 'text-white bg-blue-600 rounded-full w-5 h-5 flex items-center justify-center -ml-0.5 -mt-0.5' 
                        : (isHoliday ? 'text-red-500' : (isCurrentMonth ? 'text-gray-700' : 'text-gray-400'))}
                      `}>
                        {dayNum}
                      </div>
                      {isHoliday && <span className="text-[10px] text-red-400 font-medium leading-none mt-0.5 pr-0.5">หยุด</span>}
                    </div>
                    
                    <div className="mt-1.5 space-y-0.5">
                      {dayItems.slice(0, 5).map((row, i) => {
                        const meta = STATUS_META[rowStatus(row)] ?? STATUS_META.pending;
                        return (
                          <HoverTooltip key={i} content={renderTooltipContent(row)}>
                            <div className={`text-[10px] px-1 py-0.5 rounded truncate ${meta.badge}`}>
                              {calendarLabel(row)}
                            </div>
                          </HoverTooltip>
                        );
                      })}
                      {dayItems.length > 5 && (
                        <div className="text-[10px] text-gray-400 mt-1 font-medium bg-gray-100 rounded px-1 w-fit">+{dayItems.length - 5} เพิ่มเติม</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StockPlanCalendar;
