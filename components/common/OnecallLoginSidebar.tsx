import React, { useState, useEffect } from "react";
import { Settings, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

// User role enum
enum UserRole {
  SuperAdmin = "Super Admin",
  AdminControl = "AdminControl",
  Admin = "Admin",
  User = "User",
}

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: UserRole;
  company_id: number;
  team_id: number | null;
  supervisor_id: number | null;
  status: string;
}

interface OnecallLoginSidebarProps {
  onLogin?: (username: string, password: string) => void;
  className?: string;
  currentUser?: User | null;
}

interface AuthResponse {
  success: boolean;
  data?: any;
  token?: string;
  error?: string;
  http_code?: number;
  debug_info?: any;
}

const OnecallLoginSidebar: React.FC<OnecallLoginSidebarProps> = ({
  onLogin,
  className = "",
  currentUser,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const [showDetailedResponse, setShowDetailedResponse] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    hasCredentials: boolean;
    lastUpdated: string | null;
  }>({ hasCredentials: false, lastUpdated: null });

  // Function to check if user has permission to access Onecall settings
  const hasPermission = (): boolean => {
    if (!currentUser) return false;
    return (
      currentUser.role === UserRole.SuperAdmin ||
      currentUser.role === UserRole.AdminControl
    );
  };

  // Function to get company ID from currentUser or localStorage
  const getCompanyId = (): number => {
    try {
      // First try to get from currentUser prop
      if (currentUser && currentUser.company_id) {
        return currentUser.company_id;
      }

      // Fallback to localStorage
      const sessionUser = localStorage.getItem("sessionUser");
      if (sessionUser) {
        const user = JSON.parse(sessionUser);
        return user.company_id || 1; // Default to 1 if no company_id
      }
      return 1; // Default fallback
    } catch (error) {
      console.error("Error getting company ID:", error);
      return 1; // Default fallback
    }
  };

  // Function to save credentials to database
  const saveCredentialsToDatabase = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const companyId = getCompanyId();
      const usernameKey = `ONECALL_USERNAME_${companyId}`;
      const passwordKey = `ONECALL_PASSWORD_${companyId}`;

      console.log("Saving credentials to database:", {
        companyId,
        usernameKey,
        passwordKey: passwordKey.replace("PASSWORD", "PASSWORD"), // Log password key without revealing it's a password
        username: username,
      });

      // Get current user data
      const currentUser = getCurrentUser();

      // Save username
      const usernameResponse = await fetch("/api/Onecall_DB/env_manager.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: usernameKey,
          value: username,
          user: currentUser,
        }),
      });

      if (!usernameResponse.ok) {
        const errorData = await usernameResponse.json();
        throw new Error(
          `Failed to save username: ${errorData.error || "Unknown error"}`,
        );
      }

      // Save password
      const passwordResponse = await fetch("/api/Onecall_DB/env_manager.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: passwordKey,
          value: password,
          user: currentUser,
        }),
      });

      if (!passwordResponse.ok) {
        const errorData = await passwordResponse.json();
        throw new Error(
          `Failed to save password: ${errorData.error || "Unknown error"}`,
        );
      }

      const usernameResult = await usernameResponse.json();
      const passwordResult = await passwordResponse.json();

      console.log("Credentials saved successfully:", {
        username: usernameResult,
        password: passwordResult,
      });

      // Update database status immediately after save
      const updatedStatus = await checkDatabaseStatus();
      setDbStatus(updatedStatus);

      return true;
    } catch (error) {
      console.error("Error saving credentials to database:", error);
      return false;
    }
  };

  // Function to check if credentials exist in database for current company
  const checkDatabaseStatus = async (): Promise<{
    hasCredentials: boolean;
    lastUpdated: string | null;
  }> => {
    try {
      const companyId = getCompanyId();

      console.log("Checking database status for company:", companyId);

      const currentUser = getCurrentUser();

      const response = await fetch("/api/Onecall_DB/env_manager.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "check_status",
          user: currentUser,
          company_id: companyId,
        }),
      });

      console.log("Database check response:", {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Database check result:", result);

        if (result.success && result.has_credentials) {
          return {
            hasCredentials: true,
            lastUpdated: result.last_updated || null,
          };
        } else {
          console.log("Credentials not found:", result.message);
        }
      } else {
        const errorText = await response.text();
        console.error("Database check failed:", errorText);
      }
    } catch (error) {
      console.error("Error checking database status:", error);
    }

    return { hasCredentials: false, lastUpdated: null };
  };

  // Check database status when sidebar opens
  // Function to get current user data from localStorage
  const getCurrentUser = () => {
    try {
      const sessionUser = localStorage.getItem("sessionUser");
      if (sessionUser) {
        const user = JSON.parse(sessionUser);
        return {
          id: user.id,
          company_id: user.company_id,
          role: user.role,
        };
      }
      // Fallback for testing
      return {
        id: 1,
        company_id: 1,
        role: "Super Admin",
      };
    } catch (error) {
      console.error("Error getting current user:", error);
      return {
        id: 1,
        company_id: 1,
        role: "Super Admin",
      };
    }
  };

  // Check database status when sidebar opens
  useEffect(() => {
    if (sidebarOpen) {
      checkDatabaseStatus().then(setDbStatus);
    }
  }, [sidebarOpen]);

  // JavaScript version of authenticateOneCall function
  const authenticateOneCall = async (
    user: string,
    pass: string,
  ): Promise<AuthResponse> => {
    // Use proxy to avoid CORS issues
    const loginUrl =
      "/onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true";

    // Create auth string and encode it (Postman Basic Auth style)
    const authString = `${user}:${pass}`;
    const base64Auth = btoa(authString);

    // Create headers with Authorization header (Postman style)
    const headers = {
      Accept: "application/json",
      Authorization: `Basic ${base64Auth}`,
    };

    try {
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: headers,
        // SSL verification is handled by the browser, but for development we might need to handle CORS issues
      });

      const httpCode = response.status;
      const responseText = await response.text();

      // Try to parse as JSON, if fails, keep as text
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }

      // Create debug information
      const debugInfo = {
        request_url: loginUrl,
        request_method: "POST",
        request_headers: headers,
        request_body: "none",
        request_auth: {
          username: user,
          password: pass,
          auth_string: authString,
          base64_encoded: base64Auth,
          authorization_header: `Basic ${base64Auth}`,
          postman_style:
            "Using Authorization header instead of CURLOPT_USERPWD",
        },
        response_http_code: httpCode,
        response_headers: response.headers,
        response_body: responseData,
      };

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP Error: ${httpCode}`,
          http_code: httpCode,
          debug_info: debugInfo,
        };
      }

      // Extract token from response (adjust based on actual response structure)
      let token = null;
      if (
        responseData &&
        typeof responseData === "object" &&
        responseData.accesstoken
      ) {
        token = responseData.accesstoken;
      }

      return {
        success: true,
        data: responseData,
        token: token,
        http_code: httpCode,
        debug_info: debugInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to fetch",
        debug_info: {
          request_url: loginUrl,
          request_method: "POST",
          error: error,
          note: "This might be a CORS issue. Check if the Vite proxy is configured correctly.",
        },
      };
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      alert("กรุณากรอก username และ password");
      return;
    }

    setIsLoading(true);
    setShowResponse(false);
    setAuthResponse(null);

    try {
      // Call the authentication API
      const result = await authenticateOneCall(username, password);
      setAuthResponse(result);
      setShowResponse(true);

      // If login is successful, save credentials to database
      if (result.success) {
        console.log("Login successful, saving credentials to database...");

        // Save credentials to database
        const saveSuccess = await saveCredentialsToDatabase(username, password);

        if (saveSuccess) {
          console.log("Credentials saved to database successfully");
          // Update response to show database save success
          setAuthResponse((prev) => ({
            ...prev!,
            data: {
              ...prev!.data,
              database_saved: true,
              message: "Login successful and credentials saved to database",
            },
          }));
        } else {
          console.error("Failed to save credentials to database");
          // Update response to show database save failure
          setAuthResponse((prev) => ({
            ...prev!,
            data: {
              ...prev!.data,
              database_saved: false,
              message:
                "Login successful but failed to save credentials to database",
            },
          }));
        }

        // If onLogin callback is provided
        if (onLogin) {
          onLogin(username, password);
        }

        // Auto close sidebar after successful login
        setTimeout(() => {
          setSidebarOpen(false);
          // Clear form
          setUsername("");
          setPassword("");
          setShowResponse(false);
          setShowDetailedResponse(false);
        }, 3000); // Extended time to show database save status
      }
    } catch (error) {
      const errorResponse: AuthResponse = {
        success: false,
        error: error.message || "Unexpected error occurred",
      };
      setAuthResponse(errorResponse);
      setShowResponse(true);
    } finally {
      setIsLoading(false);
    }
  };

  const formatJson = (obj: any): string => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  // Don't render if user doesn't have permission
  if (!hasPermission()) {
    return null;
  }

  return (
    <>
      {/* Floating Settings Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className={`fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center ${className}`}
        title="ตั้งค่า Onecall"
      >
        <Settings className="w-6 h-6" />
      </button>

      {/* Onecall Login Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity opacity-100"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div
            className={`absolute right-0 top-0 h-full w-96 bg-white shadow-xl transform transition-transform translate-x-0 overflow-y-auto`}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-700">
                เข้าสู่ระบบ Onecall
              </h3>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="p-6">
              {/* Database Status Display */}
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-700">
                    สถานะฐานข้อมูล:
                  </span>
                  <button
                    onClick={async () => {
                      console.log("Refreshing database status...");
                      const updatedStatus = await checkDatabaseStatus();
                      console.log("Updated status:", updatedStatus);
                      setDbStatus(updatedStatus);
                    }}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  >
                    รีเฟรช
                  </button>
                </div>
                {dbStatus.hasCredentials ? (
                  <div className="text-xs text-green-700">
                    ✓ มีข้อมูล Onecall ของบริษัทนี้ในระบบแล้ว
                    {dbStatus.lastUpdated && (
                      <div className="text-gray-600 mt-1">
                        อัพเดตล่าสุด:{" "}
                        {new Date(dbStatus.lastUpdated).toLocaleString("th-TH")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-orange-700">
                    ⚠ ยังไม่มีข้อมูล Onecall ของบริษัทนี้ในระบบ
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="กรอก username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="กรอก password"
                  />
                </div>
                <div className="pt-4">
                  <button
                    onClick={handleLogin}
                    disabled={!username || !password || isLoading}
                    className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      !username || !password || isLoading
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังเข้าสู่ระบบ...</span>
                      </>
                    ) : (
                      <span>เข้าสู่ระบบ</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Response Display */}
              {showResponse && authResponse && (
                <div className="mt-6 space-y-4">
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      {authResponse.success ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <h4 className="text-sm font-semibold text-green-700">
                            การเข้าสู่ระบบสำเร็จ
                          </h4>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <h4 className="text-sm font-semibold text-red-700">
                            การเข้าสู่ระบบล้มเหลว
                          </h4>
                        </>
                      )}
                    </div>

                    {/* Response Summary */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-medium text-gray-600">
                            Status:
                          </span>
                          <span
                            className={`ml-1 ${authResponse.success ? "text-green-600" : "text-red-600"}`}
                          >
                            {authResponse.success ? "Success" : "Failed"}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">
                            HTTP Code:
                          </span>
                          <span className="ml-1 text-gray-800">
                            {authResponse.http_code || "N/A"}
                          </span>
                        </div>
                        {authResponse.token && (
                          <div className="col-span-2">
                            <span className="font-medium text-gray-600">
                              Token:
                            </span>
                            <span className="ml-1 text-green-600 text-xs break-all">
                              {authResponse.token.substring(0, 20)}...
                            </span>
                          </div>
                        )}
                        {authResponse.data?.database_saved !== undefined && (
                          <div className="col-span-2">
                            <span className="font-medium text-gray-600">
                              Database:
                            </span>
                            <span
                              className={`ml-1 text-xs ${authResponse.data.database_saved ? "text-green-600" : "text-orange-600"}`}
                            >
                              {authResponse.data.database_saved
                                ? "✓ Saved"
                                : "⚠ Failed"}
                            </span>
                          </div>
                        )}
                        {authResponse.error && (
                          <div className="col-span-2">
                            <span className="font-medium text-gray-600">
                              Error:
                            </span>
                            <span className="ml-1 text-red-600 text-xs break-all">
                              {authResponse.error}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detailed Response */}
                    <div>
                      <button
                        onClick={() =>
                          setShowDetailedResponse(!showDetailedResponse)
                        }
                        className="text-xs text-blue-600 hover:text-blue-800 mb-2"
                      >
                        {showDetailedResponse ? "ซ่อน" : "แสดง"} Response
                        ทั้งหมด
                      </button>
                      {showDetailedResponse && (
                        <div className="bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                            {formatJson(authResponse)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OnecallLoginSidebar;
