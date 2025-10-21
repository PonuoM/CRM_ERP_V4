import React, { useState } from 'react';
import { Customer, Order, CallHistory, Appointment, ModalType, User, Tag, Activity, ActivityType, TagType } from '../types';
// FIX: Add 'X', 'Repeat', 'Paperclip' icons to the import from 'lucide-react'.
import { ArrowLeft, Phone, Edit, MessageSquare, ShoppingCart, Check, Flame, Tag as TagIcon, Plus, Calendar, List, Truck, Briefcase, Facebook, MoreHorizontal, UserCheck, BarChart, XCircle, X, ChevronLeft, ChevronRight, Repeat, Paperclip } from 'lucide-react';
import { getStatusChip, getPaymentStatusChip } from '../components/OrderTable';

interface CustomerDetailPageProps {
  customer: Customer;
  orders: Order[];
  callHistory: CallHistory[];
  appointments: Appointment[];
  activities: Activity[];
  user: User;
  systemTags: Tag[];
  onClose: () => void;
  openModal: (type: ModalType, data?: any) => void;
  onAddTag: (customerId: string, tag: Tag) => void;
  onRemoveTag: (customerId: string, tagId: number) => void;
  onCreateUserTag: (tagName: string) => Tag | null;
  onCompleteAppointment?: (appointmentId: number) => void;
  setActivePage?: (page: string) => void;
}

type ActiveTab = 'calls' | 'appointments' | 'orders';

const InfoItem: React.FC<{ label: string; value?: string | number; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p className="text-xs text-gray-500">{label}</p>
        {value ? <p className="text-sm font-medium text-gray-800 truncate">{value}</p> : children}
    </div>
);

const CustomerDetailPage: React.FC<CustomerDetailPageProps> = (props) => {
    const { customer, orders, callHistory, appointments, activities, user, systemTags, onClose, openModal, onAddTag, onRemoveTag, onCreateUserTag, setActivePage } = props;
    const [activeTab, setActiveTab] = useState<ActiveTab>('calls');
    const [newTagName, setNewTagName] = useState('');

    const [callHistoryPage, setCallHistoryPage] = useState(1);
    const [appointmentsPage, setAppointmentsPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    const getRemainingTime = (expiryDate: string) => {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diff = expiry.getTime() - now.getTime();
        if (diff <= 0) return { text: 'หมดอายุ', color: 'text-red-500' };
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return { text: `${days} วัน`, color: days < 7 ? 'text-orange-500' : 'text-gray-600' };
    };

    const formatAddress = (address: Customer['address']) => {
        if (!address || !address.street) return '-';
        return `${address.street}, ต.${address.subdistrict}, อ.${address.district}, จ.${address.province} ${address.postalCode}`;
    }

    const sortedActivities = activities.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleAddTag = () => {
        if (!newTagName.trim()) return;
        
        if (customer.tags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
            setNewTagName('');
            return;
        }

        const allAvailableTags = [...systemTags, ...user.customTags];
        const existingTag = allAvailableTags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase());

        if (existingTag) {
            onAddTag(customer.id, existingTag);
        } else {
            const newTag = onCreateUserTag(newTagName.trim());
            if (newTag) {
                onAddTag(customer.id, newTag);
            }
        }
        setNewTagName('');
    }
    
    const getRelativeTime = (timestamp: string) => {
        const now = new Date();
        const past = new Date(timestamp);
        const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

        if (diffInSeconds < 60) return `${diffInSeconds} วินาทีที่แล้ว`;
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} ชั่วโมงที่แล้ว`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} วันที่แล้ว`;
    };
    
    // FIX: activityIconMap is missing some properties from ActivityType and has an incorrect one.
    const activityIconMap: Record<ActivityType, React.ElementType> = {
        [ActivityType.Assignment]: UserCheck,
        [ActivityType.GradeChange]: BarChart,
        [ActivityType.StatusChange]: Flame,
        [ActivityType.OrderCreated]: ShoppingCart,
        [ActivityType.AppointmentSet]: Calendar,
        [ActivityType.CallLogged]: Phone,
        [ActivityType.OrderCancelled]: XCircle,
        [ActivityType.TrackingAdded]: Truck,
        [ActivityType.PaymentVerified]: Check,
        [ActivityType.OrderStatusChanged]: Repeat,
        [ActivityType.OrderNoteAdded]: Paperclip,
    };

    const ActivityIcon = ({type}: {type: ActivityType}) => {
        const Icon = activityIconMap[type] || MoreHorizontal;
        return <Icon className="w-4 h-4 text-gray-500" />
    }

    const Paginator: React.FC<{currentPage: number, totalPages: number, onPageChange: (page: number) => void}> = ({currentPage, totalPages, onPageChange}) => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex justify-end items-center mt-4 text-xs">
                <span className="text-gray-600">หน้า {currentPage} / {totalPages}</span>
                <div className="flex ml-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 border bg-white rounded-l-md disabled:opacity-50 hover:bg-gray-50"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 border bg-white rounded-r-md disabled:opacity-50 hover:bg-gray-50"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        )
    };
    
    const totalCallPages = Math.ceil(callHistory.length / ITEMS_PER_PAGE);
    const paginatedCallHistory = callHistory.slice((callHistoryPage - 1) * ITEMS_PER_PAGE, callHistoryPage * ITEMS_PER_PAGE);
    
    const totalAppointmentPages = Math.ceil(appointments.length / ITEMS_PER_PAGE);
    const paginatedAppointments = appointments.slice((appointmentsPage - 1) * ITEMS_PER_PAGE, appointmentsPage * ITEMS_PER_PAGE);
    
    const totalOrderPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
    const paginatedOrders = orders.slice((ordersPage - 1) * ITEMS_PER_PAGE, ordersPage * ITEMS_PER_PAGE);

    // Filter appointments to show only future follow-ups that are not completed
    const upcomingFollowUps = appointments.filter(appointment => {
        const appointmentDate = new Date(appointment.date);
        const now = new Date();
        return appointmentDate > now && appointment.status !== 'เสร็จสิ้น';
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="p-6 bg-gray-50 min-h-full">
            <header className="flex justify-between items-center mb-6">
                <button onClick={onClose} className="flex items-center text-gray-600 hover:text-gray-900">
                    <ArrowLeft size={20} className="mr-2"/>
                    <span className="font-semibold text-lg">กลับ</span>
                </button>
                <div className="flex items-center space-x-2">
                    <button onClick={() => openModal('logCall', customer)} className="bg-green-100 text-green-700 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-green-200"><Phone size={16} className="mr-2"/>บันทึกการโทร</button>
                    <button onClick={() => openModal('addAppointment', customer)} className="bg-cyan-100 text-cyan-700 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-cyan-200"><Calendar size={16} className="mr-2"/>นัดหมาย</button>
                    <button onClick={() => setActivePage ? setActivePage('สร้างคำสั่งซื้อ') : openModal('createOrder', { customer })} className="bg-amber-100 text-amber-700 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-amber-200"><ShoppingCart size={16} className="mr-2"/>สร้างคำสั่งซื้อ</button>
                    <button onClick={() => openModal('editCustomer', customer)} className="bg-slate-700 text-white py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center hover:bg-slate-800"><Edit size={16} className="mr-2"/>แก้ไข</button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <div className="flex justify-between items-start">
                             <h2 className="text-xl font-bold text-gray-800 mb-4">ข้อมูลลูกค้า</h2>
                             {customer.behavioralStatus === 'Hot' && <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center"><Flame size={14} className="mr-1.5"/>Hot</span>}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                            <InfoItem label="รหัสลูกค้า" value={customer.id} />
                            <InfoItem label="ชื่อ-นามสกุล" value={`${customer.firstName} ${customer.lastName}`} />
                            <InfoItem label="เบอร์โทร" value={customer.phone} />
                            <InfoItem label="อีเมล" value={customer.email || '-'} />
                             <InfoItem label="Facebook">
                                <div className="flex items-center space-x-2">
                                    <Facebook size={16} className="text-blue-600" />
                                    <p className="text-sm font-medium text-gray-800">{customer.facebookName || '-'}</p>
                                </div>
                            </InfoItem>
                            <InfoItem label="LINE ID">
                                <div className="flex items-center space-x-2">
                                    <MessageSquare size={16} className="text-green-500" />
                                    <p className="text-sm font-medium text-gray-800">{customer.lineId || '-'}</p>
                                </div>
                            </InfoItem>
                            <InfoItem label="ที่อยู่" value={formatAddress(customer.address)} />
                            <InfoItem label="จังหวัด" value={customer.province} />
                            <div className="md:col-span-3 border-t my-2"></div>
                            <InfoItem label="เกรดลูกค้า" value={customer.grade} />
                            <InfoItem label="ยอดซื้อรวม" value={`฿${customer.totalPurchases.toLocaleString()}`} />
                            <InfoItem label="จำนวนครั้งที่ซื้อ" value={`${orders.length} ครั้ง`} />
                            <InfoItem label="จำนวนครั้งที่ติดต่อ" value={`${customer.totalCalls} ครั้ง`} />
                            <InfoItem label="ผู้ดูแล">
                                <div className="flex items-center">
                                    <span className="text-sm font-medium text-gray-800 mr-2">{`${user.firstName} ${user.lastName}`}</span>
                                    <button className="text-xs text-blue-600 hover:underline">(เปลี่ยนผู้ดูแล)</button>
                                </div>
                            </InfoItem>
                            <InfoItem label="วันที่ลงทะเบียน" value={customer.dateRegistered ? new Date(customer.dateRegistered).toLocaleString('th-TH') : '-'} />
                            <InfoItem label="ติดตามถัดไป">
                                {upcomingFollowUps.length > 0 ? (
                                    <span className="font-semibold text-red-600 px-2 py-1 bg-red-50 rounded-md">
                                        {new Date(upcomingFollowUps[0].date).toLocaleString('th-TH')}
                                    </span>
                                ) : '-'}
                            </InfoItem>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border">
                        <div className="border-b px-4">
                            <nav className="flex space-x-4 -mb-px">
                                <button onClick={() => setActiveTab('calls')} className={`py-3 px-1 text-sm font-medium ${activeTab === 'calls' ? 'border-b-2 border-green-600 text-green-600' : 'border-transparent text-gray-600 hover:text-gray-700'}`}><Phone size={16} className="inline mr-2"/>ประวัติการโทร</button>
                                <button onClick={() => setActiveTab('appointments')} className={`py-3 px-1 text-sm font-medium ${activeTab === 'appointments' ? 'border-b-2 border-green-600 text-green-600' : 'border-transparent text-gray-600 hover:text-gray-700'}`}><Calendar size={16} className="inline mr-2"/>รายการนัดหมาย</button>
                                <button onClick={() => setActiveTab('orders')} className={`py-3 px-1 text-sm font-medium ${activeTab === 'orders' ? 'border-b-2 border-green-600 text-green-600' : 'border-transparent text-gray-600 hover:text-gray-700'}`}><ShoppingCart size={16} className="inline mr-2"/>ประวัติคำสั่งซื้อ</button>
                            </nav>
                        </div>
                        <div className="p-4">
                            <div className="overflow-x-auto">
                                {activeTab === 'calls' && (
                                    <>
                                        <table className="w-full text-xs text-left">
                                            <thead className="text-gray-500"><tr><th className="py-2 px-2">วันที่</th><th className="py-2 px-2">ผู้โทร</th><th className="py-2 px-2">สถานะ</th><th className="py-2 px-2">ผลการโทร</th><th className="py-2 px-2">พืช/พันธุ์</th><th className="py-2 px-2">ขนาดสวน</th><th className="py-2 px-2">หมายเหตุ</th></tr></thead>
                                            <tbody className="text-gray-700">{paginatedCallHistory.map(c => (<tr key={c.id} className="border-b last:border-0"><td className="py-2 px-2">{new Date(c.date).toLocaleString('th-TH')}</td><td className="py-2 px-2">{c.caller}</td><td className="py-2 px-2"><span className={`px-2 py-0.5 rounded-full ${c.status === 'รับสาย' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span></td><td className="py-2 px-2">{c.result}</td><td className="py-2 px-2">{c.cropType || '-'}</td><td className="py-2 px-2">{c.areaSize || '-'}</td><td className="py-2 px-2">{c.notes || '-'}</td></tr>))}</tbody>
                                        </table>
                                        <Paginator currentPage={callHistoryPage} totalPages={totalCallPages} onPageChange={setCallHistoryPage} />
                                    </>
                                )}
                                {activeTab === 'appointments' && (
                                    <>
                                        <table className="w-full text-xs text-left">
                                            <thead className="text-gray-500"><tr><th className="py-2 px-2">วันที่นัดหมาย</th><th className="py-2 px-2">หัวข้อ</th><th className="py-2 px-2">สถานะ</th><th className="py-2 px-2">หมายเหตุ</th><th className="py-2 px-2">การดำเนินการ</th></tr></thead>
                                            <tbody className="text-gray-700">{paginatedAppointments.map(a => (<tr key={a.id} className="border-b last:border-0"><td className="py-2 px-2">{new Date(a.date).toLocaleString('th-TH')}</td><td className="py-2 px-2">{a.title}</td><td className="py-2 px-2"><span className={`px-2 py-0.5 rounded-full ${a.status === 'เสร็จสิ้น' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status}</span></td><td className="py-2 px-2">{a.notes || '-'}</td><td className="py-2 px-2">{a.status === 'เสร็จสิ้น' ? <Check size={16} className="text-green-600 inline mr-2" /> : props.onCompleteAppointment && (<button onClick={() => props.onCompleteAppointment!(a.id)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">ทำเครื่องหมายเสร็จ</button>)}</td></tr>))}</tbody>
                                        </table>
                                        <Paginator currentPage={appointmentsPage} totalPages={totalAppointmentPages} onPageChange={setAppointmentsPage} />
                                    </>
                                )}
                                 {activeTab === 'orders' && (
                                    <>
                                        <table className="w-full text-xs text-left">
                                            <thead className="text-gray-500"><tr><th className="py-2 px-2">OrderID</th><th className="py-2 px-2">วันที่สั่ง</th><th className="py-2 px-2">ยอดรวม</th><th className="py-2 px-2">ชำระเงิน</th><th className="py-2 px-2">สถานะ</th></tr></thead>
                                            <tbody className="text-gray-700">{paginatedOrders.map(o => (<tr key={o.id} className="border-b last:border-0"><td className="py-2 px-2 font-mono">{o.id}</td><td className="py-2 px-2">{new Date(o.orderDate).toLocaleDateString('th-TH')}</td><td className="py-2 px-2">฿{o.totalAmount.toLocaleString()}</td><td className="py-2 px-2">{getPaymentStatusChip(o.paymentStatus, o.paymentMethod)}</td><td className="py-2 px-2">{getStatusChip(o.orderStatus)}</td></tr>))}</tbody>
                                        </table>
                                        <Paginator currentPage={ordersPage} totalPages={totalOrderPages} onPageChange={setOrdersPage} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border">
                        <h3 className="font-semibold mb-4 text-gray-700">สถิติสรุป</h3>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div><p className="text-2xl font-bold text-blue-600">{orders.length}</p><p className="text-xs text-gray-500">คำสั่งซื้อ</p></div>
                            <div><p className="text-2xl font-bold text-blue-600">฿{customer.totalPurchases.toLocaleString()}</p><p className="text-xs text-gray-500">ยอดซื้อรวม</p></div>
                            <div><p className="text-2xl font-bold text-blue-600">{customer.totalCalls}</p><p className="text-xs text-gray-500">การโทร</p></div>
                            <div><p className="text-2xl font-bold text-blue-600">{appointments.length}</p><p className="text-xs text-gray-500">นัดหมาย</p></div>
                            <div><p className="text-2xl font-bold text-blue-600">{activities.length}</p><p className="text-xs text-gray-500">กิจกรรม</p></div>
                            <div><p className={`text-2xl font-bold ${getRemainingTime(customer.ownershipExpires).color}`}>{getRemainingTime(customer.ownershipExpires).text}</p><p className="text-xs text-gray-500">เวลาคงเหลือ</p></div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <h3 className="font-semibold mb-2 text-gray-700">TAG</h3>
                        <div className="flex flex-wrap gap-2 mb-2 min-h-[24px]">
                            {customer.tags.map(tag => (
                                <span key={tag.id} className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${tag.type === TagType.System ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                    {tag.name}
                                    <button onClick={() => onRemoveTag(customer.id, tag.id)} className="ml-1.5 opacity-70 hover:opacity-100"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex space-x-2">
                             <input value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} type="text" placeholder="เพิ่ม Tag ใหม่..." className="flex-grow border rounded-md px-2 py-1 text-sm w-full"/>
                             <button onClick={handleAddTag} className="bg-gray-800 text-white px-3 rounded-md text-sm font-semibold hover:bg-gray-900"><Plus size={16}/></button>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border">
                        <h3 className="font-semibold mb-2 text-gray-700">กิจกรรมล่าสุด</h3>
                        <div className="space-y-4">
                            {sortedActivities.slice(0, 5).map(activity => (
                                <div key={activity.id} className="flex">
                                    <div className="flex-shrink-0 w-8 text-center">
                                        <div className="mx-auto w-px h-6 bg-gray-200"></div>
                                        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                                            <ActivityIcon type={activity.type}/>
                                        </div>
                                    </div>
                                    <div className="ml-2">
                                        <p className="text-xs text-gray-700">{activity.description}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{activity.actorName} • {getRelativeTime(activity.timestamp)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {activities.length > 5 && (
                             <div className="mt-4 text-center">
                                <button onClick={() => openModal('viewAllActivities', customer)} className="text-xs text-blue-600 font-semibold hover:underline">ดูเพิ่มเติม</button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CustomerDetailPage;
