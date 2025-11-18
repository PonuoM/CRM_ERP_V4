import React, { useState, useEffect } from "react";
import { User as UserIcon, Search, Calendar } from "lucide-react";
import { User } from "@/types";
import OnecallLoginSidebar from "@/components/common/OnecallLoginSidebar";

interface CallDetailsPageProps {
  currentUser: User;
}

interface EmployeeCallData {
  user_id: number;
  first_name: string;
  role: string;
  phone: string;
  working_days: number;
  total_minutes: number;
  connected_calls: number;
  total_calls: number;
  minutes_per_workday: number;
}

const CallDetailsPage: React.FC<CallDetailsPageProps> = ({ currentUser }) => {
  const [employeeCallData, setEmployeeCallData] = useState<EmployeeCallData[]>(
    [],
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM format
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Function to fetch employee call data
  const fetchEmployeeCallData = async () => {
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split("-");
      // Determine company id from prop or session fallback
      const companyId = (() => {
        if (currentUser && typeof (currentUser as any).companyId === "number") {
          return (currentUser as any).companyId as number;
        }
        try {
          const s = localStorage.getItem("sessionUser");
          if (s) {
            const su = JSON.parse(s);
            if (su && typeof su.company_id === "number") return su.company_id as number;
          }
        } catch {}
        return undefined as number | undefined;
      })();

      const companyQs = companyId != null ? `&companyId=${encodeURIComponent(String(companyId))}` : "";
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/Onecall_DB/get_call_overview.php?month=${selectedMonth}${companyQs}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setEmployeeCallData(data || []);
      } else {
        console.error("Failed to fetch employee call data");
        setEmployeeCallData([]);
      }
    } catch (error) {
      console.error("Error fetching employee call data:", error);
      setEmployeeCallData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load employee call data when component mounts or month changes
  useEffect(() => {
    fetchEmployeeCallData();
  }, [selectedMonth]);

  // Filter employees based on search term
  const filteredEmployees = employeeCallData.filter(
    (employee) =>
      employee.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.phone.includes(searchTerm),
  );

  return (
    <>
      <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
        <div className="w-full">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
                รายละเอียดการโทร
              </h1>
            </div>
            <p className="text-gray-600 ml-11">
              ข้อมูลการโทรของพนักงาน Telesale และ Super Telesale
            </p>
          </div>

          {/* Filter Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">
                  เดือน:
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  onClick={fetchEmployeeCallData}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {isLoading ? "กำลังโหลด..." : "ดึงข้อมูล"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, ตำแหน่ง หรือเบอร์โทร"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
                />
              </div>
            </div>
          </div>

          {/* Employee Call Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      รายชื่อพนักงาน
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      ตำแหน่ง
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      เบอร์โทร
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      วันที่ทำงาน
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      เวลาโทร (นาที)
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      สายที่ได้คุย
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      โทรทั้งหมด
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      เวลาโทร/วัน (นาที)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                          <p className="text-gray-500 text-sm font-medium">
                            กำลังโหลดข้อมูล...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map((employee) => (
                          <tr
                            key={employee.user_id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                              {employee.first_name}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {employee.role}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {employee.phone}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {employee.working_days}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {employee.total_minutes}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {employee.connected_calls}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {employee.total_calls}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {employee.minutes_per_workday}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-12 text-center">
                            <div className="flex flex-col items-center">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <UserIcon className="w-6 h-6 text-gray-400" />
                              </div>
                              <p className="text-gray-500 text-sm font-medium">
                                ไม่พบข้อมูล
                              </p>
                              <p className="text-gray-400 text-xs mt-1">
                                {searchTerm
                                  ? "ลองปรับเปลี่ยนคำค้นหา"
                                  : 'ลองเลือกเดือนอื่นหรือกดปุ่ม "ดึงข้อมูล" เพื่อโหลดข้อมูลใหม่'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Onecall Login Sidebar Component */}
      <OnecallLoginSidebar
        currentUser={currentUser}
        onLogin={(username, password) => {
          console.log("Onecall login successful in CallDetailsPage:", {
            username: username,
            password: "***",
          });
          // You can add additional logic here after successful login
          // For example, store the token, update state, etc.
          alert("เข้าสู่ระบบ Onecall สำเร็จ");
        }}
      />
    </>
  );
};

export default CallDetailsPage;
