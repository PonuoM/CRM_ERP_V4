/**
 * ดึง text item ออกจากไฟล์ PDF ด้วย pdf.js (ทำงานบนเบราว์เซอร์เท่านั้น)
 * แยกไฟล์จาก pdfImport.ts เพื่อให้ตัว parser เทสต์ได้โดยไม่ต้องมี worker/DOM
 *
 * โหลดแบบ dynamic import — pdf.js หนักราว 365KB จึงไม่ควรติดไปกับ bundle หลัก
 * ผู้ใช้จะโหลดตอนกดปุ่ม "นำเข้าจาก PDF" เท่านั้น
 *
 * ทำไมต้องใช้ `?worker` แทนการชี้ workerSrc ไปที่ไฟล์:
 *   pdfjs-dist แจก worker เป็นไฟล์ .mjs ซึ่ง Apache บน host ไม่รู้จักนามสกุลนี้
 *   จึงส่ง Content-Type ว่างมา แล้วเบราว์เซอร์บล็อกทิ้งตามกฎ strict MIME ของ module script
 *   ("Failed to load module script ... MIME type of \"\"") พอโหลด worker ไม่ได้ pdf.js
 *   จะถอยไปใช้ fake worker ซึ่งก็ fetch ไฟล์เดิมไม่ได้อีก สุดท้ายอ่านไฟล์ไม่ออกเลย
 *   ให้ Vite bundle worker เองด้วย `?worker` จะได้ไฟล์ .js ที่ Apache เสิร์ฟถูก MIME อยู่แล้ว
 */
import type { RawTextItem } from './pdfImport';

/** อ่านทุกหน้าของ PDF แล้วคืน text item พร้อมพิกัด */
export const extractTextItems = async (file: File | ArrayBuffer): Promise<RawTextItem[]> => {
  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
  ]);

  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();

  // สร้าง worker ใหม่ต่อการอ่าน 1 ครั้ง แล้วปิดทิ้ง — ผู้ใช้กดนำเข้าไม่บ่อย
  // และไม่ต้องกังวลว่า port จะค้างจากไฟล์ก่อนหน้า
  const workerInstance = new workerModule.default();
  // ใช้ fromPort ตามที่ pdf.js แนะนำสำหรับ worker ที่เราสร้างเอง
  // (constructor ของ PDFWorker มี type ที่ generate มาผิด port เป็น null อย่างเดียว)
  const worker = pdfjs.PDFWorker.fromPort({ port: workerInstance, name: 'fp-pdf-import' });

  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(data), worker }).promise;
    const out: RawTextItem[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      content.items.forEach((raw: any) => {
        if (typeof raw?.str !== 'string') return;
        out.push({
          str: raw.str,
          x: raw.transform[4],
          y: raw.transform[5],
          width: raw.width ?? 0,
          page: p,
        });
      });
    }
    await doc.destroy();
    return out;
  } finally {
    worker.destroy();
    workerInstance.terminate();
  }
};
