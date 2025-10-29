
import React, { useState } from 'react';
import { 
  Notification, 
  NotificationType, 
  NotificationCategory, 
  NotificationPriority,
  UserRole 
} from '../types';
import { 
  AlertCircle, 
  Clock, 
  FileCheck2, 
  ShoppingCart, 
  X, 
  Filter,
  ChevronDown,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  Facebook,
  Bell
} from 'lucide-react';

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onNotificationClick?: (notification: Notification) => void;
  currentUserRole?: UserRole;
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

const getPriorityColor = (priority: NotificationPriority) => {
  switch (priority) {
    case NotificationPriority.URGENT:
      return 'border-red-500 bg-red-50';
    case NotificationPriority.HIGH:
      return 'border-orange-500 bg-orange-50';
    case NotificationPriority.MEDIUM:
      return 'border-yellow-500 bg-yellow-50';
    case NotificationPriority.LOW:
      return 'border-blue-500 bg-blue-50';
    default:
      return 'border-gray-500 bg-gray-50';
  }
};

const NotificationIcon: React.FC<{ type: NotificationType; category?: NotificationCategory }> = ({ type, category }) => {
  // Page Performance notifications (Admin role)
  if (category === NotificationCategory.PAGE_PERFORMANCE) {
    switch (type) {
      case NotificationType.PageEngagementDrop:
        return <TrendingDown className="w-5 h-5 text-orange-500" />;
      case NotificationType.PageReachIncrease:
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case NotificationType.UnansweredMessages:
        return <MessageSquare className="w-5 h-5 text-red-500" />;
      case NotificationType.WeeklyPageReport:
        return <BarChart3 className="w-5 h-5 text-blue-500" />;
      default:
        return <Facebook className="w-5 h-5 text-blue-600" />;
    }
  }

  // Content Management notifications (Admin role)
  if (category === NotificationCategory.CONTENT_MANAGEMENT) {
    switch (type) {
      case NotificationType.HighPerformingPost:
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case NotificationType.LowPerformingPost:
        return <TrendingDown className="w-5 h-5 text-orange-500" />;
      case NotificationType.ScheduledPostReminder:
        return <Clock className="w-5 h-5 text-blue-500" />;
      case NotificationType.FacebookPolicyAlert:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Facebook className="w-5 h-5 text-blue-600" />;
    }
  }

  // Customer Interaction notifications (Admin role)
  if (category === NotificationCategory.CUSTOMER_INTERACTION) {
    switch (type) {
      case NotificationType.NewCustomerFromPage:
        return <Users className="w-5 h-5 text-green-500" />;
      case NotificationType.CustomerInquiryFromPage:
        return <MessageSquare className="w-5 h-5 text-orange-500" />;
      case NotificationType.CustomerComplaintFromPage:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case NotificationType.CustomerReviewFromPage:
        return <Users className="w-5 h-5 text-blue-500" />;
      default:
        return <Users className="w-5 h-5 text-gray-500" />;
    }
  }

  // System & Integration notifications (Admin role)
  if (type === NotificationType.PancakeApiConnectionIssue || 
      type === NotificationType.PageDataSyncSuccess || 
      type === NotificationType.PageDataSyncFailure || 
      type === NotificationType.EnvironmentVariableChange) {
    switch (type) {
      case NotificationType.PancakeApiConnectionIssue:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case NotificationType.PageDataSyncSuccess:
        return <FileCheck2 className="w-5 h-5 text-green-500" />;
      case NotificationType.PageDataSyncFailure:
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case NotificationType.EnvironmentVariableChange:
        return <Settings className="w-5 h-5 text-blue-500" />;
      default:
        return <Settings className="w-5 h-5 text-gray-500" />;
    }
  }

  // Standard notifications for all roles
  switch (type) {
    case NotificationType.PendingVerification:
      return <FileCheck2 className="w-5 h-5 text-yellow-500" />;
    case NotificationType.OverduePayment:
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case NotificationType.ExpiringOwnership:
      return <Clock className="w-5 h-5 text-orange-500" />;
    case NotificationType.NewOrderForCustomer:
    case NotificationType.NewOrderCreated:
      return <ShoppingCart className="w-5 h-5 text-green-600" />;
    case NotificationType.PaymentVerificationRequired:
      return <CreditCard className="w-5 h-5 text-orange-500" />;
    case NotificationType.PaymentVerified:
      return <FileCheck2 className="w-5 h-5 text-green-500" />;
    case NotificationType.StockLow:
    case NotificationType.StockOut:
      return <Package className="w-5 h-5 text-red-500" />;
    case NotificationType.NewStockReceived:
      return <Package className="w-5 h-5 text-green-500" />;
    case NotificationType.NewCustomerAssigned:
      return <Users className="w-5 h-5 text-blue-500" />;
    case NotificationType.CustomerOwnershipExpiring:
      return <Clock className="w-5 h-5 text-orange-500" />;
    case NotificationType.CustomerFollowUpDue:
      return <Clock className="w-5 h-5 text-yellow-500" />;
    case NotificationType.CustomerGradeChanged:
      return <Users className="w-5 h-5 text-purple-500" />;
    case NotificationType.OrderStatusChanged:
      return <ShoppingCart className="w-5 h-5 text-blue-500" />;
    case NotificationType.OrderCancelled:
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case NotificationType.OrderPaymentPending:
      return <CreditCard className="w-5 h-5 text-yellow-500" />;
    case NotificationType.NewPromotionCreated:
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    case NotificationType.PromotionExpiring:
      return <Clock className="w-5 h-5 text-orange-500" />;
    case NotificationType.CampaignPerformance:
      return <BarChart3 className="w-5 h-5 text-blue-500" />;
    case NotificationType.TeamTargetAchieved:
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    case NotificationType.TeamMemberPerformance:
      return <Users className="w-5 h-5 text-blue-500" />;
    case NotificationType.NewTeamMember:
      return <Users className="w-5 h-5 text-purple-500" />;
    case NotificationType.DailyReportReady:
    case NotificationType.WeeklyReportReady:
    case NotificationType.MonthlyReportReady:
      return <BarChart3 className="w-5 h-5 text-blue-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
};

const NotificationPanel: React.FC<NotificationPanelProps> = ({ 
  notifications, 
  onClose, 
  onMarkAllAsRead, 
  onMarkAsRead,
  onNotificationClick,
  currentUserRole
}) => {
  const [filterCategory, setFilterCategory] = useState<NotificationCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<NotificationPriority | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter notifications based on selected filters
  const filteredNotifications = notifications.filter(notif => {
    const categoryMatch = filterCategory === 'all' || notif.category === filterCategory;
    const priorityMatch = filterPriority === 'all' || notif.priority === filterPriority;
    return categoryMatch && priorityMatch;
  });

  // Group notifications by category
  const groupedNotifications = filteredNotifications.reduce((groups, notif) => {
    const category = notif.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(notif);
    return groups;
  }, {} as Record<NotificationCategory, Notification[]>);

  const handleNotificationClick = (notification: Notification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
  };

  const getCategoryLabel = (category: NotificationCategory) => {
    switch (category) {
      case NotificationCategory.SYSTEM:
        return 'ระบบ';
      case NotificationCategory.SALES:
        return 'การขาย';
      case NotificationCategory.CUSTOMER:
        return 'ลูกค้า';
      case NotificationCategory.ORDER:
        return 'คำสั่งซื้อ';
      case NotificationCategory.PAYMENT:
        return 'การชำระเงิน';
      case NotificationCategory.INVENTORY:
        return 'สินค้าคงคลัง';
      case NotificationCategory.MARKETING:
        return 'การตลาด';
      case NotificationCategory.REPORT:
        return 'รายงาน';
      case NotificationCategory.TEAM:
        return 'ทีม';
      case NotificationCategory.PAGE_PERFORMANCE:
        return 'ประสิทธิภาพเพจ';
      case NotificationCategory.CONTENT_MANAGEMENT:
        return 'จัดการเนื้อหา';
      case NotificationCategory.CUSTOMER_INTERACTION:
        return 'การโต้ตอบลูกค้า';
      default:
        return 'อื่นๆ';
    }
  };

  const getPriorityLabel = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 'เร่งด่วน';
      case NotificationPriority.HIGH:
        return 'สูง';
      case NotificationPriority.MEDIUM:
        return 'ปานกลาง';
      case NotificationPriority.LOW:
        return 'ต่ำ';
      default:
        return 'ทั้งหมด';
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute top-16 right-6 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-3 border-b">
          <h3 className="font-semibold text-gray-800">การแจ้งเตือน</h3>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className="p-1 rounded-full text-gray-400 hover:bg-gray-100"
              title="ตัวกรอง"
            >
              <Filter size={18} />
            </button>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-3 border-b bg-gray-50">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">หมวดหมู่</label>
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value as NotificationCategory | 'all')}
                  className="w-full border rounded-md px-2 py-1 text-sm"
                >
                  <option value="all">ทั้งหมด</option>
                  {Object.values(NotificationCategory).map(category => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ความสำคัญ</label>
                <select 
                  value={filterPriority} 
                  onChange={(e) => setFilterPriority(e.target.value as NotificationPriority | 'all')}
                  className="w-full border rounded-md px-2 py-1 text-sm"
                >
                  <option value="all">ทั้งหมด</option>
                  {Object.values(NotificationPriority).map(priority => (
                    <option key={priority} value={priority}>
                      {getPriorityLabel(priority)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length > 0 ? (
            <div>
              {Object.entries(groupedNotifications).map(([category, categoryNotifications]) => (
                <div key={category} className="mb-4">
                  <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                    {getCategoryLabel(category as NotificationCategory)}
                  </div>
                  {categoryNotifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`flex items-start p-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer ${
                        !notif.read ? 'bg-blue-50 border-l-4 ' + getPriorityColor(notif.priority) : ''
                      }`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="flex-shrink-0 mt-1 mr-3">
                        <NotificationIcon type={notif.type} category={notif.category} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm text-gray-700 font-medium truncate">{notif.title}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                            notif.priority === NotificationPriority.URGENT ? 'bg-red-100 text-red-700' :
                            notif.priority === NotificationPriority.HIGH ? 'bg-orange-100 text-orange-700' :
                            notif.priority === NotificationPriority.MEDIUM ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {getPriorityLabel(notif.priority)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                        {notif.pageName && (
                          <p className="text-xs text-gray-500 mt-1">
                            เพจ: {notif.pageName} {notif.platform && `(${notif.platform})`}
                          </p>
                        )}
                        {notif.actionUrl && (
                          <button 
                            className="text-xs text-blue-600 hover:underline mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle navigation to action URL
                              window.location.href = notif.actionUrl;
                            }}
                          >
                            {notif.actionText || 'ดูรายละเอียด'}
                          </button>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{getRelativeTime(notif.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-gray-500">
              {notifications.length === 0 ? 'ไม่มีการแจ้งเตือน' : 'ไม่มีการแจ้งเตือนที่ตรงกับตัวกรอง'}
            </div>
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <button 
              onClick={onMarkAllAsRead} 
              className="w-full text-center text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-md py-1.5"
            >
              ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationPanel;
