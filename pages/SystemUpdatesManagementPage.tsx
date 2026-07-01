import React, { useState, useEffect } from 'react';
import { getSystemUpdates, createSystemUpdate, updateSystemUpdate, deleteSystemUpdate } from '@/services/api';
import { SystemUpdate, UserRole } from '@/types';
import { Plus, Edit, Trash2, X, AlertTriangle, Info, CheckCircle, AlertOctagon } from 'lucide-react';
import { formatThaiDateTime } from '@/utils/datetime';
const SystemUpdatesManagementPage: React.FC = () => {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [retainedImages, setRetainedImages] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'danger',
    is_active: 1,
    target_roles: ''
  });

  const fetchUpdates = async () => {
    setIsLoading(true);
    try {
      const data = await getSystemUpdates();
      if (Array.isArray(data)) {
        setUpdates(data);
      }
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถดึงข้อมูลการอัปเดตได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  const handleOpenModal = (update?: SystemUpdate) => {
    setSelectedImages([]);
    setNewImagePreviews([]);
    setRetainedImages([]);
    
    if (update) {
      setEditingUpdate(update);
      
      let parsedImages: string[] = [];
      if (update.image_url) {
        try {
          parsedImages = JSON.parse(update.image_url);
        } catch {
          // Fallback if it's a single string URL
          parsedImages = [update.image_url];
        }
      }
      setRetainedImages(parsedImages);
      
      setFormData({
        title: update.title,
        message: update.message,
        type: update.type,
        is_active: Number(update.is_active),
        target_roles: update.target_roles || ''
      });
    } else {
      setEditingUpdate(null);
      setFormData({
        title: '',
        message: '',
        type: 'info',
        is_active: 1,
        target_roles: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...filesArray]);
      
      const newPreviews = filesArray.map(file => URL.createObjectURL(file));
      setNewImagePreviews(prev => [...prev, ...newPreviews]);
    }
    // reset input so same file can be selected again if needed
    e.target.value = '';
  };

  const handleRemoveNewImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleRemoveRetainedImage = (index: number) => {
    setRetainedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('message', formData.message);
      submitData.append('type', formData.type);
      submitData.append('is_active', String(formData.is_active));
      if (formData.target_roles) {
        submitData.append('target_roles', formData.target_roles);
      } else {
        submitData.append('target_roles', '');
      }
      
      if (selectedImages.length > 0) {
        selectedImages.forEach(file => {
          submitData.append('images[]', file);
        });
      }
      if (retainedImages.length > 0) {
        retainedImages.forEach(url => {
          submitData.append('retained_images[]', url);
        });
      }

      if (editingUpdate) {
        await updateSystemUpdate(editingUpdate.id, submitData);
      } else {
        await createSystemUpdate(submitData);
      }
      setIsModalOpen(false);
      fetchUpdates();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนนี้?')) return;
    try {
      await deleteSystemUpdate(id);
      fetchUpdates();
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการลบ: ${err.message || 'Unknown error'}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'danger': return <AlertOctagon className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">จัดการการแจ้งเตือนอัปเดตระบบ</h1>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          สร้างการแจ้งเตือน
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หัวข้อ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">กลุ่มเป้าหมาย</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้สร้าง</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">กำลังโหลด...</td>
              </tr>
            ) : updates.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">ไม่พบข้อมูลการอัปเดต</td>
              </tr>
            ) : (
              updates.map((update) => (
                <tr key={update.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getIcon(update.type)}
                      <span className="ml-2 capitalize">{update.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{update.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">{update.message}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {Number(update.is_active) === 1 ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        เปิดใช้งาน
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        ปิดใช้งาน
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {update.target_roles ? (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {update.target_roles.split(',').map((role, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">
                            {role.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-600">
                        ทั้งหมด
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {update.first_name} {update.last_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatThaiDateTime(update.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(update)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <Edit className="w-5 h-5 inline" />
                    </button>
                    <button
                      onClick={() => handleDelete(update.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{editingUpdate ? 'แก้ไขการแจ้งเตือน' : 'สร้างการแจ้งเตือน'}</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-1">หัวข้อ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="ตัวอย่าง: ปิดปรับปรุงระบบคืนนี้"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-1">ข้อความ <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={4}
                  placeholder="รายละเอียดการอัปเดต..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                ></textarea>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-1">ประเภท</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="info">ข้อมูลทั่วไป (สีฟ้า)</option>
                  <option value="warning">คำเตือน (สีเหลือง)</option>
                  <option value="success">สำเร็จ (สีเขียว)</option>
                  <option value="danger">อันตราย (สีแดง)</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-gray-700 text-sm font-semibold">กลุ่มเป้าหมาย</label>
                  <span className="text-xs text-gray-500 font-medium">เว้นว่างเพื่อแสดงให้ทุกคนเห็น</span>
                </div>
                <div className="grid grid-cols-2 gap-3 border border-gray-200 rounded-lg p-4 bg-gray-50/50 max-h-48 overflow-y-auto shadow-inner">
                  {Object.values(UserRole).map((role) => {
                    const currentRoles = formData.target_roles ? formData.target_roles.split(',').map(r => r.trim()) : [];
                    const isChecked = currentRoles.includes(role);
                    return (
                      <label key={role} className="flex items-center text-sm cursor-pointer group">
                        <input
                          type="checkbox"
                          className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all"
                          checked={isChecked}
                          onChange={(e) => {
                            let newRoles = [...currentRoles];
                            if (e.target.checked) {
                              newRoles.push(role);
                            } else {
                              newRoles = newRoles.filter(r => r !== role);
                            }
                            setFormData({ ...formData, target_roles: newRoles.join(',') });
                          }}
                        />
                        <span className="text-gray-700 group-hover:text-blue-700 transition-colors font-medium">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-1">รูปภาพประกอบ (ไม่บังคับ, อัปโหลดได้หลายรูป)</label>
                
                <div className="flex flex-wrap gap-4 mb-3">
                  {retainedImages.map((url, idx) => (
                    <div key={`retained-${idx}`} className="relative inline-block">
                      <img src={url} alt={`Retained ${idx}`} className="h-24 w-auto rounded-lg border border-gray-200 object-contain" />
                      <button
                        type="button"
                        onClick={() => handleRemoveRetainedImage(idx)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {newImagePreviews.map((url, idx) => (
                    <div key={`new-${idx}`} className="relative inline-block">
                      <img src={url} alt={`New ${idx}`} className="h-24 w-auto rounded-lg border border-blue-200 object-contain" />
                      <div className="absolute top-1 left-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded shadow">ใหม่</div>
                      <button
                        type="button"
                        onClick={() => handleRemoveNewImage(idx)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleImageChange}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
                />
              </div>
              <div className="flex items-center p-4 border border-gray-200 rounded-lg bg-gray-50">
                <input
                  type="checkbox"
                  id="isActive"
                  className="mr-3 w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                  checked={formData.is_active === 1}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="isActive" className="text-gray-800 text-sm font-bold cursor-pointer select-none">
                  เปิดใช้งาน (แสดงให้ผู้ใช้เห็นทันที)
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemUpdatesManagementPage;
