import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X } from 'lucide-react';
import { GuideContent } from './HowToPanel';

interface Props {
  canManage: boolean;
}

/**
 * ปุ่มวงกลมลอยมุมขวาล่าง คลิกแล้วเปิด modal คู่มือ
 * ตามแผน: เลิกใช้ HowToPanel กางบนหน้า + localStorage GUIDE_KEY
 */
const GuideFab: React.FC<Props> = ({ canManage }) => {
  const [open, setOpen] = useState(false);

  // body-scroll lock + ปิดด้วย ESC — pattern เดียวกับ components/Modal.tsx
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="fp-fab"
        onClick={() => setOpen(true)}
        aria-label="เปิดคู่มือใช้งาน"
        aria-expanded={open}
        title="คู่มือใช้งาน"
      >
        <BookOpen size={22} aria-hidden />
      </button>

      {open && createPortal(
        <div
          className="fp-modal-backdrop fp-portal"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          role="presentation"
        >
          <div
            className="fp-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fp-guide-title"
          >
            <header className="fp-guide-modal__header">
              <span id="fp-guide-title" className="fp-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={14} aria-hidden />
                คู่มือใช้งาน · สั่งผลิต &amp; ใบขน
              </span>
              <button
                type="button"
                className="fp-guide-modal__close"
                onClick={() => setOpen(false)}
                aria-label="ปิดคู่มือ"
              >
                <X size={18} aria-hidden />
              </button>
            </header>
            <div className="fp-guide-modal__body">
              <GuideContent canManage={canManage} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default GuideFab;
