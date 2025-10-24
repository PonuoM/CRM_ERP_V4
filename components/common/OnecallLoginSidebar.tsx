import React, { useState } from "react";
import { Settings, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface OnecallLoginSidebarProps {
  onLogin?: (username: string, password: string) => void;
  className?: string;
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
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authResponse, setAuthResponse] = useState<AuthResponse | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const [showDetailedResponse, setShowDetailedResponse] = useState(false);

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

      // If login is successful and onLogin callback is provided
      if (result.success && onLogin) {
        onLogin(username, password);
      }

      // Auto close sidebar after successful login
      if (result.success) {
        setTimeout(() => {
          setSidebarOpen(false);
          // Clear form
          setUsername("");
          setPassword("");
          setShowResponse(false);
          setShowDetailedResponse(false);
        }, 2000);
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
      <div
        className={`fixed inset-0 z-50 ${sidebarOpen ? "" : "pointer-events-none"}`}
      >
        <div
          className={`fixed inset-0 z-50 ${sidebarOpen ? "" : "pointer-events-none"}`}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black bg-opacity-50 transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar */}
          <div
            className={`absolute right-0 top-0 h-full w-96 bg-white shadow-xl transform transition-transform ${sidebarOpen ? "translate-x-0" : "translate-x-full"} overflow-y-auto`}
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
      </div>
    </>
  );
};

export default OnecallLoginSidebar;
