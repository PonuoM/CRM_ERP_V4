import React, { useRef, useState } from 'react';
import { FileUp, Loader2, X, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { uploadProductionDoc, productionDocUrl } from '@/services/api';
import type { ParsedDoc } from './pdfImport';
import { fmtQty, fmtDate } from './types';

/** ไฟล์ที่เก็บไว้บนเซิร์ฟเวอร์แล้ว */
export interface StoredDoc { path: string; size: number; }

interface Props {
  /** ใบไหน — ใช้แค่เปลี่ยนถ้อยคำบนปุ่ม */
  kind: 'so' | 'dn';
  /** ผลที่อ่านได้ (null = ยังไม่ได้นำเข้า) */
  parsed: ParsedDoc | null;
  fileName: string;
  /** SKU ในเอกสารที่หาไม่เจอในแคตตาล็อก */
  unmatchedSkus: string[];
  onParsed: (doc: ParsedDoc, fileName: string, stored: StoredDoc | null) => void;
  onClear: () => void;
  /** ใช้ตรวจสิทธิ์ตอนอัปโหลดไฟล์เก็บไว้ */
  userId?: number;
  /** ไฟล์ที่เก็บไว้แล้วของเอกสารนี้ (ตอนแก้ไขของเดิม) */
  storedPath?: string | null;
}

/**
 * แถบนำเข้าเอกสาร "ใบจองสินค้า/ใบสั่งขาย" (PDF จาก e-acc)
 * อ่านค่าจากไฟล์แล้วเติมฟอร์มให้ ผู้ใช้ยังแก้ได้ทุกช่องก่อนบันทึก
 */
const PdfImportPanel: React.FC<Props> = ({
  kind, parsed, fileName, unmatchedSkus, onParsed, onClear, userId, storedPath,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stored, setStored] = useState<StoredDoc | null>(null);
  const [storeWarning, setStoreWarning] = useState<string | null>(null);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setError('รองรับเฉพาะไฟล์ PDF');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // โหลด pdf.js ตอนใช้จริงเท่านั้น (ไฟล์ใหญ่ ไม่ควรติดไปกับหน้าแรก)
      const [{ extractTextItems }, { parseProductionDoc }] = await Promise.all([
        import('./pdfExtract'),
        import('./pdfImport'),
      ]);
      const items = await extractTextItems(file);
      const doc = parseProductionDoc(items);
      if (!doc.docNumber && doc.items.length === 0) {
        setError('อ่านไฟล์นี้ไม่ออก — อาจเป็นไฟล์สแกน หรือเป็นเอกสารคนละแบบ');
        return;
      }

      /* เก็บไฟล์ไว้เป็นหลักฐานด้วย -- ถ้าเก็บไม่สำเร็จก็ยังนำเข้าข้อมูลต่อได้ ไม่บล็อก */
      let saved: StoredDoc | null = null;
      try {
        const res: any = await uploadProductionDoc(file, userId);
        if (res?.success && res.data?.path) {
          saved = { path: res.data.path, size: res.data.size ?? file.size };
          setStoreWarning(null);
        } else {
          setStoreWarning(res?.error || 'เก็บไฟล์ไว้ในระบบไม่สำเร็จ (ข้อมูลที่อ่านได้ยังใช้ได้ปกติ)');
        }
      } catch {
        setStoreWarning('เก็บไฟล์ไว้ในระบบไม่สำเร็จ (ข้อมูลที่อ่านได้ยังใช้ได้ปกติ)');
      }
      setStored(saved);
      onParsed(doc, file.name, saved);
    } catch (err: any) {
      setError(err?.message || 'อ่านไฟล์ไม่สำเร็จ');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (parsed) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 rounded p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-emerald-900">
                อ่านจากไฟล์แล้ว · {parsed.docNumber || 'ไม่พบเลขเอกสาร'}
              </div>
              <div className="text-xs text-emerald-800 mt-0.5 break-words">
                {fileName} · {parsed.items.length} รายการ · รวม {fmtQty(parsed.totalQty ?? 0)}
                {parsed.docDate && <> · วันที่ {fmtDate(parsed.docDate)}</>}
                {parsed.receiveDate && <> · รับของ {fmtDate(parsed.receiveDate)}</>}
              </div>
              {(parsed.customerName || parsed.warehouseName) && (
                <div className="text-xs text-emerald-800 mt-0.5 break-words">
                  {parsed.customerName && <>ลูกค้า {parsed.customerCode} {parsed.customerName}</>}
                  {parsed.warehouseName && <> · {parsed.warehouseName}</>}
                </div>
              )}
            </div>
          </div>
          <button type="button"
                  onClick={() => { setStored(null); setStoreWarning(null); onClear(); }}
                  className="text-emerald-700 hover:text-emerald-900 shrink-0" title="ล้างข้อมูลที่นำเข้า">
            <X size={16} />
          </button>
        </div>

        {(stored || storedPath) && (
          <div className="mt-2 pt-2 border-t border-emerald-200">
            <a href={productionDocUrl(stored?.path ?? storedPath)} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-900 underline">
              <FileText size={13} /> เก็บไฟล์ไว้ในระบบแล้ว — เปิดดูเอกสารต้นฉบับ
            </a>
          </div>
        )}

        {(unmatchedSkus.length > 0 || parsed.warnings.length > 0 || storeWarning) && (
          <div className="mt-2 pt-2 border-t border-emerald-200 space-y-1">
            {storeWarning && (
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span className="text-xs">{storeWarning}</span>
              </div>
            )}
            {unmatchedSkus.length > 0 && (
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span className="text-xs">
                  ไม่มีรหัสนี้ในแคตตาล็อก ต้องเลือกสินค้าเอง: <b>{unmatchedSkus.join(', ')}</b>
                </span>
              </div>
            )}
            {parsed.warnings.map(w => (
              <div key={w} className="flex items-start gap-2 text-amber-800">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span className="text-xs">{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`border-2 border-dashed rounded p-3 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
      >
        <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
          <span>
            {busy ? 'กำลังอ่านไฟล์…' : (
              <>ลากไฟล์ PDF มาวาง หรือ <b className="text-blue-600">เลือกไฟล์</b></>
            )}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          ใบจองสินค้า/ใบสั่งขายจาก e-acc — ระบบจะอ่าน
          {kind === 'so' ? 'เลข SO วันที่ และรายการสินค้า' : 'เลขเอกสาร วันที่ และรายการสินค้า'}
          มาเติมให้อัตโนมัติ
        </p>
      </div>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden"
             onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  );
};

export default PdfImportPanel;
