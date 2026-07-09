import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HoverTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const TOOLTIP_WIDTH = 260;

const HoverTooltip: React.FC<HoverTooltipProps> = ({ content, children, className }) => {
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState<{ top: number; left: number; arrow: 'top' | 'bottom' } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const show = () => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const spaceBelow = window.innerHeight - rect.bottom;
    const showBelow = spaceBelow > 140 || spaceBelow > rect.top;

    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 8),
      window.innerWidth - TOOLTIP_WIDTH - 8
    );

    setPlacement({
      top: showBelow ? rect.bottom + 8 : rect.top - 8,
      left,
      arrow: showBelow ? 'top' : 'bottom',
    });
    setVisible(true);
  };

  const hide = () => setVisible(false);

  return (
    <div ref={wrapperRef} className={className} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && placement && createPortal(
        <div
          style={{
            position: 'fixed',
            top: placement.top,
            left: placement.left,
            width: TOOLTIP_WIDTH,
            zIndex: 9999,
            transform: placement.arrow === 'bottom' ? 'translateY(-100%)' : undefined,
          }}
          className="pointer-events-none"
        >
          {placement.arrow === 'bottom' && (
            <div
              style={{ position: 'absolute', bottom: -6, left: '50%', marginLeft: -6 }}
              className="w-3 h-3 rotate-45 bg-gray-900"
            />
          )}
          <div className="bg-gray-900 text-white text-xs rounded-lg shadow-xl px-3 py-2.5 leading-relaxed">
            {content}
          </div>
          {placement.arrow === 'top' && (
            <div
              style={{ position: 'absolute', top: -6, left: '50%', marginLeft: -6 }}
              className="w-3 h-3 rotate-45 bg-gray-900"
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default HoverTooltip;
