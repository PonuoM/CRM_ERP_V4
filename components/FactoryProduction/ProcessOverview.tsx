import React, { useMemo, useState } from 'react';
import {
  ClipboardList, Factory, Truck, Warehouse,
  ChevronDown, ChevronUp, ArrowRight, ExternalLink,
} from 'lucide-react';
import type {
  DeliveryNote, ProductionBalance, ProductionOrder, ProductionSummary,
} from './types';
import { fmtQty, fmtDate } from './types';

export type StationKey = 'all' | 'pending' | 'waiting' | 'picked';

const MONTH_ABBR_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const DAY_MS = 86400000;

const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/** ติดลบ = ยังไม่ถึงกำหนด (SO ของเดือนหน้า ไม่ใช่ของค้าง) */
const daysSince = (from: Date | null, today: Date): number => {
  if (!from) return 0;
  return Math.floor((today.getTime() - from.getTime()) / DAY_MS);
};

const monthLabel = (d: Date | null): string =>
  (d ? `${MONTH_ABBR_TH[d.getMonth()]} ${d.getFullYear() + 543}` : '—');

interface StageDef {
  key: StationKey;
  n: string;
  name: string;
  foot: string;
  /** โทนสี a–d ตามลำดับสถานี (ดูตัวแปร --fp-t1..4 ใน productionStyles) */
  tone: 'a' | 'b' | 'c' | 'd';
  Icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  qty: (t: ProductionBalance | undefined) => number;
  /** ชื่อที่ใช้ต่อท้าย "รายการ SO ที่…" */
  listLabel: string;
}

const STAGES: StageDef[] = [
  {
    key: 'all', n: '1', name: 'SO สั่งผลิต', foot: 'ยอดที่เปิดไว้ทั้งหมด',
    tone: 'a', Icon: ClipboardList, listLabel: 'เปิดไว้',
    qty: t => t?.ordered_qty ?? 0,
  },
  {
    key: 'pending', n: '2', name: 'ยังไม่ผลิต', foot: 'ค้างอยู่ที่โรงงาน',
    tone: 'b', Icon: Factory, listLabel: 'ยังไม่ผลิต',
    qty: t => t?.pending_qty ?? 0,
  },
  {
    key: 'waiting', n: '3', name: 'รอขนย้าย', foot: 'ออกใบขนแล้ว รอ Airport มารับ',
    tone: 'c', Icon: Truck, listLabel: 'รอขนย้าย',
    qty: t => t?.waiting_qty ?? 0,
  },
  {
    key: 'picked', n: '4', name: 'เข้าคลังแล้ว', foot: 'ขนเข้าคลังเรียบร้อย',
    tone: 'd', Icon: Warehouse, listLabel: 'เข้าคลังแล้ว',
    qty: t => t?.picked_qty ?? 0,
  },
];

const AGE_TIERS = [
  { label: '0 – 7 วัน',   min: 0,  max: 7,        tone: 'g' },
  { label: '8 – 30 วัน',  min: 8,  max: 30,       tone: 'y' },
  { label: '31 – 60 วัน', min: 31, max: 60,       tone: 'o' },
  { label: '60+ วัน',     min: 61, max: Infinity, tone: 'r' },
];

const ageStatus = (age: number): { label: string; cls: string } => {
  if (age < 0) return { label: 'ยังไม่ถึงกำหนด', cls: 'is-soon' };
  if (age <= 7) return { label: 'ปกติ', cls: 'is-ok' };
  if (age <= 30) return { label: 'เริ่มค้าง', cls: 'is-warn' };
  return { label: 'ค้างนาน', cls: 'is-late' };
};

interface StageRow {
  order: ProductionOrder;
  qty: number;
  /** วันที่ใช้เป็นตัวตั้งของ "ค้างแล้วกี่วัน" */
  anchor: Date | null;
  soDate: Date | null;
  age: number;
}

interface Props {
  summary: ProductionSummary | null;
  orders: ProductionOrder[];
  notes: DeliveryNote[];
  station: StationKey;
  onStation: (s: StationKey) => void;
  updatedAt?: Date | null;
}

/**
 * ภาพรวมกระบวนการ SO — แถบสรุป + การ์ด 4 สถานี + แผงรายละเอียดของสถานีที่กาง
 * แทน FlowMap เดิม (river / stepper / sankey / bubble) ทั้งหมด
 */
const ProcessOverview: React.FC<Props> = ({ summary, orders, notes, station, onStation, updatedAt }) => {
  const [open, setOpen] = useState<StationKey | null>('all');

  const totals = summary?.totals;
  const orderedQty = totals?.ordered_qty ?? 0;
  const soCount = summary?.order_count ?? orders.length;

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  /** SO ไหนออกใบขนไว้ตั้งแต่เมื่อไร — ใช้เป็นจุดเริ่มนับ "ค้างรอขนย้าย" */
  const waitingSince = useMemo(() => {
    const map = new Map<string, Date>();
    notes.forEach(n => {
      if (n.status !== 'issued') return;
      const d = parseDate(n.issued_date);
      if (!d) return;
      n.so_numbers.forEach(so => {
        const cur = map.get(so);
        if (!cur || d < cur) map.set(so, d);
      });
    });
    return map;
  }, [notes]);

  const stageRows = (stage: StageDef): StageRow[] => {
    const rows: StageRow[] = [];
    orders.forEach(o => {
      const qty = stage.qty(o.totals);
      if (qty <= 0) return;
      const soDate = parseDate(o.so_date);
      /* ค้าง = เลย "กำหนดส่ง" มากี่วัน (ถ้าไม่ได้ระบุ ถอยไปใช้วันที่ SO)
         ยกเว้นสถานีรอขนย้าย ที่นับจากวันออกใบขนเพราะของผลิตเสร็จแล้ว รอแค่รถ */
      const due = parseDate(o.due_date) ?? parseDate(o.receive_date) ?? soDate;
      const anchor = stage.key === 'waiting'
        ? (waitingSince.get(o.so_number) ?? due)
        : due;
      rows.push({ order: o, qty, anchor, soDate, age: daysSince(anchor, today) });
    });
    return rows.sort((a, b) => b.age - a.age);
  };

  const openStage = STAGES.find(s => s.key === open) ?? null;
  const rows = useMemo(
    () => (openStage ? stageRows(openStage) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openStage?.key, orders, waitingSince, today]
  );

  /** กลุ่มตามเดือนของ SO — เดือนนี้ / เดือนก่อน / 2 เดือนก่อน / เก่ากว่านั้น / ล่วงหน้า */
  const monthBuckets = useMemo(() => {
    const key = (y: number, m: number) => y * 12 + m;
    const nowKey = key(today.getFullYear(), today.getMonth());
    const base = [0, 1, 2].map(back => {
      const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
      return {
        label: `${monthLabel(d)}${back === 0 ? ' (เดือนนี้)' : ''}`,
        color: `var(--fp-m${back + 1})`,
        k: key(d.getFullYear(), d.getMonth()),
        count: 0, qty: 0, always: true,
      };
    });
    const older = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const ahead = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const olderBucket = {
      label: `${monthLabel(older)} ลงไป`, color: 'var(--fp-m4)',
      k: -1, count: 0, qty: 0, always: true,
    };
    /* SO ของเดือนหน้าเป็นต้นไป = แผนล่วงหน้า ไม่ใช่ของเก่าที่ค้าง */
    const aheadBucket = {
      label: `${monthLabel(ahead)} ขึ้นไป (ล่วงหน้า)`, color: 'var(--fp-m5)',
      k: -2, count: 0, qty: 0, always: false,
    };
    const buckets = [...base, olderBucket, aheadBucket];
    rows.forEach(r => {
      const d = r.soDate;
      const k = d ? key(d.getFullYear(), d.getMonth()) : olderBucket.k;
      const target = k > nowKey
        ? aheadBucket
        : (buckets.find(b => b.k === k) ?? olderBucket);
      target.count += 1;
      target.qty += r.qty;
    });
    return buckets.filter(b => b.always || b.count > 0);
  }, [rows, today]);

  /** ใบที่ถึงกำหนดเริ่มผลิตแล้ว — ใบที่ยังไม่ถึงไม่ใช่ของค้าง จึงไม่เอามาคิดอายุงาน */
  const dueRows = useMemo(() => rows.filter(r => r.age >= 0), [rows]);
  const notDueCount = rows.length - dueRows.length;
  const lateRows = useMemo(() => dueRows.filter(r => r.age > 0), [dueRows]);

  const ageBuckets = useMemo(
    () => AGE_TIERS.map(t => ({
      ...t,
      count: dueRows.filter(r => r.age >= t.min && r.age <= t.max).length,
      qty: dueRows.filter(r => r.age >= t.min && r.age <= t.max).reduce((s, r) => s + r.qty, 0),
    })),
    [dueRows]
  );

  const pct = (v: number, base: number) => (base > 0 ? (v / base) * 100 : 0);
  const pctText = (v: number, base: number) => `${pct(v, base).toFixed(1)}%`;

  const handleCard = (key: StationKey) => {
    if (open === key) {
      setOpen(null);
      onStation('all');
      return;
    }
    setOpen(key);
    onStation(key);
  };

  /* ── สายน้ำ: ความหนาแต่ละจุด = ยอดที่อยู่ตรงสถานีนั้น ── */
  const flowValues = STAGES.map(st => st.qty(totals));
  const flowMax = Math.max(...flowValues, 1);
  const MID = 60, MAX_HALF = 46, MIN_HALF = 3.5;
  const halves = flowValues.map(v => Math.max(MIN_HALF, (v / flowMax) * MAX_HALF));
  const flowX = [0, 125, 375, 625, 875, 1000];
  const flowH = [halves[0], halves[0], halves[1], halves[2], halves[3], halves[3]];
  const curve = (pts: { x: number; y: number }[], move: boolean) =>
    pts.map((p, i) => {
      if (i === 0) return `${move ? 'M' : 'L'} ${p.x} ${p.y}`;
      const q = pts[i - 1];
      const cx = (q.x + p.x) / 2;
      return `C ${cx} ${q.y} ${cx} ${p.y} ${p.x} ${p.y}`;
    }).join(' ');
  const ribbonPath = [
    curve(flowX.map((x, i) => ({ x, y: MID - flowH[i] })), true),
    curve(flowX.map((x, i) => ({ x, y: MID + flowH[i] })).reverse(), false),
    'Z',
  ].join(' ');

  /* ── โดนัทสรุปตามเดือน ── */
  const donutTotal = monthBuckets.reduce((s, b) => s + b.count, 0);
  const R = 50, SW = 18, CIRC = 2 * Math.PI * R;
  let donutOffset = 0;

  return (
    <section className="fp-ov" aria-label="ภาพรวมกระบวนการ SO">
      {/* ─── แถบสรุปรวม ─── */}
      <div className="fp-ov__bar">
        <div className="fp-ov__total">
          <span className="fp-label">SO ทั้งหมด</span>
          <div className="fp-ov__big num">{fmtQty(soCount)}</div>
          <span className="fp-ov__totalsub">
            <b className="num">{fmtQty(orderedQty)}</b> ชิ้น · ยอดรวมทั้งหมด
          </span>
        </div>

        <div className="fp-ov__progress">
          <span className="fp-label">ความคืบหน้ารวม</span>
          <div className="fp-ov__track" role="img"
               aria-label={`ยังไม่ผลิต ${pctText(totals?.pending_qty ?? 0, orderedQty)} · รอขนย้าย ${pctText(totals?.waiting_qty ?? 0, orderedQty)} · เข้าคลังแล้ว ${pctText(totals?.picked_qty ?? 0, orderedQty)}`}>
            {(['b', 'c', 'd'] as const).map((tone, i) => {
              const v = [totals?.pending_qty ?? 0, totals?.waiting_qty ?? 0, totals?.picked_qty ?? 0][i];
              return <span key={tone} className={`fp-ov__seg is-${tone}`} style={{ width: `${pct(v, orderedQty)}%` }} />;
            })}
          </div>
        </div>

        <div className="fp-ov__stamp num">
          อัปเดตล่าสุด {updatedAt
            ? `${String(updatedAt.getDate()).padStart(2, '0')}/${String(updatedAt.getMonth() + 1).padStart(2, '0')}/${updatedAt.getFullYear()} ${String(updatedAt.getHours()).padStart(2, '0')}:${String(updatedAt.getMinutes()).padStart(2, '0')} น.`
            : '—'}
        </div>
      </div>

      {/* ─── สายน้ำ: เส้นทางของสินค้าจากสถานี 1 ไป 4 ─── */}
      <div className="fp-ov__flow" aria-hidden>
        <span className="fp-ov__flowlabel" style={{ left: '50%' }}>
          ผลิตเสร็จ ออกใบขน <b className="num">{fmtQty(totals?.delivered_qty ?? 0)}</b>
        </span>
        <span className="fp-ov__flowlabel" style={{ left: '75%' }}>
          Airport ขนเข้าคลัง <b className="num">{fmtQty(totals?.picked_qty ?? 0)}</b>
        </span>
        <svg className="fp-ov__ribbon" viewBox="0 0 1000 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fp-ribbon-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--fp-t1-flow)" />
              <stop offset="12.5%" stopColor="var(--fp-t1-flow)" />
              <stop offset="37.5%" stopColor="var(--fp-t2-flow)" />
              <stop offset="62.5%" stopColor="var(--fp-t3-flow)" />
              <stop offset="87.5%" stopColor="var(--fp-t4-flow)" />
              <stop offset="100%" stopColor="var(--fp-t4-flow)" />
            </linearGradient>
          </defs>
          <path d={ribbonPath} fill="url(#fp-ribbon-grad)" />
        </svg>
        <span className="fp-ov__drops">
          {[0, 1, 2, 3].map(i => (
            <i key={i} style={{ left: `calc(${12.5 + i * 25}% + ${(i - 1.5) * 4}px)` }} />
          ))}
        </span>
      </div>

      {/* ─── การ์ด 4 สถานี ─── */}
      <div className="fp-ov__stages">
        {STAGES.map(s => {
          const value = s.qty(totals);
          const isOpen = open === s.key;
          const Icon = s.Icon;
          return (
            <div className="fp-ov__cell" key={s.key}>
              <button
                type="button"
                className={`fp-ov__card is-${s.tone}${isOpen ? ' is-open' : ''}${station === s.key ? ' is-picked' : ''}`}
                onClick={() => handleCard(s.key)}
                aria-expanded={isOpen}
                title={s.foot}
              >
                <span className="fp-ov__head">
                  <span className="fp-ov__n num">{s.n}</span>
                  <span className="fp-ov__ico"><Icon size={20} aria-hidden /></span>
                  <span className="fp-ov__name">{s.name}</span>
                </span>
                <span className="fp-ov__value">
                  <b className="fp-ov__num num">{fmtQty(value)}</b>
                  <span className="fp-ov__unit">ชิ้น</span>
                </span>
                <span className="fp-ov__foot">
                  <span className="fp-ov__pct num">{pctText(value, orderedQty)} ของทั้งหมด</span>
                  <span className="fp-ov__caret">{isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── แผงรายละเอียดของสถานีที่กาง ─── */}
      {openStage && (
        <div className={`fp-ov__panel is-${openStage.tone}`}>
          <header className="fp-ov__panel-head">
            <span className="fp-ov__panel-title">
              <span className="fp-ov__ico fp-ov__ico--sm"><openStage.Icon size={16} aria-hidden /></span>
              <b>{openStage.n}&nbsp;&nbsp;{openStage.name}</b>
              <span className="fp-ov__chip num">{fmtQty(openStage.qty(totals))} ชิ้น · {fmtQty(rows.length)} ใบ</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" className="fp-ov__more" onClick={() => onStation(openStage.key)}>
                ดูรายละเอียดทั้งหมด <ExternalLink size={13} aria-hidden />
              </button>
              <button type="button" className="fp-btn fp-btn--icon" onClick={() => { setOpen(null); onStation('all'); }}
                      aria-label="ย่อแผงรายละเอียด">
                <ChevronUp size={16} />
              </button>
            </span>
          </header>

          <div className="fp-ov__panel-grid">
            {/* ── โดนัท: สรุปตามเดือนของ SO ── */}
            <section className="fp-ov__block">
              <span className="fp-label">สรุปตามเดือนของ SO</span>
              <div className="fp-ov__donut-wrap">
                <div className="fp-ov__donut">
                  <svg viewBox="0 0 128 128" width="100%" height="100%" role="img" aria-label="สัดส่วน SO ตามเดือน">
                    <circle cx="64" cy="64" r={R} fill="none" stroke="var(--fp-surface-2)" strokeWidth={SW} />
                    {donutTotal > 0 && monthBuckets.map(b => {
                      const frac = b.count / donutTotal;
                      const seg = (
                        <circle
                          key={b.label} cx="64" cy="64" r={R} fill="none"
                          stroke={b.color} strokeWidth={SW}
                          strokeDasharray={`${frac * CIRC} ${CIRC - frac * CIRC}`}
                          strokeDashoffset={-donutOffset}
                          transform="rotate(-90 64 64)"
                        />
                      );
                      donutOffset += frac * CIRC;
                      return seg;
                    })}
                  </svg>
                  <div className="fp-ov__donut-mid">
                    <b className="num">{fmtQty(donutTotal)}</b>
                    <span>ใบ</span>
                  </div>
                </div>
                <ul className="fp-ov__legend">
                  {monthBuckets.map(b => (
                    <li key={b.label}>
                      <span className="fp-ov__dot" style={{ background: b.color }} />
                      <span className="fp-ov__legend-t">{b.label}</span>
                      <span className="fp-ov__legend-v num">{fmtQty(b.count)}</span>
                      <span className="fp-ov__legend-p num">{pctText(b.count, donutTotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="fp-ov__note">* นับจากเดือนของ SO (ไม่ใช่เดือนที่เข้าคลัง)</p>
            </section>

            {/* ── อายุงาน ── */}
            <section className="fp-ov__block">
              <span className="fp-label">
                อายุงาน (นับจาก{openStage.key === 'waiting' ? 'วันที่ออกใบขน' : 'กำหนดส่ง'})
              </span>
              <div className="fp-ov__ages">
                {ageBuckets.map(b => (
                  <div className={`fp-ov__age is-${b.tone}`} key={b.label}>
                    <span className="fp-ov__age-t">{b.label}</span>
                    <b className="fp-ov__age-v num">{fmtQty(b.count)}</b>
                    <span className="fp-ov__age-p num">{pctText(b.count, dueRows.length)}</span>
                  </div>
                ))}
              </div>
              <div className="fp-ov__agebar" aria-hidden>
                {ageBuckets.map(b => (
                  <span key={b.label} className={`fp-ov__ageseg is-${b.tone}`}
                        style={{ width: `${pct(b.count, dueRows.length)}%` }} />
                ))}
              </div>
              {notDueCount > 0 && (
                <p className="fp-ov__note">
                  + อีก <b className="num">{fmtQty(notDueCount)}</b> ใบยังไม่ถึงกำหนดส่ง จึงไม่นับเป็นของค้าง
                </p>
              )}
            </section>

            {/* ── ตารางตัวอย่าง ── */}
            <section className="fp-ov__block fp-ov__block--wide">
              <span className="fp-label">รายการ SO ที่{openStage.listLabel} (ตัวอย่าง)</span>
              <div className="fp-scroll" style={{ marginTop: 10 }}>
                <table className="fp-table fp-table--mini">
                  <thead>
                    <tr>
                      <th>รหัส SO</th>
                      <th>โรงงาน</th>
                      <th>เดือน SO</th>
                      <th>วันที่ SO</th>
                      <th>{openStage.key === 'waiting' ? 'วันที่ออกใบขน' : 'กำหนดส่ง'}</th>
                      <th className="r">ค้างแล้ว (วัน)</th>
                      <th className="r">จำนวน (ชิ้น)</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={8} className="fp-ov__empty">ไม่มี SO ในสถานะนี้</td></tr>
                    )}
                    {rows.slice(0, 5).map(r => {
                      const st = ageStatus(r.age);
                      return (
                        <tr key={r.order.id}>
                          <td><span className="fp-key num">{r.order.so_number}</span></td>
                          <td>{r.order.factory_name}</td>
                          <td><span className="fp-ov__month">{monthLabel(r.soDate)}</span></td>
                          <td className="num">{fmtDate(r.order.so_date)}</td>
                          <td className="num">
                            {r.anchor
                              ? `${String(r.anchor.getDate()).padStart(2, '0')}/${String(r.anchor.getMonth() + 1).padStart(2, '0')}/${r.anchor.getFullYear()}`
                              : '—'}
                          </td>
                          <td className={`r num fp-ov__age-cell ${st.cls}`}>
                            {r.age < 0 ? `อีก ${fmtQty(-r.age)} วัน` : `${fmtQty(r.age)} วัน`}
                          </td>
                          <td className="r num">{fmtQty(r.qty)}</td>
                          <td><span className={`fp-pill fp-ov__st ${st.cls}`}>{st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <button type="button" className="fp-ov__more fp-ov__more--foot" onClick={() => onStation(openStage.key)}>
                  ดูรายการทั้งหมด ({fmtQty(rows.length)}) <ArrowRight size={13} aria-hidden />
                </button>
              )}
            </section>

            {/* ── ค้างนานที่สุด ── */}
            <section className="fp-ov__block">
              <span className="fp-label">SO ที่ค้างนานที่สุด</span>
              <ol className="fp-ov__rank">
                {lateRows.length === 0 && (
                  <li className="fp-ov__empty">ยังไม่มี SO ที่เลยกำหนดส่ง</li>
                )}
                {lateRows.slice(0, 5).map((r, i) => (
                  <li key={r.order.id}>
                    <span className="fp-ov__rank-n num">{i + 1}</span>
                    <span className="fp-ov__rank-so num">{r.order.so_number}</span>
                    <span className="fp-ov__month">{monthLabel(r.soDate)}</span>
                    <span className={`fp-ov__rank-age num ${ageStatus(r.age).cls}`}>ค้าง {fmtQty(r.age)} วัน</span>
                    <span className="fp-ov__rank-qty num">{fmtQty(r.qty)} ชิ้น</span>
                  </li>
                ))}
              </ol>
              {lateRows.length > 5 && (
                <button type="button" className="fp-ov__more fp-ov__more--foot" onClick={() => onStation(openStage.key)}>
                  ดูทั้งหมด <ArrowRight size={13} aria-hidden />
                </button>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProcessOverview;
