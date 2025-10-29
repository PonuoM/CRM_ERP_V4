import React, { useState, useEffect } from 'react';
import { 
  NotificationType, 
  NotificationCategory, 
  NotificationPriority,
  NotificationSetting,
  User,
  UserRole 
} from '@/types';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Clock, 
  Save, 
  Settings,
  Check,
  X
} from 'lucide-react';
import notificationService from '@/services/notificationService';

interface NotificationSettingsPageProps {
  currentUser: User;
}

interface NotificationTypeConfig {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  description: string;
  defaultEnabled: boolean;
  applicableRoles: UserRole[];
}

const NotificationSettingsPage: React.FC<NotificationSettingsPageProps> = ({ currentUser }) => {
  const [settings, setSettings] = useState<Record<string, NotificationSetting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Define all notification types with their configurations
  const notificationTypes: NotificationTypeConfig[] = [
    // System notifications
    {
      type: NotificationType.SystemMaintenance,
      category: NotificationCategory.SYSTEM,
      title: 'การบำรุงรักษาระบบ',
      description: 'แจ้งเตือนเมื่อมีการบำรุงรักษาระบบ',
      defaultEnabled: true,
      applicableRoles: Object.values(UserRole)
    },
    {
      type: NotificationType.SystemUpdate,
      category: NotificationCategory.SYSTEM,
      title: 'การอัปเดตระบบ',
      description: 'แจ้งเตือนเมื่อมีการอัปเดตระบบ',
      defaultEnabled: true,
      applicableRoles: Object.values(UserRole)
    },
    
    // Customer notifications
    {
      type: NotificationType.NewCustomerAssigned,
      category: NotificationCategory.CUSTOMER,
      title: 'ได้รับมอบหมายลูกค้าใหม่',
      description: 'แจ้งเตือนเมื่อได้รับมอบหมายลูกค้าใหม่',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale]
    },
    {
      type: NotificationType.CustomerOwnershipExpiring,
      category: NotificationCategory.CUSTOMER,
      title: 'สิทธิ์ดูแลลูกค้าใกล้หมดอายุ',
      description: 'แจ้งเตือนเมื่อสิทธิ์ดูแลลูกค้าใกล้หมดอายุ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale]
    },
    {
      type: NotificationType.CustomerFollowUpDue,
      category: NotificationCategory.CUSTOMER,
      title: 'ถึงเวลาติดต่อลูกค้า',
      description: 'แจ้งเตือนเมื่อถึงเวลาที่ควรติดต่อลูกค้า',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale]
    },
    {
      type: NotificationType.CustomerGradeChanged,
      category: NotificationCategory.CUSTOMER,
      title: 'เกรดลูกค้าเปลี่ยน',
      description: 'แจ้งเตือนเมื่อเกรดลูกค้าเปลี่ยน',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale, UserRole.Supervisor]
    },
    
    // Order notifications
    {
      type: NotificationType.NewOrderCreated,
      category: NotificationCategory.ORDER,
      title: 'มีคำสั่งซื้อใหม่',
      description: 'แจ้งเตือนเมื่อมีคำสั่งซื้อใหม่',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale, UserRole.Backoffice]
    },
    {
      type: NotificationType.OrderStatusChanged,
      category: NotificationCategory.ORDER,
      title: 'สถานะคำสั่งซื้อเปลี่ยน',
      description: 'แจ้งเตือนเมื่อสถานะคำสั่งซื้อเปลี่ยน',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale, UserRole.Backoffice]
    },
    {
      type: NotificationType.OrderCancelled,
      category: NotificationCategory.ORDER,
      title: 'คำสั่งซื้อถูกยกเลิก',
      description: 'แจ้งเตือนเมื่อคำสั่งซื้อถูกยกเลิก',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale, UserRole.Backoffice]
    },
    {
      type: NotificationType.OrderPaymentPending,
      category: NotificationCategory.ORDER,
      title: 'รอการชำระเงินคำสั่งซื้อ',
      description: 'แจ้งเตือนเมื่อคำสั่งซื้อรอการชำระเงิน',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale, UserRole.Backoffice]
    },
    
    // Payment notifications
    {
      type: NotificationType.PaymentVerificationRequired,
      category: NotificationCategory.PAYMENT,
      title: 'ต้องการตรวจสอบการชำระเงิน',
      description: 'แจ้งเตือนเมื่อต้องการตรวจสอบการชำระเงิน',
      defaultEnabled: true,
      applicableRoles: [UserRole.Backoffice]
    },
    {
      type: NotificationType.PaymentOverdue,
      category: NotificationCategory.PAYMENT,
      title: 'การชำระเงินล่าช้า',
      description: 'แจ้งเตือนเมื่อการชำระเงินล่าช้า',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale, UserRole.Backoffice]
    },
    {
      type: NotificationType.PaymentVerified,
      category: NotificationCategory.PAYMENT,
      title: 'การชำระเงินได้รับการตรวจสอบแล้ว',
      description: 'แจ้งเตือนเมื่อการชำระเงินได้รับการตรวจสอบแล้ว',
      defaultEnabled: true,
      applicableRoles: [UserRole.Telesale, UserRole.Backoffice]
    },
    
    // Inventory notifications
    {
      type: NotificationType.StockLow,
      category: NotificationCategory.INVENTORY,
      title: 'สต็อกสินค้าใกล้หมด',
      description: 'แจ้งเตือนเมื่อสต็อกสินค้าใกล้หมด',
      defaultEnabled: true,
      applicableRoles: [UserRole.Backoffice]
    },
    {
      type: NotificationType.StockOut,
      category: NotificationCategory.INVENTORY,
      title: 'สินค้าหมด',
      description: 'แจ้งเตือนเมื่อสินค้าหมด',
      defaultEnabled: true,
      applicableRoles: [UserRole.Backoffice]
    },
    {
      type: NotificationType.NewStockReceived,
      category: NotificationCategory.INVENTORY,
      title: 'ได้รับสินค้าใหม่',
      description: 'แจ้งเตือนเมื่อได้รับสินค้าใหม่',
      defaultEnabled: true,
      applicableRoles: [UserRole.Backoffice]
    },
    
    // Marketing notifications
    {
      type: NotificationType.NewPromotionCreated,
      category: NotificationCategory.MARKETING,
      title: 'สร้างโปรโมชั่นใหม่',
      description: 'แจ้งเตือนเมื่อมีการสร้างโปรโมชั่นใหม่',
      defaultEnabled: true,
      applicableRoles: [UserRole.Marketing, UserRole.Telesale]
    },
    {
      type: NotificationType.PromotionExpiring,
      category: NotificationCategory.MARKETING,
      title: 'โปรโมชั่นใกล้หมดอายุ',
      description: 'แจ้งเตือนเมื่อโปรโมชั่นใกล้หมดอายุ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Marketing, UserRole.Telesale]
    },
    {
      type: NotificationType.CampaignPerformance,
      category: NotificationCategory.MARKETING,
      title: 'รายงานประสิทธิภาพแคมเปญ',
      description: 'แจ้งเตือนเมื่อมีรายงานประสิทธิภาพแคมเปญ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Marketing]
    },
    
    // Team notifications
    {
      type: NotificationType.TeamTargetAchieved,
      category: NotificationCategory.TEAM,
      title: 'ทีมบรรลุเป้าหมาย',
      description: 'แจ้งเตือนเมื่อทีมบรรลุเป้าหมาย',
      defaultEnabled: true,
      applicableRoles: [UserRole.Supervisor, UserRole.AdminControl, UserRole.SuperAdmin]
    },
    {
      type: NotificationType.TeamMemberPerformance,
      category: NotificationCategory.TEAM,
      title: 'ประสิทธิภาพสมาชิกทีม',
      description: 'แจ้งเตือนเมื่อมีรายงานประสิทธิภาพสมาชิกทีม',
      defaultEnabled: true,
      applicableRoles: [UserRole.Supervisor, UserRole.AdminControl, UserRole.SuperAdmin]
    },
    {
      type: NotificationType.NewTeamMember,
      category: NotificationCategory.TEAM,
      title: 'สมาชิกใหม่ในทีม',
      description: 'แจ้งเตือนเมื่อมีสมาชิกใหม่ในทีม',
      defaultEnabled: true,
      applicableRoles: [UserRole.Supervisor, UserRole.AdminControl, UserRole.SuperAdmin]
    },
    
    // Report notifications
    {
      type: NotificationType.DailyReportReady,
      category: NotificationCategory.REPORT,
      title: 'รายงานประจำวันพร้อม',
      description: 'แจ้งเตือนเมื่อรายงานประจำวันพร้อม',
      defaultEnabled: true,
      applicableRoles: [UserRole.Supervisor, UserRole.AdminControl, UserRole.SuperAdmin]
    },
    {
      type: NotificationType.WeeklyReportReady,
      category: NotificationCategory.REPORT,
      title: 'รายงานประจำสัปดาห์พร้อม',
      description: 'แจ้งเตือนเมื่อรายงานประจำสัปดาห์พร้อม',
      defaultEnabled: true,
      applicableRoles: [UserRole.Supervisor, UserRole.AdminControl, UserRole.SuperAdmin]
    },
    {
      type: NotificationType.MonthlyReportReady,
      category: NotificationCategory.REPORT,
      title: 'รายงานประจำเดือนพร้อม',
      description: 'แจ้งเตือนเมื่อรายงานประจำเดือนพร้อม',
      defaultEnabled: true,
      applicableRoles: [UserRole.Supervisor, UserRole.AdminControl, UserRole.SuperAdmin]
    },
    
    // Page Performance notifications (Admin role)
    {
      type: NotificationType.PageEngagementDrop,
      category: NotificationCategory.PAGE_PERFORMANCE,
      title: 'การมีส่วนร่วมลดลง',
      description: 'แจ้งเตือนเมื่อการมีส่วนร่วมของเพจลดลง',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.PageReachIncrease,
      category: NotificationCategory.PAGE_PERFORMANCE,
      title: 'การเข้าถึงเพจเพิ่มขึ้น',
      description: 'แจ้งเตือนเมื่อการเข้าถึงเพจเพิ่มขึ้น',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.UnansweredMessages,
      category: NotificationCategory.PAGE_PERFORMANCE,
      title: 'มีข้อความที่ยังไม่ได้ตอบ',
      description: 'แจ้งเตือนเมื่อมีข้อความที่ยังไม่ได้ตอบ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.WeeklyPageReport,
      category: NotificationCategory.PAGE_PERFORMANCE,
      title: 'รายงานประจำสัปดาห์ของเพจ',
      description: 'แจ้งเตือนเมื่อรายงานประจำสัปดาห์ของเพจพร้อม',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    
    // Content Management notifications (Admin role)
    {
      type: NotificationType.HighPerformingPost,
      category: NotificationCategory.CONTENT_MANAGEMENT,
      title: 'โพสต์ที่มีประสิทธิภาพสูง',
      description: 'แจ้งเตือนเมื่อมีโพสต์ที่มีประสิทธิภาพสูง',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.LowPerformingPost,
      category: NotificationCategory.CONTENT_MANAGEMENT,
      title: 'โพสต์ที่มีประสิทธิภาพต่ำ',
      description: 'แจ้งเตือนเมื่อมีโพสต์ที่มีประสิทธิภาพต่ำ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.ScheduledPostReminder,
      category: NotificationCategory.CONTENT_MANAGEMENT,
      title: 'เตือนโพสต์ที่กำหนดไว้',
      description: 'แจ้งเตือนเมื่อถึงเวลาโพสต์ที่กำหนดไว้',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.FacebookPolicyAlert,
      category: NotificationCategory.CONTENT_MANAGEMENT,
      title: 'แจ้งเตือนนโยบาย Facebook',
      description: 'แจ้งเตือนเมื่อมีการแจ้งเตือนนโยบาย Facebook',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    
    // Customer Interaction notifications (Admin role)
    {
      type: NotificationType.NewCustomerFromPage,
      category: NotificationCategory.CUSTOMER_INTERACTION,
      title: 'ลูกค้าใหม่จากเพจ',
      description: 'แจ้งเตือนเมื่อมีลูกค้าใหม่จากเพจ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.CustomerInquiryFromPage,
      category: NotificationCategory.CUSTOMER_INTERACTION,
      title: 'มีคำถามจากลูกค้าในเพจ',
      description: 'แจ้งเตือนเมื่อมีคำถามจากลูกค้าในเพจ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.CustomerComplaintFromPage,
      category: NotificationCategory.CUSTOMER_INTERACTION,
      title: 'มีการร้องเรียนจากลูกค้าในเพจ',
      description: 'แจ้งเตือนเมื่อมีการร้องเรียนจากลูกค้าในเพจ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.CustomerReviewFromPage,
      category: NotificationCategory.CUSTOMER_INTERACTION,
      title: 'มีรีวิวจากลูกค้าในเพจ',
      description: 'แจ้งเตือนเมื่อมีรีวิวจากลูกค้าในเพจ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    
    // System & Integration notifications (Admin role)
    {
      type: NotificationType.PancakeApiConnectionIssue,
      category: NotificationCategory.SYSTEM,
      title: 'ปัญหาการเชื่อมต่อ Pancake API',
      description: 'แจ้งเตือนเมื่อมีปัญหาการเชื่อมต่อ Pancake API',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.PageDataSyncSuccess,
      category: NotificationCategory.SYSTEM,
      title: 'อัปเดตข้อมูลเพจสำเร็จ',
      description: 'แจ้งเตือนเมื่ออัปเดตข้อมูลเพจสำเร็จ',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.PageDataSyncFailure,
      category: NotificationCategory.SYSTEM,
      title: 'อัปเดตข้อมูลเพจล้มเหลว',
      description: 'แจ้งเตือนเมื่ออัปเดตข้อมูลเพจล้มเหลว',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    },
    {
      type: NotificationType.EnvironmentVariableChange,
      category: NotificationCategory.SYSTEM,
      title: 'มีการเปลี่ยนแปลง Environment Variables',
      description: 'แจ้งเตือนเมื่อมีการเปลี่ยนแปลง Environment Variables',
      defaultEnabled: true,
      applicableRoles: [UserRole.Admin]
    }
  ];

  // Filter notification types based on user role
  const applicableNotificationTypes = notificationTypes.filter(config => 
    config.applicableRoles.includes(currentUser.role as UserRole)
  );

  // Group notification types by category
  const groupedNotificationTypes = applicableNotificationTypes.reduce((groups, config) => {
    const category = config.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(config);
    return groups;
  }, {} as Record<NotificationCategory, NotificationTypeConfig[]>);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const userSettings = await notificationService.getNotificationSettings(currentUser.id);
        
        // Convert settings array to object with notification type as key
        const settingsObject = userSettings.reduce((obj, setting) => {
          obj[setting.notificationType] = setting;
          return obj;
        }, {} as Record<string, NotificationSetting>);
        
        setSettings(settingsObject);
      } catch (error) {
        console.error('Error fetching notification settings:', error);
        setErrorMessage('ไม่สามารถดึงข้อมูลการตั้งค่าได้');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [currentUser.id]);

  const handleSettingChange = async (notificationType: string, field: keyof NotificationSetting, value: boolean) => {
    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');
      
      const currentSetting = settings[notificationType] || {
        id: 0,
        userId: currentUser.id,
        notificationType,
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        businessHoursOnly: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const updatedSetting = await notificationService.updateNotificationSettings({
        ...currentSetting,
        [field]: value
      });
      
      setSettings(prev => ({
        ...prev,
        [notificationType]: updatedSetting
      }));
      
      setSuccessMessage('บันทึกการตั้งค่าสำเร็จ');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      setErrorMessage('ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#F5F5F5]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ตั้งค่าการแจ้งเตือน</h1>
        <p className="text-gray-600">เลือกการแจ้งเตือนที่คุณต้องการรับและช่องทางที่ต้องการรับ</p>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded flex items-center">
          <Check className="w-5 h-5 mr-2" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
          <X className="w-5 h-5 mr-2" />
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <div className="flex items-center">
            <Settings className="w-5 h-5 mr-2 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-800">การตั้งค่าการแจ้งเตือน</h2>
          </div>
        </div>

        <div className="p-4">
          {Object.entries(groupedNotificationTypes).map(([category, types]) => (
            <div key={category} className="mb-6">
              <h3 className="text-md font-semibold text-gray-700 mb-4 pb-2 border-b">
                {getCategoryLabel(category as NotificationCategory)}
              </h3>
              
              <div className="space-y-4">
                {types.map(config => {
                  const setting = settings[config.type] || {
                    id: 0,
                    userId: currentUser.id,
                    notificationType: config.type,
                    inAppEnabled: config.defaultEnabled,
                    emailEnabled: false,
                    smsEnabled: false,
                    businessHoursOnly: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  
                  return (
                    <div key={config.type} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-800">{config.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`${config.type}-inApp`}
                            checked={setting.inAppEnabled}
                            onChange={(e) => handleSettingChange(config.type, 'inAppEnabled', e.target.checked)}
                            disabled={saving}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`${config.type}-inApp`} className="ml-2 block text-sm text-gray-700 flex items-center">
                            <Bell className="w-4 h-4 mr-1" />
                            ในแอป
                          </label>
                        </div>
                        
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`${config.type}-email`}
                            checked={setting.emailEnabled}
                            onChange={(e) => handleSettingChange(config.type, 'emailEnabled', e.target.checked)}
                            disabled={saving}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`${config.type}-email`} className="ml-2 block text-sm text-gray-700 flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            อีเมล
                          </label>
                        </div>
                        
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`${config.type}-sms`}
                            checked={setting.smsEnabled}
                            onChange={(e) => handleSettingChange(config.type, 'smsEnabled', e.target.checked)}
                            disabled={saving}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`${config.type}-sms`} className="ml-2 block text-sm text-gray-700 flex items-center">
                            <MessageSquare className="w-4 h-4 mr-1" />
                            SMS
                          </label>
                        </div>
                        
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id={`${config.type}-businessHours`}
                            checked={setting.businessHoursOnly}
                            onChange={(e) => handleSettingChange(config.type, 'businessHoursOnly', e.target.checked)}
                            disabled={saving}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`${config.type}-businessHours`} className="ml-2 block text-sm text-gray-700 flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            เฉพาะเวลาทำการ
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;