
import React from 'react';
import { Notification, NotificationType } from '../types';
import { AlertCircle, Clock, FileCheck2, X } from 'lucide-react';

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
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

const NotificationIcon: React.FC<{ type: NotificationType }> = ({ type }) => {
    switch (type) {
        case NotificationType.PendingVerification:
            return <FileCheck2 className="w-5 h-5 text-yellow-500" />;
        case NotificationType.OverduePayment:
            return <AlertCircle className="w-5 h-5 text-red-500" />;
        case NotificationType.ExpiringOwnership:
            return <Clock className="w-5 h-5 text-orange-500" />;
        default:
            return null;
    }
};

const NotificationPanel: React.FC<NotificationPanelProps> = ({ notifications, onClose, onMarkAllAsRead }) => {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute top-16 right-6 w-80 bg-white rounded-lg shadow-xl border z-50">
        <div className="flex justify-between items-center p-3 border-b">
          <h3 className="font-semibold text-gray-800">การแจ้งเตือน</h3>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100">
              <X size={18} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map(notif => (
              <div key={notif.id} className={`flex items-start p-3 border-b last:border-0 hover:bg-gray-50 ${!notif.read ? 'bg-blue-50' : ''}`}>
                <div className="flex-shrink-0 mt-1 mr-3">
                  <NotificationIcon type={notif.type} />
                </div>
                <div>
                  <p className="text-sm text-gray-700">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{getRelativeTime(notif.timestamp)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-sm text-gray-500">
              ไม่มีการแจ้งเตือนใหม่
            </div>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="p-2 border-t">
              <button onClick={onMarkAllAsRead} className="w-full text-center text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-md py-1.5">
                  ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว
              </button>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationPanel;