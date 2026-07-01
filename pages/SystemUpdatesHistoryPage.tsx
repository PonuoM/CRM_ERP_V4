import React, { useState, useEffect } from 'react';
import { getSystemUpdates } from '@/services/api';
import { SystemUpdate } from '@/types';
import { Info, AlertTriangle, CheckCircle, AlertOctagon, Bell } from 'lucide-react';
import { formatThaiDateTime } from '@/utils/datetime';

const SystemUpdatesHistoryPage: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingImages, setViewingImages] = useState<string[] | null>(null);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      const data = await getSystemUpdates();
      // Sort by created_at desc
      data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setUpdates(data);
    } catch (error) {
      console.error('Error fetching system updates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'danger': return <AlertOctagon className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-600" /> ประวัติการแจ้งเตือน
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : updates.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Info className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg">ไม่มีประวัติการแจ้งเตือน</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {updates.map(update => (
              <div key={update.id} className="p-6 hover:bg-gray-50 transition-colors flex items-start gap-4">
                <div className="mt-1">
                  {getIcon(update.type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900">{update.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{update.message}</p>
                  {update.image_url && (() => {
                    let images: string[] = [];
                    try {
                      images = JSON.parse(update.image_url);
                    } catch {
                      images = [update.image_url];
                    }
                    if (images.length === 0) return null;
                    
                    return (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {images.map((img, idx) => (
                          <div key={idx} className="relative cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setViewingImages(images)}>
                            <img src={img} alt={`Update ${idx}`} className="rounded-lg max-w-full h-auto max-h-64 object-contain border border-gray-200 shadow-sm" />
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="text-xs text-gray-400 mt-3 font-medium">
                    {formatThaiDateTime(update.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingImages && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
          <div className="absolute top-4 right-4">
            <button onClick={() => setViewingImages(null)} className="text-white hover:text-gray-300 bg-gray-800 rounded-full p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col gap-4">
            {viewingImages.map((img, idx) => (
              <img key={idx} src={img} alt={`View ${idx}`} className="w-full h-auto object-contain rounded-lg border border-gray-700" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemUpdatesHistoryPage;
