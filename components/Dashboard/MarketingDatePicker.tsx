import React, { useEffect, useMemo, useState, useRef } from "react";
import { Calendar } from "lucide-react";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

interface MarketingDatePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onSearch?: () => void;
  loading?: boolean;
}

const formatDate = (dateString: string) => {
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const MarketingDatePicker: React.FC<MarketingDatePickerProps> = ({
  value,
  onChange,
  onSearch,
  loading = false,
}) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(value.start);
  const [end, setEnd] = useState(value.end);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStart(value.start);
    setEnd(value.end);
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const display = useMemo(() => {
    if (value.start && value.end) {
      return `${formatDate(value.start)} - ${formatDate(value.end)}`;
    }
    return "เลือกช่วงวันที่";
  }, [value]);

  const applyPreset = (type: string) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case "thisWeek":
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "last7Days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        endDate = new Date(now);
        break;
      case "last30Days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        endDate = new Date(now);
        break;
      default:
        return;
    }

    const newRange = {
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
    };
    setStart(newRange.start);
    setEnd(newRange.end);
    onChange(newRange);
    setOpen(false);
  };

  const handleApply = () => {
    if (start && end) {
      onChange({ start, end });
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setOpen(!open)}
          className="w-64 px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
        >
          <span
            className={
              value.start && value.end ? "text-gray-900" : "text-gray-500"
            }
          >
            {display}
          </span>
          <Calendar className="w-4 h-4 text-gray-400" />
        </button>
        <button
          onClick={onSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md shadow-sm"
        >
          {loading ? "กำลังโหลด..." : "ค้นหา"}
        </button>
      </div>

      {open && (
        <div className="absolute z-50 w-80 mt-2 bg-white rounded-lg shadow-xl border border-gray-200">
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  วันที่เริ่มต้น
                </label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  วันที่สิ้นสุด
                </label>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-700 mb-2">
                เลือกช่วงเวลาด่วน:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => applyPreset("thisWeek")}
                  className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                >
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  อาทิตย์นี้
                </button>
                <button
                  onClick={() => applyPreset("thisMonth")}
                  className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                >
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  เดือนนี้
                </button>
                <button
                  onClick={() => applyPreset("last7Days")}
                  className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                >
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  7 วันล่าสุด
                </button>
                <button
                  onClick={() => applyPreset("last30Days")}
                  className="px-3 py-2 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center"
                >
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  30 วันล่าสุด
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingDatePicker;
