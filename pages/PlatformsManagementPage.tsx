import React, { useState, useEffect, useMemo, useRef } from "react";
import { User, Company, UserRole } from "../types";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import Modal from "../components/Modal";
import {
  listPlatforms,
  createPlatform,
  updatePlatform,
  deletePlatform,
} from "../services/api";
import { listRoles } from "../services/roleApi"; // Import listRoles

interface Platform {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  companyId: number;
  active: boolean;
  sortOrder: number;
  showPagesFrom?: string | null;
  roleShow?: string[];
}

interface PlatformsManagementPageProps {
  currentUser: User;
  companies: Company[];
}

const PlatformsManagementPage: React.FC<PlatformsManagementPageProps> = ({
  currentUser,
  companies,
}) => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    currentUser?.companyId || null,
  );
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Use state for roles instead of hardcoded enum
  const [roleOptions, setRoleOptions] = useState<string[]>([]);

  // Fetch roles on mount
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const data = await listRoles(); // Fetch active roles
        if (data && Array.isArray(data.roles)) {
          // Assuming we use 'name' to match the previous enum values like "Telesale", "Admin Page"
          // If you need unique codes, use r.code
          setRoleOptions(data.roles.map((r: any) => r.name));
        }
      } catch (err) {
        console.error("Failed to fetch roles:", err);
      }
    };
    fetchRoles();
  }, []);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);

  // Fetch platforms
  const fetchPlatforms = async (companyId?: number) => {
    setLoading(true);
    try {
      const data = await listPlatforms(
        companyId || undefined,
        false,
        currentUser.role,
      );
      setPlatforms(
        Array.isArray(data)
          ? data.map((p: any) => ({
            id: p.id,
            name: p.name,
            displayName: p.display_name,
            description: p.description,
            companyId: p.company_id,
            active: Boolean(p.active),
            sortOrder: p.sort_order || 0,
            showPagesFrom: p.show_pages_from || null,
            roleShow: (() => {
              const raw = p.role_show;
              if (!raw) return [];
              try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed)
                  ? parsed.map((v: any) => String(v))
                  : [];
              } catch {
                return String(raw)
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
              }
            })(),
          }))
          : [],
      );
    } catch (error) {
      console.error("Error fetching platforms:", error);
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลแพลตฟอร์ม");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPlatforms(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const filteredPlatforms = platforms
    .filter((platform) => {
      const matchesSearch =
        platform.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        platform.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (platform.description &&
          platform.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()));
      const matchesActive = showActiveOnly ? platform.active : true;
      return matchesSearch && matchesActive;
    })
    .sort((a, b) => {
      // Sort by sortOrder first, then by displayName
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.displayName.localeCompare(b.displayName);
    });

  const handleAddPlatform = async (newPlatform: Omit<Platform, "id">) => {
    try {
      const result = await createPlatform({
        name: newPlatform.name,
        displayName: newPlatform.displayName,
        description: newPlatform.description || "",
        companyId: newPlatform.companyId,
        active: newPlatform.active,
        sortOrder: newPlatform.sortOrder,
        showPagesFrom:
          newPlatform.showPagesFrom !== undefined
            ? newPlatform.showPagesFrom &&
              newPlatform.showPagesFrom.trim() !== ""
              ? newPlatform.showPagesFrom
              : null
            : null,
        roleShow: newPlatform.roleShow || [],
      });

      await fetchPlatforms(selectedCompanyId || undefined);
      setIsAddModalOpen(false);
      alert("เพิ่มแพลตฟอร์มสำเร็จ");
    } catch (error: any) {
      console.error("Failed to create platform:", error);
      const errorMsg =
        error?.data?.message ||
        error?.message ||
        "เกิดข้อผิดพลาดในการเพิ่มแพลตฟอร์ม";
      alert(errorMsg);
    }
  };

  const handleEditPlatform = async (updatedPlatform: Platform) => {
    try {
      await updatePlatform(updatedPlatform.id, {
        name: updatedPlatform.name,
        displayName: updatedPlatform.displayName,
        description: updatedPlatform.description || "",
        active: updatedPlatform.active,
        sortOrder: updatedPlatform.sortOrder,
        showPagesFrom:
          updatedPlatform.showPagesFrom !== undefined
            ? updatedPlatform.showPagesFrom &&
              updatedPlatform.showPagesFrom.trim() !== ""
              ? updatedPlatform.showPagesFrom
              : null
            : null,
        roleShow: updatedPlatform.roleShow || [],
      });

      await fetchPlatforms(selectedCompanyId || undefined);
      setIsEditModalOpen(false);
      setEditingPlatform(null);
      alert("แก้ไขแพลตฟอร์มสำเร็จ");
    } catch (error: any) {
      console.error("Failed to update platform:", error);
      const errorMsg =
        error?.data?.message ||
        error?.message ||
        "เกิดข้อผิดพลาดในการแก้ไขแพลตฟอร์ม";
      alert(errorMsg);
    }
  };

  const handleDeletePlatform = async (id: number) => {
    if (
      window.confirm(
        "คุณแน่ใจหรือไม่ที่จะลบแพลตฟอร์มนี้? (จะเป็นการปิดใช้งานแทนการลบ)",
      )
    ) {
      try {
        await deletePlatform(id);
        await fetchPlatforms(selectedCompanyId || undefined);
        alert("ปิดใช้งานแพลตฟอร์มสำเร็จ");
      } catch (error: any) {
        console.error("Failed to delete platform:", error);
        const errorMsg =
          error?.data?.message ||
          error?.message ||
          "เกิดข้อผิดพลาดในการลบแพลตฟอร์ม";
        alert(errorMsg);
      }
    }
  };

  const handleToggleActive = async (platform: Platform) => {
    try {
      await updatePlatform(platform.id, {
        active: !platform.active,
      });
      await fetchPlatforms(selectedCompanyId || undefined);
    } catch (error: any) {
      console.error("Failed to toggle platform active status:", error);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะแพลตฟอร์ม");
    }
  };

  const currentCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">จัดการแพลตฟอร์ม</h2>
        {selectedCompanyId && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            เพิ่มแพลตฟอร์ม
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">บริษัท</label>
            <select
              value={selectedCompanyId || ""}
              onChange={(e) =>
                setSelectedCompanyId(Number(e.target.value) || null)
              }
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">เลือกบริษัท</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ค้นหา</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="ค้นหาชื่อหรือรายละเอียด..."
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">
                แสดงเฉพาะที่เปิดใช้งาน
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Platforms Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
      ) : !selectedCompanyId ? (
        <div className="text-center py-8 text-gray-500">กรุณาเลือกบริษัท</div>
      ) : filteredPlatforms.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchTerm
            ? "ไม่พบแพลตฟอร์มที่ตรงกับการค้นหา"
            : "ไม่มีแพลตฟอร์มในบริษัทนี้"}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ลำดับ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ชื่อ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ชื่อแสดง
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  รายละเอียด
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  สถานะ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPlatforms.map((platform, index) => (
                <tr
                  key={platform.id}
                  className={!platform.active ? "bg-gray-50 opacity-60" : ""}
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {platform.sortOrder || index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {platform.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {platform.displayName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {platform.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleToggleActive(platform)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${platform.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                        }`}
                    >
                      {platform.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingPlatform(platform);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="แก้ไข"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlatform(platform.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Platform Modal */}
      {isAddModalOpen && selectedCompanyId && (
        <AddPlatformModal
          companyId={selectedCompanyId}
          companyName={currentCompany?.name || ""}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddPlatform}
          existingPlatforms={platforms}
          roleOptions={roleOptions}
        />
      )}

      {/* Edit Platform Modal */}
      {isEditModalOpen && editingPlatform && (
        <EditPlatformModal
          platform={editingPlatform}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingPlatform(null);
          }}
          onSave={handleEditPlatform}
          existingPlatforms={platforms}
          roleOptions={roleOptions}
        />
      )}
    </div>
  );
};

// Add Platform Modal Component
const AddPlatformModal: React.FC<{
  companyId: number;
  companyName: string;
  onClose: () => void;
  onSave: (platform: Omit<Platform, "id">) => void;
  existingPlatforms: Platform[];
  roleOptions: string[];
}> = ({
  companyId,
  companyName,
  onClose,
  onSave,
  existingPlatforms,
  roleOptions,
}) => {
    const [formData, setFormData] = useState({
      name: "",
      displayName: "",
      description: "",
      active: true,
      sortOrder:
        existingPlatforms.length > 0
          ? Math.max(...existingPlatforms.map((p) => p.sortOrder || 0)) + 1
          : 1,
      showPagesFrom: null as string | null,
      roleShow: [] as string[],
    });

    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [roleDropdownPos, setRoleDropdownPos] = useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);

    const toggleRoleDropdown = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setRoleDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
      setRoleDropdownOpen((open) => !open);
    };

    const allRolesSelected =
      formData.roleShow.length > 0 &&
      formData.roleShow.length === roleOptions.length;

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.displayName.trim()) {
        alert("กรุณากรอกชื่อและชื่อแสดงผลของแพลตฟอร์ม");
        return;
      }

      // Check for duplicate name
      if (
        existingPlatforms.some(
          (p) => p.name.toLowerCase() === formData.name.toLowerCase(),
        )
      ) {
        alert("มีชื่อแพลตฟอร์มนี้อยู่แล้ว");
        return;
      }

      onSave({
        ...formData,
        companyId,
      });
    };

    return (
      <Modal title="เพิ่มแพลตฟอร์ม" onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-md mb-4">
            <p className="text-sm text-blue-800">
              <strong>บริษัท:</strong> {companyName}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อแพลตฟอร์ม (สำหรับระบบ) *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="เช่น facebook, line, tiktok"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อแสดงผล (UI) *
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="เช่น Facebook, LINE, TikTok"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รายละเอียด
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              แพลตฟอร์มนี้ดึงเพจจาก
            </label>
            <select
              value={formData.showPagesFrom ? formData.showPagesFrom : ""}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({
                  ...formData,
                  showPagesFrom: value && value.trim() !== "" ? value : null,
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">ไม่กำหนด (ค่าเดิม)</option>
              {existingPlatforms
                .filter((p) => p.name !== formData.name && p.active)
                .map((platform) => (
                  <option key={platform.id} value={platform.name}>
                    {platform.displayName || platform.name}
                  </option>
                ))}
            </select>
          </div>

          {/* role_show multi select dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              สิทธิ์ที่เห็นแพลตฟอร์มนี้ (role_show)
            </label>
            <div className="relative">
              <button
                type="button"
                ref={buttonRef}
                onClick={toggleRoleDropdown}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm flex justify-between items-center flex-wrap gap-1 bg-white"
              >
                <span className="flex flex-wrap gap-1">
                  {formData.roleShow.length === 0 ? (
                    <span className="text-gray-400">เลือก role ได้หลายค่า</span>
                  ) : (
                    formData.roleShow.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs"
                      >
                        {role}
                      </span>
                    ))
                  )}
                </span>
                <span className="text-gray-400 text-xs ml-auto">▼</span>
              </button>
              {roleDropdownOpen && roleDropdownPos && (
                <div
                  className="fixed z-50 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-auto"
                  style={{
                    top: roleDropdownPos.top,
                    left: roleDropdownPos.left,
                    width: roleDropdownPos.width,
                  }}
                >
                  {/* option เลือกทั้งหมด */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        roleShow: allRolesSelected ? [] : [...roleOptions],
                      });
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 border-b border-gray-100"
                  >
                    {allRolesSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
                  </button>

                  {roleOptions.map((role) => {
                    const selected = formData.roleShow.includes(role);
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            roleShow: selected
                              ? formData.roleShow.filter((r) => r !== role)
                              : [...formData.roleShow, role],
                          });
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${selected ? "bg-blue-100 text-blue-800" : ""
                          }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`inline-block w-3 h-3 border rounded-sm ${selected
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300"
                              }`}
                          />
                          {role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              จะถูกเก็บในฐานข้อมูลเป็น JSON array เช่น ['Telesale','Admin
              Control']
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ลำดับการแสดงผล
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData({ ...formData, sortOrder: Number(e.target.value) })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) =>
                  setFormData({ ...formData, active: e.target.checked })
                }
                className="mr-2"
              />
              <label htmlFor="active" className="text-sm text-gray-700">
                เปิดใช้งาน
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              บันทึก
            </button>
          </div>
        </form>
      </Modal>
    );
  };

// Edit Platform Modal Component
const EditPlatformModal: React.FC<{
  platform: Platform;
  onClose: () => void;
  onSave: (platform: Platform) => void;
  existingPlatforms: Platform[];
  roleOptions: string[];
}> = ({ platform, onClose, onSave, existingPlatforms, roleOptions }) => {
  const [formData, setFormData] = useState({
    name: platform.name,
    displayName: platform.displayName,
    description: platform.description || "",
    active: platform.active,
    sortOrder: platform.sortOrder,
    showPagesFrom: platform.showPagesFrom || null,
    roleShow: platform.roleShow || [],
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [roleDropdownPos, setRoleDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const toggleRoleDropdown = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setRoleDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
    setRoleDropdownOpen((open) => !open);
  };

  const allRolesSelected =
    formData.roleShow.length > 0 &&
    formData.roleShow.length === roleOptions.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.displayName.trim()) {
      alert("กรุณากรอกชื่อและชื่อแสดงผลของแพลตฟอร์ม");
      return;
    }

    onSave({
      ...platform,
      ...formData,
    });
  };

  return (
    <Modal title="แก้ไขแพลตฟอร์ม" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อแพลตฟอร์ม (สำหรับระบบ) *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อแสดงผล (UI) *
          </label>
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) =>
              setFormData({ ...formData, displayName: e.target.value })
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            รายละเอียด
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            แพลตฟอร์มนี้ดึงเพจจาก
          </label>
          <select
            value={formData.showPagesFrom ? formData.showPagesFrom : ""}
            onChange={(e) => {
              const value = e.target.value;
              setFormData({
                ...formData,
                showPagesFrom: value && value.trim() !== "" ? value : null,
              });
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">ไม่กำหนด (ค่าเดิม)</option>
            {existingPlatforms
              .filter((p) => p.id !== platform.id && p.active)
              .map((p) => (
                <option key={p.id} value={p.name}>
                  {p.displayName || p.name}
                </option>
              ))}
          </select>
        </div>

        {/* role_show multi select dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            สิทธิ์ที่เห็นแพลตฟอร์มนี้ (role_show)
          </label>
          <div className="relative">
            <button
              type="button"
              ref={buttonRef}
              onClick={toggleRoleDropdown}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm flex justify-between items-center flex-wrap gap-1 bg-white"
            >
              <span className="flex flex-wrap gap-1">
                {formData.roleShow.length === 0 ? (
                  <span className="text-gray-400">เลือก role ได้หลายค่า</span>
                ) : (
                  formData.roleShow.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs"
                    >
                      {role}
                    </span>
                  ))
                )}
              </span>
              <span className="text-gray-400 text-xs ml-auto">▼</span>
            </button>
          </div>

          {roleDropdownOpen && roleDropdownPos && (
            <div
              className="fixed z-50 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-auto"
              style={{
                top: roleDropdownPos.top,
                left: roleDropdownPos.left,
                width: roleDropdownPos.width,
              }}
            >
              {/* option เลือกทั้งหมด */}
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    roleShow: allRolesSelected ? [] : [...roleOptions],
                  });
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 border-b border-gray-100"
              >
                {allRolesSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
              </button>

              {roleOptions.map((role) => {
                const selected = formData.roleShow.includes(role);
                return (
                  <button
                    type="button"
                    key={role}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        roleShow: selected
                          ? formData.roleShow.filter((r) => r !== role)
                          : [...formData.roleShow, role],
                      });
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${selected ? "bg-blue-100 text-blue-800" : ""
                      }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`inline-block w-3 h-3 border rounded-sm ${selected
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300"
                          }`}
                      />
                      {role}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-1 text-xs text-gray-500">
            จะถูกเก็บในฐานข้อมูลเป็น JSON array เช่น ['Telesale','Admin
            Control']
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ลำดับการแสดงผล
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData({ ...formData, sortOrder: Number(e.target.value) })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) =>
                setFormData({ ...formData, active: e.target.checked })
              }
              className="mr-2"
            />
            <label htmlFor="active" className="text-sm text-gray-700">
              เปิดใช้งาน
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PlatformsManagementPage;
