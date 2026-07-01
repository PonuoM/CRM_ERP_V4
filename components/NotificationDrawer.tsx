import React, { useState, useEffect, useRef } from 'react';
import { getSystemUpdates } from '@/services/api';
import { SystemUpdate } from '@/types';
import { Info, AlertTriangle, CheckCircle, AlertOctagon, X, Bell, Check } from 'lucide-react';
import { formatThaiDateTime } from '@/utils/datetime';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
  onViewAll?: () => void;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, userRole, onViewAll }) => {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load read notifications from localStorage
    const saved = localStorage.getItem('readSystemUpdates');
    if (saved) {
      try {
        setReadIds(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Error parsing read system updates", e);
      }
    }
  }, []);

  const saveReadIds = (ids: Set<number>) => {
    localStorage.setItem('readSystemUpdates', JSON.stringify(Array.from(ids)));
    setReadIds(ids);
    // Dispatch event to update badge in Sidebar
    window.dispatchEvent(new Event('systemUpdatesRead'));
  };

  useEffect(() => {
    if (isOpen) {
      fetchUpdates();
    }
  }, [isOpen, userRole]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchUpdates = async () => {
    setIsLoading(true);
    try {
      const data = await getSystemUpdates();
      if (Array.isArray(data)) {
        const roleUpdates = data.filter(u => {
          if (!u.target_roles) return true;
          const targetRolesArray = u.target_roles.split(',').map(r => r.trim());
          if (targetRolesArray.length === 0 || (targetRolesArray.length === 1 && targetRolesArray[0] === '')) {
            return true;
          }
          return targetRolesArray.includes(userRole);
        });
        roleUpdates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setUpdates(roleUpdates);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const markAllAsRead = () => {
    const allIds = new Set(readIds);
    updates.forEach(u => allIds.add(u.id));
    saveReadIds(allIds);
  };

  const markAsRead = (id: number) => {
    const newIds = new Set(readIds);
    newIds.add(id);
    saveReadIds(newIds);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case 'danger': return <AlertOctagon className="w-5 h-5 text-red-500 flex-shrink-0" />;
      default: return <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />;
    }
  };

  return (
    <>
      {/* Invisible Backdrop to handle clicking outside if needed */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      
      {/* Popover */}
      <div
        ref={drawerRef}
        className={`fixed bottom-16 left-20 lg:left-64 lg:ml-2 w-80 max-h-[75vh] bg-[#1a1a1a] text-white shadow-2xl rounded-xl z-[100] flex flex-col border border-gray-800 transform transition-all duration-200 origin-bottom-left ${
          isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            การแจ้งเตือน
          </h2>
          <div className="flex items-center gap-2">
            {onViewAll && (
              <button
                onClick={onViewAll}
                className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded transition-colors"
              >
                ดูทั้งหมด
              </button>
            )}
            <button
              onClick={markAllAsRead}
              className="text-[11px] flex items-center gap-1 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400 px-2 py-1 rounded transition-colors"
              title="อ่านทั้งหมด"
            >
              <Check className="w-3 h-3" /> อ่านทั้งหมด
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-full lg:hidden">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
            </div>
          ) : updates.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <Info className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              ไม่มีการแจ้งเตือน
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {updates.map(update => {
                const isUnread = !readIds.has(update.id);
                return (
                  <div
                    key={update.id}
                    onClick={() => markAsRead(update.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-800/80 transition-colors flex items-start gap-3 relative ${
                      isUnread ? 'bg-[#2a2a2a]' : ''
                    }`}
                  >
                    <div className="mt-0.5">
                      {getIcon(update.type)}
                    </div>
                    <div className="flex-1 pr-4">
                      <h4 className={`text-sm ${isUnread ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
                        {update.title}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1.5 whitespace-pre-wrap">{update.message}</p>
                      {update.image_url && (() => {
                        let images: string[] = [];
                        try {
                          images = JSON.parse(update.image_url);
                        } catch {
                          images = [update.image_url];
                        }
                        if (images.length === 0) return null;
                        
                        return (
                          <div className="mt-2 relative inline-block">
                            <img src={images[0]} alt="Update" className="rounded-md max-w-full h-auto max-h-32 object-contain bg-gray-800" />
                            {images.length > 1 && (
                              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded-md pointer-events-none">
                                <span className="text-white font-medium text-xs px-2 py-1 bg-black bg-opacity-50 rounded-full">
                                  +{images.length - 1} รูปภาพ
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="text-[10px] text-gray-500 mt-2 font-medium">
                        {formatThaiDateTime(update.created_at)}
                      </div>
                    </div>
                    {isUnread && (
                      <span className="absolute top-1/2 right-4 -translate-y-1/2 w-2 h-2 bg-gray-400 rounded-full"></span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationDrawer;
