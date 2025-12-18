import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Customer, Order, ModalType } from '@/types';
import CustomerTable from '@/components/CustomerTable';
import { getCustomerStats, getOrderStats, listCustomers } from '@/services/api';
import { mapCustomerFromApi } from '@/utils/customerMapper';
import Spinner from '@/components/Spinner';

type OrdersFilterValue = 'all' | 'yes' | 'no';
type DateRangeFilter = { start: string; end: string };

interface ManageCustomersPageProps {
  allUsers: User[];
  allCustomers: Customer[];
  allOrders: Order[];
  currentUser: User;
  onTakeCustomer?: (customer: Customer) => void;
  openModal?: (type: ModalType, data: any) => void;
  onViewCustomer?: (customer: Customer) => void;
  onUpsellClick?: (customer: Customer) => void;
  onChangeOwner?: (customerId: string, newOwnerId: number) => Promise<void> | void;
}

const ManageCustomersPage: React.FC<ManageCustomersPageProps> = ({
  allUsers,
  allCustomers,
  allOrders,
  currentUser,
  onTakeCustomer,
  openModal,
  onViewCustomer,
  onUpsellClick,
  onChangeOwner,
}) => {
  const [selectedUser, setSelectedUser] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  // Legacy pagination state (kept for hidden legacy table markup)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // API Stats State
  const [apiCustomerStats, setApiCustomerStats] = useState<any>(null);
  const [apiOrderStats, setApiOrderStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Server-side Pagination State
  const [fetchedCustomers, setFetchedCustomers] = useState<Customer[]>([]);
  const [totalCustomersInDB, setTotalCustomersInDB] = useState<number>(0);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(false);

  useEffect(() => {
    const fetchApiStats = async () => {
      if (!currentUser?.companyId) return;
      setLoadingStats(true);
      try {
        const [cRes, oRes] = await Promise.all([
          getCustomerStats(currentUser.companyId),
          getOrderStats(currentUser.companyId)
        ]);
        if (cRes?.ok) setApiCustomerStats(cRes.stats);
        if (oRes?.ok) setApiOrderStats(oRes.stats);
      } catch (error) {
        console.error("Failed to fetch page stats", error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchApiStats();
  }, [currentUser.companyId]);

  // ... (existing state for filters: fName, fPhone, etc.)
  const [fName, setFName] = useState<string>('');
  const [fPhone, setFPhone] = useState<string>('');
  const [fProvince, setFProvince] = useState<string>('');
  const [fLifecycle, setFLifecycle] = useState<string>('');
  const [fBehavioral, setFBehavioral] = useState<string>('');
  const [fGrade, setFGrade] = useState<string>('');
  const [fHasOrders, setFHasOrders] = useState<OrdersFilterValue>('all');
  const [fDateAssigned, setFDateAssigned] = useState<DateRangeFilter>({ start: '', end: '' });
  const [fOwnership, setFOwnership] = useState<DateRangeFilter>({ start: '', end: '' });
  const [apSelectedUser, setApSelectedUser] = useState<number | 'all'>('all');
  const [apName, setApName] = useState<string>('');
  const [apPhone, setApPhone] = useState<string>('');
  const [apProvince, setApProvince] = useState<string>('');
  const [apLifecycle, setApLifecycle] = useState<string>('');
  const [apBehavioral, setApBehavioral] = useState<string>('');
  const [apGrade, setApGrade] = useState<string>('');
  const [apHasOrders, setApHasOrders] = useState<OrdersFilterValue>('all');
  const [apDateAssigned, setApDateAssigned] = useState<DateRangeFilter>({ start: '', end: '' });
  const [apOwnership, setApOwnership] = useState<DateRangeFilter>({ start: '', end: '' });
  const advRef = useRef<HTMLDivElement | null>(null);

  // Helper: resolve user name by id (handles null/unknown)
  const resolveUserName = (userId: number | null) => {
    if (userId === null || typeof userId === 'undefined') return 'Unassigned';
    const user = allUsers.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'Unknown';
  };

  // Get user name by ID
  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'ไม่มีผู้ดูแล';
  };

  // Filter customers based on selected user and search term
  const filteredCustomers = useMemo(() => {
    let customers = allCustomers;

    // Filter by user
    if (selectedUser !== 'all') {
      customers = customers.filter(customer => customer.assignedTo === selectedUser);
    }

    // Filter by search term
    if (searchTerm) {
      customers = customers.filter(customer =>
        customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm)
      );
    }

    return customers;
  }, [allCustomers, selectedUser, searchTerm]);

  // Server-side Fetch
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const res = await listCustomers({
          companyId: currentUser.companyId,
          page: currentPage,
          pageSize: itemsPerPage,
          q: searchTerm,
          assignedTo: selectedUser !== 'all' ? selectedUser : undefined,
          province: apProvince || undefined,
          lifecycle: apLifecycle || undefined,
          behavioral: apBehavioral || undefined,
          // Note: apDateAssigned / apOwnership logic can be added here if backend supports it
        });

        // Handle result (normalized to { total, data })
        const total = res.total || 0;
        const data = res.data || [];

        setTotalCustomersInDB(total);
        setFetchedCustomers(data.map(r => mapCustomerFromApi(r)));
      } catch (err) {
        console.error("Failed to fetch customers", err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    // Debounce search slightly or just fetch
    const timeout = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timeout);
  }, [
    currentUser.companyId,
    currentPage,
    itemsPerPage,
    searchTerm,
    selectedUser,
    apProvince,
    apLifecycle,
    apBehavioral,
    // Trigger on advanced search application
    apSelectedUser,
    apName, // redundant with searchTerm if mapped?
  ]);

  // Use fetched customers for display
  // const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const totalPages = Math.ceil(totalCustomersInDB / itemsPerPage);
  const paginatedCustomers = fetchedCustomers; // Already paginated from API

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ข้อมูลลูกค้า</h1>
        <p className="text-gray-600">ดูข้อมูลลูกค้าทั้งหมดในบริษัทและข้อมูล DO Dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ลูกค้าทั้งหมด</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loadingStats ? <Spinner size="sm" /> : (apiCustomerStats?.totalCustomers?.toLocaleString() || allCustomers.length.toLocaleString())}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ยอดขายรวม</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loadingStats ? <Spinner size="sm" /> : `฿${(apiOrderStats?.totalRevenue || 0).toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ออเดอร์ทั้งหมด</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loadingStats ? <Spinner size="sm" /> : (apiOrderStats?.totalOrders || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ผลการค้นหา</p>
              <p className="text-2xl font-semibold text-gray-900">{loadingCustomers ? <Spinner size="sm" /> : totalCustomersInDB.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div
        className="bg-white p-4 rounded-lg shadow-sm border mb-6"
        ref={advRef}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50"
          >
            Advanced Filters
            {(() => {
              const count =
                [
                  apName,
                  apPhone,
                  apProvince,
                  apLifecycle,
                  apBehavioral,
                  apGrade,
                  apHasOrders !== "all" ? "x" : "",
                  apDateAssigned.start,
                  apDateAssigned.end,
                  apOwnership.start,
                  apOwnership.end,
                ].filter((v) => !!v && String(v).trim() !== "").length +
                (apSelectedUser !== "all" ? 1 : 0);
              return count > 0 ? (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px]">
                  {count}
                </span>
              ) : null;
            })()}
          </button>
          <button
            onClick={() => {
              setApSelectedUser(selectedUser);
              setApName(fName.trim());
              setApPhone(fPhone.trim());
              setApProvince(fProvince.trim());
              setApLifecycle(fLifecycle);
              setApBehavioral(fBehavioral);
              setApGrade(fGrade);
              setApHasOrders(fHasOrders);
              setApDateAssigned({ ...fDateAssigned });
              setApOwnership({ ...fOwnership });
              setShowAdvanced(false);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            ค้นหา
          </button>
          {(apSelectedUser !== "all" ||
            apName ||
            apPhone ||
            apProvince ||
            apLifecycle ||
            apBehavioral ||
            apGrade ||
            apHasOrders !== "all" ||
            apDateAssigned.start ||
            apDateAssigned.end ||
            apOwnership.start ||
            apOwnership.end) && (
              <button
                onClick={() => {
                  setSelectedUser("all");
                  setFName("");
                  setFPhone("");
                  setFProvince("");
                  setFLifecycle("");
                  setFBehavioral("");
                  setFGrade("");
                  setFHasOrders("all");
                  setFDateAssigned({ start: "", end: "" });
                  setFOwnership({ start: "", end: "" });
                  setApSelectedUser("all");
                  setApName("");
                  setApPhone("");
                  setApProvince("");
                  setApLifecycle("");
                  setApBehavioral("");
                  setApGrade("");
                  setApHasOrders("all");
                  setApDateAssigned({ start: "", end: "" });
                  setApOwnership({ start: "", end: "" });
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50 text-gray-600"
              >
                ล้างตัวกรอง
              </button>
            )}
        </div>
        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                ผู้รับผิดชอบ
              </label>
              <select
                value={selectedUser}
                onChange={(e) =>
                  setSelectedUser(
                    e.target.value === "all" ? "all" : Number(e.target.value),
                  )
                }
                className="w-full p-2 border rounded"
              >
                <option value="all">ทั้งหมด</option>
                {allUsers
                  .filter(
                    (u) =>
                      u.role === "Telesale" ||
                      String(u.role).includes("Supervisor"),
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                ชื่อลูกค้า
              </label>
              <input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="ชื่อหรือนามสกุล"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                เบอร์โทร
              </label>
              <input
                value={fPhone}
                onChange={(e) => setFPhone(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="เช่น 0812345678"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                จังหวัด
              </label>
              <input
                value={fProvince}
                onChange={(e) => setFProvince(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="เช่น กรุงเทพมหานคร"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Lifecycle
              </label>
              <select
                value={fLifecycle}
                onChange={(e) => setFLifecycle(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">ทั้งหมด</option>
                <option value="New">New</option>
                <option value="Old">Old</option>
                <option value="FollowUp">FollowUp</option>
                <option value="Old3Months">Old3Months</option>
                <option value="DailyDistribution">DailyDistribution</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Behavioral
              </label>
              <select
                value={fBehavioral}
                onChange={(e) => setFBehavioral(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">ทั้งหมด</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
                <option value="Frozen">Frozen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">เกรด</label>
              <select
                value={fGrade}
                onChange={(e) => setFGrade(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">ทั้งหมด</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                มีออเดอร์หรือไม่
              </label>
              <select
                value={fHasOrders}
                onChange={(e) => setFHasOrders(e.target.value as any)}
                className="w-full p-2 border rounded"
              >
                <option value="all">ทั้งหมด</option>
                <option value="yes">มีออเดอร์</option>
                <option value="no">ไม่มีออเดอร์</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                วันที่ได้รับมอบหมาย (เริ่ม)
              </label>
              <input
                type="date"
                value={fDateAssigned.start}
                onChange={(e) =>
                  setFDateAssigned((v) => ({ ...v, start: e.target.value }))
                }
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                วันที่ได้รับมอบหมาย (สิ้นสุด)
              </label>
              <input
                type="date"
                value={fDateAssigned.end}
                onChange={(e) =>
                  setFDateAssigned((v) => ({ ...v, end: e.target.value }))
                }
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                วันหมดอายุสิทธิ์ (เริ่ม)
              </label>
              <input
                type="date"
                value={fOwnership.start}
                onChange={(e) =>
                  setFOwnership((v) => ({ ...v, start: e.target.value }))
                }
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                วันหมดอายุสิทธิ์ (สิ้นสุด)
              </label>
              <input
                type="date"
                value={fOwnership.end}
                onChange={(e) =>
                  setFOwnership((v) => ({ ...v, end: e.target.value }))
                }
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">กรองตามผู้ดูแล:</label>
            <select
              value={selectedUser}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setSelectedUser(val);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทุกคน</option>
              {allUsers
                .filter(user => user.role === 'Telesale' || user.role === 'Supervisor')
                .map(user => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">ค้นหา:</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="ชื่อ นามสกุล หรือเบอร์โทร"
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
            />
          </div>

          <div className="flex items-center space-x-4 hidden">
            <label className="text-sm font-medium text-gray-700">แสดง:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5 รายการ</option>
              <option value={10}>10 รายการ</option>
              <option value={20}>20 รายการ</option>
              <option value={50}>50 รายการ</option>
              <option value={100}>100 รายการ</option>
              <option value={500}>500 รายการ</option>
            </select>
          </div>
        </div>
      </div>



      {/* Customers Table (shared with Telesale) */}
      <div className="relative">
        {loadingCustomers && (
          <div className="absolute inset-0 bg-white bg-opacity-50 z-10 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}
        <CustomerTable
          customers={paginatedCustomers}
          onViewCustomer={(c) => (onViewCustomer ? onViewCustomer(c) : setSelectedCustomer(c))}
          openModal={(type, data) => { if (openModal) openModal(type, data); }}
          pageSizeOptions={[5, 10, 20, 50, 100, 500]}
          storageKey={`manageCustomers:${currentUser.id}`}
          currentUserId={currentUser.id}
          onUpsellClick={(customer) => {
            if (onUpsellClick) {
              onUpsellClick(customer);
            }
          }}
          onChangeOwner={onChangeOwner}
          allUsers={allUsers}
          currentUser={currentUser}

          // Server-side Pagination
          totalCount={totalCustomersInDB}
          controlledPage={currentPage}
          controlledPageSize={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setItemsPerPage(size);
            setCurrentPage(1);
          }}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            รายชื่อลูกค้า {selectedUser !== 'all' && `(${resolveUserName(Number(selectedUser))})`}
          </h2>
          <div className="text-sm text-gray-500">
            แสดง {paginatedCustomers.length} จาก {filteredCustomers.length} รายการ
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ชื่อลูกค้า
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  เบอร์โทร
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จังหวัด
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ผู้ดูแล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ออเดอร์
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  การทำงาน
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCustomers.map((customer) => {
                const customerOrders = allOrders.filter(order => order.customerId === customer.id);
                const hasOrders = customerOrders.length > 0;

                return (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {customer.firstName} {customer.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{customer.province}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {getUserName(customer.assignedTo || '')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.lifecycleStatus === 'New'
                        ? 'bg-green-100 text-green-800'
                        : customer.lifecycleStatus === 'FollowUp'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                        {customer.lifecycleStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {hasOrders ? `${customerOrders.length} ออเดอร์` : 'ยังไม่มี'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        ดูเพิ่มเติม
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ถัดไป
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  แสดง <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> ถึ{' '}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredCustomers.length)}</span> จาก{' '}
                  <span className="font-medium">{filteredCustomers.length}</span> รายการ
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === pageNum
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail Modal (disabled to match Telesale fullpage) */}
      {false && selectedCustomer && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">ข้อมูลลูกค้า</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">ชื่อ-นามสกุล</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">เบอร์โทร</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">อีเมล</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">จังหวัด</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.province}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">ที่อยู่</p>
                  <p className="text-sm text-gray-900">
                    {selectedCustomer.address.street ? `${selectedCustomer.address.street}, ` : ''}
                    {selectedCustomer.address.subdistrict ? `${selectedCustomer.address.subdistrict}, ` : ''}
                    {selectedCustomer.address.district ? `${selectedCustomer.address.district}, ` : ''}
                    {selectedCustomer.address.subdistrict ? `${selectedCustomer.address.subdistrict}, ` : ''}
                    {selectedCustomer.address.postalCode ? `${selectedCustomer.address.postalCode}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">ผู้ดูแล</p>
                  <p className="text-sm text-gray-900">{resolveUserName(selectedCustomer.assignedTo ?? null)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">สถานะลูกค้า</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.lifecycleStatus}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">พฤติกรรม</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.behavioralStatus}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">เกรด</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.grade}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">วันที่สมัคร</p>
                  <p className="text-sm text-gray-900">
                    {selectedCustomer.dateRegistered
                      ? new Date(selectedCustomer.dateRegistered).toLocaleDateString('th-TH')
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">วันหมดอายุการดูแล</p>
                  <p className="text-sm text-gray-900">
                    {selectedCustomer.ownershipExpires
                      ? new Date(selectedCustomer.ownershipExpires).toLocaleDateString('th-TH')
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">นัดหมายถัดไป</p>
                  <p className="text-sm text-gray-900">
                    {selectedCustomer.followUpDate
                      ? new Date(selectedCustomer.followUpDate).toLocaleDateString('th-TH')
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Facebook</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.facebookName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Line ID</p>
                  <p className="text-sm text-gray-900">{selectedCustomer.lineId || '-'}</p>
                </div>
              </div>

              {/* Customer Orders */}
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">ประวัติการสั่งซื้อ</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          หมายเลขออเดอร์
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          วันที่สั่งซื้อ
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          จำนวนเงิน
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          สถานะ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allOrders
                        .filter(order => order.customerId === selectedCustomer.id)
                        .slice(0, 5) // Show only last 5 orders
                        .map(order => (
                          <tr key={order.id}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {order.id}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              {new Date(order.orderDate).toLocaleDateString('th-TH')}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                              ฿{order.totalAmount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.orderStatus === 'Delivered'
                                ? 'bg-green-100 text-green-800'
                                : order.orderStatus === 'Pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                                }`}>
                                {order.orderStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {allOrders.filter(order => order.customerId === selectedCustomer.id).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-center text-sm text-gray-500">
                            ไม่มีประวัติการสั่งซื้อ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCustomersPage;
