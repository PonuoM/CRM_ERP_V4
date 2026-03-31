import React, { useState, useEffect, useRef } from "react";
import { Customer } from "@/types";
import { listCustomers, mergeCustomers } from "@/services/api";
import { mapCustomerFromApi } from "@/utils/customerMapper";
import Spinner from "@/components/Spinner";
import APP_BASE_PATH from "@/appBasePath";

interface MergeCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: number;
}

const MergeCustomersModal: React.FC<MergeCustomersModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [searchTerm1, setSearchTerm1] = useState("");
  const [searchTerm2, setSearchTerm2] = useState("");

  const [results1, setResults1] = useState<Customer[]>([]);
  const [results2, setResults2] = useState<Customer[]>([]);

  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  const [selected1, setSelected1] = useState<Customer | null>(null);
  const [selected2, setSelected2] = useState<Customer | null>(null);

  const [mainId, setMainId] = useState<string | number | null>(null);
  const [merging, setMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Debounce ref
  const timer1 = useRef<NodeJS.Timeout | null>(null);
  const timer2 = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm1("");
      setSearchTerm2("");
      setResults1([]);
      setResults2([]);
      setSelected1(null);
      setSelected2(null);
      setMainId(null);
      setErrorMsg("");
    }
  }, [isOpen]);

  const fetchCustomers = async (
    q: string,
    setResults: React.Dispatch<React.SetStateAction<Customer[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!q || q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listCustomers({ q, companyId, pageSize: 10 });
      // Depending on API response shape
      const rawData = Array.isArray(res) ? res : res.data || [];
      // Map raw snake_case API data to camelCase Customer objects
      const data = rawData.map((r: any) => mapCustomerFromApi(r));
      setResults(data);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const onSearch1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm1(val);
    setSelected1(null);
    if (timer1.current) clearTimeout(timer1.current);
    timer1.current = setTimeout(() => {
      fetchCustomers(val, setResults1, setLoading1);
    }, 500);
  };

  const onSearch2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm2(val);
    setSelected2(null);
    if (timer2.current) clearTimeout(timer2.current);
    timer2.current = setTimeout(() => {
      fetchCustomers(val, setResults2, setLoading2);
    }, 500);
  };

  const handleSelect1 = (customer: Customer) => {
    setSelected1(customer);
    setSearchTerm1("");
    setResults1([]);
    const cId = customer.customer_id ?? customer.id;
    if (!mainId) setMainId(cId);
  };

  const handleSelect2 = (customer: Customer) => {
    setSelected2(customer);
    setSearchTerm2("");
    setResults2([]);
    const cId = customer.customer_id ?? customer.id;
    if (!mainId && !selected1) setMainId(cId);
  };

  const handleMerge = async () => {
    if (!selected1 || !selected2) {
      setErrorMsg("กรุณาเลือกลูกค้าทั้ง 2 คนให้ครบถ้วน");
      return;
    }
    if (selected1.id === selected2.id) {
      setErrorMsg("ไม่สามารถรวมลูกค้ารายการเดียวกันได้");
      return;
    }
    if (!mainId) {
      setErrorMsg("กรุณาเลือกข้อมูลหลัก (Main Record)");
      return;
    }

    const c1Id = selected1.customer_id ?? selected1.id;
    const c2Id = selected2.customer_id ?? selected2.id;
    const secondaryId = c1Id === mainId ? c2Id : c1Id;

    if (!confirm("ยืนยันการรวมประวัติสั่งซื้อและการโทร? ข้อมูลที่ถูกรวมไปแล้วจะไม่สามารถแยกออกจากกันได้ง่ายๆ")) {
      return;
    }

    setMerging(true);
    setErrorMsg("");

    try {
      await mergeCustomers({
        mainCustomerId: mainId,
        secondaryCustomerId: secondaryId,
        companyId,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Merge error", err);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการรวมข้อมูล");
    } finally {
      setMerging(false);
    }
  };

  const handleOpenDetail = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    const cId = customer.customer_id ?? customer.id;
    const basePath = APP_BASE_PATH || '/';
    window.open(`${basePath}?page=Customers&customerId=${cId}`, '_blank');
  };

  if (!isOpen) return null;

  const renderCustomerCard = (customer: Customer | null, isMain: boolean, onSetMain: () => void) => {
    if (!customer) {
      return (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 h-full bg-gray-50/50">
          <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-sm">ยังไม่ได้เลือกลูกค้า</span>
        </div>
      );
    }

    return (
      <div
        className={`relative border-2 rounded-xl p-5 cursor-pointer transition-all ${
          isMain
            ? "border-blue-500 bg-blue-50 shadow-md transform scale-[1.02]"
            : "border-gray-200 bg-white hover:border-blue-300"
        }`}
        onClick={onSetMain}
      >
        {isMain && (
          <div className="absolute -top-3 -right-3 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            ข้อมูลหลัก (Main Record)
          </div>
        )}
        <div className="flex items-start justify-between mb-3">
          <div>
            <button
              type="button"
              onClick={(e) => handleOpenDetail(customer, e)}
              className="font-bold text-lg text-blue-700 hover:text-blue-900 border-b border-dashed border-blue-400 hover:border-blue-900 focus:outline-none text-left flex items-center gap-2"
              title="คลิกเพื่อดูรายละเอียดเชิงลึกและออเดอร์ทั้งหมด"
            >
              {customer.firstName} {customer.lastName}
            </button>
            <p className="text-sm text-gray-500 font-mono mt-0.5">{customer.phone}</p>
          </div>
          <div className="text-right">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${isMain ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
              ID: {customer.id}
            </span>
          </div>
        </div>

        <div className="space-y-2 mt-4 text-sm bg-white/60 p-3 rounded-lg border border-gray-100">
          <div className="flex justify-between">
            <span className="text-gray-500">จังหวัด:</span>
            <span className="text-gray-900 font-medium">{customer.province || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">สมัครเมื่อ:</span>
            <span className="text-gray-900 font-medium">{new Date(customer.dateRegistered).toLocaleDateString("th-TH")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">สถานะ:</span>
            <span className="text-gray-900 font-medium">{customer.lifecycleStatus}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
            <span className="text-gray-500">ออเดอร์สะสม:</span>
            <span className="text-green-600 font-bold">{customer.totalPurchases || 0} รายการ</span>
          </div>
        </div>

        {!isMain && (
          <div className="mt-4 text-center">
            <span className="text-xs font-medium text-gray-400">คลิกที่การ์ดเพื่อตั้งเป็นข้อมูลหลัก</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">รวมรายชื่อลูกค้า (Merge Customers)</h2>
              <p className="text-sm text-gray-500">ย้ายประวัติการสั่งซื้อและการโทรจากโปรไฟล์หนึ่งมารวมกับโปรไฟล์หลัก</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
          {errorMsg && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6">
            {/* Customer 1 Side */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">ค้นหาลูกค้าคนที่ 1</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    type="text"
                    value={searchTerm1}
                    onChange={onSearch1Change}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-shadow"
                    placeholder="พิมพ์ชื่อ นามสกุล หรือเบอร์โทร..."
                  />
                  {loading1 && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>

                {/* Search Results Dropdown 1 */}
                {results1.length > 0 && !selected1 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto pt-1 pb-1 divide-y divide-gray-50">
                    {results1.map((c) => (
                      <div
                        key={c.id}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => handleSelect1(c)}
                      >
                        <div className="font-semibold text-gray-800">{c.firstName} {c.lastName}</div>
                        <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                          <span>📱 {c.phone}</span>
                          <span>📍 {c.province}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Customer 1 Card */}
              {renderCustomerCard(
                selected1, 
                mainId === (selected1?.customer_id ?? selected1?.id), 
                () => selected1 && setMainId(selected1.customer_id ?? selected1.id)
              )}
            </div>


            {/* Link Icon / Visual Separator */}
            <div className="hidden md:flex flex-col justify-center items-center px-2 pt-8">
              <div className="h-10 border-l border-dashed border-gray-300"></div>
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm z-10 my-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <div className="h-10 border-l border-dashed border-gray-300"></div>
            </div>


            {/* Customer 2 Side */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1">ค้นหาลูกค้าคนที่ 2</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input
                    type="text"
                    value={searchTerm2}
                    onChange={onSearch2Change}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-shadow"
                    placeholder="พิมพ์ชื่อ นามสกุล หรือเบอร์โทร..."
                  />
                  {loading2 && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>

                {/* Search Results Dropdown 2 */}
                {results2.length > 0 && !selected2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto pt-1 pb-1 divide-y divide-gray-50">
                    {results2.map((c) => (
                      <div
                        key={c.id}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => handleSelect2(c)}
                      >
                        <div className="font-semibold text-gray-800">{c.firstName} {c.lastName}</div>
                        <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                          <span>📱 {c.phone}</span>
                          <span>📍 {c.province}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Customer 2 Card */}
              {renderCustomerCard(
                selected2, 
                mainId === (selected2?.customer_id ?? selected2?.id), 
                () => selected2 && setMainId(selected2.customer_id ?? selected2.id)
              )}
            </div>
          </div>
          
          <div className="mt-8 bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            <p>
              <strong>คำแนะนำ:</strong> เลือกประวัติที่ถูกต้องที่สุดเป็น <span className="text-blue-600 font-bold">ข้อมูลหลัก (Main)</span> ประวัติการสั่งซื้อและการโทรทั้งหมดของคนที่เป็นโปรไฟล์สำรองจะถูกโอนไปให้คนกระบวนการหลักเพื่อไม่ให้การวิเคราะห์พฤติกรรมลูกค้าถูกตัดขาดจากกัน (ตัวประวัติสำรองจะไม่ถูกโดนลบทิ้ง แต่จะไม่มีออเดอร์เกาะอยู่แล้ว)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleMerge}
            disabled={merging || !selected1 || !selected2 || !mainId}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-400 flex items-center gap-2 shadow-sm transition-colors"
          >
            {merging ? <Spinner size="sm" /> : null}
            ยืนยันรวมประวัติ
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeCustomersModal;
