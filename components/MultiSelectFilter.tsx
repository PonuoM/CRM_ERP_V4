import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface MultiSelectOption {
  id: number;
  label: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
  placeholder?: string;
  emptyMeansAllLabel?: string;
  // Hint shown under the list when nothing is selected. Defaults to the visibility-picker
  // wording; pass a different one when reusing this for plain filtering (not visibility).
  emptyHint?: string;
}

/**
 * Generic dropdown + search + checkbox multi-select, modeled on
 * components/Dashboard/MultiSelectPageFilter.tsx but with plain {id,label} options
 * so it can be reused for roles, companies, etc.
 *
 * The dropdown panel renders into a portal (document.body) with fixed positioning computed
 * from the trigger button, instead of being an absolutely-positioned child of the trigger.
 * That's deliberate: this component is frequently used inside scrollable modals
 * (components/Modal.tsx's <main className="overflow-y-auto">), and a plain `absolute` panel
 * gets clipped by that ancestor's overflow box whenever it opens near the bottom of a tall
 * form — the panel doesn't expand the ancestor's scrollable area, so the options become
 * impossible to reach. Portaling to <body> escapes that clipping entirely.
 */
const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  options,
  selectedIds,
  onChange,
  placeholder = "เลือก...",
  emptyMeansAllLabel = "ทุกรายการ (ไม่จำกัด)",
  emptyHint = "ไม่เลือก = แสดงให้ทุกคนเห็น",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    // Prefer opening downward; only flip up when there's truly more room that way.
    const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    setPanelStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 10000,
      // Hard cap so the panel can never extend past the viewport — if its natural content
      // (search box + buttons + list + footer) is taller than the available space, the
      // panel itself scrolls as a whole so every part (including the footer) stays reachable.
      maxHeight: Math.max(160, available),
      overflowY: "auto",
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  };

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleReposition = () => updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen]);

  const filteredOptions = options
    .filter((o) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.label.localeCompare(b.label));

  const handleToggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => onChange(options.map((o) => o.id));
  const handleClearAll = () => onChange([]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
      >
        <span className="text-gray-900 text-sm">
          {selectedIds.length === 0
            ? emptyMeansAllLabel
            : selectedIds.length === options.length
              ? "ทั้งหมด"
              : `เลือก ${selectedIds.length} รายการ`}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen &&
        createPortal(
          <div ref={panelRef} style={panelStyle} className="bg-white border border-gray-300 rounded-md shadow-lg">
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                placeholder={placeholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                autoFocus
              />
            </div>

            <div className="p-2 border-b border-gray-200 flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
              >
                เลือกทั้งหมด
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
              >
                เคลียร์ทั้งหมด
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto p-2">
              {filteredOptions.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">ไม่พบรายการ</div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  return (
                    <div
                      key={option.id}
                      onClick={() => handleToggle(option.id)}
                      className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded transition-colors"
                    >
                      <div className="relative mr-3">
                        <div
                          className={`w-4 h-4 border rounded transition-colors ${
                            isSelected ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5" />}
                        </div>
                      </div>
                      <div className="flex-1 text-sm text-gray-900">{option.label}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                เลือกแล้ว <span className="font-semibold text-gray-900">{selectedIds.length}</span> จาก{" "}
                <span className="font-semibold text-gray-900">{options.length}</span> รายการ
                {selectedIds.length === 0 && (
                  <div className="text-xs text-amber-600 mt-1">{emptyHint}</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default MultiSelectFilter;
