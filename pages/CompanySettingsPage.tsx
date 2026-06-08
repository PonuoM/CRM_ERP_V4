import React, { useState, useEffect } from "react";
import { getCompanySettings, saveCompanySettings, listCompanies } from "@/services/api";
import { Company } from "@/types";
import { Save, AlertCircle, Building2, Eye, EyeOff } from "lucide-react";

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // UI State for toggling password visibility
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const sessionUserStr = localStorage.getItem("sessionUser");
  const sessionUser = sessionUserStr ? JSON.parse(sessionUserStr) : null;
  const isSuperAdmin = sessionUser?.role === "Super Admin" || sessionUser?.role === "Developer";
  const userCompanyId = sessionUser?.company_id;

  useEffect(() => {
    async function init() {
      try {
        if (isSuperAdmin) {
          const comps = await listCompanies();
          setCompanies(comps);
          if (comps.length > 0) {
            setSelectedCompanyId(comps[0].id);
          }
        } else {
          setSelectedCompanyId(userCompanyId);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load companies");
      }
    }
    init();
  }, [isSuperAdmin, userCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadSettings(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const loadSettings = async (companyId: number) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await getCompanySettings(companyId);
      // Initialize with default keys if empty
      if (Object.keys(data).length === 0) {
        setSettings({
          JST_ACCOUNT_ID: "",
          JST_PASSWORD: ""
        });
      } else {
        setSettings({
          JST_ACCOUNT_ID: data.JST_ACCOUNT_ID || "",
          JST_PASSWORD: data.JST_PASSWORD || "",
          ...data
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await saveCompanySettings(settings, selectedCompanyId);
      setSuccessMsg("Settings saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const togglePassword = (key: string) => {
    setShowPassword(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!sessionUser) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-indigo-600" />
          Company Settings
        </h1>
        <p className="text-gray-500 mt-1">Manage integration credentials and company-specific configurations.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg">
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Integration Configuration</h2>
            <p className="text-sm text-gray-500">Configure external API keys and settings</p>
          </div>
          
          {isSuperAdmin && (
            <div className="min-w-[250px]">
              <label className="block text-xs font-medium text-gray-700 mb-1">Select Company</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={selectedCompanyId || ""}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                disabled={isLoading}
              >
                <option value="" disabled>Select a company</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-6">
                <h3 className="font-semibold text-blue-900 mb-4 border-b border-blue-100 pb-2">JST ERP Integration</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account ID
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      placeholder="e.g. jst_account_123"
                      value={settings.JST_ACCOUNT_ID || ""}
                      onChange={(e) => handleChange("JST_ACCOUNT_ID", e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword["JST_PASSWORD"] ? "text" : "password"}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm pr-10"
                        placeholder="Enter password"
                        value={settings.JST_PASSWORD || ""}
                        onChange={(e) => handleChange("JST_PASSWORD", e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        onClick={() => togglePassword("JST_PASSWORD")}
                      >
                        {showPassword["JST_PASSWORD"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Required for RSA encryption login to JST ERP.</p>
                  </div>
                </div>
              </div>

              {/* In the future, other integrations can be added here */}

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSaving || !selectedCompanyId}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Settings
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
