import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Package, Users, Building2, Percent, StickyNote, Info, Calendar } from 'lucide-react';
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

interface AnnouncementCardProps {
  a: PriceAnnouncement;
  allCompanies: Company[];
  canEdit: boolean;
  onCopy: (a: PriceAnnouncement) => void;
  onEdit: (a: PriceAnnouncement) => void;
  onDelete: (id: number) => void;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({ a, allCompanies, canEdit, onCopy, onEdit, onDelete }) => {
  const scopeLabel = (kind: 'role' | 'company') => {
    const ids = kind === 'role' ? a.visibility_role_ids : a.visibility_company_ids;
    if (!ids || ids.length === 0) {
      return kind === 'role' ? 'ทุกแผนก' : 'ทุกบริษัท';
    }
    if (kind === 'company') {
      const names = ids.map((id) => allCompanies.find((c) => c.id === id)?.name || `#${id}`);
      return names.join(', ');
    }
    return `${ids.length} แผนก`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Package size={13} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm leading-snug truncate" title={a.title || a.product_name}>
              {a.title || a.product_name}
            </div>
            {a.title && (
              <div className="text-[11px] text-gray-500 truncate" title={a.product_name}>
                {a.product_name}
              </div>
            )}
            <div className="text-[10px] text-gray-400 uppercase tracking-wide truncate">
              {a.sku} · {a.company_name}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => onCopy(a)}
              title="คัดลอกเป็นประกาศใหม่ (เช่น เดือนถัดไป)"
              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => onEdit(a)}
              title="แก้ไขประกาศนี้"
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onDelete(a.id)}
              title="ลบประกาศนี้"
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Scope badges */}
      <div className="flex items-center gap-1 flex-wrap text-[9px] pt-1.5">
        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 flex items-center gap-1 font-medium">
          <Calendar size={9} /> {thaiMonthLabel(a.month)}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 flex items-center gap-1">
          <Users size={9} /> {scopeLabel('role')}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 flex items-center gap-1">
          <Building2 size={9} /> {scopeLabel('company')}
        </span>
      </div>

      {/* Price table: one line per quantity, with column headers */}
      <div className="pt-2">
        <div className="grid grid-cols-[0.7fr_0.75fr_0.8fr_0.75fr_1.3fr] gap-1 text-[9px] text-gray-400 font-medium pb-1 border-b border-gray-100">
          <div>จำนวน</div>
          <div className="text-right">ราคาเก่า</div>
          <div className="text-right">ราคาใหม่</div>
          <div className="text-right">ต่อหน่วย</div>
          <div>หมายเหตุ</div>
        </div>
        <div className="divide-y divide-gray-50">
          {a.tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-[0.7fr_0.75fr_0.8fr_0.75fr_1.3fr] gap-1 items-start text-[10px] py-1">
              <div className="text-gray-600 flex items-center gap-1 truncate">
                <Info size={9} className="text-gray-300 flex-shrink-0" /> {t.quantity}
              </div>
              <div className="text-right text-gray-400 line-through">
                {t.old_total_price != null ? formatMoney(t.old_total_price) : '-'}
              </div>
              <div className="text-right font-bold text-indigo-700">{formatMoney(t.new_total_price)}</div>
              <div className="text-right text-gray-400">
                {t.quantity ? formatMoney(t.new_total_price / t.quantity) : '-'}
              </div>
              <div className="text-[9px] text-gray-500 italic leading-tight">
                {t.notes.length > 0
                  ? t.notes.map((n, ni) => <div key={ni}>• {n}</div>)
                  : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* General notes */}
      {a.general_notes && (
        <div className="mt-1.5 px-2 py-1.5 bg-yellow-50 border border-yellow-200 rounded-md text-[10px] text-gray-700 whitespace-pre-line flex gap-1">
          <StickyNote size={11} className="flex-shrink-0 mt-0.5 text-yellow-600" />
          <div>{a.general_notes}</div>
        </div>
      )}

      {/* Discount section, stacked rows */}
      {a.discount_tiers.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-[10px] font-semibold text-teal-700 flex items-center gap-1 mb-1">
            <Percent size={11} /> ส่วนลดท้ายบิล
          </div>
          {a.discount_notes.length > 0 && (
            <div className="text-[9px] text-gray-500 mb-1 leading-tight">
              {a.discount_notes.map((n, ni) => (
                <div key={ni}>• {n}</div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            {a.discount_tiers.map((dt, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-500">ยอดขาย ฿{dt.min_amount.toLocaleString()}+</span>
                <span className="text-right">
                  {dt.cod_discount_pct != null && <span className="text-amber-700">COD {dt.cod_discount_pct}%</span>}
                  {dt.cod_discount_pct != null && dt.transfer_discount_pct != null && <span className="text-gray-300 mx-1">|</span>}
                  {dt.transfer_discount_pct != null && <span className="text-teal-700">โอน {dt.transfer_discount_pct}%</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
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

  const renderGrid = (list: PriceAnnouncement[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {list.map((a) => (
        <AnnouncementCard
          key={a.id}
          a={a}
          allCompanies={allCompanies}
          canEdit={canEdit}
          onCopy={openCopy}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-6">
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
        <div className="space-y-6">
          <div>
            <div className="inline-block bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-md mb-3 shadow-sm">
              โปรโมชั่นเดือน {thaiMonthLabel(month)}
            </div>
            {announcements.length === 0 ? (
              <div className="text-center text-gray-500 py-10 bg-white border border-gray-200 rounded-md text-sm">
                ยังไม่มีประกาศราคาสำหรับเดือนนี้
              </div>
            ) : (
              renderGrid(announcements)
            )}
          </div>

          {nextAnnouncements.length > 0 && (
            <div>
              <div className="inline-block bg-purple-600 text-white text-sm font-bold px-4 py-2 rounded-md mb-3 shadow-sm">
                โปรโมชั่นเดือน {thaiMonthLabel(nextMonthValue(month))}{' '}
                <span className="font-normal text-purple-100">(ดูล่วงหน้า)</span>
              </div>
              {renderGrid(nextAnnouncements)}
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
