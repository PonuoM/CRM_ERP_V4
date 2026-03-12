import React, { useState, useMemo } from 'react';
import { apiFetch } from '@/services/api';

interface BlockedCustomer {
  id: number;
  customer_ref_id: string | null;
  fname: string | null;
  lname: string | null;
  phone: string | null;
  reason: string | null;
  blocked_at: string | null;
  block_id: number;
  blocker_name: string | null;
}

interface BasketOption {
  id: number;
  basket_key: string;
  basket_name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  blockedCustomers: BlockedCustomer[];
  loading: boolean;
  baskets: BasketOption[];
  currentUserId: number;
  companyId: number;
  onUnblockSuccess: () => void;
}

const BlockedCustomersModal: React.FC<Props> = ({
  isOpen,
  onClose,
  blockedCustomers,
  loading,
  baskets,
  currentUserId,
  companyId,
  onUnblockSuccess,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [targetBasket, setTargetBasket] = useState<number>(0);
  const [searchText, setSearchText] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync check state
  const [syncChecking, setSyncChecking] = useState(false);
  const [syncMismatched, setSyncMismatched] = useState<any[] | null>(null);
  const [syncFixing, setSyncFixing] = useState(false);

  // Unique reasons for filter dropdown
  const uniqueReasons = useMemo(() => {
    const reasons = new Set<string>();
    blockedCustomers.forEach(c => {
      if (c.reason) reasons.add(c.reason);
    });
    return Array.from(reasons).sort();
  }, [blockedCustomers]);

  // Filtered list
  const filtered = useMemo(() => {
    return blockedCustomers.filter(c => {
      const name = `${c.fname || ''} ${c.lname || ''}`.toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const refId = (c.customer_ref_id || '').toLowerCase();
      const q = searchText.toLowerCase();
      const matchSearch = !q || name.includes(q) || phone.includes(q) || refId.includes(q);
      const matchReason = !reasonFilter || c.reason === reasonFilter;
      return matchSearch && matchReason;
    });
  }, [blockedCustomers, searchText, reasonFilter]);

  const toggleSelect = (blockId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.block_id)));
    }
  };

  const handleUnblock = async () => {
    if (selectedIds.size === 0 || !targetBasket) return;
    setSubmitting(true);
    setResultMessage(null);
    try {
      const res = await apiFetch('customer_blocks', {
        method: 'POST',
        body: JSON.stringify({
          action: 'batch_unblock',
          block_ids: Array.from(selectedIds),
          target_basket_key: targetBasket,
          unblockedBy: currentUserId,
        }),
      });
      if (res?.ok) {
        const r = res.results;
        setResultMessage({
          type: 'success',
          text: `✅ ปลดบล็อคสำเร็จ ${r.success} คน${r.failed > 0 ? ` (ล้มเหลว ${r.failed})` : ''}`,
        });
        setSelectedIds(new Set());
        onUnblockSuccess();
      } else {
        setResultMessage({ type: 'error', text: `❌ เกิดข้อผิดพลาด: ${res?.error || 'Unknown'}` });
      }
    } catch (e: any) {
      setResultMessage({ type: 'error', text: `❌ ${e.message || 'Network error'}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncCheck = async () => {
    setSyncChecking(true);
    setSyncMismatched(null);
    try {
      const res = await apiFetch(`get_blocked_customers.php?action=check_mismatched&company_id=${companyId}`);
      if (res?.success) {
        setSyncMismatched(res.data || []);
      }
    } catch (e: any) {
      setResultMessage({ type: 'error', text: `❌ ตรวจสอบล้มเหลว: ${e.message}` });
    } finally {
      setSyncChecking(false);
    }
  };

  const handleSyncFix = async () => {
    if (!syncMismatched || syncMismatched.length === 0) return;
    setSyncFixing(true);
    try {
      const ids = syncMismatched.map((c: any) => c.customer_id);
      const res = await apiFetch('get_blocked_customers.php?action=fix_mismatched', {
        method: 'POST',
        body: JSON.stringify({ customer_ids: ids }),
      });
      if (res?.success) {
        setResultMessage({ type: 'success', text: `✅ ย้ายสำเร็จ ${res.affected} คนเข้าตะกร้าบล็อค` });
        setSyncMismatched(null);
        onUnblockSuccess();
      } else {
        setResultMessage({ type: 'error', text: `❌ ${res?.error || 'Unknown error'}` });
      }
    } catch (e: any) {
      setResultMessage({ type: 'error', text: `❌ ${e.message}` });
    } finally {
      setSyncFixing(false);
    }
  };

  if (!isOpen) return null;

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '90%', maxWidth: 960,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fef2f2', borderRadius: '16px 16px 0 0',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#991b1b' }}>
              🚫 ลูกค้าบล็อค ({blockedCustomers.length} คน)
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b91c1c' }}>
              เลือกรายชื่อเพื่อปลดบล็อคและย้ายไปตะกร้าที่ต้องการ
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleSyncCheck}
              disabled={syncChecking}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid #f59e0b',
                background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', opacity: syncChecking ? 0.6 : 1,
              }}
            >
              {syncChecking ? '⏳ กำลังตรวจ...' : '🔍 ตรวจสอบ Sync'}
            </button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
              color: '#6b7280', padding: '4px 8px', borderRadius: 8,
            }}>✕</button>
          </div>
        </div>

        {/* Sync Check Result Panel */}
        {syncMismatched !== null && (
          <div style={{
            padding: '12px 24px', borderBottom: '1px solid #e5e7eb',
            background: syncMismatched.length > 0 ? '#fffbeb' : '#ecfdf5',
          }}>
            {syncMismatched.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: '#065f46', fontWeight: 500 }}>✅ ไม่พบข้อมูลไม่ตรงกัน — ลูกค้าบล็อคทั้งหมดอยู่ในตะกร้าที่ถูกต้อง</span>
                <button onClick={() => setSyncMismatched(null)} style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16,
                }}>✕</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                    ⚠️ พบ {syncMismatched.length} รายชื่อที่ is_blocked = 1 แต่ยังไม่ได้อยู่ตะกร้าบล็อค (basket 55)
                  </span>
                  <button onClick={() => setSyncMismatched(null)} style={{
                    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16,
                  }}>✕</button>
                </div>
                <div style={{ maxHeight: 150, overflow: 'auto', border: '1px solid #fcd34d', borderRadius: 8, background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #fcd34d', background: '#fef3c7' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>ชื่อ</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>เบอร์โทร</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>ตะกร้าปัจจุบัน</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>ประเภท</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncMismatched.map((c: any) => (
                        <tr key={c.customer_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 10px' }}>{c.first_name} {c.last_name}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280' }}>{c.phone || '-'}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                              {c.current_basket_name || `Basket #${c.current_basket_key || 'ไม่มี'}`}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{
                              background: c.target_page === 'distribution' ? '#dbeafe' : c.target_page === 'dashboard' ? '#e0e7ff' : '#f3f4f6',
                              color: c.target_page === 'distribution' ? '#1e40af' : c.target_page === 'dashboard' ? '#3730a3' : '#6b7280',
                              padding: '1px 6px', borderRadius: 4, fontSize: 11,
                            }}>
                              {c.target_page || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSyncFix}
                    disabled={syncFixing}
                    style={{
                      padding: '8px 20px', borderRadius: 8, border: 'none',
                      background: syncFixing ? '#d1d5db' : '#f59e0b', color: '#fff',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {syncFixing ? '⏳ กำลังย้าย...' : `📦 ย้ายทั้งหมด ${syncMismatched.length} คนเข้าตะกร้าบล็อค`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div style={{
          padding: '12px 24px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อ, เบอร์, รหัส..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{
              flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
              border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
            }}
          />
          <select
            value={reasonFilter}
            onChange={e => setReasonFilter(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
              fontSize: 14, minWidth: 180, outline: 'none', background: '#fff',
            }}
          >
            <option value="">ทุกสาเหตุ</option>
            {uniqueReasons.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            แสดง {filtered.length} รายการ
          </span>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
              กำลังโหลด...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              ไม่พบข้อมูล
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff' }}>
                  <th style={{ padding: '10px 8px', width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>ชื่อลูกค้า</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>เบอร์โทร</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>สาเหตุบล็อค</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>บล็อคโดย</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>วันที่บล็อค</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.block_id}
                    onClick={() => toggleSelect(c.block_id)}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer',
                      background: selectedIds.has(c.block_id) ? '#eff6ff' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => {
                      if (!selectedIds.has(c.block_id))
                        (e.currentTarget as HTMLElement).style.background = '#f9fafb';
                    }}
                    onMouseOut={e => {
                      if (!selectedIds.has(c.block_id))
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.block_id)}
                        onChange={() => toggleSelect(c.block_id)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                      {c.fname} {c.lname}
                      {c.customer_ref_id && (
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                          #{c.customer_ref_id}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#6b7280' }}>{c.phone || '-'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{
                        background: '#fef3c7', color: '#92400e', padding: '2px 8px',
                        borderRadius: 6, fontSize: 12, fontWeight: 500,
                      }}>
                        {c.reason || 'ไม่ระบุ'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: 13 }}>
                      {c.blocker_name || '-'}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: 13 }}>
                      {c.blocked_at ? new Date(c.blocked_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Action Bar */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: '#f9fafb', borderRadius: '0 0 16px 16px',
        }}>
          {selectedIds.size > 0 && (
            <span style={{
              background: '#3b82f6', color: '#fff', padding: '4px 12px',
              borderRadius: 20, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              เลือก {selectedIds.size} คน
            </span>
          )}
          <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
            ย้ายไปตะกร้า:
          </span>
          <select
            value={targetBasket}
            onChange={e => setTargetBasket(Number(e.target.value))}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db',
              fontSize: 14, minWidth: 200, outline: 'none', background: '#fff',
            }}
          >
            <option value={0}>-- เลือกตะกร้าปลายทาง --</option>
            {baskets.filter(b => b.basket_key !== 'block_customer').map(b => (
              <option key={b.id} value={b.id}>{b.basket_name}</option>
            ))}
          </select>
          <button
            onClick={handleUnblock}
            disabled={selectedIds.size === 0 || !targetBasket || submitting}
            style={{
              marginLeft: 'auto',
              padding: '10px 24px', borderRadius: 10, border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: (selectedIds.size === 0 || !targetBasket || submitting)
                ? '#d1d5db' : '#10b981',
              color: '#fff',
              transition: 'all 0.2s',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? '⏳ กำลังปลดบล็อค...' : '✅ ปลดบล็อค'}
          </button>
        </div>

        {/* Result message */}
        {resultMessage && (
          <div style={{
            padding: '12px 24px',
            background: resultMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: resultMessage.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: 14, fontWeight: 500,
            borderRadius: '0 0 16px 16px',
          }}>
            {resultMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockedCustomersModal;
