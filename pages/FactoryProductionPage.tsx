import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Pencil, Trash2,
  Loader2, Search, RefreshCw, PackageCheck, Undo2, Download, Truck, X, Factory, Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { User } from '@/types';
import {
  getProductionAccess, listProductionFactories, listProductionOrders,
  listDeliveryNotes, deleteProductionOrder, deleteDeliveryNote,
  pickupDeliveryNote, getProductionSummary, listStockPlanProducts, listWarehouses,
} from '@/services/api';
import ProductionOrderModal from '@/components/FactoryProduction/ProductionOrderModal';
import DeliveryNoteModal from '@/components/FactoryProduction/DeliveryNoteModal';
import PickupModal from '@/components/FactoryProduction/PickupModal';
import ProductionSettings from '@/components/FactoryProduction/ProductionSettings';
import ConfirmModal from '@/components/ConfirmModal';
import ProductionStyles from '@/components/FactoryProduction/productionStyles';
import ProcessOverview, { StationKey } from '@/components/FactoryProduction/ProcessOverview';
import GuideFab from '@/components/FactoryProduction/GuideFab';
import {
  ProductionFactory, ProductionOrder, DeliveryNote, ProductionAccess, ProductionSummary,
  PROGRESS_META, DN_STATUS_META, fmtQty, fmtDate,
} from '@/components/FactoryProduction/types';

interface Props {
  currentUser?: User;
  companyId?: number;
}

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

type Tab = 'orders' | 'notes' | 'report' | 'settings';

const FactoryProductionPage: React.FC<Props> = ({ currentUser, companyId }) => {
  const now = new Date();
  const [tab, setTab] = useState<Tab>('orders');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  /** ยอดค้างผลิตมักข้ามเดือน จึงเริ่มที่ "ทุกเดือน" เสมอ */
  const [allMonths, setAllMonths] = useState(true);
  const [factoryId, setFactoryId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dnStatusFilter, setDnStatusFilter] = useState('');
  /** สถานีที่กดบนแผนผัง — กรองรายการด้านล่างให้ตรงกับจุดที่ของค้างอยู่ */
  const [station, setStation] = useState<StationKey>('all');

  const [access, setAccess] = useState<ProductionAccess>({
    can_manage: false, can_grant: false, is_super_admin: false, factory_ids: [],
  });
  const [factories, setFactories] = useState<ProductionFactory[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [summary, setSummary] = useState<ProductionSummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  /** กล่องยืนยันของระบบ — AGENTS.md ห้ามใช้ window.confirm */
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: React.ReactNode;
    confirmText: string;
    type: 'danger' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const [orderModal, setOrderModal] = useState<{ open: boolean; id?: number } | null>(null);
  const [dnModal, setDnModal] = useState<{ open: boolean; note?: DeliveryNote; orderId?: number; factoryId?: number } | null>(null);
  const [pickupTarget, setPickupTarget] = useState<DeliveryNote | null>(null);

  const effectiveCompanyId = companyId ?? currentUser?.companyId;
  const canManage = access.can_manage;

  const periodParams = useMemo(
    () => (allMonths ? { year: 0, month: 0 } : { year, month }),
    [allMonths, year, month]
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    getProductionAccess(currentUser.id)
      .then((res: any) => {
        if (!res?.success) return;
        setAccess({
          can_manage: !!res.data.can_manage,
          can_grant: !!res.data.can_grant,
          is_super_admin: !!res.data.is_super_admin,
          factory_ids: res.data.factory_ids ?? [],
          role: res.data.role,
        });
      })
      .catch(() => setAccess({ can_manage: false, can_grant: false, is_super_admin: false, factory_ids: [] }));
  }, [currentUser?.id]);

  const loadFactories = async () => {
    const res: any = await listProductionFactories({ userId: currentUser?.id });
    setFactories(res?.data ?? []);
  };
  const loadCatalog = async () => {
    const res: any = await listStockPlanProducts();
    setProducts(res?.data ?? []);
  };
  const loadWarehouses = async () => {
    try {
      const res: any = await listWarehouses(effectiveCompanyId);
      const rows = Array.isArray(res) ? res : (res?.data ?? []);
      setWarehouses(rows.map((w: any) => ({ id: w.id, name: w.name })));
    } catch {
      setWarehouses([]);
    }
  };

  useEffect(() => {
    loadFactories().catch(() => {});
    loadCatalog().catch(() => {});
    loadWarehouses().catch(() => {});
  }, [currentUser?.id, effectiveCompanyId]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const common = {
        userId: currentUser?.id,
        companyId: effectiveCompanyId,
        factoryId: factoryId ? Number(factoryId) : undefined,
        month: periodParams.month || undefined,
        year: periodParams.year || undefined,
      };
      const [oRes, nRes, sRes]: any[] = await Promise.all([
        listProductionOrders({ ...common, status: statusFilter || undefined, search: search || undefined }),
        listDeliveryNotes({ ...common, status: dnStatusFilter || undefined, search: search || undefined }),
        getProductionSummary({ ...common, scope: 'open' }),
      ]);
      setOrders(oRes?.data ?? []);
      setNotes(nRes?.data ?? []);
      setSummary(sRes?.data ?? null);
      setUpdatedAt(new Date());
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    loadAll();
  }, [currentUser?.id, effectiveCompanyId, factoryId, allMonths, month, year, statusFilter, dnStatusFilter]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const t = setTimeout(() => loadAll(), 350);
    return () => clearTimeout(t);
  }, [search]);

  /** กดสถานีบนแผนผัง = กระโดดไปแท็บที่ตอบคำถามนั้นได้จริง */
  const handleStation = (s: StationKey) => {
    setStation(s);
    if (s === 'pending') setTab('orders');
    if (s === 'waiting' || s === 'picked') setTab('notes');
  };

  const visibleOrders = useMemo(() => {
    if (station === 'pending') return orders.filter(o => o.totals.pending_qty > 0 && o.status === 'open');
    if (station === 'waiting') return orders.filter(o => o.totals.waiting_qty > 0);
    if (station === 'picked') return orders.filter(o => o.totals.picked_qty > 0);
    return orders;
  }, [orders, station]);

  const visibleNotes = useMemo(() => {
    if (station === 'waiting') return notes.filter(n => n.status === 'issued');
    if (station === 'picked') return notes.filter(n => n.status === 'picked_up');
    return notes;
  }, [notes, station]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y); setAllMonths(false);
  };

  const handleDeleteOrder = (o: ProductionOrder) => {
    setConfirmAction({
      title: 'ลบ SO สั่งผลิต',
      message: <>ลบ SO <b>{o.so_number}</b> ({o.factory_name}) ออกจากระบบ?</>,
      confirmText: 'ลบ SO',
      type: 'danger',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await deleteProductionOrder({ id: o.id, user_id: currentUser?.id });
          loadAll();
        } catch (err: any) {
          setError(err?.data?.error || err?.message || 'ลบไม่สำเร็จ');
        }
      },
    });
  };

  const handleDeleteNote = (n: DeliveryNote) => {
    setConfirmAction({
      title: 'ลบใบขน',
      message: <>ลบใบขน <b>{n.dn_number}</b> ({n.factory_name}) ออกจากระบบ?</>,
      confirmText: 'ลบใบขน',
      type: 'danger',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await deleteDeliveryNote({ id: n.id, user_id: currentUser?.id });
          loadAll();
        } catch (err: any) {
          setError(err?.data?.error || err?.message || 'ลบไม่สำเร็จ');
        }
      },
    });
  };

  const handleUndoPickup = (n: DeliveryNote) => {
    setConfirmAction({
      title: 'ถอนการรับเข้าคลัง',
      message: (
        <>ถอนการรับเข้าคลังของใบขน <b>{n.dn_number}</b>?<br />ยอดจะกลับไปเป็น “รอขนย้าย”</>
      ),
      confirmText: 'ถอนการรับเข้า',
      type: 'warning',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await pickupDeliveryNote({ id: n.id, action: 'undo', user_id: currentUser?.id });
          loadAll();
        } catch (err: any) {
          setError(err?.data?.error || err?.message || 'ถอนไม่สำเร็จ');
        }
      },
    });
  };

  const exportReport = () => {
    if (!summary) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      summary.by_factory.map(f => ({
        โรงงาน: f.factory_name, 'จำนวน SO': f.so_count, สั่งผลิต: f.ordered_qty,
        ยังไม่ผลิต: f.pending_qty, รอขนย้าย: f.waiting_qty, เข้าคลังแล้ว: f.picked_qty,
        รับจริง: f.received_qty, ขาด: f.shortage_qty,
      }))
    ), 'รายโรงงาน');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      summary.by_product.map(p => ({
        รหัส: p.sku, สินค้า: p.product_name, สั่งผลิต: p.ordered_qty,
        ยังไม่ผลิต: p.pending_qty, รอขนย้าย: p.waiting_qty, เข้าคลังแล้ว: p.picked_qty,
      }))
    ), 'รายสินค้า');
    const stamp = allMonths ? 'ทั้งหมด' : `${year}-${String(month).padStart(2, '0')}`;
    XLSX.writeFile(wb, `สั่งผลิต_${stamp}.xlsx`);
  };

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'orders', label: 'SO สั่งผลิต', count: visibleOrders.length },
    { key: 'notes', label: 'ใบขน', count: visibleNotes.length },
    { key: 'report', label: 'รายงาน' },
    { key: 'settings', label: 'ตั้งค่า' },
  ];

  const nothingYet = !loading && orders.length === 0 && notes.length === 0 && !search && !statusFilter;
  const num = (v: number) => <span className={`num${v === 0 ? ' fp-zero' : ''}`}>{fmtQty(v)}</span>;

  return (
    <div className="fp" style={{ padding: '20px clamp(12px, 3vw, 32px) 56px' }}>
      <ProductionStyles />

      <header className="fp-masthead">
        <div style={{ minWidth: 0 }}>
          <h1 className="fp-title">สั่งผลิต &amp; ใบขน</h1>
          <p className="fp-route">
            ภาพรวมกระบวนการ SO ทั้งหมด
            {!canManage && (
              <span style={{ color: 'var(--fp-ink-3)', marginLeft: 4 }}>· บัญชีนี้ดูอย่างเดียว</span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div className="fp-pillsel">
            <Factory size={14} aria-hidden />
            <select value={factoryId} aria-label="กรองตามโรงงาน"
                    onChange={e => setFactoryId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">ทุกโรงงาน</option>
              {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div className="fp-monthnav">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="เดือนก่อนหน้า">
              <ChevronLeft size={15} />
            </button>
            <button type="button" className="fp-monthnav__label"
                    style={{ color: allMonths ? 'var(--fp-ink-3)' : 'var(--fp-ink)' }}
                    onClick={() => setAllMonths(v => !v)}
                    title="สลับระหว่างดูทุกเดือนกับเฉพาะเดือนที่เลือก">
              <Calendar size={14} aria-hidden />
              {allMonths ? 'ทุกเดือน' : `${MONTH_NAMES_TH[month - 1]} ${year + 543}`}
            </button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="เดือนถัดไป">
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: 11, color: 'var(--fp-ink-3)' }} />
            <input className="fp-field" style={{ paddingLeft: 28, width: 208 }}
                   value={search} onChange={e => setSearch(e.target.value)}
                   placeholder="ค้นหา SO / ใบขน / สินค้า" aria-label="ค้นหา" />
          </div>

          <button type="button" className="fp-btn fp-btn--icon" onClick={loadAll} title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลใหม่">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {canManage && (
            <button type="button" className="fp-btn fp-btn--primary" onClick={() => setOrderModal({ open: true })}>
              <Plus size={15} /> เปิด SO
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="fp-note fp-note--err" style={{ marginTop: 16 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" className="fp-btn fp-btn--icon" onClick={() => setError(null)} aria-label="ปิด">
            <X size={14} />
          </button>
        </div>
      )}

      <ProcessOverview
        summary={summary}
        orders={orders}
        notes={notes}
        station={station}
        onStation={handleStation}
        updatedAt={updatedAt}
      />

      <GuideFab canManage={canManage} />

      <nav className="fp-tabs" role="tablist" aria-label="มุมมองข้อมูล">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" className="fp-tab"
                  aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
            {typeof t.count === 'number' && <span className="fp-tab__count num">{t.count}</span>}
          </button>
        ))}
      </nav>

      {/* ═══ SO ═══ */}
      {tab === 'orders' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <select className="fp-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="กรองสถานะ SO">
              <option value="">ทุกสถานะ</option>
              <option value="open">เปิดอยู่</option>
              <option value="closed">ปิดยอดแล้ว</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
          </div>

          <div className="fp-sheet">
            {nothingYet ? (
              <div className="fp-empty">
                <div className="fp-empty__title">ยังไม่มี SO ในระบบ</div>
                <p style={{ maxWidth: 460, margin: '0 auto 16px' }}>
                  เริ่มจากคีย์ใบ SO ที่ได้จาก e-acc เข้ามา แล้วเส้นทางด้านบนจะเริ่มเดิน
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {canManage && (
                    <button type="button" className="fp-btn fp-btn--primary" onClick={() => setOrderModal({ open: true })}>
                      <Plus size={15} /> เปิด SO ใบแรก
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="fp-scroll">
                <table className="fp-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}><span className="sr-only" /></th>
                      <th>SO</th>
                      <th>โรงงาน</th>
                      <th>วันที่ SO / กำหนดส่ง</th>
                      <th className="r">สั่งผลิต</th>
                      <th className="r">ยังไม่ผลิต</th>
                      <th className="r">รอขนย้าย</th>
                      <th className="r">เข้าคลัง</th>
                      <th>สถานะ</th>
                      <th style={{ width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {loading && visibleOrders.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--fp-ink-3)' }}>
                        <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} /> กำลังโหลด…
                      </td></tr>
                    )}
                    {!loading && visibleOrders.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--fp-ink-3)' }}>
                        ไม่มี SO ตามเงื่อนไขที่เลือก
                      </td></tr>
                    )}
                    {visibleOrders.map(o => {
                      const meta = PROGRESS_META[o.progress_status];
                      const isOpen = !!expanded[o.id];
                      return (
                        <React.Fragment key={o.id}>
                          <tr>
                            <td>
                              <button type="button" className="fp-btn fp-btn--icon"
                                      aria-expanded={isOpen}
                                      aria-label={isOpen ? 'ย่อรายการสินค้า' : 'ดูรายการสินค้า'}
                                      onClick={() => setExpanded(p => ({ ...p, [o.id]: !p[o.id] }))}>
                                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                            <td><span className="fp-key num">{o.so_number}</span></td>
                            <td>{o.factory_name}</td>
                            <td>
                              <span className="num">{fmtDate(o.so_date)}</span>
                              {(o.due_date || o.receive_date) && (
                                <div className="fp-sub num">
                                  ส่ง {fmtDate(o.due_date ?? o.receive_date)}
                                </div>
                              )}
                            </td>
                            <td className="r">{num(o.totals.ordered_qty)}</td>
                            <td className="r" style={{ color: o.totals.pending_qty > 0 ? 'var(--fp-s1)' : undefined }}>
                              {num(o.totals.pending_qty)}
                            </td>
                            <td className="r" style={{ color: o.totals.waiting_qty > 0 ? 'var(--fp-s2)' : undefined }}>
                              {num(o.totals.waiting_qty)}
                            </td>
                            <td className="r" style={{ color: o.totals.picked_qty > 0 ? 'var(--fp-s3)' : undefined }}>
                              {num(o.totals.picked_qty)}
                            </td>
                            <td>
                              <span className="fp-pill" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                            </td>
                            <td className="r" style={{ whiteSpace: 'nowrap' }}>
                              {canManage && (
                                <>
                                  {o.status === 'open' && o.totals.pending_qty > 0 && (
                                    <button type="button" className="fp-btn fp-btn--icon" title="ออกใบขนจาก SO นี้"
                                            onClick={() => setDnModal({ open: true, orderId: o.id, factoryId: o.factory_id })}>
                                      <Truck size={15} />
                                    </button>
                                  )}
                                  <button type="button" className="fp-btn fp-btn--icon" title="แก้ไข SO"
                                          onClick={() => setOrderModal({ open: true, id: o.id })}>
                                    <Pencil size={14} />
                                  </button>
                                  <button type="button" className="fp-btn fp-btn--icon" title="ลบ SO"
                                          onClick={() => handleDeleteOrder(o)}>
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="fp-drawer">
                              <td colSpan={10} style={{ padding: 0 }}>
                                <div className="fp-drawer__inner">
                                  <table className="fp-table" style={{ background: 'transparent' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ background: 'transparent' }}>สินค้า</th>
                                        <th className="r" style={{ background: 'transparent', width: 110 }}>สั่งผลิต</th>
                                        <th className="r" style={{ background: 'transparent', width: 110 }}>ยังไม่ผลิต</th>
                                        <th className="r" style={{ background: 'transparent', width: 110 }}>รอขนย้าย</th>
                                        <th className="r" style={{ background: 'transparent', width: 110 }}>เข้าคลัง</th>
                                        <th className="r" style={{ background: 'transparent', width: 90 }}>ขาด</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {o.items.map(i => (
                                        <tr key={i.id}>
                                          <td>
                                            {i.product_name}
                                            <div className="fp-sub num">{i.sku}</div>
                                          </td>
                                          <td className="r">{num(i.ordered_qty)}</td>
                                          <td className="r" style={{ color: i.pending_qty > 0 ? 'var(--fp-s1)' : undefined }}>{num(i.pending_qty)}</td>
                                          <td className="r" style={{ color: i.waiting_qty > 0 ? 'var(--fp-s2)' : undefined }}>{num(i.waiting_qty)}</td>
                                          <td className="r" style={{ color: i.picked_qty > 0 ? 'var(--fp-s3)' : undefined }}>{num(i.picked_qty)}</td>
                                          <td className="r" style={{ color: i.shortage_qty > 0 ? 'var(--fp-danger)' : undefined }}>{num(i.shortage_qty)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {o.notes && (
                                    <p style={{ fontSize: 12.5, color: 'var(--fp-ink-3)', margin: '10px 0 0' }}>
                                      หมายเหตุ · {o.notes}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ ใบขน ═══ */}
      {tab === 'notes' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <select className="fp-field" value={dnStatusFilter} onChange={e => setDnStatusFilter(e.target.value)} aria-label="กรองสถานะใบขน">
              <option value="">ทุกสถานะ</option>
              <option value="issued">รอขนย้าย</option>
              <option value="picked_up">เข้าคลังแล้ว</option>
              <option value="cancelled">ยกเลิก</option>
            </select>
            {canManage && (
              <button type="button" className="fp-btn fp-btn--primary" style={{ marginLeft: 'auto' }}
                      onClick={() => setDnModal({ open: true })}>
                <Plus size={15} /> คีย์ใบขน
              </button>
            )}
          </div>

          <div className="fp-sheet">
            <div className="fp-scroll">
              <table className="fp-table">
                <thead>
                  <tr>
                    <th>เลขใบขน</th>
                    <th>โรงงาน</th>
                    <th>วันที่ออก</th>
                    <th>SO</th>
                    <th>สินค้า</th>
                    <th className="r">จำนวน</th>
                    <th>สถานะ</th>
                    <th>รับเข้าคลัง</th>
                    <th style={{ width: 110 }} />
                  </tr>
                </thead>
                <tbody>
                  {!loading && visibleNotes.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fp-ink-3)' }}>
                      {nothingYet ? 'ยังไม่มีใบขน — จะมีเมื่อโรงงานผลิตเสร็จล็อตแรกและออกใบขนให้' : 'ไม่มีใบขนตามเงื่อนไขที่เลือก'}
                    </td></tr>
                  )}
                  {visibleNotes.map(n => {
                    const meta = DN_STATUS_META[n.status];
                    const short = n.status === 'picked_up' && n.total_received_qty !== n.total_qty;
                    return (
                      <tr key={n.id}>
                        <td><span className="fp-key num">{n.dn_number}</span></td>
                        <td>{n.factory_name}</td>
                        <td className="num">{fmtDate(n.issued_date)}</td>
                        <td className="num">{n.so_numbers.join(', ')}</td>
                        <td>
                          {n.items.slice(0, 2).map(i => i.product_name).join(', ')}
                          {n.items.length > 2 && <span style={{ color: 'var(--fp-ink-3)' }}> +{n.items.length - 2}</span>}
                        </td>
                        <td className="r">
                          {num(n.total_qty)}
                          {short && (
                            <div className="fp-sub num" style={{ color: 'var(--fp-danger)' }}>
                              รับจริง {fmtQty(n.total_received_qty)}
                            </div>
                          )}
                        </td>
                        <td><span className="fp-pill" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span></td>
                        <td>
                          {n.status === 'picked_up' ? (
                            <>
                              {n.warehouse_name ?? '—'}
                              <div className="fp-sub num">{fmtDate(n.received_date)}</div>
                            </>
                          ) : <span className="fp-zero">—</span>}
                        </td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}>
                          {canManage && n.status === 'issued' && (
                            <button type="button" className="fp-btn fp-btn--icon" title="รับของเข้าคลัง"
                                    onClick={() => setPickupTarget(n)}>
                              <PackageCheck size={16} style={{ color: 'var(--fp-s3)' }} />
                            </button>
                          )}
                          {canManage && n.status === 'picked_up' && (
                            <button type="button" className="fp-btn fp-btn--icon" title="ถอนการรับเข้า"
                                    onClick={() => handleUndoPickup(n)}>
                              <Undo2 size={15} />
                            </button>
                          )}
                          {canManage && n.status !== 'picked_up' && (
                            <button type="button" className="fp-btn fp-btn--icon" title="แก้ไขใบขน"
                                    onClick={() => setDnModal({ open: true, note: n })}>
                              <Pencil size={14} />
                            </button>
                          )}
                          {canManage && (
                            <button type="button" className="fp-btn fp-btn--icon" title="ลบใบขน"
                                    onClick={() => handleDeleteNote(n)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══ รายงาน ═══ */}
      {tab === 'report' && summary && (
        <div style={{ marginTop: 14, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="fp-btn" onClick={exportReport}>
              <Download size={14} /> ส่งออก Excel
            </button>
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}>
            <section className="fp-sheet" style={{ padding: 16 }}>
              <span className="fp-label">ยอดค้างรายโรงงาน</span>
              <table className="fp-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th style={{ background: 'transparent' }}>โรงงาน</th>
                    <th className="r" style={{ background: 'transparent' }}>SO</th>
                    <th className="r" style={{ background: 'transparent' }}>ยังไม่ผลิต</th>
                    <th className="r" style={{ background: 'transparent' }}>รอขนย้าย</th>
                    <th className="r" style={{ background: 'transparent' }}>เข้าคลัง</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.by_factory.map(f => (
                    <tr key={f.factory_id}>
                      <td>{f.factory_name}</td>
                      <td className="r num">{f.so_count}</td>
                      <td className="r" style={{ color: 'var(--fp-s1)' }}>{num(f.pending_qty)}</td>
                      <td className="r" style={{ color: 'var(--fp-s2)' }}>{num(f.waiting_qty)}</td>
                      <td className="r" style={{ color: 'var(--fp-s3)' }}>{num(f.picked_qty)}</td>
                    </tr>
                  ))}
                  {summary.by_factory.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fp-ink-3)', padding: 24 }}>ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="fp-sheet" style={{ padding: 16 }}>
              <span className="fp-label">คิวรอ Airport มารับ</span>
              {summary.pickup_queue.length === 0 ? (
                <p style={{ color: 'var(--fp-ink-3)', fontSize: 13, padding: '24px 0', textAlign: 'center', margin: 0 }}>
                  ไม่มีใบขนค้างรอขนย้าย
                </p>
              ) : (
                <table className="fp-table" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ background: 'transparent' }}>โรงงาน</th>
                      <th className="r" style={{ background: 'transparent' }}>ใบขน</th>
                      <th className="r" style={{ background: 'transparent' }}>จำนวน</th>
                      <th className="r" style={{ background: 'transparent' }}>ค้างตั้งแต่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.pickup_queue.map(q => (
                      <tr key={q.factory_id}>
                        <td>{q.factory_name}</td>
                        <td className="r num">{q.note_count}</td>
                        <td className="r" style={{ color: 'var(--fp-s2)' }}>{num(q.qty)}</td>
                        <td className="r num">{fmtDate(q.oldest_issued_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section className="fp-sheet" style={{ padding: 16 }}>
            <span className="fp-label">ยอดค้างรายสินค้า</span>
            <div style={{ maxHeight: '50vh', overflowY: 'auto', marginTop: 10 }}>
              <table className="fp-table">
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0 }}>สินค้า</th>
                    <th className="r" style={{ position: 'sticky', top: 0 }}>สั่งผลิต</th>
                    <th className="r" style={{ position: 'sticky', top: 0 }}>ยังไม่ผลิต</th>
                    <th className="r" style={{ position: 'sticky', top: 0 }}>รอขนย้าย</th>
                    <th className="r" style={{ position: 'sticky', top: 0 }}>เข้าคลัง</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.by_product.map(p => (
                    <tr key={p.product_id}>
                      <td>
                        {p.product_name}
                        <div className="fp-sub num">{p.sku}</div>
                      </td>
                      <td className="r">{num(p.ordered_qty)}</td>
                      <td className="r" style={{ color: 'var(--fp-s1)' }}>{num(p.pending_qty)}</td>
                      <td className="r" style={{ color: 'var(--fp-s2)' }}>{num(p.waiting_qty)}</td>
                      <td className="r" style={{ color: 'var(--fp-s3)' }}>{num(p.picked_qty)}</td>
                    </tr>
                  ))}
                  {summary.by_product.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fp-ink-3)', padding: 24 }}>ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ═══ ตั้งค่า ═══ */}
      {tab === 'settings' && (
        <div style={{ marginTop: 14 }}>
          <ProductionSettings
            factories={factories}
            products={products}
            access={access}
            companyId={effectiveCompanyId}
            currentUser={currentUser}
            onChanged={() => { loadFactories().catch(() => {}); loadCatalog().catch(() => {}); }}
          />
        </div>
      )}

      {orderModal?.open && (
        <ProductionOrderModal
          editOrderId={orderModal.id}
          factories={factories}
          products={products}
          companyId={effectiveCompanyId}
          currentUser={currentUser}
          onClose={() => setOrderModal(null)}
          onSaved={() => { setOrderModal(null); loadAll(); }}
        />
      )}

      {dnModal?.open && (
        <DeliveryNoteModal
          editNote={dnModal.note}
          presetOrderId={dnModal.orderId}
          presetFactoryId={dnModal.factoryId}
          factories={factories}
          companyId={effectiveCompanyId}
          currentUser={currentUser}
          onClose={() => setDnModal(null)}
          onSaved={() => { setDnModal(null); loadAll(); }}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          type={confirmAction.type}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}

      {pickupTarget && (
        <PickupModal
          note={pickupTarget}
          warehouses={warehouses}
          currentUser={currentUser}
          onClose={() => setPickupTarget(null)}
          onSaved={() => { setPickupTarget(null); loadAll(); }}
        />
      )}
    </div>
  );
};

export default FactoryProductionPage;
