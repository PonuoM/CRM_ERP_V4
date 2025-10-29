import { 
  Notification, 
  NotificationType, 
  NotificationCategory, 
  NotificationPriority, 
  UserRole, 
  NotificationSetting,
  NotificationReadStatus,
  User 
} from '@/types';

// API base URL
const API_BASE = '/api/index.php/notifications';

class NotificationService {
  private async post<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Fetch notifications for current user based on role
  async fetchNotifications(
    userId: number,
    userRole: UserRole,
    limit: number = 50,
    includeRead: boolean = false,
  ): Promise<Notification[]> {
    try {
      const data = await this.post<{ success: boolean; notifications: any[]; error?: string }>('get', {
        userId,
        userRole,
        limit,
        includeRead,
      });
      
      if (data.success) {
        // Map is_read from database to read for frontend
        return data.notifications.map((notif: any) => {
          let forRoles: UserRole[] = [];

          if (Array.isArray(notif.forRoles)) {
            forRoles = notif.forRoles as UserRole[];
          } else if (Array.isArray(notif.for_roles)) {
            forRoles = notif.for_roles as UserRole[];
          } else if (typeof notif.for_roles === 'string') {
            forRoles = notif.for_roles
              .split(',')
              .map((role: string) => role.trim())
              .filter(Boolean) as UserRole[];
          }

          if (forRoles.length === 0) {
            forRoles = [userRole];
          }

          const readFlag =
            notif.is_read_by_user ?? notif.is_read ?? notif.read ?? false;

          return {
            ...notif,
            forRoles,
            read: Boolean(readFlag),
            is_read: notif.is_read ?? Boolean(readFlag),
          };
        });
      } else {
        throw new Error(data.error || 'Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Get notification count by category for current user
  async getNotificationCount(userId: number, userRole: UserRole): Promise<Record<NotificationCategory, number>> {
    try {
      const data = await this.post<{
        success: boolean;
        counts: Record<NotificationCategory, number>;
        error?: string;
      }>('count', {
        userId,
        userRole,
      });
      
      if (data.success) {
        return data.counts;
      } else {
        throw new Error(data.error || 'Failed to get notification count');
      }
    } catch (error) {
      console.error('Error getting notification count:', error);
      return {} as Record<NotificationCategory, number>;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: number): Promise<void> {
    try {
      const data = await this.post<{ success: boolean; error?: string }>('markAsRead', {
        notificationId,
        userId,
      });
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to mark notification as read');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for user
  async markAllAsRead(userId: number, userRole: UserRole): Promise<void> {
    try {
      const data = await this.post<{ success: boolean; error?: string }>('markAllAsRead', {
        userId,
        userRole,
      });
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to mark all notifications as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Create new notification
  async createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'is_read' | 'read'>): Promise<Notification> {
    try {
      const data = await this.post<{
        success: boolean;
        notification: Notification;
        error?: string;
      }>('create', {
        notification,
      });
      
      if (data.success) {
        // Map is_read from database to read for frontend
        const readFlag =
          (data.notification as any).is_read_by_user ??
          (data.notification as any).is_read ??
          (data.notification as any).read ??
          false;
        return {
          ...data.notification,
          read: Boolean(readFlag),
          is_read: (data.notification as any).is_read ?? Boolean(readFlag),
        };
      } else {
        throw new Error(data.error || 'Failed to create notification');
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Get notification settings for user
  async getNotificationSettings(userId: number): Promise<NotificationSetting[]> {
    try {
      const data = await this.post<{
        success: boolean;
        settings: NotificationSetting[];
        error?: string;
      }>('settings/get', {
        userId,
      });
      
      if (data.success) {
        return data.settings;
      } else {
        throw new Error(data.error || 'Failed to get notification settings');
      }
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return [];
    }
  }

  // Update notification settings
  async updateNotificationSettings(settings: Partial<NotificationSetting> & { userId: number, notificationType: string }): Promise<NotificationSetting> {
    try {
      const data = await this.post<{
        success: boolean;
        setting: NotificationSetting;
        error?: string;
      }>('settings/update', {
        settings,
      });
      
      if (data.success) {
        return data.setting;
      } else {
        throw new Error(data.error || 'Failed to update notification settings');
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }

  // Helper methods for creating specific notification types

  // Create a notification for new order
  async createNewOrderNotification(orderId: string, customerId: string, customerName: string, forRoles: UserRole[]): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.NewOrderCreated,
      category: NotificationCategory.ORDER,
      title: 'มีคำสั่งซื้อใหม่',
      message: `มีคำสั่งซื้อใหม่ #${orderId} จากลูกค้า ${customerName}`,
      priority: NotificationPriority.MEDIUM,
      relatedId: orderId,
      actionUrl: `/orders/${orderId}`,
      actionText: 'ดูรายละเอียด',
      forRoles
    });
  }

  // Create a notification for payment verification
  async createPaymentVerificationNotification(orderId: string, forRoles: UserRole[]): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.PaymentVerificationRequired,
      category: NotificationCategory.PAYMENT,
      title: 'ต้องการตรวจสอบการชำระเงิน',
      message: `คำสั่งซื้อ #${orderId} ต้องการตรวจสอบการชำระเงิน`,
      priority: NotificationPriority.HIGH,
      relatedId: orderId,
      actionUrl: `/orders/${orderId}`,
      actionText: 'ตรวจสอบ',
      forRoles
    });
  }

  // Create a notification for page engagement drop (Admin role)
  async createPageEngagementDropNotification(pageId: number, pageName: string, percentageChange: number, forRoles: UserRole[]): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.PageEngagementDrop,
      category: NotificationCategory.PAGE_PERFORMANCE,
      title: 'การมีส่วนร่วมลดลง',
      message: `เพจ "${pageName}" มีการมีส่วนร่วมลดลง ${percentageChange}% ในช่วง 7 วันที่ผ่านมา`,
      priority: NotificationPriority.MEDIUM,
      pageId,
      pageName,
      platform: 'Facebook',
      metrics: {
        percentageChange
      },
      actionUrl: `/pages/${pageId}/stats`,
      actionText: 'ดูสถิติ',
      forRoles
    });
  }

  // Create a notification for customer inquiry from page (Admin role)
  async createCustomerInquiryNotification(pageId: number, pageName: string, forRoles: UserRole[]): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.CustomerInquiryFromPage,
      category: NotificationCategory.CUSTOMER_INTERACTION,
      title: 'มีคำถามจากลูกค้า',
      message: `มีคำถามใหม่จากลูกค้าในเพจ "${pageName}" ที่ยังไม่ได้ตอบกลับ`,
      priority: NotificationPriority.HIGH,
      pageId,
      pageName,
      platform: 'Facebook',
      actionUrl: `/pages/${pageId}/messages`,
      actionText: 'ตอบกลับ',
      forRoles
    });
  }

  // Create a notification for new customer assigned (Telesale role)
  async createNewCustomerAssignedNotification(customerId: string, customerName: string, forRoles: UserRole[], userId?: number): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.NewCustomerAssigned,
      category: NotificationCategory.CUSTOMER,
      title: 'ได้รับมอบหมายลูกค้าใหม่',
      message: `คุณได้รับมอบหมายลูกค้าใหม่: ${customerName}`,
      priority: NotificationPriority.MEDIUM,
      relatedId: customerId,
      actionUrl: `/customers/${customerId}`,
      actionText: 'ดูข้อมูล',
      forRoles,
      userId
    });
  }

  // Create a notification for customer ownership expiring (Telesale role)
  async createCustomerOwnershipExpiringNotification(customerId: string, customerName: string, daysLeft: number, forRoles: UserRole[], userId?: number): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.CustomerOwnershipExpiring,
      category: NotificationCategory.CUSTOMER,
      title: 'สิทธิ์ดูแลลูกค้าใกล้หมดอายุ',
      message: `สิทธิ์ดูแลลูกค้า ${customerName} จะหมดอายุในอีก ${daysLeft} วัน`,
      priority: daysLeft <= 3 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      relatedId: customerId,
      actionUrl: `/customers/${customerId}`,
      actionText: 'ดูข้อมูล',
      forRoles,
      userId
    });
  }

  // Create a notification for low stock (Backoffice role)
  async createLowStockNotification(productId: number, productName: string, currentStock: number, forRoles: UserRole[]): Promise<Notification> {
    return this.createNotification({
      type: NotificationType.StockLow,
      category: NotificationCategory.INVENTORY,
      title: 'สต็อกสินค้าใกล้หมด',
      message: `สินค้า "${productName}" (ID: ${productId}) มีสต็อกเหลือ ${currentStock} ชิ้น`,
      priority: currentStock <= 5 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
      relatedId: productId,
      actionUrl: `/products/${productId}`,
      actionText: 'ดูข้อมูล',
      forRoles
    });
  }
}

export default new NotificationService();
