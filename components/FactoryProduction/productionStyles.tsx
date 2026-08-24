import React from 'react';

/*
 * Hallmark · genre: modern-minimal · macrostructure: 19 Map/Diagram
 * theme: Cobalt-adapted (cool near-white paper · ink-monochrome UI · chroma reserved for stock state)
 * enrichment: E-none (the diagram IS the artifact — hand-built SVG, Tier B)
 * pre-emit critique: P5 H5 E4 S5 R5 V4
 *
 * ทำไมสีถึงเป็นแบบนี้:
 *   ปุ่ม/ตัวหนังสือ/เส้น = หมึกล้วน ไม่มีสี  → สีบนหน้านี้แปลว่า "ของอยู่ตรงไหน" เท่านั้น
 *   ยังไม่ผลิต  = เทากราไฟต์ (ยังไม่เกิดขึ้น)
 *   รอขนย้าย    = เหลืองอำพัน (เงินจมอยู่ที่โรงงาน = ต้องรีบ)
 *   เข้าคลังแล้ว = เขียวป่า   (จบแล้ว นิ่งแล้ว)
 * ทุกอย่าง scope ใต้ .fp เพื่อไม่ให้รั่วไปหน้าอื่นในระบบ
 */
const CSS = `
.fp, .fp-portal {
  --fp-paper:        oklch(98.6% 0.002 250);
  --fp-surface:      oklch(100% 0 0);
  --fp-surface-2:    oklch(97.2% 0.003 250);
  --fp-ink:          oklch(21% 0.012 262);
  --fp-ink-2:        oklch(44% 0.012 262);
  --fp-ink-3:        oklch(60% 0.010 262);
  --fp-rule:         oklch(91.5% 0.004 250);
  --fp-rule-strong:  oklch(83% 0.006 250);

  --fp-s1:           oklch(56% 0.014 262);
  --fp-s1-soft:      oklch(93.5% 0.006 262);
  --fp-s1-flow:      oklch(88% 0.012 262);
  --fp-s2:           oklch(64% 0.142 62);
  --fp-s2-soft:      oklch(95% 0.045 78);
  --fp-s2-flow:      oklch(87% 0.085 72);
  --fp-s3:           oklch(50% 0.102 158);
  --fp-s3-soft:      oklch(94.5% 0.048 158);
  --fp-s3-flow:      oklch(86% 0.075 158);
  --fp-danger:       oklch(51% 0.175 26);

  /* สีประจำสถานี 1-4 ของแถบภาพรวม (ม่วง -> ส้ม -> เขียว -> น้ำเงิน) */
  --fp-t1:           oklch(55% 0.165 300);
  --fp-t1-soft:      oklch(95.5% 0.032 300);
  --fp-t2:           oklch(62% 0.152 62);
  --fp-t2-soft:      oklch(96% 0.045 72);
  --fp-t3:           oklch(53% 0.115 158);
  --fp-t3-soft:      oklch(95% 0.045 158);
  --fp-t4:           oklch(55% 0.132 250);
  --fp-t4-soft:      oklch(95.5% 0.038 250);
  --fp-t1-flow:      oklch(87% 0.072 300);
  --fp-t2-flow:      oklch(87% 0.085 72);
  --fp-t3-flow:      oklch(86% 0.072 158);
  --fp-t4-flow:      oklch(87% 0.068 250);

  /* โดนัทสรุปตามเดือนของ SO — เดือนนี้ / -1 / -2 / เก่ากว่านั้น */
  --fp-m1:           oklch(58% 0.17 300);
  --fp-m2:           oklch(66% 0.15 55);
  --fp-m3:           oklch(58% 0.17 25);
  --fp-m4:           oklch(78% 0.12 85);
  --fp-m5:           oklch(72% 0.02 262);

  /* แถบอายุงาน — ยิ่งค้างนานยิ่งร้อน */
  --fp-age-g:        oklch(50% 0.115 158);
  --fp-age-g-soft:   oklch(96% 0.035 158);
  --fp-age-g-line:   oklch(88% 0.06 158);
  --fp-age-y:        oklch(56% 0.115 92);
  --fp-age-y-soft:   oklch(96.5% 0.05 95);
  --fp-age-y-line:   oklch(89% 0.075 95);
  --fp-age-o:        oklch(56% 0.145 55);
  --fp-age-o-soft:   oklch(96% 0.045 62);
  --fp-age-o-line:   oklch(88% 0.075 62);
  --fp-age-r:        oklch(51% 0.175 26);
  --fp-age-r-soft:   oklch(95.5% 0.03 26);
  --fp-age-r-line:   oklch(88% 0.06 26);

  /* ฟอนต์เดียวกับทั้งระบบ — ตัวเลขใช้ tabular-nums ให้คอลัมน์ตรงกันแทนการใช้ mono */
  --fp-font: 'Kanit', system-ui, -apple-system, sans-serif;
  --fp-mono: var(--fp-font);

  --fp-1: 4px;  --fp-2: 8px;  --fp-3: 12px; --fp-4: 16px;
  --fp-5: 24px; --fp-6: 32px; --fp-7: 48px; --fp-8: 64px;

  --fp-radius: 6px;
  --fp-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --fp-dur: 180ms;

  font-family: var(--fp-font);
  color: var(--fp-ink);
}

/* .fp-portal = ตัวถือ token ให้ modal ที่ portal ออกไปแขวนที่ body (นอก .fp) ถ้าไม่มีบรรทัดนี้ var ทั้งชุด resolve ไม่ได้ */
.fp {
  background: var(--fp-paper);
  min-height: 100%;
  overflow-x: clip;
}

/* ── ตัวเลขทุกตัวบนหน้านี้เป็น mono + tabular เพื่อให้คอลัมน์ตรงกัน ── */
.fp .num, .fp-portal .num {
  font-family: var(--fp-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.01em;
}

.fp .fp-label, .fp-portal .fp-label {
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--fp-ink-3);
  font-family: var(--fp-mono);
}

/* ═══ หัวเรื่อง ═══ */
.fp-masthead {
  display: flex; flex-wrap: wrap; align-items: flex-end;
  justify-content: space-between; gap: var(--fp-4);
  padding-bottom: var(--fp-4);
  border-bottom: 1px solid var(--fp-rule-strong);
}
.fp-title {
  font-size: clamp(22px, 2.4vw, 30px);
  font-weight: 600; line-height: 1.15;
  letter-spacing: -0.015em;
  margin: 0;
  overflow-wrap: anywhere; min-width: 0;
}
.fp-route {
  margin: 6px 0 0; font-size: 13px; color: var(--fp-ink-2);
  display: flex; align-items: center; gap: var(--fp-2); flex-wrap: wrap;
}
.fp-route b { font-weight: 500; }
.fp-route span[aria-hidden] { color: var(--fp-ink-3); }

/* ═══ ปุ่ม ═══ */
.fp-btn {
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap;                       /* ปุ่มห้ามตัดสองบรรทัด */
  padding: 8px 14px; border-radius: var(--fp-radius);
  font-family: var(--fp-font); font-size: 13px; font-weight: 500;
  border: 1px solid var(--fp-rule-strong);
  background: var(--fp-surface); color: var(--fp-ink);
  cursor: pointer;
  transition: background-color var(--fp-dur) var(--fp-ease),
              border-color var(--fp-dur) var(--fp-ease),
              color var(--fp-dur) var(--fp-ease);
}
.fp-btn:hover { background: var(--fp-surface-2); border-color: var(--fp-ink-3); }
.fp-btn:active { background: oklch(94% 0.004 250); }
.fp-btn:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: 2px; }
.fp-btn[disabled] { opacity: 0.45; cursor: not-allowed; }
.fp-btn--primary {
  background: var(--fp-ink); color: var(--fp-paper); border-color: var(--fp-ink);
}
.fp-btn--primary:hover { background: oklch(30% 0.014 262); border-color: oklch(30% 0.014 262); }
.fp-btn--primary:active { background: oklch(26% 0.014 262); }
.fp-btn--icon { padding: 6px; border-color: transparent; background: transparent; }
.fp-btn--icon:hover { background: var(--fp-surface-2); border-color: var(--fp-rule); }

.fp-field {
  font-family: var(--fp-font); font-size: 13px;
  padding: 8px 10px; border: 1px solid var(--fp-rule-strong);
  border-radius: var(--fp-radius); background: var(--fp-surface); color: var(--fp-ink);
  min-width: 0;
}
.fp-field:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: 1px; border-color: var(--fp-ink); }

/* ═══ ตัวเลือกบนหัวเรื่อง (โรงงาน / เดือน) ═══ */
.fp-pillsel {
  display: inline-flex; align-items: center; gap: 6px; padding: 0 10px;
  border: 1px solid var(--fp-rule-strong); border-radius: var(--fp-radius);
  background: var(--fp-surface); color: var(--fp-ink-3);
  transition: border-color var(--fp-dur) var(--fp-ease);
}
.fp-pillsel:hover { border-color: var(--fp-ink-3); }
.fp-pillsel:focus-within { outline: 2px solid var(--fp-ink); outline-offset: 1px; }
.fp-pillsel select {
  border: 0; background: transparent; outline: none; cursor: pointer;
  padding: 8px 2px 8px 0; max-width: 180px;
  font-family: var(--fp-font); font-size: 13px; color: var(--fp-ink);
}

.fp-monthnav {
  display: inline-flex; align-items: stretch;
  border: 1px solid var(--fp-rule-strong); border-radius: var(--fp-radius);
  background: var(--fp-surface); overflow: hidden;
}
.fp-monthnav button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px; border: 0; background: transparent; cursor: pointer;
  font-family: var(--fp-font); font-size: 13px; font-weight: 500; color: var(--fp-ink-2);
  transition: background-color var(--fp-dur) var(--fp-ease);
}
.fp-monthnav button:hover { background: var(--fp-surface-2); }
.fp-monthnav button:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: -2px; }
.fp-monthnav__label { min-width: 168px; }

/* ═══ ภาพรวมกระบวนการ — แถบสรุป + การ์ด 4 สถานี + แผงรายละเอียด ═══ */
.fp-ov { margin-top: var(--fp-5); display: grid; gap: var(--fp-3); }

.fp-ov__bar {
  display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
  align-items: center; gap: var(--fp-5);
  background: var(--fp-surface); border: 1px solid var(--fp-rule);
  border-radius: 12px; padding: var(--fp-4) var(--fp-5);
}
.fp-ov__total {
  display: grid; gap: 1px; align-content: center;
  padding-right: var(--fp-5); border-right: 1px solid var(--fp-rule);
}
.fp-ov__big { font-size: 34px; font-weight: 600; line-height: 1.08; }
.fp-ov__totalsub { font-size: 11.5px; color: var(--fp-ink-3); white-space: nowrap; }
.fp-ov__totalsub b { color: var(--fp-ink-2); font-weight: 500; }
.fp-ov__progress { display: grid; gap: 7px; min-width: 0; }
.fp-ov__track { display: flex; height: 9px; border-radius: 999px; overflow: hidden; background: var(--fp-surface-2); }
.fp-ov__seg { height: 100%; transition: width 320ms var(--fp-ease); }
.fp-ov__seg.is-b { background: var(--fp-t2); }
.fp-ov__seg.is-c { background: var(--fp-t3); }
.fp-ov__seg.is-d { background: var(--fp-t4); }
.fp-ov__stamp { font-size: 11.5px; color: var(--fp-ink-3); white-space: nowrap; }

.fp-ov__stages { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--fp-4); }
.fp-ov__cell { position: relative; display: flex; min-width: 0; }

/* สายน้ำ — ริบบิ้นเหนือการ์ด ความหนา = ของที่ค้างอยู่ตรงสถานีนั้น */
.fp-ov__flow { position: relative; padding: 22px 0 16px; margin-bottom: -6px; }
.fp-ov__ribbon { display: block; width: 100%; height: 116px; }
.fp-ov__flowlabel {
  position: absolute; top: 0; z-index: 1; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
  padding: 2px 10px; border-radius: 999px;
  background: var(--fp-surface); border: 1px solid var(--fp-rule);
  font-size: 11.5px; color: var(--fp-ink-2);
}
.fp-ov__flowlabel b { font-weight: 500; color: var(--fp-ink); }
.fp-ov__drops { position: absolute; left: 0; right: 0; bottom: 0; height: 16px; }
.fp-ov__drops i { position: absolute; top: 0; bottom: 0; border-left: 1px dashed var(--fp-rule-strong); }

.fp-ov__card {
  width: 100%; display: grid; gap: 12px; align-content: start;
  padding: var(--fp-4) var(--fp-4) var(--fp-3); border-radius: 12px;
  border: 1px solid var(--fp-rule); background: var(--fp-surface);
  font-family: var(--fp-font); color: inherit; text-align: left; cursor: pointer;
  transition: border-color var(--fp-dur) var(--fp-ease),
              box-shadow var(--fp-dur) var(--fp-ease),
              transform var(--fp-dur) var(--fp-ease);
}
.fp-ov__card.is-a { --tone: var(--fp-t1); --tone-soft: var(--fp-t1-soft); }
.fp-ov__card.is-b { --tone: var(--fp-t2); --tone-soft: var(--fp-t2-soft); }
.fp-ov__card.is-c { --tone: var(--fp-t3); --tone-soft: var(--fp-t3-soft); }
.fp-ov__card.is-d { --tone: var(--fp-t4); --tone-soft: var(--fp-t4-soft); }
.fp-ov__card:hover { border-color: var(--fp-rule-strong); transform: translateY(-1px); }
.fp-ov__card:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: 2px; }
.fp-ov__card.is-open {
  border-color: var(--tone);
  box-shadow: 0 0 0 1px var(--tone), 0 14px 26px -22px var(--tone);
}
.fp-ov__head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fp-ov__n {
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  background: var(--tone); color: oklch(100% 0 0);
  font-size: 10.5px; font-weight: 600; display: grid; place-items: center;
}
.fp-ov__ico {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: var(--tone-soft); color: var(--tone); display: grid; place-items: center;
}
.fp-ov__ico--sm { width: 26px; height: 26px; border-radius: 8px; }
.fp-ov__name { font-size: 14px; font-weight: 500; overflow-wrap: anywhere; min-width: 0; }
.fp-ov__value { display: flex; align-items: baseline; gap: 6px; }
.fp-ov__num { font-size: clamp(26px, 2.8vw, 36px); font-weight: 600; line-height: 1.05; color: var(--tone); }
.fp-ov__unit { font-size: 12px; color: var(--fp-ink-3); }
.fp-ov__foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.fp-ov__pct { font-size: 11.5px; color: var(--fp-ink-3); }
.fp-ov__caret { color: var(--fp-ink-3); display: grid; place-items: center; }

.fp-ov__panel {
  border: 1px solid var(--fp-rule); border-radius: 12px;
  background: var(--fp-surface); overflow: hidden;
  animation: fp-fade-up 220ms var(--fp-ease);
}
.fp-ov__panel.is-a { --tone: var(--fp-t1); --tone-soft: var(--fp-t1-soft); }
.fp-ov__panel.is-b { --tone: var(--fp-t2); --tone-soft: var(--fp-t2-soft); }
.fp-ov__panel.is-c { --tone: var(--fp-t3); --tone-soft: var(--fp-t3-soft); }
.fp-ov__panel.is-d { --tone: var(--fp-t4); --tone-soft: var(--fp-t4-soft); }
.fp-ov__panel-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--fp-3); flex-wrap: wrap;
  padding: var(--fp-3) var(--fp-4); border-bottom: 1px solid var(--fp-rule);
}
.fp-ov__panel-title { display: flex; align-items: center; gap: 10px; font-size: 14px; min-width: 0; }
.fp-ov__chip {
  font-size: 11px; padding: 2px 9px; border-radius: 999px;
  background: var(--tone-soft); color: var(--tone); white-space: nowrap;
}
.fp-ov__more {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: var(--fp-radius);
  border: 1px solid var(--fp-rule); background: transparent;
  font-family: var(--fp-font); font-size: 12px; color: var(--fp-ink-2); cursor: pointer;
  transition: background-color var(--fp-dur) var(--fp-ease), color var(--fp-dur) var(--fp-ease);
}
.fp-ov__more:hover { background: var(--fp-surface-2); color: var(--fp-ink); }
.fp-ov__more:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: 2px; }
.fp-ov__more--foot { margin-top: var(--fp-3); }

.fp-ov__panel-grid {
  display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: var(--fp-3); padding: var(--fp-3); background: var(--fp-paper);
}
.fp-ov__block {
  border: 1px solid var(--fp-rule); border-radius: 10px;
  background: var(--fp-surface); padding: var(--fp-4) var(--fp-4) var(--fp-5); min-width: 0;
}
.fp-ov__note { font-size: 11px; color: var(--fp-ink-3); margin: var(--fp-3) 0 0; }

.fp-ov__donut-wrap { display: flex; align-items: center; gap: var(--fp-5); margin-top: var(--fp-3); flex-wrap: wrap; }
.fp-ov__donut { position: relative; width: 148px; height: 148px; flex-shrink: 0; }
.fp-ov__donut-mid { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.fp-ov__donut-mid b { font-size: 24px; font-weight: 600; }
.fp-ov__donut-mid span { font-size: 11px; color: var(--fp-ink-3); }
.fp-ov__legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; flex: 1; min-width: 200px; }
.fp-ov__legend li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto auto; align-items: center; gap: 9px; font-size: 12.5px; }
.fp-ov__dot { width: 10px; height: 10px; border-radius: 50%; }
.fp-ov__legend-t { color: var(--fp-ink-2); overflow-wrap: anywhere; }
.fp-ov__legend-v { font-weight: 500; }
.fp-ov__legend-p { color: var(--fp-ink-3); font-size: 11.5px; min-width: 46px; text-align: right; }

.fp-ov__ages { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--fp-2); margin-top: var(--fp-3); }
.fp-ov__age { display: grid; gap: 3px; justify-items: center; padding: 14px 6px; border-radius: 10px; border: 1px solid; }
.fp-ov__age.is-g { background: var(--fp-age-g-soft); border-color: var(--fp-age-g-line); color: var(--fp-age-g); }
.fp-ov__age.is-y { background: var(--fp-age-y-soft); border-color: var(--fp-age-y-line); color: var(--fp-age-y); }
.fp-ov__age.is-o { background: var(--fp-age-o-soft); border-color: var(--fp-age-o-line); color: var(--fp-age-o); }
.fp-ov__age.is-r { background: var(--fp-age-r-soft); border-color: var(--fp-age-r-line); color: var(--fp-age-r); }
.fp-ov__age-t { font-size: 11px; color: var(--fp-ink-2); white-space: nowrap; }
.fp-ov__age-v { font-size: 26px; font-weight: 600; line-height: 1.12; }
.fp-ov__age-p { font-size: 11px; }
.fp-ov__agebar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: var(--fp-surface-2); margin-top: var(--fp-3); }
.fp-ov__ageseg { height: 100%; transition: width 320ms var(--fp-ease); }
.fp-ov__ageseg.is-g { background: var(--fp-age-g); }
.fp-ov__ageseg.is-y { background: var(--fp-age-y); }
.fp-ov__ageseg.is-o { background: var(--fp-age-o); }
.fp-ov__ageseg.is-r { background: var(--fp-age-r); }

.fp-table--mini thead th { padding: 7px 10px; background: var(--fp-surface-2); }
.fp-table--mini td { padding: 9px 10px; vertical-align: middle; }
.fp-ov__month {
  display: inline-block; padding: 1px 8px; border-radius: 999px;
  background: var(--fp-surface-2); color: var(--fp-ink-2);
  font-size: 11.5px; white-space: nowrap;
}
.fp-ov__st.is-ok   { background: var(--fp-age-g-soft); color: var(--fp-age-g); }
.fp-ov__st.is-warn { background: var(--fp-age-o-soft); color: var(--fp-age-o); }
.fp-ov__st.is-late { background: var(--fp-age-r-soft); color: var(--fp-age-r); }
.fp-ov__st.is-soon { background: var(--fp-surface-2); color: var(--fp-ink-3); }
.fp-ov__age-cell.is-ok   { color: var(--fp-age-g); }
.fp-ov__age-cell.is-warn { color: var(--fp-age-o); }
.fp-ov__age-cell.is-late { color: var(--fp-age-r); }
.fp-ov__age-cell.is-soon { color: var(--fp-ink-3); }
.fp-ov__empty { text-align: center; color: var(--fp-ink-3); padding: 22px 0; font-size: 12.5px; }
/* li ว่างอยู่ในกริด 5 คอลัมน์ ถ้าไม่ปลดจะถูกบีบลงคอลัมน์แรก 16px แล้วตัวหนังสือตั้งเป็นแนวตั้ง */
.fp-ov__rank li.fp-ov__empty { display: block; border-bottom: 0; }

.fp-ov__rank { list-style: none; margin: var(--fp-3) 0 0; padding: 0; display: grid; }
.fp-ov__rank li {
  display: grid; grid-template-columns: 16px auto auto minmax(0, 1fr) auto;
  align-items: center; gap: 8px; font-size: 12.5px;
  padding: 8px 2px; border-bottom: 1px solid var(--fp-rule);
}
.fp-ov__rank li:last-child { border-bottom: 0; }
.fp-ov__rank-n { color: var(--fp-ink-3); font-size: 11px; }
.fp-ov__rank-so { font-weight: 500; }
.fp-ov__rank-age { text-align: right; font-size: 11.5px; }
.fp-ov__rank-age.is-ok   { color: var(--fp-age-g); }
.fp-ov__rank-age.is-warn { color: var(--fp-age-o); }
.fp-ov__rank-age.is-late { color: var(--fp-age-r); }
.fp-ov__rank-age.is-soon { color: var(--fp-ink-3); }
.fp-ov__rank-qty { color: var(--fp-ink-2); font-size: 11.5px; white-space: nowrap; }

/* ═══ แท็บ ═══ */
.fp-tabs { display: flex; gap: 2px; margin-top: var(--fp-6); border-bottom: 1px solid var(--fp-rule-strong); }
.fp-tab {
  position: relative; padding: 10px 14px; background: transparent; border: 0;
  font-family: var(--fp-font); font-size: 13px; font-weight: 500; color: var(--fp-ink-3);
  cursor: pointer; white-space: nowrap;
  transition: color var(--fp-dur) var(--fp-ease);
}
.fp-tab:hover { color: var(--fp-ink-2); }
.fp-tab:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: -2px; border-radius: 4px; }
.fp-tab[aria-selected="true"] { color: var(--fp-ink); }
.fp-tab[aria-selected="true"]::after {
  content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px;
  height: 2px; background: var(--fp-ink);
}
.fp-tab__count { font-family: var(--fp-mono); font-size: 11px; color: var(--fp-ink-3); margin-left: 5px; }

/* ═══ ตาราง ═══ */
.fp-sheet { margin-top: var(--fp-4); border: 1px solid var(--fp-rule); border-radius: 10px; background: var(--fp-surface); overflow: hidden; }
.fp-scroll { overflow-x: auto; }
.fp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fp-table thead th {
  text-align: left; font-family: var(--fp-font); font-size: 11.5px; font-weight: 500;
  letter-spacing: 0; text-transform: none; color: var(--fp-ink-3);
  padding: 10px 12px; border-bottom: 1px solid var(--fp-rule); white-space: nowrap;
  background: var(--fp-surface-2);
}
.fp-table td { padding: 11px 12px; border-bottom: 1px solid var(--fp-rule); vertical-align: top; }
.fp-table tbody tr:last-child td { border-bottom: 0; }
.fp-table tbody tr { transition: background-color 120ms var(--fp-ease); }
.fp-table tbody tr:hover { background: var(--fp-surface-2); }
.fp-table .r { text-align: right; }
.fp-key { font-weight: 500; }
.fp-sub { font-size: 11px; color: var(--fp-ink-3); margin-top: 2px; }
.fp-zero { color: oklch(78% 0.006 250); }

.fp-pill {
  display: inline-block; padding: 2px 9px; border-radius: 999px;
  font-size: 11px; font-weight: 500; white-space: nowrap; border: 1px solid transparent;
}

.fp-drawer { background: var(--fp-surface-2); }
.fp-drawer__inner { padding: var(--fp-3) var(--fp-4) var(--fp-4) 44px; }

.fp-empty { padding: var(--fp-7) var(--fp-4); text-align: center; color: var(--fp-ink-3); font-size: 13px; }
.fp-empty__title { font-size: 15px; color: var(--fp-ink-2); font-weight: 500; margin-bottom: 6px; }

.fp-note {
  display: flex; gap: var(--fp-2); align-items: flex-start;
  padding: 10px 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.55;
}
.fp-note--warn { background: var(--fp-s2-soft); color: oklch(38% 0.09 62); }
.fp-note--err  { background: oklch(95.5% 0.03 26); color: var(--fp-danger); }

/* ═══ คู่มือ ═══ */
.fp-guide { margin-top: var(--fp-5); border: 1px solid var(--fp-rule); border-radius: 10px; background: var(--fp-surface); overflow: hidden; }
.fp-guide__bar {
  display: flex; align-items: center; justify-content: space-between; gap: var(--fp-3);
  width: 100%; padding: var(--fp-3) var(--fp-4); background: transparent; border: 0;
  cursor: pointer; font-family: var(--fp-font); color: inherit; text-align: left;
  transition: background-color var(--fp-dur) var(--fp-ease);
}
.fp-guide__bar:hover { background: var(--fp-surface-2); }
.fp-guide__bar:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: -2px; }
.fp-guide__body { padding: 0 var(--fp-4) var(--fp-5); border-top: 1px solid var(--fp-rule); }

.fp-steps { display: grid; gap: 0; margin-top: var(--fp-4); }
.fp-step { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: var(--fp-3); padding: var(--fp-4) 0; border-bottom: 1px dashed var(--fp-rule); }
.fp-step:last-child { border-bottom: 0; }
.fp-step__n {
  font-family: var(--fp-mono); font-size: 12px; font-weight: 600;
  width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  border: 1px solid var(--fp-rule-strong); color: var(--fp-ink-2);
}
.fp-step__h { font-size: 15px; font-weight: 500; margin: 2px 0 4px; }
.fp-step__p { font-size: 13px; line-height: 1.65; color: var(--fp-ink-2); margin: 0 0 var(--fp-2); }
.fp-step__meta { display: flex; flex-wrap: wrap; gap: var(--fp-2) var(--fp-4); font-size: 12px; color: var(--fp-ink-3); }
.fp-step__meta b { color: var(--fp-ink-2); font-weight: 500; }

.fp-defs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: var(--fp-4); margin-top: var(--fp-3); }
.fp-def { border-left: 1px solid var(--fp-rule-strong); padding-left: var(--fp-3); }
.fp-def__t { font-size: 13px; font-weight: 500; margin-bottom: 3px; }
.fp-def__d { font-size: 12.5px; line-height: 1.6; color: var(--fp-ink-2); }

.fp-legend { display: grid; gap: var(--fp-2); margin-top: var(--fp-3); }
.fp-legend__row { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: var(--fp-3); align-items: start; font-size: 12.5px; color: var(--fp-ink-2); }
.fp-legend__ico { display: grid; place-items: center; height: 22px; color: var(--fp-ink); }

.fp-guide__h { font-size: 12.5px; font-family: var(--fp-font); letter-spacing: 0; text-transform: none; color: var(--fp-ink-3); margin: var(--fp-6) 0 0; }

/* ═══ FAB — ปุ่มคู่มือลอยมุมขวาล่าง ═══ */
.fp-fab {
  position: fixed; right: 24px; bottom: 24px; z-index: 40;
  width: 52px; height: 52px; border-radius: 50%;
  background: var(--fp-ink); color: var(--fp-paper);
  border: 1px solid var(--fp-ink);
  box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.18);
  display: grid; place-items: center; cursor: pointer;
  transition: transform var(--fp-dur) var(--fp-ease),
              background-color var(--fp-dur) var(--fp-ease),
              box-shadow var(--fp-dur) var(--fp-ease);
}
.fp-fab:hover { transform: translateY(-2px); background: oklch(30% 0.014 262); }
.fp-fab:active { transform: translateY(0); }
.fp-fab:focus-visible { outline: 2px solid var(--fp-paper); outline-offset: 3px; }
.fp-fab[aria-expanded="true"] { background: var(--fp-ink-2); }
.fp-fab__badge {
  position: absolute; top: -3px; right: -3px;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: var(--fp-s2); color: oklch(20% 0.05 62);
  font-family: var(--fp-mono); font-size: 10px; font-weight: 600;
  display: grid; place-items: center;
  box-shadow: 0 0 0 2px var(--fp-paper);
}

/* ═══ Modal — คู่มือ ═══ */
.fp-modal-backdrop {
  position: fixed; inset: 0; z-index: 50;
  background: oklch(15% 0.012 262 / 0.42);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center;
  padding: var(--fp-4);
  animation: fp-fade 180ms var(--fp-ease);
}
.fp-guide-modal {
  background: var(--fp-surface); border: 1px solid var(--fp-rule-strong);
  border-radius: 12px; width: 100%; max-width: min(1120px, calc(100vw - 2 * var(--fp-5)));
  max-height: 88vh; min-height: 0;
  display: flex; flex-direction: column; overflow: hidden;
  /* shadow เบาลงมาก — แค่ให้ modal ลอยจากพื้น ไม่ทึบจนดูเหมือนทะลุเข้าไปในตัว modal */
  box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.22),
              0 2px 4px rgba(0, 0, 0, 0.06);
  animation: fp-fade-up 280ms var(--fp-ease);
}
.fp-guide-modal__header {
  display: flex; align-items: center; justify-content: space-between; gap: var(--fp-3);
  padding: var(--fp-3) var(--fp-5);
  border-bottom: 1px solid var(--fp-rule);
  background: var(--fp-surface);
  flex-shrink: 0;
}
.fp-guide-modal__body { overflow-y: auto; padding: var(--fp-5) var(--fp-6); }
.fp-guide-modal__close {
  width: 32px; height: 32px; border-radius: 8px;
  display: grid; place-items: center;
  border: 1px solid transparent; background: transparent;
  color: var(--fp-ink-2); cursor: pointer;
  transition: background-color var(--fp-dur) var(--fp-ease);
}
.fp-guide-modal__close:hover { background: var(--fp-surface-2); color: var(--fp-ink); }
.fp-guide-modal__close:focus-visible { outline: 2px solid var(--fp-ink); outline-offset: 2px; }
@keyframes fp-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes fp-fade-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }

/* modal กว้างแล้ว บรรทัดจะยาวเกินอ่าน — จอกว้างจึงหั่นเป็น 2 คอลัมน์ */
@media (min-width: 920px) {
  .fp-guide-modal__body { padding: var(--fp-5) var(--fp-6) var(--fp-6); }
  .fp-guide-modal .fp-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--fp-6); }
  .fp-guide-modal .fp-step { border-bottom: 1px dashed var(--fp-rule); }
  .fp-guide-modal .fp-step:nth-last-child(-n+2) { border-bottom: 0; padding-bottom: 0; }
  .fp-guide-modal .fp-defs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .fp-guide-modal .fp-legend { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--fp-6); }
}

/* ═══ จอแคบ ═══ */
@media (max-width: 1180px) {
  .fp-ov__panel-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 980px) {
  .fp-ov__bar { grid-template-columns: minmax(0, 1fr); gap: var(--fp-3); }
  .fp-ov__stamp { text-align: right; }
  .fp-ov__stages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fp-ov__flow { display: none; }
}

@media (max-width: 860px) {
  .fp-tabs { overflow-x: auto; }
  .fp-drawer__inner { padding-left: var(--fp-3); }
  .fp-fab { right: 16px; bottom: 16px; }
}

@media (max-width: 620px) {
  .fp-ov__stages { grid-template-columns: minmax(0, 1fr); }
  .fp-ov__ages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fp-ov__legend li { grid-template-columns: 10px minmax(0, 1fr) auto auto; }
}

@media (prefers-reduced-motion: reduce) {
  .fp *, .fp *::before, .fp *::after,
  .fp-portal, .fp-portal *, .fp-portal *::before, .fp-portal *::after {
    animation-duration: 140ms !important;
    animation-name: fp-fade-only !important;
    transition-duration: 120ms !important;
  }
  .fp-ov__card:hover { transform: none; }
}
@keyframes fp-fade-only { from { opacity: 0 } to { opacity: 1 } }
`;

/** token + สไตล์ทั้งหมดของหน้า "สั่งผลิต & ใบขน" — scope ใต้ .fp ไม่รั่วไปหน้าอื่น */
const ProductionStyles: React.FC = () => <style>{CSS}</style>;

export default ProductionStyles;
