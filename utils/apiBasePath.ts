const resolveApiBasePath = (): string => {
  const envBase =
    typeof import.meta !== "undefined" &&
    (import.meta as any)?.env &&
    (import.meta as any).env.BASE_URL
      ? (import.meta as any).env.BASE_URL
      : undefined;

  if (typeof envBase === "string" && envBase.length > 0) {
    const trimmed = envBase.replace(/\/+$/, "");
    if (trimmed && trimmed !== ".") {
      return `${trimmed}/api`;
    }
    if (trimmed === ".") {
      return "/api";
    }
  }

  if (typeof window !== "undefined") {
    const pathname = window.location.pathname || "";
    if (pathname.startsWith("/mini_erp")) return "/mini_erp/api";
    if (pathname.startsWith("/CRM_ERP_V4")) return "/CRM_ERP_V4/api";
  }

  return "/api";
};

export default resolveApiBasePath;
