import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

import { OrderData } from '../../pages/ReturnedOrdersReportPage';

export interface AudioLink {
  id: number;
  url: string;
  date: string;
  notes: string;
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  orderData: OrderData | null;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, onSubmit, orderData }) => {
  const [summary, setSummary] = useState('');
  const [links, setLinks] = useState<AudioLink[]>([]);
  const [newLinks, setNewLinks] = useState<{ id: string; url: string; date: string; notes: string }[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    if (isOpen && orderData) {
      setSummary(orderData.admin_resolution_notes || '');
      setLinks((orderData.audio_links as any) || []);
      setNewLinks([]);
      setDeletedIds([]);
      setIsDirty(false);
      setShowConfirmClose(false);
    }
  }, [isOpen, orderData]);

  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  const handleClose = () => {
    if (isDirty) {
      setShowConfirmClose(true);
      return;
    }
    onClose();
  };

  const confirmForceClose = () => {
    setShowConfirmClose(false);
    setIsDirty(false);
    onClose();
  };

  const cancelClose = () => {
    setShowConfirmClose(false);
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

  const generateMarkdown = () => {
    if (!orderData) return '';
    const md = `# รายงานวิเคราะห์ไฟล์เสียง: ออเดอร์ ${orderData.customer_name || '-'}

> [!WARNING]
> **ประเด็นข้อผิดพลาดที่พบในการทำงาน / สรุปจากแอดมิน:**
> ${summary.replace(/\n/g, '\n> ')}

## ข้อมูลลูกค้าและออเดอร์
- **ชื่อลูกค้า:** ${orderData.customer_name || '-'}
- **เบอร์โทรศัพท์:** ${orderData.customer_phone || '-'}
- **รหัสออเดอร์:** ${orderData.order_id}
- **สถานะการตีกลับ/ยกเลิก:** ${orderData.cancel_type || '-'}
- **สินค้า:** ${orderData.items && orderData.items.length > 0 ? orderData.items.map(i => `${i.product_name} x${i.quantity}${i.is_freebie ? ' (แถม)' : ''}`).join(', ') : '-'}

---

## ⏱️ หลักฐานจากไฟล์เสียง (Timeline)

${[...links, ...newLinks].map((l, i) => `### ลิงก์ที่ ${i + 1}
📞 วันที่บันทึก: ${l.date || '-'}
🎧 ${l.url}
* **รายละเอียด:** ${l.notes || '-'}`).join('\n\n')}
`;
    return md;
  };

  const exportToMD = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `case_summary_${orderData?.order_id}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!orderData) return;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    let itemsStr = '-';
    if (orderData.items && orderData.items.length > 0) {
      itemsStr = '<ul>' + orderData.items.map(i => `<li>${i.product_name} x${i.quantity}${i.is_freebie ? ' (แถม)' : ''}</li>`).join('') + '</ul>';
    }

    let audioStr = '';
    const allLinks = [...links, ...newLinks];
    if (allLinks.length > 0) {
      audioStr = allLinks.map((l, i) => `
        <div class="audio-link">
          <h4>ลิงก์ที่ ${i + 1}</h4>
          <ul>
            <li><strong>วันที่บันทึก:</strong> ${l.date || '-'}</li>
            <li><strong>ลิงก์:</strong> <a href="${l.url}">${l.url}</a></li>
            <li><strong>รายละเอียด:</strong> ${l.notes || '-'}</li>
          </ul>
        </div>
      `).join('');
    } else {
      audioStr = '<p>-</p>';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>รายงานออเดอร์ - ${orderData.customer_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 20px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 18px; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            h4 { margin: 0 0 10px 0; font-size: 16px; }
            .warning { background: #fff3cd; color: #856404; padding: 15px; border-left: 4px solid #ffeeba; margin-bottom: 30px; border-radius: 4px; }
            .warning strong { display: block; margin-bottom: 5px; }
            .section { margin-bottom: 20px; }
            ul { margin: 0; padding-left: 20px; }
            li { margin-bottom: 5px; }
            .audio-link { margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px; border: 1px solid #eee; }
            .audio-link ul { list-style: none; padding: 0; }
            a { color: #0056b3; text-decoration: none; word-break: break-all; }
            
            @media print {
              body { padding: 0; }
              .warning { border: 1px solid #ffeeba; }
              .audio-link { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>รายงานวิเคราะห์ไฟล์เสียง: ออเดอร์ ${orderData.customer_name || '-'}</h1>
          <div class="warning">
             <strong>ประเด็นข้อผิดพลาดที่พบในการทำงาน / สรุปจากแอดมิน:</strong>
             ${summary.replace(/\n/g, '<br/>') || '-'}
          </div>
          <div class="section">
             <h2>ข้อมูลลูกค้าและออเดอร์</h2>
             <ul>
               <li><strong>ชื่อลูกค้า:</strong> ${orderData.customer_name || '-'}</li>
               <li><strong>เบอร์โทรศัพท์:</strong> ${orderData.customer_phone || '-'}</li>
               <li><strong>รหัสออเดอร์:</strong> ${orderData.order_id}</li>
               <li><strong>สถานะการตีกลับ/ยกเลิก:</strong> ${orderData.cancel_type || '-'}</li>
             </ul>
             <h3>สินค้า</h3>
             ${itemsStr}
          </div>
          
          <div class="section">
             <h2>หลักฐานจากไฟล์เสียง (Timeline)</h2>
             ${audioStr}
          </div>
        </body>
      </html>
    `;
    
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(htmlContent);
    iframe.contentDocument?.close();
    
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
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
      <div className="p-4 border-t bg-gray-50 flex justify-between items-center rounded-b-lg">
        <div className="flex gap-2">
          <button
            onClick={exportToMD}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            MD
          </button>
          <button
            onClick={exportToPDF}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            PDF
          </button>
        </div>
        
        <div className="flex gap-2">
          {showConfirmClose ? (
            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-md border border-yellow-200">
              <span className="text-sm text-yellow-700 font-medium">ยังไม่ได้บันทึก ยืนยันปิด?</span>
              <button onClick={cancelClose} className="px-2 py-1 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={confirmForceClose} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">ปิด</button>
            </div>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                ปิด
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
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
