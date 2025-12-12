# 📋 Role Management System - คู่มือการใช้งาน

## 🎯 ภาพรวมระบบ

ระบบ Role Management ใหม่รองรับ **2 ระดับของการจัดการสิทธิ์**:

### 1️⃣ Role-Level Permissions (สิทธิ์ระดับ Role)
- กำหนดสิทธิ์เริ่มต้นสำหรับ Role ทั้งหมด
- ตัวอย่าง: Backoffice ทุกคนเห็นเมนู Orders, Manage Orders, Debt, Reports

### 2️⃣ User-Level Permission Overrides (สิทธิ์ระดับ User เฉพาะบุคคล)
- Override สิทธิ์เฉพาะคน แม้จะเป็น Role เดียวกัน
- ตัวอย่าง: 
  - Backoffice คนที่ 1 → เห็นแค่เมนู "ขนส่ง"
  - Backoffice คนที่ 2 → เห็นแค่เมนู "ใส่ Tracking"

---

## 🗂️ โครงสร้างตาราง

### ตาราง `roles` (Master Data)
```sql
- id: Primary Key
- code: รหัส Role (ใช้ในระบบ) เช่น 'super_admin', 'backoffice'
- name: ชื่อ Role (แสดงผล) เช่น 'Super Admin', 'Backoffice'
- description: คำอธิบาย
- is_active: สถานะใช้งาน
- is_system: Role ระบบ (ห้ามลบ)
```

### ตาราง `role_permissions` (มีอยู่แล้ว)
```sql
- role: รหัส Role (FK จาก roles.code)
- data: JSON ของ Permissions
- description: คำอธิบาย
- updated_by: ผู้แก้ไขล่าสุด
- updated_at: เวลาแก้ไข
```

### ตาราง `user_permission_overrides` (ใหม่)
```sql
- id: Primary Key
- user_id: FK จาก users.id
- permission_key: รหัสสิทธิ์ เช่น 'nav.orders', 'nav.bulk_tracking'
- permission_value: JSON ของค่าสิทธิ์ เช่น {"view": true, "use": false}
- notes: หมายเหตุ
- created_by: ผู้สร้าง
- created_at/updated_at: เวลา
```

### View `v_user_effective_permissions`
- รวมข้อมูล User + Role + Overrides
- ใช้สำหรับดึงข้อมูล Permission จริงของ User

---

## 🔧 วิธีการใช้งาน

### 📌 1. เพิ่ม Role ใหม่

```sql
-- เพิ่ม Role ใหม่
INSERT INTO roles (code, name, description, is_active, is_system) 
VALUES ('warehouse_staff', 'พนักงานคลังสินค้า', 'จัดการคลังสินค้าและสต๊อก', TRUE, FALSE);

-- เพิ่ม Default Permissions สำหรับ Role ใหม่
INSERT INTO role_permissions (role, data, description) 
VALUES (
  'warehouse_staff',
  '{
    "nav.orders": {"view": true, "use": false},
    "nav.manage_orders": {"view": true, "use": true},
    "nav.stock": {"view": true, "use": true},
    "nav.warehouse": {"view": true, "use": true}
  }',
  'สิทธิ์สำหรับพนักงานคลังสินค้า'
);
```

### 📌 2. แก้ไขสิทธิ์ของ Role

```sql
-- แก้ไข Permission ของ Role
UPDATE role_permissions 
SET data = '{
  "nav.orders": {"view": true, "use": true},
  "nav.manage_orders": {"view": true, "use": true},
  "nav.bulk_tracking": {"view": true, "use": true},
  "nav.debt": {"view": false, "use": false}
}'
WHERE role = 'backoffice';
```

### 📌 3. Override สิทธิ์เฉพาะ User (ตัวอย่างโจทย์จริง)

#### ตัวอย่าง 1: Backoffice เห็นแค่เมนู "ขนส่ง"
```sql
-- User ID 1651 (Backoffice) เห็นแค่ Manage Orders
INSERT INTO user_permission_overrides (user_id, permission_key, permission_value, notes) 
VALUES
  (1651, 'nav.orders', '{"view": false, "use": false}', 'ปิดเมนู Orders'),
  (1651, 'nav.manage_orders', '{"view": true, "use": true}', 'เปิดแค่ขนส่ง'),
  (1651, 'nav.bulk_tracking', '{"view": false, "use": false}', 'ปิด Bulk Tracking'),
  (1651, 'nav.debt', '{"view": false, "use": false}', 'ปิด Debt'),
  (1651, 'nav.reports', '{"view": false, "use": false}', 'ปิด Reports')
ON DUPLICATE KEY UPDATE 
  permission_value = VALUES(permission_value),
  notes = VALUES(notes);
```

#### ตัวอย่าง 2: Backoffice เห็นแค่ "ใส่ Tracking"
```sql
-- User ID 1652 (Backoffice) เห็นแค่ Bulk Tracking
INSERT INTO user_permission_overrides (user_id, permission_key, permission_value, notes) 
VALUES
  (1652, 'nav.orders', '{"view": false, "use": false}', 'ปิดเมนู Orders'),
  (1652, 'nav.manage_orders', '{"view": false, "use": false}', 'ปิดขนส่ง'),
  (1652, 'nav.bulk_tracking', '{"view": true, "use": true}', 'เปิดแค่ Bulk Tracking'),
  (1652, 'nav.debt', '{"view": false, "use": false}', 'ปิด Debt'),
  (1652, 'nav.reports', '{"view": false, "use": false}', 'ปิด Reports')
ON DUPLICATE KEY UPDATE 
  permission_value = VALUES(permission_value),
  notes = VALUES(notes);
```

### 📌 4. ลบ Override กลับไปใช้ Role Default

```sql
-- ลบ Override ของ User ID 1651
DELETE FROM user_permission_overrides WHERE user_id = 1651;

-- หรือลบเฉพาะบาง Permission
DELETE FROM user_permission_overrides 
WHERE user_id = 1651 AND permission_key = 'nav.orders';
```

### 📌 5. ตรวจสอบ Effective Permissions ของ User

```sql
-- ดู Permission จริงที่ User ได้รับ (Role + Override)
SELECT * FROM v_user_effective_permissions 
WHERE user_id = 1651;

-- ดู Override ทั้งหมดของ User
SELECT 
  u.username, 
  u.first_name,
  u.last_name,
  r.name as role_name,
  upo.permission_key, 
  upo.permission_value, 
  upo.notes,
  upo.created_at
FROM user_permission_overrides upo
JOIN users u ON upo.user_id = u.id
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.id = 1651;
```

---

## 💻 Backend Implementation (PHP)

### ฟังก์ชันดึง Permission ของ User

```php
function getUserEffectivePermissions(PDO $pdo, int $userId): array {
    // 1. ดึง Role Permission
    $stmt = $pdo->prepare('
        SELECT rp.data as role_permissions
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN role_permissions rp ON rp.role = r.code
        WHERE u.id = ?
    ');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    
    $rolePermissions = $row && $row['role_permissions'] 
        ? json_decode($row['role_permissions'], true) 
        : [];
    
    // 2. ดึง User Overrides
    $stmt = $pdo->prepare('
        SELECT permission_key, permission_value 
        FROM user_permission_overrides 
        WHERE user_id = ?
    ');
    $stmt->execute([$userId]);
    $overrides = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 3. Merge: Override ทับ Role Permission
    $effectivePermissions = $rolePermissions;
    foreach ($overrides as $override) {
        $key = $override['permission_key'];
        $value = json_decode($override['permission_value'], true);
        $effectivePermissions[$key] = $value;
    }
    
    return $effectivePermissions;
}
```

### เพิ่ม API Endpoint

```php
// GET /api/users/{id}/permissions
case 'users':
    if ($action === 'permissions' && method() === 'GET') {
        $userId = intval($id);
        $permissions = getUserEffectivePermissions($pdo, $userId);
        json_response(['permissions' => $permissions]);
    }
    break;

// POST /api/users/{id}/permissions/override
case 'users':
    if ($action === 'permissions' && $subAction === 'override' && method() === 'POST') {
        $userId = intval($id);
        $input = json_input();
        $permissionKey = $input['permission_key'] ?? '';
        $permissionValue = $input['permission_value'] ?? [];
        $notes = $input['notes'] ?? '';
        
        $stmt = $pdo->prepare('
            INSERT INTO user_permission_overrides 
            (user_id, permission_key, permission_value, notes, created_by) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                permission_value = VALUES(permission_value),
                notes = VALUES(notes),
                updated_at = CURRENT_TIMESTAMP
        ');
        $stmt->execute([
            $userId, 
            $permissionKey, 
            json_encode($permissionValue), 
            $notes,
            $_SESSION['user_id'] ?? null
        ]);
        
        json_response(['ok' => true]);
    }
    break;
```

---

## 🎨 Frontend Implementation (React/TypeScript)

### Service Function

```typescript
// services/api.ts
export async function getUserPermissions(userId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/users/${userId}/permissions`);
  const data = await response.json();
  return data.permissions;
}

export async function setUserPermissionOverride(
  userId: number, 
  permissionKey: string, 
  permissionValue: { view?: boolean; use?: boolean },
  notes?: string
): Promise<void> {
  await fetch(`${API_BASE}/users/${userId}/permissions/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permission_key: permissionKey, permission_value: permissionValue, notes })
  });
}

export async function deleteUserPermissionOverride(
  userId: number, 
  permissionKey: string
): Promise<void> {
  await fetch(`${API_BASE}/users/${userId}/permissions/override?key=${permissionKey}`, {
    method: 'DELETE'
  });
}
```

### UI Component (ตัวอย่าง)

```typescript
// pages/UserPermissionEditor.tsx
function UserPermissionEditor({ userId }: { userId: number }) {
  const [permissions, setPermissions] = useState({});
  const [overrides, setOverrides] = useState<any[]>([]);
  
  useEffect(() => {
    loadPermissions();
  }, [userId]);
  
  async function loadPermissions() {
    const perms = await getUserPermissions(userId);
    const overridesList = await getUserPermissionOverrides(userId);
    setPermissions(perms);
    setOverrides(overridesList);
  }
  
  async function handleOverride(key: string, value: any) {
    await setUserPermissionOverride(userId, key, value, 'แก้ไขจากหน้าจัดการ');
    loadPermissions();
  }
  
  return (
    <div className="permission-editor">
      <h2>จัดการสิทธิ์เฉพาะบุคคล</h2>
      {Object.entries(permissions).map(([key, value]) => (
        <PermissionRow 
          key={key} 
          permissionKey={key} 
          value={value as any}
          isOverridden={overrides.some(o => o.permission_key === key)}
          onOverride={(newValue) => handleOverride(key, newValue)}
        />
      ))}
    </div>
  );
}
```

---

## ✅ สถานการณ์การใช้งานจริง

### กรณีที่ 1: Backoffice แบ่งเป็น 3 กลุ่มงาน

| User | Role | Override | เห็นเมนูไหน |
|------|------|----------|------------|
| User A | Backoffice | ไม่มี | Orders, Manage Orders, Debt, Reports, Bulk Tracking (ตาม Role) |
| User B | Backoffice | เห็นแค่ Manage Orders | Manage Orders (ขนส่ง) |
| User C | Backoffice | เห็นแค่ Bulk Tracking | Bulk Tracking (ใส่ Tracking) |

### กรณีที่ 2: Telesale มี Junior และ Senior

| User | Role | Override | สิทธิ์พิเศษ |
|------|------|----------|------------|
| Telesale Junior | Telesale | ไม่มี | สิทธิ์ตาม Role (รับออเดอร์, ติดตามลูกค้า) |
| Telesale Senior | Telesale | เพิ่มสิทธิ์ Reports | รับออเดอร์ + ติดตามลูกค้า + ดูรายงาน |

---

## 🚀 ขั้นตอนการ Deploy

### 1. Run Migration
```bash
# Connect to MySQL
mysql -u root -p mini_erp < api/Database/20251211_role_table.sql
```

### 2. ตรวจสอบข้อมูล
```sql
-- ตรวจสอบว่า migrate สำเร็จ
SELECT COUNT(*) FROM roles;
SELECT COUNT(*) FROM users WHERE role_id IS NOT NULL;
SELECT * FROM v_user_effective_permissions LIMIT 5;
```

### 3. Update Backend Code
- เพิ่ม API endpoints สำหรับจัดการ roles, permissions
- เพิ่มฟังก์ชัน `getUserEffectivePermissions()`
- Update authentication middleware ให้ใช้ Permission ใหม่

### 4. Update Frontend Code
- เพิ่มหน้าจัดการ Roles (สร้าง/แก้ไข/ลบ Role)
- เพิ่มหน้าจัดการ User Permissions (Override สิทธิ์เฉพาะคน)
- Update การตรวจสอบสิทธิ์ในเมนูต่าง ๆ

---

## 📝 API Endpoints ที่ต้องเพิ่ม

```
GET    /api/roles                    - ดึงรายการ Roles ทั้งหมด
POST   /api/roles                    - สร้าง Role ใหม่
GET    /api/roles/{id}               - ดึงข้อมูล Role
PUT    /api/roles/{id}               - แก้ไข Role
DELETE /api/roles/{id}               - ลบ Role (ถ้าไม่ใช่ system role)

GET    /api/roles/{id}/permissions   - ดึง Permissions ของ Role
PUT    /api/roles/{id}/permissions   - แก้ไข Permissions ของ Role

GET    /api/users/{id}/permissions   - ดึง Effective Permissions ของ User
GET    /api/users/{id}/overrides     - ดึง Permission Overrides ของ User
POST   /api/users/{id}/overrides     - เพิ่ม/แก้ไข Override
DELETE /api/users/{id}/overrides     - ลบ Override (กลับไปใช้ Role Default)
```

---

## ⚠️ ข้อควรระวัง

1. **อย่าลบ Role ที่มี is_system = TRUE** (Super Admin, etc.)
2. **ตรวจสอบก่อนลบ Role** ว่ามี User ใช้งานอยู่หรือไม่
3. **Permission Override มีความสำคัญสูงกว่า Role Permission**
4. **เก็บ Log การเปลี่ยนแปลง Permission** (อาจเพิ่มตาราง permission_audit_log)
5. **Column users.role (VARCHAR) ยังคงไว้** เพื่อ backward compatibility

---

## 🔮 แผนพัฒนาในอนาคต

- [ ] หน้าจัดการ Roles UI (CRUD Roles)
- [ ] หน้าจัดการ User Permissions UI (Override สิทธิ์)
- [ ] Permission Auditing (Log การเปลี่ยนแปลง)
- [ ] Role Templates (สร้าง Role จาก Template)
- [ ] Bulk Permission Assignment (ตั้งค่าหลายคนพร้อมกัน)
- [ ] Permission Inheritance (Role ลูกรับสิทธิ์จาก Role แม่)

---

## 📞 ติดต่อสอบถาม

หากมีข้อสงสัยหรือต้องการความช่วยเหลือ กรุณาติดต่อทีมพัฒนา

**Created:** 2025-12-11  
**Version:** 1.0.0
