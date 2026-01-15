import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '../types';
import Modal from './Modal';
import { Facebook, MessageSquare, Phone } from 'lucide-react';
import resolveApiBasePath from '../utils/apiBasePath';

interface EditCustomerModalProps {
  customer: Customer;
  onSave: (customer: Customer) => Promise<void> | void;
  onClose: () => void;
}

interface AddressData {
  id: number;
  name_th: string;
  zip_code?: string;
}

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({ customer, onSave, onClose }) => {
  const [formData, setFormData] = useState<Customer>(customer);
  const [backupPhoneError, setBackupPhoneError] = useState('');

  // Address selector states
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

  // Load provinces on mount
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

  // Initialize address fields from customer data
  useEffect(() => {
    if (customer && provinces.length > 0) {
      // Find province by name
      if (customer.address?.province) {
        const province = provinces.find(p => p.name_th === customer.address.province);
        if (province) {
          setSelectedProvince(province.id);
          setProvinceSearchTerm(province.name_th);
        } else {
          setProvinceSearchTerm(customer.address.province);
        }
      }
    }
  }, [customer, provinces]);

  // Load districts when province is selected
  useEffect(() => {
    if (selectedProvince) {
      fetch(`${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=districts&id=${selectedProvince}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setDistricts(data.data || []);
            // Find district by name
            if (customer.address?.district) {
              const district = data.data?.find((d: AddressData) => d.name_th === customer.address.district);
              if (district) {
                setSelectedDistrict(district.id);
                setDistrictSearchTerm(district.name_th);
              } else {
                setDistrictSearchTerm(customer.address.district);
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
  }, [selectedProvince, customer.address?.district]);

  // Load sub-districts when district is selected
  useEffect(() => {
    if (selectedDistrict) {
      fetch(`${resolveApiBasePath()}/Address_DB/get_address_data.php?endpoint=sub_districts&id=${selectedDistrict}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setSubDistricts(data.data || []);
            // Find sub-district by name
            if (customer.address?.subdistrict) {
              const subDistrict = data.data?.find((sd: AddressData) =>
                sd.name_th === customer.address.subdistrict &&
                (!customer.address.postalCode || String(sd.zip_code) === String(customer.address.postalCode))
              ) || data.data?.find((sd: AddressData) => sd.name_th === customer.address.subdistrict);

              if (subDistrict) {
                setSelectedSubDistrict(subDistrict.id);
                setSubDistrictSearchTerm(subDistrict.name_th);
                // Auto-fill postal code
                if (subDistrict.zip_code) {
                  setFormData(prev => ({
                    ...prev,
                    address: {
                      ...prev.address,
                      postalCode: subDistrict.zip_code || prev.address?.postalCode || ''
                    }
                  }));
                }
              } else {
                setSubDistrictSearchTerm(customer.address.subdistrict);
              }
            }
          }
        })
        .catch(error => console.error('Error loading sub-districts:', error));
    } else {
      setSubDistricts([]);
      setSelectedSubDistrict(null);
    }
  }, [selectedDistrict, customer.address?.subdistrict]);

  // Update formData when sub-district is selected
  useEffect(() => {
    if (selectedSubDistrict && subDistricts.length > 0) {
      const subDistrict = subDistricts.find(sd => sd.id === selectedSubDistrict);
      if (subDistrict) {
        const district = districts.find(d => d.id === selectedDistrict);
        const province = provinces.find(p => p.id === selectedProvince);

        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            subdistrict: subDistrict.name_th,
            district: district?.name_th || prev.address?.district || '',
            province: province?.name_th || prev.address?.province || '',
            postalCode: subDistrict.zip_code || prev.address?.postalCode || ''
          },
          province: province?.name_th || prev.province || ''
        }));
      }
    }
  }, [selectedSubDistrict, subDistricts, selectedDistrict, districts, selectedProvince, provinces]);

  // Close dropdowns when clicking outside
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBackupPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // รับเฉพาะตัวเลข
    const value = e.target.value.replace(/[^0-9]/g, '');

    // จำกัดความยาวไม่เกิน 10 หลัก
    if (value.length > 10) return;

    // อัปเดตค่า
    setFormData(prev => ({ ...prev, backupPhone: value }));

    // Validation
    if (value.length === 0) {
      setBackupPhoneError('');
    } else if (value.length !== 10) {
      setBackupPhoneError('เบอร์สำรองต้องมี 10 หลัก');
    } else if (value[0] !== '0') {
      setBackupPhoneError('เบอร์สำรองต้องขึ้นต้นด้วย 0');
    } else {
      setBackupPhoneError('');
    }
  };

  const handleAddressChange = (field: 'street' | 'subdistrict' | 'district' | 'province' | 'postalCode', value: string) => {
    setFormData(prev => {
      const updatedAddress = {
        ...prev.address,
        [field]: value
      };
      // Also update province at root level if province is being changed
      if (field === 'province') {
        return {
          ...prev,
          address: updatedAddress,
          province: value
        };
      }
      return {
        ...prev,
        address: updatedAddress
      };
    });
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

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Failed to update customer", error);
    } finally {
      setIsSaving(false);
    }
  };

  const commonInputClass = "w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500";
  const commonLabelClass = "block text-gray-700 font-medium mb-1";

  return (
    <Modal
      title={`แก้ไขข้อมูล: ${customer.firstName} ${customer.lastName}`}
      onClose={!isSaving ? onClose : () => { }}
      requireConfirmation={true}
      confirmationMessage="คุณต้องการปิดหน้าต่างนี้หรือไม่? ข้อมูลที่ยังไม่ได้บันทึกจะหายไป"
      hideCloseButton={isSaving}
    >
      <div className="space-y-4 text-sm max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={commonLabelClass}>ชื่อ</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={commonInputClass}
              disabled={isSaving}
            />
          </div>
          <div>
            <label className={commonLabelClass}>นามสกุล</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={commonInputClass}
              disabled={isSaving}
            />
          </div>
        </div>

        <div>
          <label className={commonLabelClass}>เบอร์โทร</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className={commonInputClass}
            disabled={isSaving}
          />
        </div>

        <div>
          <label className={`${commonLabelClass} flex items-center`}>
            <Phone size={16} className="text-gray-600 mr-2" />
            <span>เบอร์สำรอง</span>
          </label>
          <input
            type="text"
            name="backupPhone"
            value={formData.backupPhone || ''}
            onChange={handleBackupPhoneChange}
            className={commonInputClass + (backupPhoneError ? ' border-red-500' : '')}
            placeholder="0XXXXXXXXX (10 หลัก)"
            maxLength={10}
            disabled={isSaving}
          />
          {backupPhoneError && (
            <p className="text-xs text-red-500 mt-1">{backupPhoneError}</p>
          )}
        </div>

        <div>
          <label className={commonLabelClass}>ที่อยู่ (เต็ม)</label>
          <textarea
            name="street"
            value={formData.address?.street || ''}
            onChange={(e) => handleAddressChange('street', e.target.value)}
            className={commonInputClass}
            rows={2}
            placeholder="เลขที่ หมู่ ซอย ถนน"
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
                {filteredProvinces.length > 0 ? (
                  filteredProvinces.map((province) => (
                    <div
                      key={province.id}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSelectedProvince(province.id);
                        setProvinceSearchTerm("");
                        setShowProvinceDropdown(false);
                        handleAddressChange('province', province.name_th);
                        setFormData(prev => ({
                          ...prev,
                          province: province.name_th
                        }));
                      }}
                    >
                      {province.name_th}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500">ไม่พบจังหวัดที่ค้นหา</div>
                )}
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
                {filteredDistricts.length > 0 ? (
                  filteredDistricts.map((district) => (
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
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500">ไม่พบอำเภอ/เขตที่ค้นหา</div>
                )}
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
                {filteredSubDistricts.length > 0 ? (
                  filteredSubDistricts.map((subDistrict) => (
                    <div
                      key={subDistrict.id}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSelectedSubDistrict(subDistrict.id);
                        setSubDistrictSearchTerm("");
                        setShowSubDistrictDropdown(false);
                        handleAddressChange('subdistrict', subDistrict.name_th);
                        if (subDistrict.zip_code) {
                          handleAddressChange('postalCode', subDistrict.zip_code);
                        }
                      }}
                    >
                      {subDistrict.name_th} {subDistrict.zip_code ? `(${subDistrict.zip_code})` : ''}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500">ไม่พบตำบล/แขวงที่ค้นหา</div>
                )}
              </div>
            )}
          </div>

          {/* Postal Code */}
          <div>
            <label className={commonLabelClass}>รหัสไปรษณีย์</label>
            <input
              type="text"
              value={formData.address?.postalCode || ''}
              onChange={(e) => handleAddressChange('postalCode', e.target.value)}
              className={commonInputClass}
              placeholder="รหัสไปรษณีย์"
              maxLength={5}
              disabled={isSaving}
            />
          </div>
        </div>

        <div>
          <label className={`${commonLabelClass} flex items-center`}>
            <Facebook size={16} className="text-blue-600 mr-2" />
            <span>ชื่อใน Facebook</span>
          </label>
          <input
            type="text"
            name="facebookName"
            value={formData.facebookName || ''}
            onChange={handleChange}
            className={commonInputClass}
            disabled={isSaving}
          />
        </div>

        <div>
          <label className={`${commonLabelClass} flex items-center`}>
            <MessageSquare size={16} className="text-green-500 mr-2" />
            <span>LINE ID</span>
          </label>
          <input
            type="text"
            name="lineId"
            value={formData.lineId || ''}
            onChange={handleChange}
            className={commonInputClass}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving}
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังบันทึก...
            </>
          ) : (
            "บันทึก"
          )}
        </button>
      </div>
    </Modal>
  );
};

export default EditCustomerModal;
