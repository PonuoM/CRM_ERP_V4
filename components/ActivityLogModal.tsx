import React from 'react';
import { Customer, Activity, ActivityType } from '../types';
import Modal from './Modal';
// FIX: Add 'Repeat' and 'Paperclip' icons to import.
import { MoreHorizontal, UserCheck, BarChart, Flame, ShoppingCart, Calendar, Phone, XCircle, Truck, Check, Repeat, Paperclip } from 'lucide-react';


interface ActivityLogModalProps {
  customer: Customer;
  activities: Activity[];
  onClose: () => void;
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
    return <Icon className="w-5 h-5 text-gray-500" />
}

const ActivityLogModal: React.FC<ActivityLogModalProps> = ({ customer, activities, onClose }) => {
  const sortedActivities = activities.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return (
    <Modal title={`ประวัติกิจกรรมทั้งหมด: ${customer.firstName} ${customer.lastName}`} onClose={onClose}>
      <div className="space-y-6">
        {sortedActivities.map((activity, index) => (
          <div key={activity.id} className="flex">
            <div className="flex flex-col items-center mr-4">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                <ActivityIcon type={activity.type} />
              </div>
              {index < sortedActivities.length - 1 && (
                <div className="w-px h-full bg-gray-200"></div>
              )}
            </div>
            <div className="pb-4">
              <p className="text-sm text-gray-800">{activity.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                โดย {activity.actorName} • {getRelativeTime(activity.timestamp)}
              </p>
            </div>
          </div>
        ))}
        {sortedActivities.length === 0 && (
            <div className="text-center py-10 text-gray-500">
                ไม่มีประวัติกิจกรรม
            </div>
        )}
      </div>
    </Modal>
  );
};

export default ActivityLogModal;