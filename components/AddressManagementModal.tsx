import React, { useState, useEffect, useRef } from 'react';
import { Customer, CustomerAddress } from '../types';
import Modal from './Modal';
import { MapPin, Plus, Edit, Trash2, CheckCircle, Home, Phone, X } from 'lucide-react';
import { 
  listCustomerAddresses, 
  createCustomerAddress, 
  updateCustomerAddress, 
  deleteCustomerAddress 
} from '../services/api';
import resolveApiBasePath from '../utils/apiBasePath';

interface AddressManagementModalProps {
  customer: Customer;
  onClose: () => void;
  onPrimaryAddressChange?: () => void;
}

interface AddressData {
  id: number;
  name_th: string;
  zip_code?: string;
}

const AddressManagementModal: React.FC<AddressManagementModalProps> = ({ 
  customer, 
  onClose,
  onPrimaryAddressChange
}) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  
  // Custom Autocomplete States
  const [provinces, setProvinces] = useState<AddressData[]>([]);
  const [districts, setDistricts] = useState<AddressData[]>([]);
  const [subDistricts, setSubDistricts] = useState<AddressData[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);

  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedSubDistrict, setSelectedSubDistrict] = useState<number | null>(null);

  const [provinceSearchTerm, setProvinceSearchTerm] = useState('');
  const [districtSearchTerm, setDistrictSearchTerm] = useState('');
  const [subDistrictSearchTerm, setSubDistrictSearchTerm] = useState('');

  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showSubDistrictDropdown, setShowSubDistrictDropdown] = useState(false);

  const provinceRef = useRef<HTMLDivElement>(null);
  const districtRef = useRef<HTMLDivElement>(null);
  const subDistrictRef = useRef<HTMLDivElement>(null);

  const customerId = customer.pk || customer.id || customer.customer_id;

  const loadAddresses = async () => {
    setIsLoading(true);
    try {
      const res = await listCustomerAddresses(String(customerId));
      if (res.success) {
        setAddresses(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [customerId]);

  useEffect(() => {
    const loadProvinces = async () => {
      setAddressLoading(true);
      try {
        const response = await fetch(`${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=provinces`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setProvinces(data.data || []);
          }
        }
      } catch (error) {
        console.error('Error loading provinces:', error);
      } finally {
        setAddressLoading(false);
      }
    };
    loadProvinces();
  }, []);

  useEffect(() => {
    if (editingAddress && provinces.length > 0) {
      if (editingAddress.province) {
        const province = provinces.find(p => p.name_th === editingAddress.province);
        if (province) {
          setSelectedProvince(province.id);
          setProvinceSearchTerm(province.name_th);
        } else {
          setProvinceSearchTerm(editingAddress.province);
        }
      }
    }
  }, [editingAddress, provinces]);

  useEffect(() => {
    if (selectedProvince) {
      fetch(`${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${selectedProvince}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setDistricts(data.data || []);
            // Check district
            if (editingAddress?.district) {
              const district = data.data?.find((d: AddressData) => d.name_th === editingAddress.district);
              if (district) {
                setSelectedDistrict(district.id);
                setDistrictSearchTerm(district.name_th);
              } else {
                setDistrictSearchTerm(editingAddress.district);
              }
            }
          }
        })
        .catch(error => console.error('Error loading districts:', error));
    } else {
      setDistricts([]);
      setSubDistricts([]);
      setSelectedDistrict(null);
      setSelectedSubDistrict(null);
    }
  }, [selectedProvince, editingAddress?.district]);

  useEffect(() => {
    if (selectedDistrict) {
      fetch(`${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${selectedDistrict}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setSubDistricts(data.data || []);
            // Check subdistrict
            if (editingAddress?.subdistrict) {
              const subDistrict = data.data?.find((sd: AddressData) =>
                sd.name_th === editingAddress.subdistrict &&
                (!editingAddress.zipCode || String(sd.zip_code) === String(editingAddress.zipCode))
              ) || data.data?.find((sd: AddressData) => sd.name_th === editingAddress.subdistrict);

              if (subDistrict) {
                setSelectedSubDistrict(subDistrict.id);
                setSubDistrictSearchTerm(subDistrict.name_th);
                if (subDistrict.zip_code && editingAddress) {
                  setEditingAddress({ ...editingAddress, zipCode: subDistrict.zip_code });
                }
              } else {
                setSubDistrictSearchTerm(editingAddress.subdistrict);
              }
            }
          }
        })
        .catch(error => console.error('Error loading sub-districts:', error));
    } else {
      setSubDistricts([]);
      setSelectedSubDistrict(null);
    }
  }, [selectedDistrict, editingAddress?.subdistrict]);

  useEffect(() => {
    if (selectedSubDistrict && subDistricts.length > 0 && editingAddress) {
      const subDistrict = subDistricts.find(sd => sd.id === selectedSubDistrict);
      if (subDistrict) {
        const district = districts.find(d => d.id === selectedDistrict);
        const province = provinces.find(p => p.id === selectedProvince);
        
        setEditingAddress({
           ...editingAddress,
           subdistrict: subDistrict.name_th,
           district: district?.name_th || editingAddress.district || '',
           province: province?.name_th || editingAddress.province || '',
           zipCode: subDistrict.zip_code || editingAddress.zipCode || ''
        });
      }
    }
  }, [selectedSubDistrict]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (provinceRef.current && !provinceRef.current.contains(event.target as Node)) {
        setShowProvinceDropdown(false);
      }
      if (districtRef.current && !districtRef.current.contains(event.target as Node)) {
        setShowDistrictDropdown(false);
      }
      if (subDistrictRef.current && !subDistrictRef.current.contains(event.target as Node)) {
        setShowSubDistrictDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetFormState = () => {
    setSelectedProvince(null);
    setSelectedDistrict(null);
    setSelectedSubDistrict(null);
    setProvinceSearchTerm('');
    setDistrictSearchTerm('');
    setSubDistrictSearchTerm('');
  };

  const handleAddNew = () => {
    resetFormState();
    setEditingAddress({
      id: 0,
      customerId: String(customerId),
      recipientFirstName: customer.firstName,
      recipientLastName: customer.lastName,
      address: '',
      subdistrict: '',
      district: '',
      province: '',
      zipCode: ''
    });
    setIsFormVisible(true);
  };

  const handleEdit = (addr: CustomerAddress) => {
    resetFormState();
    setEditingAddress({ ...addr });
    setIsFormVisible(true);
  };

  const handleDelete = async (addressId: number | string) => {
    if (!window.confirm("คุณมั่นใจหรือไม่ที่จะลบที่อยู่นี้?")) return;
    
    setIsLoading(true);
    try {
      const res = await deleteCustomerAddress(addressId);
      if (res.success) {
        await loadAddresses();
      }
    } catch (e) {
      console.error(e);
      alert("ไม่สามารถลบที่อยู่ได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingAddress) return;
    setIsSaving(true);
    try {
      // Validate address relationships
      try {
        const addressValidationResponse = await fetch(
          `${resolveApiBasePath()}/Address_DB/check_exist.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              province: editingAddress.province,
              district: editingAddress.district,
              subdistrict: editingAddress.subdistrict,
              postalCode: editingAddress.zipCode,
            }),
          },
        );

        const addressValidationResult = await addressValidationResponse.json();

        if (
          !addressValidationResult.success ||
          !addressValidationResult.valid
        ) {
          alert(
            addressValidationResult.message ||
            "ที่อยู่ไม่สัมพันธ์กัน (จังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์) กรุณาตรวจสอบและระบุที่อยู่อีกครั้ง"
          );
          setIsSaving(false);
          return;
        }
      } catch (error) {
        console.error("Error validating address:", error);
        alert("เกิดข้อผิดพลาดในการตรวจสอบที่อยู่ กรุณาลองใหม่อีกครั้ง");
        setIsSaving(false);
        return;
      }

      if (editingAddress.id && editingAddress.id !== 0) {
        // Update
        await updateCustomerAddress(String(customerId), editingAddress.id, editingAddress);
        if (editingAddress.id === 'primary' && onPrimaryAddressChange) {
           onPrimaryAddressChange();
        }
      } else {
        // Create
        await createCustomerAddress(String(customerId), editingAddress);
      }
      setIsFormVisible(false);
      setEditingAddress(null);
      await loadAddresses();
    } catch (e) {
      console.error(e);
      alert("ไม่สามารถบันทึกที่อยู่ได้");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddressChange = (field: keyof CustomerAddress, value: string) => {
    if (editingAddress) {
      setEditingAddress({ ...editingAddress, [field]: value });
    }
  };

  const filteredProvinces = provinces.filter(p =>
    p.name_th.toLowerCase().includes(provinceSearchTerm.toLowerCase())
  );

  const filteredDistricts = districts.filter(d =>
    d.name_th.toLowerCase().includes(districtSearchTerm.toLowerCase())
  );

  const filteredSubDistricts = subDistricts.filter(sd =>
    sd.name_th.toLowerCase().includes(subDistrictSearchTerm.toLowerCase())
  );

  const commonInputClass = "w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500";
  const commonLabelClass = "block text-gray-700 font-medium mb-1";

  return (
    <Modal
      title="จัดการที่อยู่"
      onClose={onClose}
    >
      <div className="max-h-[80vh] overflow-y-auto">
        {!isFormVisible ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">ที่อยู่ทั้งหมด ({addresses.length})</h3>
              <button 
                onClick={handleAddNew}
                className="flex items-center text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
              >
                <Plus size={16} className="mr-1" /> เพิ่มสมุดที่อยู่
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-6 text-gray-500">กำลังโหลดข้อมูล...</div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div key={addr.id} className={`border rounded-lg p-4 relative ${addr.isPrimary ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                    {addr.isPrimary && (
                      <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg font-medium flex items-center">
                        <Home size={12} className="mr-1" /> ที่อยู่หลัก
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                          {addr.recipientFirstName} {addr.recipientLastName}
                        </p>
                        {addr.phone && (
                          <p className="text-sm text-gray-600 mt-1 flex items-center">
                            <Phone size={14} className="mr-1" /> {addr.phone}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 mt-1">
                          {addr.address} 
                          {addr.subdistrict && ` ต.${addr.subdistrict}`} 
                          {addr.district && ` อ.${addr.district}`} 
                          {addr.province && ` จ.${addr.province}`} 
                          {addr.zipCode && ` ${addr.zipCode}`}
                        </p>
                      </div>
                      <div className="flex space-x-2 mt-2 md:mt-0">
                        <button 
                          onClick={() => handleEdit(addr)}
                          className="text-gray-500 hover:text-blue-600 p-1"
                          title="แก้ไข"
                        >
                          <Edit size={16} />
                        </button>
                        {!addr.isPrimary && (
                          <button 
                            onClick={() => handleDelete(addr.id)}
                            className="text-gray-500 hover:text-red-600 p-1"
                            title="ลบ"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <h3 className="font-semibold text-gray-800 flex items-center">
                <MapPin size={18} className="mr-2 text-blue-600" />
                {editingAddress?.id === 0 ? 'เพิ่มที่อยู่ใหม่' : 'แก้ไขที่อยู่'}
                {editingAddress?.isPrimary && ' (ที่อยู่หลัก)'}
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={commonLabelClass}>ชื่อผู้รับ</label>
                <input
                  type="text"
                  value={editingAddress?.recipientFirstName || ''}
                  onChange={(e) => handleAddressChange('recipientFirstName', e.target.value)}
                  className={commonInputClass}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className={commonLabelClass}>นามสกุลผู้รับ</label>
                <input
                  type="text"
                  value={editingAddress?.recipientLastName || ''}
                  onChange={(e) => handleAddressChange('recipientLastName', e.target.value)}
                  className={commonInputClass}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div>
              <label className={commonLabelClass}>รายละเอียดที่อยู่ (เลขที่ หมู่ ซอย ถนน)</label>
              <textarea
                value={editingAddress?.address || ''}
                onChange={(e) => handleAddressChange('address', e.target.value)}
                className={commonInputClass}
                rows={2}
                disabled={isSaving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Province Selector */}
              <div className="relative" ref={provinceRef}>
                <label className={commonLabelClass}>จังหวัด</label>
                <input
                  type="text"
                  value={
                    selectedProvince && !provinceSearchTerm
                      ? provinces.find(p => p.id === selectedProvince)?.name_th || ""
                      : provinceSearchTerm
                  }
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setProvinceSearchTerm(newValue);
                    setShowProvinceDropdown(true);
                    if (selectedProvince) {
                      const currentProvinceName = provinces.find(p => p.id === selectedProvince)?.name_th || "";
                      if (newValue !== currentProvinceName) {
                        setSelectedProvince(null);
                        setSelectedDistrict(null);
                        setSelectedSubDistrict(null);
                        handleAddressChange('province', newValue);
                        handleAddressChange('district', '');
                        handleAddressChange('subdistrict', '');
                      }
                    } else {
                      handleAddressChange('province', newValue);
                    }
                  }}
                  onFocus={() => setShowProvinceDropdown(true)}
                  disabled={addressLoading || isSaving}
                  className={commonInputClass + (addressLoading ? " bg-slate-100" : "")}
                  placeholder="ค้นหาหรือเลือกจังหวัด"
                />
                {showProvinceDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredProvinces.map((province) => (
                      <div
                        key={province.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSelectedProvince(province.id);
                          setProvinceSearchTerm("");
                          setShowProvinceDropdown(false);
                          handleAddressChange('province', province.name_th);
                        }}
                      >
                        {province.name_th}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* District Selector */}
              <div className="relative" ref={districtRef}>
                <label className={commonLabelClass}>อำเภอ/เขต</label>
                <input
                  type="text"
                  value={
                    selectedDistrict && !districtSearchTerm
                      ? districts.find(d => d.id === selectedDistrict)?.name_th || ""
                      : districtSearchTerm
                  }
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setDistrictSearchTerm(newValue);
                    setShowDistrictDropdown(true);
                    if (selectedDistrict) {
                      const currentDistrictName = districts.find(d => d.id === selectedDistrict)?.name_th || "";
                      if (newValue !== currentDistrictName) {
                        setSelectedDistrict(null);
                        setSelectedSubDistrict(null);
                        handleAddressChange('district', newValue);
                        handleAddressChange('subdistrict', '');
                      }
                    } else {
                      handleAddressChange('district', newValue);
                    }
                  }}
                  onFocus={() => setShowDistrictDropdown(true)}
                  disabled={!selectedProvince || addressLoading || isSaving}
                  className={commonInputClass + (!selectedProvince || addressLoading ? " bg-slate-100" : "")}
                  placeholder="ค้นหาหรือเลือกอำเภอ/เขต"
                />
                {showDistrictDropdown && selectedProvince && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredDistricts.map((district) => (
                      <div
                        key={district.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSelectedDistrict(district.id);
                          setDistrictSearchTerm("");
                          setShowDistrictDropdown(false);
                          handleAddressChange('district', district.name_th);
                        }}
                      >
                        {district.name_th}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sub-District Selector */}
              <div className="relative" ref={subDistrictRef}>
                <label className={commonLabelClass}>ตำบล/แขวง</label>
                <input
                  type="text"
                  value={
                    selectedSubDistrict && !subDistrictSearchTerm
                      ? subDistricts.find(sd => sd.id === selectedSubDistrict)?.name_th || ""
                      : subDistrictSearchTerm
                  }
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSubDistrictSearchTerm(newValue);
                    setShowSubDistrictDropdown(true);
                    if (selectedSubDistrict) {
                      const currentSubDistrictName = subDistricts.find(sd => sd.id === selectedSubDistrict)?.name_th || "";
                      if (newValue !== currentSubDistrictName) {
                        setSelectedSubDistrict(null);
                        handleAddressChange('subdistrict', newValue);
                      }
                    } else {
                      handleAddressChange('subdistrict', newValue);
                    }
                  }}
                  onFocus={() => setShowSubDistrictDropdown(true)}
                  disabled={!selectedDistrict || addressLoading || isSaving}
                  className={commonInputClass + (!selectedDistrict || addressLoading ? " bg-slate-100" : "")}
                  placeholder="ค้นหาหรือเลือกตำบล/แขวง"
                />
                {showSubDistrictDropdown && selectedDistrict && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredSubDistricts.map((subDistrict) => (
                      <div
                        key={subDistrict.id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setSelectedSubDistrict(subDistrict.id);
                          setSubDistrictSearchTerm("");
                          setShowSubDistrictDropdown(false);
                          handleAddressChange('subdistrict', subDistrict.name_th);
                          if (subDistrict.zip_code) {
                            handleAddressChange('zipCode', subDistrict.zip_code);
                          }
                        }}
                      >
                        {subDistrict.name_th} {subDistrict.zip_code ? `(${subDistrict.zip_code})` : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Postal Code */}
              <div>
                <label className={commonLabelClass}>รหัสไปรษณีย์</label>
                <input
                  type="text"
                  value={editingAddress?.zipCode || ''}
                  onChange={(e) => handleAddressChange('zipCode', e.target.value)}
                  className={commonInputClass}
                  placeholder="รหัสไปรษณีย์"
                  maxLength={5}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t mt-4">
              <button
                onClick={() => { setIsFormVisible(false); setEditingAddress(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                disabled={isSaving}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกที่อยู่'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AddressManagementModal;
