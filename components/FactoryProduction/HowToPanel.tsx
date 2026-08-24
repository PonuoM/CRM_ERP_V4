import React from 'react';
import { ChevronDown, ChevronUp, Truck, PackageCheck, Pencil, Trash2, Undo2, Plus, BookOpen } from 'lucide-react';

interface HowToPanelProps {
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
}

/** ข้อมูลคู่มือ — single source of truth ใช้ทั้ง inline (legacy) และ modal */
export const GUIDE_STEPS = [
  {
    n: '1',
    title: 'เปิด SO สั่งผลิต',
    body: 'พี่ปอวางแผนผลิตรายเดือน แล้วเปิด SO ในระบบ e-acc ครั้งละครึ่งเดือน (วันที่ 1–15 และ 16–สิ้นเดือน) — ตุ๊กตาคีย์ใบ SO นั้นเข้ามาที่นี่ ระบบจะเดารอบครึ่งเดือนให้อัตโนมัติจากวันที่ SO',
    who: 'ตุ๊กตา',
    how: 'ปุ่ม “เปิด SO” มุมขวาบน',
    detail: 'ใส่เลข SO → เลือกโรงงาน (การ 1/2/3) → ใส่สินค้ากับจำนวน · ถ้าตั้ง “โรงงานเริ่มต้น” ของสินค้าไว้แล้ว ระบบจะเลือกโรงงานให้เอง และเตือนถ้าเลือกไม่ตรง',
  },
  {
    n: '2',
    title: 'โรงงานผลิต',
    body: 'ช่วงนี้ไม่ต้องคีย์อะไรเลย ยอด “ยังไม่ผลิต” จะลดลงเองทุกครั้งที่มีใบขนใหม่เข้ามา — โรงงานกับคลังเปิดดูหน้านี้ได้เพื่อรู้ล่วงหน้าว่าค้างอะไรอยู่เท่าไร',
    who: 'โรงงาน (ดูอย่างเดียว)',
    how: '—',
    detail: 'บัญชีของโรงงานจะถูกล็อกให้เห็นเฉพาะโรงงานตัวเอง ส่วนทีมคลัง Airport เห็นทุกโรงงานเพื่อจัดรถและพื้นที่',
  },
  {
    n: '3',
    title: 'ออกใบขน แล้วคีย์เลขเข้าระบบ',
    body: 'ผลิตเสร็จล็อตไหน โรงงานต้องออก “ใบขน” ทันที แม้ยังผลิตไม่ครบตาม SO (เช่นผลิตได้ 10 จาก 100 ก็ออกใบขนของ 10 ชิ้นนั้น) เพราะใบขนคือหลักฐานว่าของเป็นของเทพมงคลแล้ว ใช้เรียกเก็บเงินได้',
    who: 'ตุ๊กตา',
    how: 'แท็บ “ใบขน” → ปุ่ม “คีย์ใบขน” หรือกดไอคอนรถบรรทุกในแถว SO',
    detail: 'เลือกได้หลาย SKU ในใบเดียว · กดตัวเลข “คงเหลือ” เพื่อเติมยอดทั้งหมดทีเดียว · ระบบไม่ยอมให้คีย์เกินยอดคงเหลือของ SO',
  },
  {
    n: '4',
    title: 'Airport มารับ แล้วกดรับเข้าคลัง',
    body: 'ทีมขนส่งของคลังขับรถมารับตามรายการใบขน พอของถึงคลังกาญจนบุรีแล้ว กดรับเข้าในระบบ ยอดจะย้ายจากฝั่งโรงงานเข้าคลังทันที ถือว่าจบกระบวนการ',
    who: 'ตุ๊กตา',
    how: 'แท็บ “ใบขน” → ไอคอนกล่องติ๊กถูกในแถวนั้น',
    detail: 'เลือกคลังปลายทาง + วันที่รับ · ถ้าของมาไม่ครบ แก้ช่อง “รับจริง” ให้ตรงความจริง ระบบจะเก็บส่วนต่างไว้เป็นยอด “ขาด” โดยไม่ทำให้ยอดค้างผลิตเพี้ยน',
  },
];

export const GUIDE_DEFS = [
  { t: 'SO (ใบสั่งผลิต)', d: 'ใบสั่งจาก e-acc ว่าเดือนนี้ให้โรงงานไหนผลิตอะไรเท่าไร 1 ใบมีได้หลายสินค้า' },
  { t: 'ใบขน', d: 'เอกสารที่โรงงานออกตอนผลิตเสร็จแต่ละล็อต เป็นหลักฐานทางกฎหมายว่าของโอนมาเป็นของเทพมงคลแล้ว 1 SO มีใบขนได้หลายใบ' },
  { t: 'ยังไม่ผลิต', d: 'ยอด SO ที่ยังไม่มีใบขนรองรับ = ของยังไม่ถูกผลิต คิดจาก ยอดสั่ง ลบ ยอดในใบขนทั้งหมด' },
  { t: 'รอขนย้าย', d: 'ผลิตเสร็จ ออกใบขนแล้ว แต่ Airport ยังไม่มารับ — ของยังกองอยู่ที่โรงงาน ยิ่งค้างนานยิ่งควรตาม' },
  { t: 'เข้าคลังแล้ว', d: 'ขนเข้าคลังเรียบร้อย จบกระบวนการของยอดก้อนนั้น' },
  { t: 'ขาด', d: 'ยอดตามใบขน ลบ ยอดที่คลังรับจริง — ของหายระหว่างทางหรือนับไม่ตรง ต้องเคลียร์กับโรงงาน' },
];

const GUIDE_ICONS = [
  { Icon: Plus, label: 'เปิด SO ใหม่ / คีย์ใบขนใหม่' },
  { Icon: Truck, label: 'ออกใบขนจาก SO แถวนี้' },
  { Icon: PackageCheck, label: 'รับของเข้าคลัง (ใช้ตอน Airport ขนมาถึงแล้ว)' },
  { Icon: Undo2, label: 'ถอนการรับเข้า — ใช้เมื่อกดรับผิดใบ ยอดจะกลับไปเป็น “รอขนย้าย”' },
  { Icon: Pencil, label: 'แก้ไข — ใบขนที่รับเข้าคลังแล้วต้องถอนก่อนถึงจะแก้ได้' },
  { Icon: Trash2, label: 'ลบ — SO ที่มีใบขนแล้วลบไม่ได้ ให้เปลี่ยนสถานะเป็น “ยกเลิก” แทน' },
];

/** เนื้อหาคู่มือล้วน ๆ ใช้ได้ทั้งใน HowToPanel เดิมและ modal */
export const GuideContent: React.FC<{ canManage?: boolean }> = ({ canManage }) => (
  <>
    <div className="fp-steps">
      {GUIDE_STEPS.map(s => (
        <article className="fp-step" key={s.n}>
          <span className="fp-step__n num">{s.n}</span>
          <div>
            <h3 className="fp-step__h">{s.title}</h3>
            <p className="fp-step__p">{s.body}</p>
            <p className="fp-step__p" style={{ color: 'var(--fp-ink-3)', fontSize: 12.5 }}>{s.detail}</p>
            <div className="fp-step__meta">
              <span>คนทำ · <b>{s.who}</b></span>
              <span>กดที่ไหน · <b>{s.how}</b></span>
            </div>
          </div>
        </article>
      ))}
    </div>

    <h4 className="fp-guide__h">ศัพท์ที่ใช้ในหน้านี้</h4>
    <div className="fp-defs">
      {GUIDE_DEFS.map(d => (
        <div className="fp-def" key={d.t}>
          <div className="fp-def__t">{d.t}</div>
          <div className="fp-def__d">{d.d}</div>
        </div>
      ))}
    </div>

    <h4 className="fp-guide__h">ปุ่มในตาราง</h4>
    <div className="fp-legend">
      {GUIDE_ICONS.map(({ Icon, label }) => (
        <div className="fp-legend__row" key={label}>
          <span className="fp-legend__ico"><Icon size={15} /></span>
          <span>{label}</span>
        </div>
      ))}
    </div>

    <h4 className="fp-guide__h">สิทธิ์</h4>
    <div className="fp-defs">
      <div className="fp-def">
        <div className="fp-def__t">คนที่แก้ไขข้อมูลได้</div>
        <div className="fp-def__d">
          Super Admin / Admin Control / CEO ได้สิทธิ์อัตโนมัติ · คนอื่น (เช่นตุ๊กตา) ต้องเปิดให้ที่แท็บ
          “ตั้งค่า → สิทธิ์”
        </div>
      </div>
      <div className="fp-def">
        <div className="fp-def__t">คนที่ดูอย่างเดียว</div>
        <div className="fp-def__d">
          โรงงานกับทีมคลัง Airport เห็นแผนและยอดค้างได้ แต่กดแก้ไม่ได้ และไม่เห็นข้อมูลต้นทุนที่ไหนเลย ·
          ล็อกให้เห็นเฉพาะโรงงานตัวเองได้ที่ “ตั้งค่า → สิทธิ์”
        </div>
      </div>
    </div>

    {canManage === false && (
      <div className="fp-note fp-note--warn" style={{ marginTop: 'var(--fp-4)' }}>
        บัญชีของคุณเป็นแบบดูอย่างเดียว จึงไม่เห็นปุ่มเปิด SO และปุ่มคีย์ใบขน —
        ถ้าต้องคีย์ข้อมูล ให้ผู้ดูแลระบบเปิดสิทธิ์ให้ที่ “ตั้งค่า → สิทธิ์”
      </div>
    )}
  </>
);

/** legacy inline panel — เก็บไว้เผื่อ consumer เก่าเรียกใช้ */
const HowToPanel: React.FC<HowToPanelProps> = ({ open, onToggle, canManage }) => {
  return (
    <section className="fp-guide">
      <button type="button" className="fp-guide__bar" onClick={onToggle} aria-expanded={open}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <BookOpen size={16} style={{ color: 'var(--fp-ink-2)', flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>คู่มือใช้งาน</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--fp-ink-3)' }}>
              4 ขั้นตอน · ใครทำอะไร · ศัพท์ที่ใช้ · ไอคอนแต่ละตัวหมายถึงอะไร
            </span>
          </span>
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="fp-guide__body">
          <GuideContent canManage={canManage} />
        </div>
      )}
    </section>
  );
};

export default HowToPanel;
