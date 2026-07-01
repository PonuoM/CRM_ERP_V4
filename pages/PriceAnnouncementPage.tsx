import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Package, Users, Building2, Percent, StickyNote, Calendar, Search } from 'lucide-react';
import { Product, Company, User, PriceAnnouncement } from '../types';
import { listPriceAnnouncements, deletePriceAnnouncement } from '../services/api';
import PriceAnnouncementModal from '../components/PriceAnnouncementModal';

interface PriceAnnouncementPageProps {
  products: Product[];
  allCompanies: Company[];
  currentUser: User;
  // Controls create/edit/copy/delete controls. Viewing the page (and its announcements) never
  // requires this — only granted roles can manage announcements; everyone with page access can read.
  canEdit?: boolean;
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const nextMonthValue = (month: string) => {
  const d = new Date(`${month}-01`);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
};

const thaiMonthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
};

const formatMoney = (value?: number | null) => (value == null ? '-' : `฿${Number(value).toLocaleString()}`);

const scopeLabel = (a: PriceAnnouncement, allCompanies: Company[], kind: 'role' | 'company') => {
  const ids = kind === 'role' ? a.visibility_role_ids : a.visibility_company_ids;
  if (!ids || ids.length === 0) return kind === 'role' ? 'ทุกแผนก' : 'ทุกบริษัท';
  if (kind === 'company') return ids.map((id) => allCompanies.find((c) => c.id === id)?.name || `#${id}`).join(', ');
  return `${ids.length} แผนก`;
};

interface AnnouncementSheetProps {
  a: PriceAnnouncement;
  allCompanies: Company[];
  canEdit: boolean;
  onCopy: (a: PriceAnnouncement) => void;
  onEdit: (a: PriceAnnouncement) => void;
  onDelete: (id: number) => void;
}

// Big, spreadsheet-style detail view for a single announcement (the content shown under the active tab).
const AnnouncementSheet: React.FC<AnnouncementSheetProps> = ({ a, allCompanies, canEdit, onCopy, onEdit, onDelete }) => {
  const [lightbox, setLightbox] = useState<string | null>(null);
  return (
  <div>
    {/* Header */}
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 border-b border-gray-200">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Package size={20} className="text-blue-600" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-gray-900 text-xl leading-snug truncate" title={a.title || a.product_name}>
            {a.title || a.product_name}
          </div>
          {a.title && <div className="text-sm text-gray-500 truncate">{a.product_name}</div>}
          <div className="text-xs text-gray-400 uppercase tracking-wide truncate">
            {a.sku} · {a.company_name}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium flex items-center gap-1">
          <Calendar size={13} /> {thaiMonthLabel(a.month)}
        </span>
        <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs flex items-center gap-1">
          <Users size={13} /> {scopeLabel(a, allCompanies, 'role')}
        </span>
        <span className="px-2.5 py-1 rounded-md bg-green-50 text-green-700 text-xs flex items-center gap-1">
          <Building2 size={13} /> {scopeLabel(a, allCompanies, 'company')}
        </span>
        {canEdit && (
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={() => onCopy(a)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-300 flex items-center gap-1"
            >
              <Copy size={13} /> คัดลอก
            </button>
            <button
              onClick={() => onEdit(a)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 flex items-center gap-1"
            >
              <Pencil size={13} /> แก้ไข
            </button>
            <button
              onClick={() => onDelete(a.id)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 flex items-center gap-1"
            >
              <Trash2 size={13} /> ลบ
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Price table — spreadsheet-style grid, with optional product image on the left */}
    <div className="flex items-start gap-3 p-4">
      {a.image_url && (
        <div className="flex-shrink-0 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white" style={{ width: 180 }}>
          <div className="bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-700 text-center border-b border-gray-300 leading-snug">
            {(a.title || a.product_name || '').length > 28
              ? (a.title || a.product_name || '').slice(0, 28) + '…'
              : (a.title || a.product_name || '')}
          </div>
          <img
            src={a.image_url}
            alt={a.title || a.product_name}
            className="w-full object-contain bg-white cursor-zoom-in"
            style={{ height: 180 }}
            onClick={() => setLightbox(a.image_url!)}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {a.sku && (
            <div className="bg-gray-50 px-2 py-1 text-center text-xs text-gray-400 border-t border-gray-200 truncate">
              {a.sku}
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto flex-1">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 px-4 py-2.5 text-left font-semibold text-gray-700">จำนวน</th>
              <th className="border border-gray-300 bg-gray-100 px-4 py-2.5 text-right font-semibold text-gray-700">ราคาเก่า</th>
              <th className="border border-gray-300 bg-yellow-100 px-4 py-2.5 text-right font-semibold text-gray-800">ราคาใหม่</th>
              <th className="border border-gray-300 bg-yellow-100 px-4 py-2.5 text-right font-semibold text-gray-800">ต่อหน่วย</th>
              <th className="border border-gray-300 bg-gray-100 px-4 py-2.5 text-left font-semibold text-gray-700">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {[...a.tiers].sort((x, y) => x.quantity - y.quantity).map((t, i) => (
              <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                <td className="border border-gray-300 px-4 py-2 text-gray-700">{t.quantity}</td>
                <td className="border border-gray-300 px-4 py-2 text-right text-gray-400 line-through">
                  {t.old_total_price != null ? formatMoney(t.old_total_price) : '-'}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right font-bold text-indigo-700">
                  {formatMoney(t.new_total_price)}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right text-gray-500">
                  {t.new_unit_price != null
                    ? formatMoney(t.new_unit_price)
                    : t.quantity
                      ? formatMoney(t.new_total_price / t.quantity)
                      : '-'}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-gray-600 italic">
                  {t.notes.length > 0 ? t.notes.map((n, ni) => <div key={ni}>• {n}</div>) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* General notes */}
    {a.general_notes && (
      <div className="mx-4 mb-4 px-4 py-3 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-gray-800 whitespace-pre-line flex gap-2">
        <StickyNote size={16} className="flex-shrink-0 mt-0.5 text-yellow-600" />
        <div>{a.general_notes}</div>
      </div>
    )}

    {/* Lightbox overlay */}
    {lightbox && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        onClick={() => setLightbox(null)}
      >
        <img
          src={lightbox}
          alt=""
          className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full w-9 h-9 flex items-center justify-center text-xl leading-none"
          onClick={() => setLightbox(null)}
        >
          ×
        </button>
      </div>
    )}

    {/* Discount block — also a real spreadsheet-style table */}
    {a.discount_tiers.length > 0 && (
      <div className="mx-4 mb-4">
        <div className="text-base font-semibold text-teal-700 flex items-center gap-1.5 mb-2">
          <Percent size={16} /> ส่วนลดท้ายบิล
        </div>
        {a.discount_notes.length > 0 && (
          <div className="text-sm text-gray-600 mb-2 leading-snug">
            {a.discount_notes.map((n, ni) => (
              <div key={ni}>• {n}</div>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 bg-gray-100 px-4 py-2 text-left font-semibold text-gray-700">ยอดขาย</th>
                <th className="border border-gray-300 bg-amber-50 px-4 py-2 text-left font-semibold text-amber-800">
                  ปลายทาง + ส่วนลดท้ายบิล
                </th>
                <th className="border border-gray-300 bg-teal-50 px-4 py-2 text-left font-semibold text-teal-800">
                  โอน + ส่วนลดท้ายบิล
                </th>
              </tr>
            </thead>
            <tbody>
              {a.discount_tiers.map((dt, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-gray-300 px-4 py-2 font-medium text-gray-700">
                    ฿{dt.min_amount.toLocaleString()}+
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-amber-700">
                    {dt.cod_discount_pct != null ? `${dt.cod_discount_pct}%` : '-'}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-teal-700">
                    {dt.transfer_discount_pct != null ? `${dt.transfer_discount_pct}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
  );
};

interface SheetSectionProps {
  list: PriceAnnouncement[];
  allCompanies: Company[];
  canEdit: boolean;
  onCopy: (a: PriceAnnouncement) => void;
  onEdit: (a: PriceAnnouncement) => void;
  onDelete: (id: number) => void;
}

// Sidebar navigation — product list on the left, announcement detail on the right.
const SheetSection: React.FC<SheetSectionProps> = ({ list, allCompanies, canEdit, onCopy, onEdit, onDelete }) => {
  const [activeId, setActiveId] = useState<number | null>(list[0]?.id ?? null);
  const [search, setSearch] = useState('');

  // Products that appear more than once (different visibility) get a company sub-label.
  const duplicateProductIds = useMemo(() => {
    const counts = new Map<number, number>();
    list.forEach((a) => counts.set(a.product_id, (counts.get(a.product_id) || 0) + 1));
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [list]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((a) =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.product_name || '').toLowerCase().includes(q)
    );
  }, [list, search]);

  useEffect(() => {
    if (!filteredList.some((a) => a.id === activeId)) {
      setActiveId(filteredList[0]?.id ?? null);
    }
  }, [filteredList, activeId]);

  const active = filteredList.find((a) => a.id === activeId) ?? filteredList[0] ?? null;

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm flex overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
      {/* Left sidebar — scrollable product list with search */}
      <div className="w-52 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-2 border-b border-gray-200">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`ค้นหาใน ${list.length} รายการ...`}
              className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {filteredList.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-6">ไม่พบรายการ</div>
          ) : (
            filteredList.map((a) => {
              const isDup = duplicateProductIds.has(a.product_id);
              const label = a.title || a.product_name || `#${a.id}`;
              const isActive = a.id === active?.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveId(a.id)}
                  title={label + (isDup && a.company_name ? ` · ${a.company_name}` : '')}
                  className={`w-full text-left px-3 py-2.5 text-xs border-b border-gray-100 transition-colors flex flex-col gap-0.5 ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <span className="leading-tight">{label}</span>
                  {isDup && a.company_name && (
                    <span className={`text-xs leading-tight ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                      {a.company_name}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-gray-200 bg-white text-xs text-gray-400 text-center">
          {filteredList.length < list.length ? `${filteredList.length} / ${list.length}` : list.length} รายการ
        </div>
      </div>

      {/* Right — announcement detail */}
      <div className="flex-1 min-w-0 overflow-auto">
        {!active ? (
          <div className="text-center text-gray-500 py-10 text-sm">ไม่พบรายการ</div>
        ) : (
          <AnnouncementSheet a={active} allCompanies={allCompanies} canEdit={canEdit} onCopy={onCopy} onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>
    </div>
  );
};

const PriceAnnouncementPage: React.FC<PriceAnnouncementPageProps> = ({ products, allCompanies, currentUser, canEdit = false }) => {
  const [month, setMonth] = useState(currentMonthValue());
  const [announcements, setAnnouncements] = useState<PriceAnnouncement[]>([]);
  const [nextAnnouncements, setNextAnnouncements] = useState<PriceAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceAnnouncement | null>(null);
  const [copyFrom, setCopyFrom] = useState<PriceAnnouncement | null>(null);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setCopyFrom(null);
  };

  const defaultCompanyId = (currentUser as any)?.company_id || (currentUser as any)?.companyId || 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = nextMonthValue(month);
      const [cur, nxt] = await Promise.all([
        listPriceAnnouncements(`${month}-01`),
        listPriceAnnouncements(`${next}-01`),
      ]);
      setAnnouncements(Array.isArray(cur) ? cur : []);
      setNextAnnouncements(Array.isArray(nxt) ? nxt : []);
    } catch (e) {
      console.error('Failed to load price announcements', e);
      setAnnouncements([]);
      setNextAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('ต้องการลบประกาศนี้หรือไม่?')) return;
    try {
      await deletePriceAnnouncement(id);
      load();
    } catch (e: any) {
      alert(e?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const openCopy = (a: PriceAnnouncement) => {
    setCopyFrom(a);
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (a: PriceAnnouncement) => {
    setEditing(a);
    setCopyFrom(null);
    setModalOpen(true);
  };

  return (
    <div className="px-2 md:px-4 py-4 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">ประกาศราคา / โปรโมชั่นรายเดือน</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          {canEdit && (
            <button
              onClick={() => {
                setEditing(null);
                setCopyFrom(null);
                setModalOpen(true);
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
            >
              <Plus size={16} /> สร้างประกาศใหม่
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">กำลังโหลด...</div>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="inline-block bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-md mb-3 shadow-sm">
              โปรโมชั่นเดือน {thaiMonthLabel(month)}
            </div>
            {announcements.length === 0 ? (
              <div className="text-center text-gray-500 py-10 bg-white border border-gray-200 rounded-md text-sm">
                ยังไม่มีประกาศราคาสำหรับเดือนนี้
              </div>
            ) : (
              <SheetSection
                list={announcements}
                allCompanies={allCompanies}
                canEdit={canEdit}
                onCopy={openCopy}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            )}
          </div>

          {nextAnnouncements.length > 0 && (
            <div>
              <div className="inline-block bg-purple-600 text-white text-sm font-bold px-4 py-2 rounded-md mb-3 shadow-sm">
                โปรโมชั่นเดือน {thaiMonthLabel(nextMonthValue(month))}{' '}
                <span className="font-normal text-purple-100">(ดูล่วงหน้า)</span>
              </div>
              <SheetSection
                list={nextAnnouncements}
                allCompanies={allCompanies}
                canEdit={canEdit}
                onCopy={openCopy}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>
      )}

      <PriceAnnouncementModal
        announcement={editing}
        copyFrom={copyFrom}
        products={products}
        companies={allCompanies}
        defaultCompanyId={defaultCompanyId}
        isOpen={modalOpen}
        onClose={closeModal}
        onSaved={load}
      />
    </div>
  );
};

export default PriceAnnouncementPage;
