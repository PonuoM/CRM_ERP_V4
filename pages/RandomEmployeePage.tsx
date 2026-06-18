import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, UserRole, Company } from '../types';
import { Users, Shuffle, RotateCcw, List, Shield, Award, Calendar, Phone, Mail, Download } from 'lucide-react';
import { listCallHistory } from '../services/api';
import DateRangePicker, { DateRange } from '../components/DateRangePicker';
import { downloadDataFile } from '../utils/exportUtils';

interface RandomEmployeePageProps {
  users: User[];
  companies: Company[];
  currentUser: User;
}

interface DrawResult {
  timestamp: string;
  winners: User[];
}

const RandomEmployeePage: React.FC<RandomEmployeePageProps> = ({
  users,
  companies,
  currentUser,
}) => {
  const [dateRange, setDateRange] = useState<DateRange>({ start: '', end: '' });

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const [companyFilter, setCompanyFilter] = useState<string>("");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [drawCount, setDrawCount] = useState<number>(1);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentDisplayWinner, setCurrentDisplayWinner] = useState<User | null>(null);
  const [drawnWinners, setDrawnWinners] = useState<User[]>([]);
  const [drawHistory, setDrawHistory] = useState<DrawResult[]>([]);
  const [shufflingName, setShufflingName] = useState<string>("");
  
  const [winnerCallHistory, setWinnerCallHistory] = useState<any[]>([]);
  const [loadingCallHistory, setLoadingCallHistory] = useState<boolean>(false);
  const [isExportingAll, setIsExportingAll] = useState<boolean>(false);
  const [auditPeriod, setAuditPeriod] = useState<{
    date: string;
    totalCallsOnDate: number;
    calls: any[];
  } | null>(null);

  const isSuperAdmin = currentUser.role === UserRole.SuperAdmin;

  const randomizeAuditPeriod = (allCalls: any[]) => {
    if (!allCalls || allCalls.length === 0) {
      setAuditPeriod(null);
      return;
    }

    // Group calls by date (YYYY-MM-DD format in local timezone)
    const callsByDate: { [key: string]: any[] } = {};
    allCalls.forEach(call => {
      if (!call.date) return;
      const d = new Date(call.date);
      if (isNaN(d.getTime())) return;
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (!callsByDate[dateStr]) {
        callsByDate[dateStr] = [];
      }
      callsByDate[dateStr].push(call);
    });

    const dates = Object.keys(callsByDate);
    if (dates.length === 0) {
      setAuditPeriod(null);
      return;
    }

    // Pick a random date
    const randomDateStr = dates[Math.floor(Math.random() * dates.length)];
    const callsOnDate = [...callsByDate[randomDateStr]];
    const totalCallsOnDate = callsOnDate.length;

    // Draw up to 10 random calls from callsOnDate
    const drawnCalls: any[] = [];
    const countToDraw = Math.min(10, callsOnDate.length);
    for (let i = 0; i < countToDraw; i++) {
      const randomIndex = Math.floor(Math.random() * callsOnDate.length);
      drawnCalls.push(callsOnDate.splice(randomIndex, 1)[0]);
    }

    // Sort calls descending (newest first)
    drawnCalls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Format display date (dd/mm/yyyy)
    const [year, month, day] = randomDateStr.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    setAuditPeriod({
      date: formattedDate,
      totalCallsOnDate,
      calls: drawnCalls
    });
  };

  const handleExportAllExcel = () => {
    if (!drawnWinners || drawnWinners.length === 0) return;

    setIsExportingAll(true);

    const promises = drawnWinners.map(winner => {
      return listCallHistory({
        assignedTo: winner.id,
        dateStart: dateRange.start || undefined,
        dateEnd: dateRange.end || undefined,
        pageSize: 1000
      })
        .then(res => {
          return {
            winner,
            calls: res && Array.isArray(res.data) ? res.data : []
          };
        })
        .catch(err => {
          console.error(`Failed to fetch call history for ${winner.firstName}`, err);
          return {
            winner,
            calls: []
          };
        });
    });

    Promise.all(promises)
      .then(results => {
        const combinedData: any[] = [];

        results.forEach((result, rIdx) => {
          const { winner, calls } = result;
          
          if (calls.length === 0) {
            combinedData.push({
              'ลำดับสาย': '-',
              'พนักงานที่ถูกสุ่ม': `${winner.firstName} ${winner.lastName}`,
              'ตำแหน่ง': winner.role || '-',
              'ชื่อลูกค้า': '-',
              'เบอร์โทร': '-',
              'วันเวลาที่โทร': '-',
              'เวลา': '-',
              'ระยะเวลา': '-',
              'บันทึก / ผลลัพธ์': 'ไม่มีประวัติการโทรในช่วงเวลาที่เลือก'
            });
            // Add blank separating row if not the last winner
            if (rIdx < results.length - 1) {
              combinedData.push({
                'ลำดับสาย': '',
                'พนักงานที่ถูกสุ่ม': '',
                'ตำแหน่ง': '',
                'ชื่อลูกค้า': '',
                'เบอร์โทร': '',
                'วันเวลาที่โทร': '',
                'เวลา': '',
                'ระยะเวลา': '',
                'บันทึก / ผลลัพธ์': ''
              });
            }
            return;
          }

          // Group calls by date (YYYY-MM-DD format in local timezone)
          const callsByDate: { [key: string]: any[] } = {};
          calls.forEach(call => {
            if (!call.date) return;
            const d = new Date(call.date);
            if (isNaN(d.getTime())) return;
            
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            if (!callsByDate[dateStr]) {
              callsByDate[dateStr] = [];
            }
            callsByDate[dateStr].push(call);
          });

          const dates = Object.keys(callsByDate);
          if (dates.length === 0) {
            combinedData.push({
              'ลำดับสาย': '-',
              'พนักงานที่ถูกสุ่ม': `${winner.firstName} ${winner.lastName}`,
              'ตำแหน่ง': winner.role || '-',
              'ชื่อลูกค้า': '-',
              'เบอร์โทร': '-',
              'วันเวลาที่โทร': '-',
              'เวลา': '-',
              'ระยะเวลา': '-',
              'บันทึก / ผลลัพธ์': 'ไม่มีประวัติการโทรในช่วงเวลาที่เลือก'
            });
            if (rIdx < results.length - 1) {
              combinedData.push({
                'ลำดับสาย': '',
                'พนักงานที่ถูกสุ่ม': '',
                'ตำแหน่ง': '',
                'ชื่อลูกค้า': '',
                'เบอร์โทร': '',
                'วันเวลาที่โทร': '',
                'เวลา': '',
                'ระยะเวลา': '',
                'บันทึก / ผลลัพธ์': ''
              });
            }
            return;
          }

          // Pick a random date
          const randomDateStr = dates[Math.floor(Math.random() * dates.length)];
          const callsOnDate = [...callsByDate[randomDateStr]];

          // Draw up to 10 random calls
          const drawnCalls: any[] = [];
          const countToDraw = Math.min(10, callsOnDate.length);
          for (let i = 0; i < countToDraw; i++) {
            const randomIndex = Math.floor(Math.random() * callsOnDate.length);
            drawnCalls.push(callsOnDate.splice(randomIndex, 1)[0]);
          }

          // Sort calls descending (newest first)
          drawnCalls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // Format display date in Buddhist Era (BE) format (dd/mm/yyyy)
          const [yearStr, month, day] = randomDateStr.split('-');
          const adYear = parseInt(yearStr);
          const beYear = adYear + 543;
          const formattedDate = `${day}/${month}/${beYear}`;

          // Add each drawn call to combined data
          drawnCalls.forEach((call, index) => {
            const callDuration = call.duration 
              ? `${Math.floor(call.duration / 60)} นาที ${call.duration % 60} วินาที` 
              : '-';
            
            const callDateObj = new Date(call.date);
            let formattedTime = '-';
            if (!isNaN(callDateObj.getTime())) {
              const hours = String(callDateObj.getHours()).padStart(2, '0');
              const minutes = String(callDateObj.getMinutes()).padStart(2, '0');
              formattedTime = `${hours}:${minutes}`;
            }

            combinedData.push({
              'ลำดับสาย': index + 1,
              'พนักงานที่ถูกสุ่ม': `${winner.firstName} ${winner.lastName}`,
              'ตำแหน่ง': winner.role || '-',
              'ชื่อลูกค้า': call.customer_first_name 
                ? `${call.customer_first_name} ${call.customer_last_name || ''}`.trim() 
                : '-',
              'เบอร์โทร': call.customer_phone || '-',
              'วันเวลาที่โทร': formattedDate,
              'เวลา': formattedTime,
              'ระยะเวลา': callDuration,
              'บันทึก / ผลลัพธ์': call.notes || call.result || '-'
            });
          });

          // Add blank separating row if not the last winner
          if (rIdx < results.length - 1) {
            combinedData.push({
              'ลำดับสาย': '',
              'พนักงานที่ถูกสุ่ม': '',
              'ตำแหน่ง': '',
              'ชื่อลูกค้า': '',
              'เบอร์โทร': '',
              'วันเวลาที่โทร': '',
              'เวลา': '',
              'ระยะเวลา': '',
              'บันทึก / ผลลัพธ์': ''
            });
          }
        });

        if (combinedData.length === 0) {
          alert("ไม่มีข้อมูลประวัติการโทรสำหรับดาวน์โหลด");
          return;
        }

        const filename = `ประวัติการโทรสุ่มตรวจพนักงานทั้งหมด`;
        downloadDataFile(combinedData, filename, 'xlsx');
      })
      .catch(err => {
        console.error("Failed to export all excel", err);
      })
      .finally(() => {
        setIsExportingAll(false);
      });
  };

  useEffect(() => {
    if (!currentDisplayWinner) {
      setWinnerCallHistory([]);
      setAuditPeriod(null);
      return;
    }

    setLoadingCallHistory(true);
    listCallHistory({
      assignedTo: currentDisplayWinner.id,
      dateStart: dateRange.start || undefined,
      dateEnd: dateRange.end || undefined,
      pageSize: 500
    })
      .then(res => {
        if (res && Array.isArray(res.data)) {
          setWinnerCallHistory(res.data);
          randomizeAuditPeriod(res.data);
        } else {
          setWinnerCallHistory([]);
          setAuditPeriod(null);
        }
      })
      .catch(err => {
        console.error("Failed to fetch call history for winner", err);
        setWinnerCallHistory([]);
        setAuditPeriod(null);
      })
      .finally(() => {
        setLoadingCallHistory(false);
      });
  }, [currentDisplayWinner, dateRange]);

  // Extract unique roles from active user list
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    users.forEach(u => {
      if (u.role) roles.add(u.role);
    });
    return Array.from(roles);
  }, [users]);

  // Filter users based on criteria
  const candidatePool = useMemo(() => {
    return users.filter((u) => {
      // 1. Role match
      if (selectedRoles.length > 0 && !selectedRoles.includes(u.role)) return false;
      // 2. Company match
      if (isSuperAdmin && companyFilter && u.companyId !== parseInt(companyFilter)) return false;
      // 3. Status match
      const userStatus = u.status ?? 'active';
      if (statusFilter && userStatus !== statusFilter) return false;
      
      return true;
    });
  }, [users, selectedRoles, companyFilter, statusFilter, isSuperAdmin]);

  // Adjust draw count when candidate pool size changes
  useEffect(() => {
    if (drawCount > candidatePool.length && candidatePool.length > 0) {
      setDrawCount(candidatePool.length);
    }
  }, [candidatePool.length]);

  const handleStartDraw = () => {
    if (candidatePool.length === 0 || drawCount <= 0) return;

    setIsDrawing(true);
    setDrawnWinners([]);
    setCurrentDisplayWinner(null);

    // Shuffle animation configuration
    const animationDuration = 2000; // 2 seconds
    const intervalTime = 80; // refresh name every 80ms
    const steps = animationDuration / intervalTime;
    let currentStep = 0;

    const shuffleInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * candidatePool.length);
      const randomUser = candidatePool[randomIndex];
      setShufflingName(`${randomUser.firstName} ${randomUser.lastName}`);
      
      currentStep++;
      if (currentStep >= steps) {
        clearInterval(shuffleInterval);
        
        // Select final winners (unique random selection)
        const poolCopy = [...candidatePool];
        const winners: User[] = [];
        const countToDraw = Math.min(drawCount, poolCopy.length);

        for (let i = 0; i < countToDraw; i++) {
          const randIdx = Math.floor(Math.random() * poolCopy.length);
          winners.push(poolCopy.splice(randIdx, 1)[0]);
        }

        setDrawnWinners(winners);
        if (winners.length > 0) {
          setCurrentDisplayWinner(winners[0]);
        }
        
        // Add to history
        const timestamp = new Date().toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setDrawHistory(prev => [{ timestamp, winners }, ...prev]);
        setIsDrawing(false);
        setShufflingName("");
      }
    }, intervalTime);
  };

  const handleReset = () => {
    setDrawnWinners([]);
    setCurrentDisplayWinner(null);
    setShufflingName("");
    setIsDrawing(false);
  };

  const handleClearHistory = () => {
    setDrawHistory([]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <Shuffle className="w-8 h-8 text-green-600 animate-pulse" />
          สุ่มรายชื่อพนักงาน
        </h2>
        <p className="text-gray-500 mt-1">เครื่องมือสำหรับสุ่มรายชื่อผู้ใช้งานและพนักงานตามเงื่อนไขที่กำหนด</p>
      </div>

      {/* Setup & Filters Horizontal Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
          <Shield className="w-5 h-5 text-gray-500" />
          เงื่อนไขการสุ่มพนักงาน
        </h3>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Filters Group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
            {/* Date Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">ช่วงวันที่ต้องการดึงประวัติการโทร</label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>

            {/* Role Filter */}
            <div className="relative" ref={roleDropdownRef}>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">ตำแหน่งงาน</label>
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-semibold text-left flex items-center justify-between min-h-[46px]"
              >
                <span className="truncate">
                  {selectedRoles.length === 0 
                    ? "ทุกตำแหน่งงาน" 
                    : selectedRoles.length === 1 
                      ? selectedRoles[0] 
                      : `เลือกแล้ว ${selectedRoles.length} ตำแหน่ง`}
                </span>
                <svg className="w-4 h-4 text-gray-500 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto p-2 space-y-1 animate-fade-in">
                  <label className="flex items-center gap-2 px-2.5 py-2 hover:bg-gray-50 rounded-lg cursor-pointer text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedRoles.length === 0}
                      onChange={() => setSelectedRoles([])}
                      className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                    />
                    <span>ทุกตำแหน่งงาน</span>
                  </label>
                  <div className="h-px bg-gray-150 my-1" />
                  {availableRoles.map(role => {
                    const isChecked = selectedRoles.includes(role);
                    return (
                      <label key={role} className="flex items-center gap-2 px-2.5 py-2 hover:bg-gray-50 rounded-lg cursor-pointer text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedRoles(selectedRoles.filter(r => r !== role));
                            } else {
                              setSelectedRoles([...selectedRoles, role]);
                            }
                          }}
                          className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                        />
                        <span>{role}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">สถานะพนักงาน</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-semibold"
                style={{ colorScheme: 'light' }}
              >
                <option value="">ทุกสถานะ</option>
                <option value="active">เปิดใช้งาน (Active)</option>
                <option value="inactive">ปิดใช้งาน (Inactive)</option>
                <option value="resigned">ลาออก (Resigned)</option>
              </select>
            </div>

            {/* Company Filter (Super Admin only) */}
            {isSuperAdmin && (
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">บริษัท</label>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-800 focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-semibold"
                  style={{ colorScheme: 'light' }}
                >
                  <option value="">ทุกบริษัท</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Candidate Pool Summary & Quantity Selector */}
          <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100 min-w-[280px] sm:min-w-[320px] justify-between self-stretch lg:self-auto">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block whitespace-nowrap">สุ่มคัดเลือกได้ตอนนี้</span>
              <p className="text-2xl font-black text-gray-900 leading-tight">
                {candidatePool.length} <span className="text-xs font-normal text-gray-500">คน</span>
              </p>
            </div>

            <div className="h-10 w-px bg-gray-200" />

            <div className="space-y-1.5 flex flex-col items-end">
              <label className="text-xs font-bold text-gray-500 block whitespace-nowrap">จำนวนที่ต้องการสุ่ม:</label>
              <input
                type="number"
                min={1}
                max={Math.max(1, candidatePool.length)}
                value={drawCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    setDrawCount(Math.min(Math.max(1, val), candidatePool.length));
                  }
                }}
                className="w-16 p-2 border border-gray-200 rounded-xl text-center bg-white font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full">
        {drawnWinners.length > 0 && !isDrawing ? (
          /* Clean Results Table Card */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50/50 gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-600" />
                  รายชื่อผู้ที่ถูกสุ่มเลือก!
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">พนักงานที่สุ่มเลือกได้ตามเงื่อนไขของคุณ คลิกที่รายชื่อเพื่อดูประวัติการโทร</p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={handleStartDraw}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Shuffle className="w-3.5 h-3.5" /> สุ่มอีกครั้ง
                </button>
                {drawnWinners.length > 0 && (
                  <button
                    onClick={handleExportAllExcel}
                    disabled={isExportingAll}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 animate-fade-in"
                  >
                    {isExportingAll ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                        <span>กำลังเตรียมข้อมูล...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>ดาวน์โหลด Excel ทั้งหมด</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> ล้างหน้าจอ
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-150 bg-gray-50/70 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-5 w-16 text-center">ลำดับ</th>
                    <th className="py-3 px-5">พนักงาน</th>
                    <th className="py-3 px-5">ตำแหน่ง</th>
                    <th className="py-3 px-5">อีเมล</th>
                    <th className="py-3 px-5 w-32 text-center">สถานะ</th>
                    <th className="py-3 px-5 w-48 text-center font-bold">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drawnWinners.map((w, idx) => {
                    const isSelected = currentDisplayWinner?.id === w.id;
                    const statusClass = w.status === 'active' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : w.status === 'inactive' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-red-50 text-red-700 border-red-200';
                    
                    const statusLabel = w.status === 'active' 
                      ? 'เปิดใช้งาน' 
                      : w.status === 'inactive' 
                        ? 'ปิดใช้งาน' 
                        : 'ลาออก';

                    return (
                      <React.Fragment key={w.id}>
                        <tr 
                          className={`transition-colors cursor-pointer ${
                            isSelected ? 'bg-green-50/30' : 'hover:bg-gray-50/50'
                          }`}
                          onClick={() => setCurrentDisplayWinner(isSelected ? null : w)}
                        >
                          <td className="py-4 px-5 text-center font-bold text-gray-400 text-sm">
                            {idx + 1}
                          </td>
                          <td className="py-4 px-5">
                            <div className="font-bold text-gray-900">{w.firstName} {w.lastName}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{w.phone || '-'}</div>
                          </td>
                          <td className="py-4 px-5 text-sm font-semibold text-gray-700">
                            {w.role}
                          </td>
                          <td className="py-4 px-5 text-sm text-gray-500 font-mono">
                            {w.email || '-'}
                          </td>
                          <td className="py-4 px-5 text-center">
                            <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentDisplayWinner(isSelected ? null : w);
                                }}
                                className={`p-2 rounded-xl border transition-all ${
                                  isSelected 
                                    ? 'bg-green-600 border-green-600 text-white shadow-sm' 
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                }`}
                                title="ดูประวัติการโทร"
                              >
                                <Phone className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Call Logs Row */}
                        {isSelected && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50/50 p-6 border-t border-b border-gray-150">
                              <div className="max-w-6xl mx-auto space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-2">
                                  <h4 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
                                    <Phone className="w-4 h-4 text-green-600 animate-pulse" />
                                    ประวัติการโทรของ {w.firstName} {w.lastName} (สุ่มตรวจประวัติรายวัน)
                                  </h4>
                                  {!loadingCallHistory && winnerCallHistory.length > 0 && (
                                    <button
                                      onClick={() => randomizeAuditPeriod(winnerCallHistory)}
                                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                                    >
                                      <Shuffle className="w-3.5 h-3.5" /> สุ่มวันที่/สายใหม่
                                    </button>
                                  )}
                                </div>

                                {auditPeriod && (
                                  <div className="bg-green-50/70 border border-green-150 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                                        <Calendar className="w-5 h-5" />
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 font-medium">วันที่สุ่มตรวจสอบ</p>
                                        <p className="text-sm font-bold text-gray-850">
                                          วันที่ {auditPeriod.date}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right sm:text-right">
                                      <span className="inline-block bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-extrabold">
                                        สุ่ม {auditPeriod.calls.length} สาย (จากทั้งหมด {auditPeriod.totalCallsOnDate} สายในวันนี้)
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {loadingCallHistory ? (
                                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-6">
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-600 border-t-transparent" />
                                    <span>กำลังโหลดข้อมูล...</span>
                                  </div>
                                ) : auditPeriod && auditPeriod.calls.length > 0 ? (
                                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="border-b border-gray-150 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                          <th className="py-2.5 px-4 whitespace-nowrap">ลูกค้า (Customer ID)</th>
                                          <th className="py-2.5 px-4 whitespace-nowrap">ชื่อลูกค้า</th>
                                          <th className="py-2.5 px-4 whitespace-nowrap">เบอร์โทร</th>
                                          <th className="py-2.5 px-4 whitespace-nowrap">วันเวลาที่โทร</th>
                                          <th className="py-2.5 px-4 whitespace-nowrap">ระยะเวลา</th>
                                          <th className="py-2.5 px-4">บันทึก / ผลลัพธ์</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {auditPeriod.calls.map((call, cIdx) => {
                                          const callDuration = call.duration 
                                            ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` 
                                            : '-';
                                          const custName = call.customer_first_name 
                                            ? `${call.customer_first_name} ${call.customer_last_name || ''}`.trim() 
                                            : '-';
                                          const custPhone = call.customer_phone || '-';
                                          return (
                                            <tr key={call.id || cIdx} className="hover:bg-gray-50/40 transition-colors">
                                              <td className="py-3 px-4 font-bold text-gray-800 whitespace-nowrap">
                                                ID: {call.customer_id || '-'}
                                              </td>
                                              <td className="py-3 px-4 text-gray-700 font-semibold whitespace-nowrap">
                                                {custName}
                                              </td>
                                              <td className="py-3 px-4 text-gray-500 font-mono whitespace-nowrap">
                                                {custPhone}
                                              </td>
                                              <td className="py-3 px-4 text-gray-500 font-mono whitespace-nowrap">
                                                {new Date(call.date).toLocaleString('th-TH', { 
                                                  hour: '2-digit', 
                                                  minute: '2-digit', 
                                                  day: '2-digit', 
                                                  month: '2-digit', 
                                                  year: 'numeric' 
                                                })}
                                              </td>
                                              <td className="py-3 px-4 text-gray-700 font-medium whitespace-nowrap">
                                                {callDuration}
                                              </td>
                                              <td className="py-3 px-4 text-gray-600 max-w-sm truncate" title={call.notes || call.result || '-'}>
                                                {call.notes || call.result || '-'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 py-6 italic text-center bg-white rounded-xl border border-gray-150">
                                    ไม่มีประวัติการโทรในช่วงเวลาดังกล่าว
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Shuffler Interface (Idle or Shuffling State) */
          <div className="bg-gradient-to-br from-green-800 to-emerald-950 rounded-2xl shadow-md p-8 text-white relative overflow-hidden flex flex-col items-center justify-center min-h-[500px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
            
            {isDrawing ? (
              /* Drawing/Shuffling State */
              <div className="text-center space-y-4">
                <p className="text-green-300 font-medium uppercase tracking-widest text-sm animate-pulse">กำลังสุ่มพนักงาน...</p>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-sm min-h-[60px] animate-bounce">
                  {shufflingName}
                </h1>
                <div className="flex justify-center mt-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-white" />
                </div>
              </div>
            ) : (
              /* Idle / Ready to Draw State */
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-white/15 flex items-center justify-center mx-auto border border-white/10 shadow-sm animate-bounce">
                  <Shuffle className="w-8 h-8 text-green-300" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight">พร้อมสำหรับการสุ่ม!</h3>
                  <p className="text-green-200 text-sm max-w-sm mx-auto">คลิกปุ่มด้านล่างเพื่อสุ่มรายชื่อพนักงานในระบบตามเงื่อนไขตัวกรองที่คุณกำหนดไว้</p>
                </div>
                <button
                  onClick={handleStartDraw}
                  disabled={candidatePool.length === 0}
                  className="px-8 py-4 bg-white text-green-950 font-black text-base rounded-2xl shadow-lg hover:bg-green-50 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center gap-2 mx-auto"
                >
                  <Shuffle className="w-5 h-5" /> เริ่มสุ่มพนักงาน
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RandomEmployeePage;
