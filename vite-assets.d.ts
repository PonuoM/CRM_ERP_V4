/**
 * ให้ TypeScript รู้จัก asset import พิเศษของ Vite
 * ใช้กับ worker ของ pdf.js (components/FactoryProduction/pdfExtract.ts)
 */
declare module '*?url' {
  const src: string;
  export default src;
}

declare module '*?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
