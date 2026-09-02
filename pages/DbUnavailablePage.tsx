import React from "react";

const DbUnavailablePage: React.FC = () => (
  <div className="flex h-screen items-center justify-center bg-slate-50 px-6">
    <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-lg font-semibold text-slate-900">ระบบฐานข้อมูลใช้ไม่ได้</p>
      <p className="mt-2 text-sm text-slate-600">
        กำลังกู้ข้อมูลจากสำเนาบน Google Drive / HDD ตามขั้นตอนสำรอง
        ไม่สามารถรับออเดอร์หรือแก้ข้อมูลลูกค้าได้ในขณะนี้
      </p>
      <button
        type="button"
        className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
        onClick={() => window.location.reload()}
      >
        ลองอีกครั้ง
      </button>
    </div>
  </div>
);

export default DbUnavailablePage;
