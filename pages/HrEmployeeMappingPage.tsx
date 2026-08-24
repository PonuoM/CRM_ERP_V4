import { useState, useEffect, useCallback, useMemo } from 'react';
import APP_BASE_PATH from '../appBasePath';

/**
 * จับคู่ข้อมูลระหว่าง ERP กับ HR Mobile Connect — ทำเป็น 3 ชั้นจากหยาบไปละเอียด
 *   1. บริษัท : ERP company -> HR company
 *   2. แผนก   : ERP users.role -> HR departments (many-to-many, เพราะสองฝั่งซอยแผนกไม่เท่ากัน)
 *   3. พนักงาน: ERP user -> HR employee
 *
 * ชั้น 1-2 มีไว้กรองตัวเลือกในชั้น 3 ให้แคบลง — ถ้าไม่กรอง dropdown จะมีพนักงาน HR ทั้ง 145 คน
 * จาก 3 บริษัท 36 แผนก ปนกันจนเลือกไม่ไหว
 *
 * ที่ต้องจับคู่ด้วยมือเพราะ ERP เก็บ "ชื่อเล่น" ไว้ในช่องชื่อ ส่วน HR เก็บชื่อจริง+นามสกุล
 */

interface HrEmployeeSlim {
    id: string;
    name: string;
    nickname: string | null;
    company_id: number;
    company_name: string | null;
    department_id: number | null;
    department: string | null;
    position: string | null;
    hire_date: string | null;
    is_active: boolean;
}

interface HrEmployee extends HrEmployeeSlim {
    email: string | null;
    phone: string | null;
    terminated_at: string | null;
    linked_user_id: number | null;
    linked_user_name: string | null;
}

type Confidence = 'high' | 'medium' | 'low' | 'ambiguous';

interface Suggestion {
    employee: HrEmployeeSlim | null;
    confidence: Confidence;
    reason: string;
    candidates: HrEmployeeSlim[];
}

interface MappingRecord {
    user_id: number;
    username: string;
    erp_first_name: string | null;
    erp_last_name: string | null;
    erp_display_name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    company_id: number;
    company_name: string | null;
    status: string;
    hr_employee_id: string | null;
    hr_linked_at: string | null;
    hr_linked_by_name: string | null;
    hr_missing: boolean;
    hr: HrEmployeeSlim | null;
    suggestion: Suggestion | null;
    hr_company_id: number | null;
    hr_company_covered: boolean;
    hr_department_ids: number[];
}

interface MappingResponse {
    success: boolean;
    hr_database: string;
    company_map: Record<string, number>;
    department_map_count: number;
    stats: {
        total: number;
        linked: number;
        suggested: number;
        ambiguous: number;
        unmatched: number;
        no_hr_company: number;
    };
    records: MappingRecord[];
    hr_employees: HrEmployee[];
}

interface ErpCompany {
    id: number;
    name: string;
    active_users: number;
    hr_company_id: number | null;
}

interface ErpRole {
    company_id: number;
    role: string;
    user_count: number;
    hr_department_ids: number[];
}

interface HrCompany {
    id: number;
    code: string;
    name: string;
}

interface HrDepartment {
    id: number;
    company_id: number;
    name: string;
    active_employees: number;
}

interface ConfigResponse {
    success: boolean;
    erp_companies: ErpCompany[];
    erp_roles: ErpRole[];
    hr_companies: HrCompany[];
    hr_departments: HrDepartment[];
}

type TabKey = 'company' | 'department' | 'employee';
type FilterKey = 'all' | 'unlinked' | 'linked' | 'suggested' | 'ambiguous';

const TABS: { key: TabKey; label: string; hint: string }[] = [
    { key: 'company', label: '1. บริษัท', hint: 'บริษัทใน ERP ตรงกับบริษัทไหนใน HR' },
    { key: 'department', label: '2. แผนก', hint: 'ตำแหน่งใน ERP อยู่แผนกไหนใน HR' },
    { key: 'employee', label: '3. พนักงาน', hint: 'จับคู่รายคน' },
];

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'unlinked', label: 'ยังไม่ผูก' },
    { key: 'suggested', label: 'ระบบเดาให้' },
    { key: 'ambiguous', label: 'ต้องเลือกเอง' },
    { key: 'linked', label: 'ผูกแล้ว' },
];

const CONFIDENCE_STYLE: Record<Confidence, { class: string; label: string }> = {
    high: { class: 'bg-emerald-100 text-emerald-700', label: 'มั่นใจสูง' },
    medium: { class: 'bg-blue-100 text-blue-700', label: 'มั่นใจปานกลาง' },
    low: { class: 'bg-amber-100 text-amber-700', label: 'ต้องตรวจสอบ' },
    ambiguous: { class: 'bg-orange-100 text-orange-700', label: 'ซ้ำ ต้องเลือกเอง' },
};

// วันที่จาก DB เป็น ค.ศ. — แสดงเป็น พ.ศ. ให้ตรงกับหน้าอื่นในระบบ
const formatThaiDate = (value: string | null): string => {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
};

export function HrEmployeeMappingPage() {
    const [tab, setTab] = useState<TabKey>('company');
    const [data, setData] = useState<MappingResponse | null>(null);
    const [config, setConfig] = useState<ConfigResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [autoLinking, setAutoLinking] = useState(false);
    const [filter, setFilter] = useState<FilterKey>('unlinked');
    const [search, setSearch] = useState('');
    const [activeOnly, setActiveOnly] = useState(true);
    // ปกติกรองตัวเลือกตามแมปบริษัท+แผนก — เปิดอันนี้เมื่อคนที่ตามหาอยู่นอกกรอบที่แมปไว้
    const [showAllHr, setShowAllHr] = useState(false);
    // แถวที่เพิ่งผูกไปจะหลุดจากฟิลเตอร์ทันที (เช่นอยู่หน้า "ระบบเดาให้") ทำให้รายการเลื่อนใต้เมาส์
    // จึงตรึงไว้จนกว่าจะเปลี่ยนฟิลเตอร์หรือกดโหลดใหม่ — จะได้เห็นผลและทำคนถัดไปต่อได้เลย
    const [stickyIds, setStickyIds] = useState<Set<number>>(new Set());
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

    const apiUrl = `${APP_BASE_PATH}api/User_DB/hr_employee_mapping.php`;

    const authHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json',
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [listRes, cfgRes] = await Promise.all([
                fetch(apiUrl, { headers: authHeaders() }).then(r => r.json()),
                fetch(`${apiUrl}?action=config`, { headers: authHeaders() }).then(r => r.json()),
            ]);
            if (listRes.success) setData(listRes); else setError(listRes.message || 'โหลดข้อมูลไม่สำเร็จ');
            if (cfgRes.success) setConfig(cfgRes);
        } catch {
            setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // เปลี่ยนมุมมองเมื่อไหร่ ให้เลิกตรึงแถวเก่า
    useEffect(() => {
        setStickyIds(new Set());
    }, [filter, search, activeOnly, tab]);

    /** ใช้กับการตั้งค่าแมปบริษัท/แผนก — เปลี่ยนแล้วกระทบทั้งหน้า จึงโหลดใหม่ทั้งชุด */
    const post = async (body: Record<string, unknown>, key: string) => {
        setBusyKey(key);
        setMessage(null);
        try {
            const res = await fetch(apiUrl, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
            const result = await res.json();
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                await fetchAll();
            } else {
                setMessage({ type: 'error', text: result.message || 'บันทึกไม่สำเร็จ' });
            }
        } catch {
            setMessage({ type: 'error', text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
        } finally {
            setBusyKey(null);
        }
    };

    /** นับสถิติใหม่จาก records ในเครื่อง — ตรรกะต้องตรงกับที่ API คำนวณ ไม่งั้นตัวเลขจะเพี้ยนจนกด "โหลดใหม่" */
    const recomputeStats = (records: MappingRecord[]): MappingResponse['stats'] => {
        const s = { total: 0, linked: 0, suggested: 0, ambiguous: 0, unmatched: 0, no_hr_company: 0 };
        records.forEach(r => {
            s.total++;
            if (r.hr !== null) s.linked++;
            else if (r.hr_company_id === null) s.no_hr_company++;
            else if (!r.suggestion) s.unmatched++;
            else if (r.suggestion.confidence === 'ambiguous') s.ambiguous++;
            else s.suggested++;
        });
        return s;
    };

    /**
     * ผูก/ยกเลิกผูกรายคน แล้วแก้ state ในที่ — ไม่โหลดใหม่ทั้งหน้า
     *
     * เดิมเรียก fetchAll() ทุกครั้ง ทำให้ผูก 20 คนต้องรอโหลด 20 รอบและตารางเด้งกลับไปบนสุดทุกที
     * ตอนนี้แก้เฉพาะแถวที่เปลี่ยน + สถานะ "ถูกจองแล้ว" ของพนักงาน HR คนนั้น
     */
    const linkEmployee = async (userId: number, hrEmployeeId: string | null, opts?: { quiet?: boolean }): Promise<boolean> => {
        if (!opts?.quiet) setBusyKey(`link-${userId}`);
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ user_id: userId, hr_employee_id: hrEmployeeId }),
            });
            const result = await res.json();
            if (!result.success) {
                setMessage({ type: 'error', text: result.message || 'บันทึกไม่สำเร็จ' });
                return false;
            }

            setStickyIds(prev => new Set(prev).add(userId));
            setData(prev => {
                if (!prev) return prev;

                const employee = hrEmployeeId ? prev.hr_employees.find(e => e.id === hrEmployeeId) || null : null;
                const target = prev.records.find(r => r.user_id === userId);
                const releasedId = target?.hr_employee_id ?? null;

                const records = prev.records.map(r => {
                    if (r.user_id !== userId) return r;
                    return {
                        ...r,
                        hr_employee_id: hrEmployeeId,
                        hr: employee,
                        hr_missing: false,
                        hr_linked_at: hrEmployeeId ? new Date().toISOString() : null,
                        // ชื่อคนผูกรู้ได้จาก API เท่านั้น ล้างทิ้งไปก่อนดีกว่าโชว์ชื่อคนเก่าค้าง
                        hr_linked_by_name: null,
                        // ผูกแล้วไม่ต้องเดาต่อ ส่วนตอนยกเลิกก็ปล่อยข้อเสนอเดิมไว้ให้กดซ้ำได้
                        suggestion: hrEmployeeId ? null : r.suggestion,
                    };
                });

                const hr_employees = prev.hr_employees.map(e => {
                    if (e.id === hrEmployeeId) {
                        return { ...e, linked_user_id: userId, linked_user_name: target?.erp_display_name ?? null };
                    }
                    if (releasedId && e.id === releasedId) {
                        return { ...e, linked_user_id: null, linked_user_name: null };
                    }
                    return e;
                });

                return { ...prev, records, hr_employees, stats: recomputeStats(records) };
            });

            if (!opts?.quiet) setMessage({ type: 'success', text: result.message });
            return true;
        } catch {
            setMessage({ type: 'error', text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
            return false;
        } finally {
            if (!opts?.quiet) setBusyKey(null);
        }
    };

    const runAutoLink = async () => {
        if (!window.confirm(
            'ผูกอัตโนมัติเฉพาะคู่ที่ระบบมั่นใจ (อีเมล / ชื่อ-นามสกุล / เบอร์โทร / ชื่อเล่นไม่ซ้ำในบริษัทหรือแผนกเดียวกัน)\n' +
            'คู่ที่ชื่อซ้ำ คนละบริษัท หรือคนละแผนก จะไม่ถูกแตะ — ยกเลิกทีหลังได้\n\nดำเนินการต่อ?'
        )) return;
        setAutoLinking(true);
        setMessage(null);
        try {
            const res = await fetch(apiUrl, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'auto_link' }) });
            const result = await res.json();
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                await fetchAll();
            } else {
                setMessage({ type: 'error', text: result.message || 'ผูกอัตโนมัติไม่สำเร็จ' });
            }
        } catch {
            setMessage({ type: 'error', text: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' });
        } finally {
            setAutoLinking(false);
        }
    };

    const hrDeptsByCompany = useMemo(() => {
        const m = new Map<number, HrDepartment[]>();
        (config?.hr_departments || []).forEach(d => {
            if (!m.has(d.company_id)) m.set(d.company_id, []);
            m.get(d.company_id)!.push(d);
        });
        return m;
    }, [config?.hr_departments]);

    const hrDeptById = useMemo(() => {
        const m = new Map<number, HrDepartment>();
        (config?.hr_departments || []).forEach(d => m.set(d.id, d));
        return m;
    }, [config?.hr_departments]);

    const hrEmployeeById = useMemo(() => {
        const m = new Map<string, HrEmployee>();
        (data?.hr_employees || []).forEach(e => m.set(e.id, e));
        return m;
    }, [data?.hr_employees]);

    const visibleRecords = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (data?.records || []).filter(r => {
            if (activeOnly && r.status !== 'active') return false;

            if (q) {
                const hit = [r.erp_display_name, r.username, r.hr?.name, r.hr?.nickname, r.hr_employee_id, r.company_name, r.role]
                    .some(v => (v || '').toString().toLowerCase().includes(q));
                if (!hit) return false;
            }

            // แถวที่เพิ่งแก้ไปในรอบนี้ อยู่ต่อจนกว่าจะเปลี่ยนมุมมอง
            if (stickyIds.has(r.user_id)) return true;

            if (filter === 'linked' && !r.hr_employee_id) return false;
            if (filter === 'unlinked' && r.hr_employee_id) return false;
            if (filter === 'suggested') {
                if (r.hr_employee_id) return false;
                if (!r.suggestion || r.suggestion.confidence === 'ambiguous') return false;
            }
            if (filter === 'ambiguous') {
                if (r.hr_employee_id) return false;
                if (r.suggestion?.confidence !== 'ambiguous') return false;
            }
            return true;
        });
    }, [data?.records, filter, search, activeOnly, stickyIds]);

    /** แถวที่แสดงอยู่ตอนนี้ และกดยืนยันตามที่ระบบเดาให้ได้ทันที */
    const pendingSuggestions = useMemo(
        () => visibleRecords.filter(r => !r.hr_employee_id && r.suggestion?.employee),
        [visibleRecords],
    );

    /** ยืนยันข้อเสนอของทุกแถวที่เห็นอยู่ ทีละคนตามลำดับ เพื่อให้ฝั่ง server กันคนซ้ำได้ถูกต้อง */
    const applyVisibleSuggestions = async () => {
        const targets = pendingSuggestions;
        if (!targets.length) return;
        if (!window.confirm(
            `ยืนยันการจับคู่ตามที่ระบบเดาให้ ${targets.length} คนที่แสดงอยู่ตอนนี้\n` +
            'แถวที่ชื่อซ้ำจนระบบเลือกไม่ได้จะไม่ถูกแตะ — ยกเลิกรายคนทีหลังได้\n\nดำเนินการต่อ?'
        )) return;

        setMessage(null);
        setBulkProgress({ done: 0, total: targets.length });
        let ok = 0;
        let failed = 0;
        for (let i = 0; i < targets.length; i++) {
            const r = targets[i];
            const employeeId = r.suggestion?.employee?.id;
            if (!employeeId) continue;
            const success = await linkEmployee(r.user_id, employeeId, { quiet: true });
            if (success) ok++; else failed++;
            setBulkProgress({ done: i + 1, total: targets.length });
        }
        setBulkProgress(null);
        setMessage({
            type: failed ? 'error' : 'success',
            text: failed ? `ผูกสำเร็จ ${ok} คน, ไม่สำเร็จ ${failed} คน` : `ผูกสำเร็จทั้งหมด ${ok} คน`,
        });
    };

    /** ตัวเลือก HR ของแถวนี้ — กรองด้วยแมปบริษัท+แผนก เว้นแต่จะกดดูทั้งหมด */
    const optionsFor = useCallback((r: MappingRecord): { options: HrEmployee[]; totalActive: number } => {
        const all = data?.hr_employees || [];
        const totalActive = all.filter(e => e.is_active).length;
        if (showAllHr) return { options: all, totalActive };

        const filtered = all.filter(e => {
            // คนที่ผูกอยู่กับแถวนี้ต้องอยู่ในลิสต์เสมอ ไม่งั้น select จะแสดงค่าว่าง
            if (e.id === r.hr_employee_id) return true;
            if (!e.is_active) return false;
            if (r.hr_company_id !== null && e.company_id !== r.hr_company_id) return false;
            if (r.hr_department_ids.length && (e.department_id === null || !r.hr_department_ids.includes(e.department_id))) return false;
            return true;
        });
        return { options: filtered, totalActive };
    }, [data?.hr_employees, showAllHr]);

    const stats = data?.stats;
    const mappedCompanyCount = config?.erp_companies.filter(c => c.hr_company_id !== null).length ?? 0;
    const mappedRoleCount = config?.erp_roles.filter(r => r.hr_department_ids.length > 0).length ?? 0;

    return (
        <div className="p-4 md:p-6 max-w-[1500px] mx-auto">
            <div className="mb-5">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">🔗 จับคู่พนักงาน HR</h1>
                <p className="text-gray-500 text-sm">
                    ผูกผู้ใช้งานใน ERP เข้ากับพนักงานในระบบ HR เพื่อดึงชื่อจริง นามสกุล ชื่อเล่น วันเข้างาน
                    และเวลาตอกบัตรมาแสดงในหน้า "จัดการวันมาทำงาน" — ตั้งค่าบริษัทกับแผนกก่อน แล้วรายชื่อในขั้นที่ 3 จะแคบลงมาก
                </p>
            </div>

            {error && <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">{error}</div>}

            {message && (
                <div className={`mb-4 p-3 rounded-lg ${message.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-5 border-b border-gray-200">
                {TABS.map(t => {
                    const badge = t.key === 'company'
                        ? `${mappedCompanyCount}/${config?.erp_companies.length ?? 0}`
                        : t.key === 'department'
                            ? `${mappedRoleCount}/${config?.erp_roles.length ?? 0}`
                            : `${stats?.linked ?? 0}/${stats?.total ?? 0}`;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-2.5 -mb-px border-b-2 text-sm font-medium ${tab === t.key
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {t.label}
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]">{badge}</span>
                            <span className="block text-[11px] font-normal text-gray-400">{t.hint}</span>
                        </button>
                    );
                })}
            </div>

            {loading && <div className="py-10 text-center text-gray-400">กำลังโหลด...</div>}

            {/* ---------------- 1. บริษัท ---------------- */}
            {!loading && tab === 'company' && config && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-600">บริษัทใน ERP</th>
                                <th className="px-4 py-3 text-center font-medium text-gray-600">ผู้ใช้ active</th>
                                <th className="px-4 py-3 text-left font-medium text-indigo-700 bg-indigo-50">ตรงกับบริษัทใน HR</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-600">แผนกที่มีให้แมป</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {config.erp_companies.map(c => {
                                const depts = c.hr_company_id !== null ? (hrDeptsByCompany.get(c.hr_company_id) || []) : [];
                                return (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-gray-800">{c.name}</span>
                                            <span className="block text-xs text-gray-400">company_id {c.id}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-gray-600">{c.active_users}</td>
                                        <td className="px-4 py-3 bg-indigo-50/40">
                                            <select
                                                value={c.hr_company_id ?? ''}
                                                disabled={busyKey === `company-${c.id}`}
                                                onChange={e => post({
                                                    action: 'set_company_map',
                                                    erp_company_id: c.id,
                                                    hr_company_id: e.target.value === '' ? null : Number(e.target.value),
                                                }, `company-${c.id}`)}
                                                className="w-full max-w-xs px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                            >
                                                <option value="">— ไม่มีคู่ใน HR —</option>
                                                {config.hr_companies.map(hc => (
                                                    <option key={hc.id} value={hc.id}>{hc.name} ({hc.code})</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {c.hr_company_id === null
                                                ? <span className="text-gray-300">—</span>
                                                : `${depts.length} แผนก · พนักงาน active ${depts.reduce((s, d) => s + d.active_employees, 0)} คน`}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                        บริษัทที่ไม่มีคู่ใน HR จะข้ามไปในขั้นที่ 3 — ผู้ใช้ของบริษัทนั้นจะขึ้นว่า "บริษัทไม่มีใน HR"
                    </div>
                </div>
            )}

            {/* ---------------- 2. แผนก ---------------- */}
            {!loading && tab === 'department' && config && (
                <div className="space-y-5">
                    <p className="text-sm text-gray-500">
                        ERP ไม่มีตารางแผนก — สิ่งที่ทำหน้าที่แทนคือ <strong>ตำแหน่ง (role)</strong> ของผู้ใช้
                        เลือกได้หลายแผนกต่อหนึ่งตำแหน่ง และหลายตำแหน่งจะชี้ไปแผนกเดียวกันก็ได้
                        (เช่น <em>Telesale</em> กับ <em>Supervisor Telesale</em> รวมเป็นแผนก <em>Telesale</em> เดียวใน HR)
                    </p>

                    {config.erp_companies.map(c => {
                        const roles = config.erp_roles.filter(r => r.company_id === c.id);
                        if (!roles.length) return null;
                        const depts = c.hr_company_id !== null ? (hrDeptsByCompany.get(c.hr_company_id) || []) : [];

                        return (
                            <div key={c.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-gray-800">{c.name}</span>
                                    <span className="text-xs text-gray-400">company_id {c.id}</span>
                                    {c.hr_company_id === null && (
                                        <span className="ml-auto text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                            ยังไม่ได้แมปบริษัท — ไปตั้งค่าในแท็บ "1. บริษัท" ก่อน
                                        </span>
                                    )}
                                </div>

                                {c.hr_company_id !== null && (
                                    <table className="w-full text-sm">
                                        <thead className="bg-white border-b border-gray-100">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 w-56">ตำแหน่งใน ERP</th>
                                                <th className="px-4 py-2 text-left font-medium text-indigo-700">แผนกใน HR (เลือกได้หลายอัน)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {roles.map(r => {
                                                const key = `dept-${c.id}-${r.role}`;
                                                const selected = new Set(r.hr_department_ids);
                                                return (
                                                    <tr key={r.role} className="hover:bg-gray-50 align-top">
                                                        <td className="px-4 py-3">
                                                            <span className="font-medium text-gray-800">{r.role}</span>
                                                            <span className="block text-xs text-gray-400">{r.user_count} คน</span>
                                                            {selected.size === 0 && (
                                                                <span className="inline-block mt-1 text-[11px] text-gray-400">ยังไม่แมป = ไม่กรองด้วยแผนก</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {depts.map(d => {
                                                                    const on = selected.has(d.id);
                                                                    return (
                                                                        <button
                                                                            key={d.id}
                                                                            disabled={busyKey === key}
                                                                            onClick={() => {
                                                                                const next = new Set(selected);
                                                                                if (on) next.delete(d.id); else next.add(d.id);
                                                                                post({
                                                                                    action: 'set_department_map',
                                                                                    erp_company_id: c.id,
                                                                                    erp_role: r.role,
                                                                                    hr_department_ids: Array.from(next),
                                                                                }, key);
                                                                            }}
                                                                            className={`px-2 py-1 rounded text-xs border disabled:opacity-50 ${on
                                                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                                                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'}`}
                                                                            title={`พนักงาน active ${d.active_employees} คน`}
                                                                        >
                                                                            {d.name}
                                                                            <span className={`ml-1 ${on ? 'text-indigo-200' : 'text-gray-400'}`}>{d.active_employees}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                                {!depts.length && <span className="text-xs text-gray-400">บริษัท HR นี้ยังไม่มีแผนก</span>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ---------------- 3. พนักงาน ---------------- */}
            {!loading && tab === 'employee' && (
                <>
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
                            {[
                                { label: 'ผู้ใช้ทั้งหมด', value: stats.total, color: 'text-gray-800' },
                                { label: 'ผูกแล้ว', value: stats.linked, color: 'text-emerald-600' },
                                { label: 'ระบบเดาให้', value: stats.suggested, color: 'text-blue-600' },
                                { label: 'ชื่อซ้ำ ต้องเลือกเอง', value: stats.ambiguous, color: 'text-orange-600' },
                                { label: 'ไม่พบใน HR', value: stats.unmatched, color: 'text-gray-500' },
                                { label: 'บริษัทไม่มีใน HR', value: stats.no_hr_company, color: 'text-gray-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-wrap gap-1">
                                {FILTERS.map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f.key
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ ERP / ชื่อจริง / ชื่อเล่น / ตำแหน่ง / รหัสพนักงาน..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="flex-1 min-w-[220px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />

                            <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="rounded border-gray-300" />
                                เฉพาะผู้ใช้ที่ยัง active
                            </label>

                            <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap" title="ปกติแสดงเฉพาะพนักงานในบริษัท+แผนกที่แมปไว้">
                                <input type="checkbox" checked={showAllHr} onChange={e => setShowAllHr(e.target.checked)} className="rounded border-gray-300" />
                                ไม่กรองตัวเลือก HR
                            </label>

                            <button
                                onClick={applyVisibleSuggestions}
                                disabled={!pendingSuggestions.length || bulkProgress !== null || autoLinking}
                                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
                                title="ยืนยันการจับคู่ตามที่ระบบเดาให้ ของทุกแถวที่แสดงอยู่ตอนนี้"
                            >
                                {bulkProgress
                                    ? `⏳ ${bulkProgress.done}/${bulkProgress.total}`
                                    : `✓ ยืนยันที่แสดงอยู่ (${pendingSuggestions.length})`}
                            </button>

                            <button
                                onClick={runAutoLink}
                                disabled={autoLinking || loading || bulkProgress !== null}
                                className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 whitespace-nowrap"
                            >
                                {autoLinking ? '⏳ กำลังผูก...' : '⚡ ผูกอัตโนมัติเท่าที่มั่นใจ'}
                            </button>

                            <button
                                onClick={fetchAll}
                                disabled={loading || autoLinking || bulkProgress !== null}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
                                title="โหลดข้อมูลใหม่ และล้างแถวที่ตรึงไว้"
                            >
                                🔄 โหลดใหม่
                            </button>
                        </div>

                        {stickyIds.size > 0 && (
                            <p className="mt-2 text-xs text-gray-500">
                                ตรึงแถวที่เพิ่งแก้ไว้ {stickyIds.size} แถว เพื่อไม่ให้รายการเลื่อนระหว่างทำ —
                                กด "โหลดใหม่" หรือเปลี่ยนฟิลเตอร์เพื่อล้าง
                            </p>
                        )}
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600">#</th>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600">
                                            ชื่อใน ERP
                                            <span className="block text-[11px] font-normal text-gray-400">ชื่อที่ใช้ในระบบนี้</span>
                                        </th>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600">บริษัท / ตำแหน่ง</th>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600 bg-indigo-50/60">
                                            ชื่อจริง-นามสกุล (HR)
                                            <span className="block text-[11px] font-normal text-indigo-400">จากระบบ HR</span>
                                        </th>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600 bg-indigo-50/60">ชื่อเล่น (HR)</th>
                                        <th className="px-3 py-3 text-center font-medium text-gray-600 bg-indigo-50/60">วันเข้างาน</th>
                                        <th className="px-3 py-3 text-left font-medium text-gray-600" style={{ minWidth: '330px' }}>จับคู่กับพนักงาน HR</th>
                                        <th className="px-3 py-3 text-center font-medium text-gray-600">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visibleRecords.length === 0 ? (
                                        <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</td></tr>
                                    ) : (
                                        visibleRecords.map((r, idx) => {
                                            const rawSuggested = r.suggestion?.employee || null;
                                            // คนที่ระบบเดาให้ อาจเพิ่งถูกผูกไปกับคนอื่นในรอบนี้ — อย่าเสนอซ้ำ
                                            const suggestedTakenBy = rawSuggested ? hrEmployeeById.get(rawSuggested.id)?.linked_user_id ?? null : null;
                                            const suggested = suggestedTakenBy !== null && suggestedTakenBy !== r.user_id ? null : rawSuggested;
                                            const conf = r.suggestion ? CONFIDENCE_STYLE[r.suggestion.confidence] : null;
                                            const { options, totalActive } = optionsFor(r);
                                            const busy = busyKey === `link-${r.user_id}`;
                                            const justChanged = stickyIds.has(r.user_id);
                                            return (
                                                <tr
                                                    key={r.user_id}
                                                    className={`align-top ${justChanged && r.hr_employee_id
                                                        ? 'bg-emerald-50/60 hover:bg-emerald-50'
                                                        : 'hover:bg-gray-50'}`}
                                                >
                                                    <td className="px-3 py-3 text-gray-400">{idx + 1}</td>

                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <div className="font-medium text-gray-800">{r.erp_display_name || '-'}</div>
                                                        <div className="text-xs text-gray-400">@{r.username}</div>
                                                        {r.status !== 'active' && (
                                                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[11px]">{r.status}</span>
                                                        )}
                                                        {justChanged && r.hr_employee_id && (
                                                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[11px]">✓ เพิ่งผูก</span>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                                                        <div>{r.company_name || `#${r.company_id}`}</div>
                                                        <div className="text-gray-400">{r.role || '-'}</div>
                                                        {r.hr_department_ids.length > 0 && (
                                                            <div className="text-indigo-400 mt-0.5">
                                                                → {r.hr_department_ids.map(id => hrDeptById.get(id)?.name || `#${id}`).join(', ')}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3 bg-indigo-50/30">
                                                        {r.hr ? (
                                                            <span className="font-medium text-indigo-900">{r.hr.name}</span>
                                                        ) : r.hr_missing ? (
                                                            <span className="text-red-500 text-xs">ผูกไว้กับ {r.hr_employee_id} แต่ไม่พบใน HR แล้ว</span>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                        {r.hr?.department && <div className="text-xs text-indigo-400 mt-0.5">{r.hr.department}</div>}
                                                    </td>

                                                    <td className="px-3 py-3 bg-indigo-50/30">
                                                        {r.hr?.nickname ? <span className="text-indigo-900">{r.hr.nickname}</span> : <span className="text-gray-300">—</span>}
                                                    </td>

                                                    <td className="px-3 py-3 text-center bg-indigo-50/30 whitespace-nowrap">
                                                        {r.hr ? <span className="text-indigo-900">{formatThaiDate(r.hr.hire_date)}</span> : <span className="text-gray-300">—</span>}
                                                    </td>

                                                    <td className="px-3 py-3">
                                                        <select
                                                            value={r.hr_employee_id || ''}
                                                            disabled={busy}
                                                            onChange={e => linkEmployee(r.user_id, e.target.value || null)}
                                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                                        >
                                                            <option value="">— ยังไม่ผูก —</option>
                                                            {options.map(e => {
                                                                const takenByOther = e.linked_user_id !== null && e.linked_user_id !== r.user_id;
                                                                return (
                                                                    <option key={e.id} value={e.id} disabled={takenByOther}>
                                                                        {e.name}
                                                                        {e.nickname ? ` (${e.nickname})` : ''}
                                                                        {showAllHr && e.department ? ` · ${e.department}` : ''}
                                                                        {!e.is_active ? ' [ลาออกแล้ว]' : ''}
                                                                        {takenByOther ? ` — ผูกกับ ${e.linked_user_name} แล้ว` : ''}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>

                                                        <div className="mt-1 text-[11px] text-gray-400">
                                                            {showAllHr
                                                                ? `ไม่กรอง — ${options.length} คน`
                                                                : `กรองเหลือ ${options.length} จาก ${totalActive} คน`}
                                                            {!r.hr_company_covered && ' · บริษัทนี้ยังไม่มีคู่ใน HR'}
                                                            {r.hr_company_covered && r.hr_department_ids.length === 0 && ' · ตำแหน่งนี้ยังไม่ได้แมปแผนก'}
                                                        </div>

                                                        {!r.hr_employee_id && r.suggestion && conf && (
                                                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${conf.class}`}>{conf.label}</span>
                                                                <span className="text-xs text-gray-500">{r.suggestion.reason}</span>
                                                                {!suggested && rawSuggested && (
                                                                    <span className="text-xs text-orange-600">
                                                                        ("{rawSuggested.name}" เพิ่งถูกผูกกับคนอื่นไป)
                                                                    </span>
                                                                )}
                                                                {suggested && (
                                                                    <button
                                                                        onClick={() => linkEmployee(r.user_id, suggested.id)}
                                                                        disabled={busy}
                                                                        className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
                                                                    >
                                                                        ใช้ "{suggested.name}"
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {!r.hr_employee_id && r.suggestion?.candidates?.length ? (
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {r.suggestion.candidates.map(cd => {
                                                                    const takenBy = hrEmployeeById.get(cd.id)?.linked_user_id ?? null;
                                                                    const taken = takenBy !== null && takenBy !== r.user_id;
                                                                    return (
                                                                        <button
                                                                            key={cd.id}
                                                                            onClick={() => linkEmployee(r.user_id, cd.id)}
                                                                            disabled={busy || taken}
                                                                            className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs hover:bg-orange-100 disabled:opacity-40 disabled:line-through"
                                                                            title={taken ? 'ถูกผูกกับผู้ใช้อื่นแล้ว' : (cd.department || '')}
                                                                        >
                                                                            {cd.name}{cd.department ? ` · ${cd.department}` : ''}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : null}

                                                        {r.hr_employee_id && (
                                                            <div className="mt-1 text-xs text-gray-400">
                                                                รหัส {r.hr_employee_id}{r.hr_linked_by_name ? ` · ผูกโดย ${r.hr_linked_by_name}` : ''}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-3 text-center whitespace-nowrap">
                                                        {r.hr_employee_id ? (
                                                            <button
                                                                onClick={() => linkEmployee(r.user_id, null)}
                                                                disabled={busy}
                                                                className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                                                            >
                                                                {busy ? '...' : 'ยกเลิกการผูก'}
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-4 text-xs text-gray-500 space-y-1">
                        <p>
                            <strong>💡 ทำไมชื่อสองฝั่งไม่ตรงกัน:</strong> ERP เก็บ "ชื่อเล่น" ไว้ในช่องชื่อ ส่วน HR เก็บชื่อจริงกับนามสกุล
                            ระบบจึงจับคู่อัตโนมัติได้เฉพาะกรณีที่อีเมล เบอร์โทร หรือชื่อเล่นตรงกันแบบไม่ซ้ำ
                        </p>
                        <p><strong>⚠️ พนักงาน HR หนึ่งคนผูกได้กับผู้ใช้ ERP คนเดียว</strong> — คนที่ถูกผูกไปแล้วจะเลือกซ้ำไม่ได้</p>
                        <p>หาคนที่ต้องการไม่เจอในลิสต์? ติ๊ก "ไม่กรองตัวเลือก HR" เพื่อดูพนักงานทุกบริษัททุกแผนก</p>
                    </div>
                </>
            )}
        </div>
    );
}

export default HrEmployeeMappingPage;
