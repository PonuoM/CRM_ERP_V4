import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Trash2, Settings } from 'lucide-react';
import { User, UserRole } from '@/types';
import resolveApiBasePath from '@/utils/apiBasePath';

interface PancakeEnvOffSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: any; // Using any to support both User type and session object shapes
    onUpdate?: () => void;
}

interface EnvVariable {
    id?: number;
    key: string;
    value: string;
    created_at?: string;
    updated_at?: string;
}

const PancakeEnvOffSidebar: React.FC<PancakeEnvOffSidebarProps> = ({ isOpen, onClose, currentUser, onUpdate }) => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);

    // State
    const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
    const [newEnvVar, setNewEnvVar] = useState<EnvVariable>({
        key: 'ACCESS_TOKEN_PANCAKE_',
        value: ''
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isStoreDbEnabled, setIsStoreDbEnabled] = useState<boolean>(true); // Default to enabled

    // Determine Company ID from currentUser object (handle both camelCase and snake_case)
    const companyId = useMemo(() => {
        if (!currentUser) return null;
        return currentUser.companyId || currentUser.company_id || null;
    }, [currentUser]);

    // Load data when sidebar opens
    useEffect(() => {
        if (isOpen && currentUser && (currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl)) {
            fetchEnvVariables();

            // Initialize new Env Var key with company ID default
            if (companyId) {
                setNewEnvVar(prev => ({
                    ...prev,
                    key: `ACCESS_TOKEN_PANCAKE_${companyId}`
                }));
            }

            checkDbSetting();
        }
    }, [isOpen, currentUser, companyId]);

    const fetchEnvVariables = async () => {
        try {
            const response = await fetch(`${apiBase}/Page_DB/env_manager.php`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}` // Ensure we pass token for company context
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    setEnvVariables(data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch env variables:', error);
        }
    };

    const checkDbSetting = async () => {
        try {
            const envResponse = await fetch(`${apiBase}/Page_DB/env_manager.php`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            if (envResponse.ok) {
                const envData = await envResponse.json();
                const dbSetting = Array.isArray(envData) ? envData.find((env: any) => env.key === 'page_store_db') : null;
                setIsStoreDbEnabled(dbSetting ? dbSetting.value === '1' : true);
            }
        } catch (error) {
            console.error('Error checking database setting:', error);
        }
    };

    const saveEnvVariable = async (variable: EnvVariable) => {
        if (!variable.key || !variable.value) return;
        setIsLoading(true);
        try {
            const response = await fetch(`${apiBase}/Page_DB/env_manager.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(variable)
            });

            if (response.ok) {
                await fetchEnvVariables();
                // Only clear input if it was the main input form (not db verify checkbox)
                if (variable.key !== 'page_store_db') {
                    setNewEnvVar(prev => ({ ...prev, value: '' })); // Keep the key pattern
                }
                if (onUpdate) onUpdate();
            } else {
                const err = await response.json();
                alert(`Error: ${err.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error saving env variable:', error);
            alert('Error saving environment variable');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteEnvVariable = async (key: string) => {
        if (!confirm(`Are you sure you want to delete variable "${key}"?`)) return;
        setIsLoading(true);
        try {
            const response = await fetch(`${apiBase}/Page_DB/env_manager.php?key=${encodeURIComponent(key)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                await fetchEnvVariables();
                if (onUpdate) onUpdate();
            } else {
                alert('Failed to delete variable');
            }
        } catch (error) {
            console.error('Error deleting env variable:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Only render for authorized roles
    if (!currentUser || (currentUser.role !== UserRole.SuperAdmin && currentUser.role !== UserRole.AdminControl)) {
        return null;
    }

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={onClose}
                />
            )}

            <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-xl font-semibold">จัดการตัวแปรสภาพแวดล้อม</h2>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-gray-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="space-y-4">
                            {/* Add new env variable */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="text-md font-medium mb-3">เพิ่มตัวแปรใหม่</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                                        <input
                                            type="text"
                                            value={newEnvVar.key}
                                            onChange={(e) => setNewEnvVar({ ...newEnvVar, key: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="ACCESS_TOKEN_PANCAKE_1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                                        <textarea
                                            value={newEnvVar.value}
                                            onChange={(e) => setNewEnvVar({ ...newEnvVar, value: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="ค่าของตัวแปร"
                                            rows={3}
                                        />
                                    </div>
                                    <button
                                        onClick={() => saveEnvVariable(newEnvVar)}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Save className="w-4 h-4" />
                                        {isLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                                    </button>
                                </div>
                            </div>

                            {/* List existing env variables */}
                            <div>
                                <h3 className="text-md font-medium mb-3">ตัวแปรที่มีอยู่</h3>
                                {(() => {
                                    // Filter env variables to show only ACCESS_TOKEN_PANCAKE_* for current user's company
                                    const filteredEnvVars = envVariables.filter(envVar =>
                                        envVar.key.startsWith('ACCESS_TOKEN_PANCAKE_') &&
                                        companyId &&
                                        envVar.key === `ACCESS_TOKEN_PANCAKE_${companyId}`
                                    );

                                    return filteredEnvVars.length === 0 ? (
                                        <p className="text-gray-500 text-sm">ไม่มีตัวแปร</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredEnvVars.map((envVar) => (
                                                <div key={envVar.id || envVar.key} className="bg-white border border-gray-200 rounded-lg p-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1 mr-2">
                                                            <div className="font-medium text-sm text-gray-900">{envVar.key}</div>
                                                            <div className="text-sm text-gray-600 mt-1 break-all">{envVar.value}</div>
                                                            {envVar.updated_at && (
                                                                <div className="text-xs text-gray-400 mt-1">
                                                                    อัพเดต: {new Date(envVar.updated_at).toLocaleString('th-TH')}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => deleteEnvVariable(envVar.key)}
                                                            disabled={isLoading}
                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                            title="ลบตัวแปร"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Database Upload Setting */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="text-md font-medium mb-3">การตั้งค่าฐานข้อมูล</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="storeDbEnabled"
                                            checked={isStoreDbEnabled}
                                            onChange={(e) => {
                                                const isEnabled = e.target.checked;
                                                setIsStoreDbEnabled(isEnabled);

                                                // Save the setting to database
                                                saveEnvVariable({
                                                    key: 'page_store_db',
                                                    value: isEnabled ? '1' : '0'
                                                });
                                            }}
                                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="storeDbEnabled" className="text-sm text-gray-700">
                                            เปิดใช้งานฟังก์ชันอัปโหลดข้อมูลลงฐานข้อมูล
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        เมื่อปิดใช้งาน ปุ่ม "อัปโหลดข้อมูล" จะไม่แสดง
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PancakeEnvOffSidebar;
