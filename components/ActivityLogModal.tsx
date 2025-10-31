import React, { useEffect, useMemo, useState } from 'react';
import { Customer, CustomerLog, User } from '../types';
import Modal from './Modal';
import { MoreHorizontal, Plus, Edit, Trash2 } from 'lucide-react';
import { listCustomerLogs } from '../services/api';
import {
  actionLabels,
  parseCustomerLogRow,
  summarizeCustomerLogChanges,
} from '../utils/customerLogs';

interface ActivityLogModalProps {
  customer: Customer;
  initialLogs?: CustomerLog[];
  allUsers: User[];
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

const actionIcons: Record<CustomerLog["actionType"], React.ElementType> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
};

const ActivityIcon = ({ action }: { action: CustomerLog["actionType"] }) => {
  const Icon = actionIcons[action] || MoreHorizontal;
  return <Icon className="w-5 h-5 text-gray-500" />;
};

const ActivityLogModal: React.FC<ActivityLogModalProps> = ({ customer, initialLogs, allUsers, onClose }) => {
  const [logs, setLogs] = useState<CustomerLog[]>(initialLogs ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usersById = useMemo(() => {
    const map = new Map<number, User>();
    allUsers.forEach((user) => map.set(user.id, user));
    return map;
  }, [allUsers]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listCustomerLogs(customer.id, { limit: 200 })
      .then((rows) => {
        if (cancelled) return;
        const normalized = Array.isArray(rows)
          ? rows.map((row: any) => parseCustomerLogRow(row))
          : [];
        setLogs(normalized);
      })
      .catch((fetchError) => {
        if (cancelled) return;
        console.error("Failed to load customer logs", fetchError);
        setError("ไม่สามารถโหลดประวัติกิจกรรมได้");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  useEffect(() => {
    if (initialLogs && initialLogs.length) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [logs]);

  const logEntries = useMemo(() => {
    return sortedLogs
      .map((log) => ({
        log,
        summaries: summarizeCustomerLogChanges(log, usersById, {
        }),
      }))
      .filter((entry) => entry.summaries.length > 0);
  }, [sortedLogs, usersById]);
  
  return (
    <Modal title={`ประวัติกิจกรรมทั้งหมด: ${customer.firstName} ${customer.lastName}`} onClose={onClose}>
      <div className="space-y-6">
        {loading && (
          <div className="text-sm text-gray-500 text-center py-6">กำลังโหลดข้อมูล...</div>
        )}
        {!loading && error && (
          <div className="text-sm text-red-600 text-center py-6">{error}</div>
        )}
        {!loading && !error && logEntries.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            ยังไม่มีกิจกรรม
          </div>
        )}
        {!loading && !error && logEntries.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] max-h-[60vh] overflow-y-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3 w-48">เวลา</th>
                    <th className="px-4 py-3 w-48">กิจกรรม</th>
                    <th className="px-4 py-3">รายละเอียดที่เปลี่ยน</th>
                    <th className="px-4 py-3 w-40">ผู้ทำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logEntries.map(({ log, summaries }) => {
                    return (
                      <tr key={log.id} className="align-top">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          <div className="font-medium text-gray-700">
                            {new Date(log.createdAt).toLocaleString("th-TH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </div>
                          <div>{getRelativeTime(log.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                              <ActivityIcon action={log.actionType} />
                            </div>
                            <span className="font-semibold text-gray-800">
                              {actionLabels[log.actionType] ?? log.actionType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <div className="space-y-1">
                            {summaries.map((line, idx) => (
                              <div
                                key={`${log.id}-line-${idx}`}
                                className="flex leading-snug"
                              >
                                <span className="mr-1 text-gray-400">•</span>
                                <span>{line}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {log.createdByName ? log.createdByName : "ระบบ"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ActivityLogModal;
