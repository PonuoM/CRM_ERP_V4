import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { MapPin, Briefcase, Plus, Edit2, Trash2, CheckCircle, XCircle, Navigation } from 'lucide-react';
import Modal from '../components/Modal';

interface WorkLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: number;
}

interface CompanyGeo {
  id: number;
  name: string;
  prefix: string;
  enable_geofencing: number;
  work_location_ids: number[];
}

export default function GeoCompanySettingsPage() {
  const [activeTab, setActiveTab] = useState<'locations' | 'companies'>('locations');
  
  // Data state
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [companies, setCompanies] = useState<CompanyGeo[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<WorkLocation | null>(null);
  
  // Form states
  const [locForm, setLocForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius_meters: '100',
    is_active: 1
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locRes, compRes] = await Promise.all([
        apiFetch('geo_locations'),
        apiFetch('geo_companies')
      ]);
      setLocations(locRes.data || []);
      setCompanies(compRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openLocModal = (loc?: WorkLocation) => {
    setError('');
    if (loc) {
      setEditingLoc(loc);
      setLocForm({
        name: loc.name,
        latitude: loc.latitude.toString(),
        longitude: loc.longitude.toString(),
        radius_meters: loc.radius_meters.toString(),
        is_active: loc.is_active
      });
    } else {
      setEditingLoc(null);
      setLocForm({
        name: '',
        latitude: '',
        longitude: '',
        radius_meters: '100',
        is_active: 1
      });
    }
    setIsLocModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    try {
      const payload = {
        name: locForm.name,
        latitude: parseFloat(locForm.latitude),
        longitude: parseFloat(locForm.longitude),
        radius_meters: parseInt(locForm.radius_meters, 10),
        is_active: locForm.is_active
      };

      if (editingLoc) {
        await apiFetch(`geo_locations/${editingLoc.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('geo_locations', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setIsLocModalOpen(false);
      setSuccess('Location saved successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      await apiFetch(`geo_locations/${id}`, { method: 'DELETE' });
      setSuccess('Location deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const handleCompanyUpdate = async (companyId: number, enableGeofencing: number, locationIds: number[]) => {
    try {
      await apiFetch(`geo_companies/update`, {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          enable_geofencing: enableGeofencing,
          work_location_ids: locationIds
        })
      });
      // Update local state for immediate feedback
      setCompanies(prev => prev.map(c => 
        c.id === companyId 
          ? { ...c, enable_geofencing: enableGeofencing, work_location_ids: locationIds } 
          : c
      ));
      setSuccess('Company settings updated');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e: any) {
      alert(e.message || 'Failed to update company');
      fetchData(); // reload on error
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่ง (Geolocation)');
      return;
    }
    
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocForm(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }));
        setSaving(false);
      },
      (err) => {
        setSaving(false);
        setError('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาอนุญาตให้เข้าถึง Location ก่อนครับ');
      }
    );
  };

  const renderMapPreview = () => {
    const lat = parseFloat(locForm.latitude);
    const lng = parseFloat(locForm.longitude);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      return (
        <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 border border-dashed border-gray-300">
          กรอก Latitude และ Longitude เพื่อดูแผนที่
        </div>
      );
    }

    const bboxSize = 0.005;
    const bbox = `${lng - bboxSize},${lat - bboxSize},${lng + bboxSize},${lat + bboxSize}`;
    
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-300 relative">
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
          title="Map Preview"
        ></iframe>
        <div className="absolute bottom-1 right-1 bg-white px-2 py-1 text-xs rounded opacity-75 shadow">
          © OpenStreetMap contributors
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-indigo-600" /> 
            ตั้งค่าพื้นที่ทำงาน Geo-fencing
          </h1>
          <p className="text-gray-500 mt-1">จัดการพิกัดส่วนกลางและผูกพิกัดเข้ากับบริษัทต่างๆ</p>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-2">
          <CheckCircle size={20} /> {success}
        </div>
      )}
      
      {error && !isLocModalOpen && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
          <XCircle size={20} /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === 'locations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('locations')}
        >
          <MapPin size={18} /> พื้นที่ส่วนกลาง (Work Locations)
        </button>
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
            activeTab === 'companies' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('companies')}
        >
          <Briefcase size={18} /> จัดการรายบริษัท (Company Settings)
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {activeTab === 'locations' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">พิกัดพื้นที่ทั้งหมด</h2>
                <button
                  onClick={() => openLocModal()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={16} /> เพิ่มพื้นที่ใหม่
                </button>
              </div>

              {locations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  ยังไม่มีพิกัดพื้นที่ทำงาน
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                        <th className="p-3 font-medium rounded-tl-lg">ID</th>
                        <th className="p-3 font-medium">ชื่อพื้นที่</th>
                        <th className="p-3 font-medium">พิกัด (Lat, Lng)</th>
                        <th className="p-3 font-medium">รัศมี (เมตร)</th>
                        <th className="p-3 font-medium">สถานะ</th>
                        <th className="p-3 font-medium text-right rounded-tr-lg">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map(loc => (
                        <tr key={loc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-500 text-sm">#{loc.id}</td>
                          <td className="p-3 font-medium text-gray-900">{loc.name}</td>
                          <td className="p-3 text-gray-600 text-sm font-mono">{loc.latitude}, {loc.longitude}</td>
                          <td className="p-3 text-gray-600 text-sm">{loc.radius_meters}m</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              loc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {loc.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => openLocModal(loc)}
                              className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50 mr-2 transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(loc.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-800">ตั้งค่าพิกัดรายบริษัท</h2>
                <p className="text-sm text-gray-500">เลือกบริษัทที่จะเปิดใช้งานระบบบังคับล็อกอินตามพื้นที่ และระบุจุดที่อนุญาต</p>
              </div>

              <div className="space-y-6">
                {companies.map(company => (
                  <div key={company.id} className="border border-gray-200 rounded-lg p-5 bg-gray-50 hover:bg-white transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                          {company.name} <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">ID: {company.id}</span>
                        </h3>
                      </div>
                      
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={company.enable_geofencing === 1}
                            onChange={(e) => {
                              handleCompanyUpdate(
                                company.id, 
                                e.target.checked ? 1 : 0, 
                                company.work_location_ids
                              );
                            }}
                          />
                          <div className={`block w-14 h-8 rounded-full transition-colors ${company.enable_geofencing ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${company.enable_geofencing ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-sm font-medium text-gray-700">
                          {company.enable_geofencing ? 'เปิดใช้งาน Geo-fencing' : 'ปิดใช้งาน'}
                        </div>
                      </label>
                    </div>

                    <div className={`pt-4 border-t border-gray-200 transition-opacity ${company.enable_geofencing ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">พื้นที่ที่อนุญาตให้ล็อกอิน:</h4>
                      
                      {locations.length === 0 ? (
                        <p className="text-sm text-red-500">คุณยังไม่ได้สร้างพิกัดพื้นที่ส่วนกลาง</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {locations.map(loc => {
                            const isSelected = company.work_location_ids.includes(loc.id);
                            return (
                              <label 
                                key={loc.id} 
                                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                                  isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center h-5">
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      let newIds = [...company.work_location_ids];
                                      if (e.target.checked) {
                                        newIds.push(loc.id);
                                      } else {
                                        newIds = newIds.filter(id => id !== loc.id);
                                      }
                                      handleCompanyUpdate(company.id, company.enable_geofencing, newIds);
                                    }}
                                  />
                                </div>
                                <div className="ml-3 text-sm">
                                  <span className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>{loc.name}</span>
                                  <p className={`text-xs mt-1 ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>รัศมี: {loc.radius_meters}m</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Location Modal */}
      {isLocModalOpen && (
        <Modal 
          onClose={() => !saving && setIsLocModalOpen(false)}
          title={editingLoc ? "แก้ไขพื้นที่ทำงาน" : "เพิ่มพื้นที่ทำงานใหม่"}
          size="lg"
        >
          <form onSubmit={handleSaveLocation} className="space-y-5 min-w-[400px]">
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">ชื่อเรียกพื้นที่ (Name)</label>
              <input
                required
                type="text"
                className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-4 py-3 text-base text-gray-900 transition-shadow"
                placeholder="e.g. สำนักงานใหญ่ (HQ)"
                value={locForm.name}
                onChange={e => setLocForm({...locForm, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-100 shadow-sm"
                  disabled={saving}
                >
                  <Navigation size={16} />
                  ดึงพิกัดปัจจุบัน
                </button>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Latitude</label>
                <input
                  required
                  type="number"
                  step="any"
                  className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-4 py-3 text-base font-mono text-gray-900 transition-shadow"
                  placeholder="13.7563"
                  value={locForm.latitude}
                  onChange={e => setLocForm({...locForm, latitude: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Longitude</label>
                <input
                  required
                  type="number"
                  step="any"
                  className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-4 py-3 text-base font-mono text-gray-900 transition-shadow"
                  placeholder="100.5018"
                  value={locForm.longitude}
                  onChange={e => setLocForm({...locForm, longitude: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">รัศมีที่อนุญาต (เมตร)</label>
              <input
                required
                type="number"
                min="10"
                className="w-full border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 px-4 py-3 text-base text-gray-900 transition-shadow"
                placeholder="100"
                value={locForm.radius_meters}
                onChange={e => setLocForm({...locForm, radius_meters: e.target.value})}
              />
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400"></span> แนะนำ 100-500 เมตร (ค่าความคลาดเคลื่อนของ GPS บนมือถือมักจะอยู่ที่ ~20 เมตร)
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={locForm.is_active === 1}
                  onChange={e => setLocForm({...locForm, is_active: e.target.checked ? 1 : 0})}
                />
                <span className="ml-3 text-base font-medium text-gray-800">เปิดใช้งาน (Active)</span>
              </label>
            </div>

            <div className="mt-6">
              <p className="block text-sm font-semibold text-gray-700 mb-3">แสดงตัวอย่างแผนที่ (Preview)</p>
              <div className="shadow-sm rounded-lg overflow-hidden border border-gray-200">
                {renderMapPreview()}
              </div>
            </div>

            <div className="pt-6 flex justify-end gap-3 border-t border-gray-200 mt-8">
              <button
                type="button"
                onClick={() => setIsLocModalOpen(false)}
                className="px-6 py-2.5 border border-gray-300 rounded-lg shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center min-w-[120px] transition-colors"
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
