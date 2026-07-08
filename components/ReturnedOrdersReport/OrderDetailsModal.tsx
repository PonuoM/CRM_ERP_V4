import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

export interface AudioLink {
  id: number;
  url: string;
  date: string;
  notes: string;
}

interface OrderDataProps {
  order_id: string;
  admin_resolution_notes?: string;
  audio_links: AudioLink[];
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  orderData: OrderDataProps | null;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, onSubmit, orderData }) => {
  const [summary, setSummary] = useState('');
  const [links, setLinks] = useState<AudioLink[]>([]);
  const [newLinks, setNewLinks] = useState<{ id: string; url: string; date: string; notes: string }[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isOpen && orderData) {
      setSummary(orderData.admin_resolution_notes || '');
      setLinks(orderData.audio_links || []);
      setNewLinks([]);
      setDeletedIds([]);
      setIsDirty(false);
    }
  }, [isOpen, orderData]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const handleClose = () => {
    if (isDirty) {
      if (!window.confirm('คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดหน้าต่างนี้ใช่หรือไม่?')) {
        return;
      }
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (!orderData) return;
    
    try {
      setIsSubmitting(true);
      
      const payload = {
        order_id: orderData.order_id,
        admin_resolution_notes: summary,
        new_audio_links: newLinks,
        updated_audio_links: links, // Existing links with possible edits
        deleted_audio_ids: deletedIds
      };

      await onSubmit(payload);
      
      setIsDirty(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers for Links ---
  const updateExistingLink = (id: number, field: keyof AudioLink, value: string) => {
    markDirty();
    setLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const deleteExistingLink = (id: number) => {
    markDirty();
    setDeletedIds(prev => [...prev, id]);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const addNewLink = () => {
    markDirty();
    setNewLinks(prev => [
      ...prev,
      { id: `new_${Date.now()}`, url: '', date: '', notes: '' }
    ]);
  };

  const updateNewLink = (uid: string, field: string, value: string) => {
    markDirty();
    setNewLinks(prev => prev.map(l => l.id === uid ? { ...l, [field]: value } : l));
  };

  const removeNewLink = (uid: string) => {
    setNewLinks(prev => prev.filter(l => l.id !== uid));
  };

  if (!isOpen || !orderData) return null;

  return (
    <Modal title={`จัดการรายละเอียดออเดอร์: ${orderData.order_id}`} onClose={handleClose} size="lg">
      <div className="p-5 max-h-[80vh] overflow-y-auto">
        
        {/* 1. สรุปออเดอร์ */}
        <section className="mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-2 border-b pb-1">1. สรุปเคสคำสั่งซื้อ</h3>
          <textarea
            value={summary}
            onChange={e => { setSummary(e.target.value); markDirty(); }}
            placeholder="สรุปผลการดำเนินการ เช่น ติดต่อไม่ได้, ขอเปลี่ยนไซส์, ฯลฯ"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
        </section>

        {/* 2. ไฟล์เสียง */}
        <section className="mb-2">
          <div className="flex justify-between items-center border-b pb-1 mb-3">
            <h3 className="text-sm font-bold text-gray-800">2. ไฟล์เสียงและการสนทนา</h3>
            <button 
              onClick={addNewLink}
              className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              เพิ่มไฟล์เสียงใหม่
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Existing Links */}
            {links.map((link, idx) => (
              <div key={link.id} className="bg-gray-50 p-3 rounded border border-gray-200 relative">
                <button 
                  onClick={() => deleteExistingLink(link.id)}
                  className="absolute top-3 right-3 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1 rounded"
                  title="ลบไฟล์เสียงนี้"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
                <div className="mb-2 font-medium text-xs text-gray-500">ไฟล์เสียงเดิมที่ #{idx + 1}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ลิงก์ไฟล์เสียง</label>
                    <input 
                      type="url"
                      value={link.url}
                      onChange={e => updateExistingLink(link.id, 'url', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">วัน/เวลาของการโทร</label>
                    <input 
                      type="datetime-local"
                      value={link.date ? link.date.replace(' ', 'T').slice(0, 16) : ''}
                      onChange={e => updateExistingLink(link.id, 'date', e.target.value.replace('T', ' '))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">หมายเหตุของไฟล์เสียงนี้</label>
                  <input 
                    type="text"
                    value={link.notes || ''}
                    onChange={e => updateExistingLink(link.id, 'notes', e.target.value)}
                    placeholder="เช่น โทรไม่ติด, ลูกค้าตกลง..."
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            ))}

            {/* New Links */}
            {newLinks.map((link, idx) => (
              <div key={link.id} className="bg-blue-50/50 p-3 rounded border border-blue-200 relative">
                <button 
                  onClick={() => removeNewLink(link.id)}
                  className="absolute top-3 right-3 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1 rounded"
                  title="ยกเลิกการเพิ่ม"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <div className="mb-2 font-medium text-xs text-blue-600">ไฟล์เสียงใหม่ #{idx + 1}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">ลิงก์ไฟล์เสียง *</label>
                    <input 
                      type="url"
                      value={link.url}
                      onChange={e => updateNewLink(link.id, 'url', e.target.value)}
                      placeholder="https://..."
                      className="w-full border border-blue-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">วัน/เวลาของการโทร</label>
                    <input 
                      type="datetime-local"
                      value={link.date}
                      onChange={e => updateNewLink(link.id, 'date', e.target.value)}
                      className="w-full border border-blue-300 rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">หมายเหตุของไฟล์เสียงนี้</label>
                  <input 
                    type="text"
                    value={link.notes}
                    onChange={e => updateNewLink(link.id, 'notes', e.target.value)}
                    className="w-full border border-blue-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            ))}

            {links.length === 0 && newLinks.length === 0 && (
              <div className="text-center py-6 bg-gray-50 border border-dashed rounded text-gray-500 text-sm">
                ยังไม่มีไฟล์เสียงแนบ กรุณากด "เพิ่มไฟล์เสียงใหม่"
              </div>
            )}
          </div>
        </section>

      </div>
      
      {/* Footer */}
      <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-lg">
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังบันทึก...
            </>
          ) : (
            'บันทึกข้อมูล'
          )}
        </button>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
