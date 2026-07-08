# คู่มือการเชื่อมต่อ OneCall API (แก้ไขปัญหา HTTP 415 และ 404)

เอกสารนี้อธิบายวิธีการเชื่อมต่อกับ API ของระบบ OneCall เพื่อดึงข้อมูลประวัติการโทรและการบันทึกเสียง โดยอ้างอิงจากวิธีการที่ทำงานได้จริงในหน้า `CallHistoryPage.tsx` เพื่อหลีกเลี่ยงปัญหา Error ต่อไปนี้:
- **POST Error: HTTP 415** (Unsupported Media Type / Internal Server Error)
- **GET Error: HTTP 404** (Resource Not Found)

---

## 1. การกำหนด Base URL (ผ่าน Reverse Proxy)
เพื่อหลีกเลี่ยงปัญหา CORS และให้ทำงานได้ทั้งบน Development และ Production จะต้องเรียก API ผ่าน Proxy เสมอ
- **Local Development:** ใช้ path ว่าง `""` (Vite จะจัดการ Proxy ให้ผ่าน `/onecall`)
- **Production:** ใช้ path `"/mini_erp/"` (Nginx/Apache จะ Proxy ทราฟฟิกไปที่ Server OneCall)

```javascript
const getOneCallBaseUrl = (): string => {
  const isLocalhost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  return isLocalhost ? "" : "/mini_erp/";
};
```

---

## 2. การ Login เพื่อรับ Access Token (วิธีแก้ POST 415 Error)

**สาเหตุของ 415 Error:** เกิดจากการส่ง request ที่มี `Content-Type: application/json` หรือการส่งข้อมูลผ่าน `body` ซึ่ง Server ของ OneCall ไม่รองรับใน Endpoint นี้

**วิธีที่ถูกต้อง (อ้างอิงจาก CallHistoryPage.tsx):**
1. **ห้าม** ใส่ `Content-Type` ใน Headers
2. **ห้าม** ส่ง `body` ใน request
3. ส่ง Username และ Password ผ่าน `Authorization: Basic <base64>`
4. Endpoint: `onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`

```javascript
const authenticateOneCall = async (username, password) => {
  const baseUrl = getOneCallBaseUrl();
  const loginUrl = `${baseUrl}onecall/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`;

  // ลบเครื่องหมายคำพูด (quotes) เผื่อมีติดมา
  const cleanUsername = username.replace(/^"|"$/g, "");
  const cleanPassword = password.replace(/^"|"$/g, "");

  // เข้ารหัสแบบ Basic Auth
  const base64Auth = btoa(`${cleanUsername}:${cleanPassword}`);

  // ข้อควรระวัง: ห้ามใส่ Content-Type และห้ามส่ง body
  const headers = {
    Accept: "application/json",
    Authorization: `Basic ${base64Auth}`, // ใช้ Basic Auth
  };

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: headers, 
    // ไม่มีการส่ง body ใดๆ ทั้งสิ้น
  });

  const responseData = await response.json();
  // Token จะอยู่ที่ responseData.accesstoken
  return responseData.accesstoken;
};
```

---

## 3. การดึงข้อมูลประวัติการโทร/ไฟล์เสียง (วิธีแก้ GET 404 Error)

**สาเหตุของ 404 Error:** อาจเกิดจากการระบุ Endpoint ผิด, การส่ง Header ผิดรูปแบบ หรือ Token ไม่ถูกต้อง (บางคนอาจใส่คำว่า `Bearer ` นำหน้า Token ซึ่งใน OneCall ไม่ต้องใส่ และ Server ไม่รองรับ)

**วิธีที่ถูกต้อง:**
1. Endpoint สำหรับรายการโทร: `onecall/orktrack/rest/recordings`
2. ส่งพารามิเตอร์ต่างๆ ผ่าน **Query String (URL Parameters)**
3. ใน Header `Authorization` ให้ใส่ค่า Token เดี่ยวๆ **(ไม่ต้องมีคำว่า "Bearer ")**

```javascript
const getRecordingsData = async (token, partyPhone) => {
  const baseUrl = getOneCallBaseUrl();
  const apiUrl = `${baseUrl}onecall/orktrack/rest/recordings`;

  // สร้าง Query Parameters
  const params = new URLSearchParams();
  params.append("range", "custom");
  params.append("startdate", "20240101_000000"); // รูปแบบ YYYYMMDD_HHMMSS
  params.append("page", "1");
  params.append("pagesize", "20");
  params.append("maxresults", "-1");
  params.append("includetags", "true");
  params.append("includemetadata", "true");
  params.append("includeprograms", "true");
  
  if (partyPhone) {
    params.append("party", partyPhone); // เบอร์โทรในรูปแบบ +66
  }

  // ข้อควรระวัง: Authorization ใช้แค่ค่า token ตรงๆ ห้ามมีคำว่า Bearer
  const headers = {
    Authorization: token, 
    Accept: "application/json",
  };

  const response = await fetch(`${apiUrl}?${params.toString()}`, {
    method: "GET",
    headers: headers,
  });

  const data = await response.json();
  return data;
};
```

## สรุปจุดสำคัญ (Key Takeaways)
1. **Login (POST):** ส่ง credentials ใน `Authorization: Basic ...` เท่านั้น **ห้ามแนบ `body`** และ **ห้ามส่ง `Content-Type`**
2. **Fetch Data (GET):** ส่ง Token ใน `Authorization: <token>` โดย **ไม่ต้องมีคำว่า `Bearer`** นำหน้า
3. **URL Paths:** ต้องพึ่งพา Reverse Proxy เสมอ (เช่น `/mini_erp/onecall/...`) เพื่อเลี่ยง CORS Error
