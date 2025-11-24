# คู่มือการตั้งค่า MCP MySQL Server

## ข้อมูลจาก GitHub Repository
- **Repository**: [mcp-server-mysql](https://github.com/benborla/mcp-server-mysql)
- **License**: MIT
- **Features**:
  - 🔍 List database tables and schemas
  - 📊 Execute read-only SQL queries (SELECT)
  - 🔐 Support for multiple databases (multi-DB mode)
  - 🏢 Schema inspection and metadata
  - 🔌 Custom port and SSL/TLS configuration
  - ✏️ Optional write operations (INSERT, UPDATE, DELETE)

## ขั้นตอนการติดตั้ง

### 1. การตั้งค่าใน mcp.json

ไฟล์ config อยู่ที่: `C:\Users\user\.cursor\mcp.json`

การตั้งค่าปัจจุบัน:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "@benborla29/mcp-server-mysql",
        "-p",
        "dotenv",
        "mcp-server-mysql"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASS": "12345678",
        "MYSQL_DB": "mini_erp"
      }
    }
  }
}
```

## Environment Variables

### Required Variables
- `MYSQL_HOST` - MySQL server hostname หรือ IP address (default: "localhost")
- `MYSQL_PORT` - MySQL server port (default: "3306")
- `MYSQL_USER` - MySQL username
- `MYSQL_PASS` - MySQL password
- `MYSQL_DB` - ชื่อ database (ถ้าไม่ระบุจะเข้าสู่ multi-DB mode)

### Optional Variables

#### Security & Permissions
- `ALLOW_INSERT_OPERATION` - อนุญาต INSERT operations (default: "false")
- `ALLOW_UPDATE_OPERATION` - อนุญาต UPDATE operations (default: "false")
- `ALLOW_DELETE_OPERATION` - อนุญาต DELETE operations (default: "false")
- `ALLOW_DDL_OPERATION` - อนุญาต DDL operations (default: "false")

#### SSL/TLS Configuration
- `MYSQL_SSL` - เปิดใช้ SSL/TLS (default: "false")
- `MYSQL_SSL_REJECT_UNAUTHORIZED` - Reject unauthorized SSL certificates (default: "true")

#### Connection Settings
- `MYSQL_CONNECTION_LIMIT` - Connection pool size (default: 10)
- `MYSQL_QUEUE_LIMIT` - Queue limit (default: 0)
- `MYSQL_CONNECT_TIMEOUT` - Connection timeout in milliseconds (default: 10000)

#### Multi-DB Mode
- `MULTI_DB_WRITE_MODE` - Enable write operations in multi-DB mode (default: "false")

#### Schema-Specific Permissions
- `SCHEMA_INSERT_PERMISSIONS` - Schema-specific INSERT permissions (format: "schema1:true,schema2:false")
- `SCHEMA_UPDATE_PERMISSIONS` - Schema-specific UPDATE permissions
- `SCHEMA_DELETE_PERMISSIONS` - Schema-specific DELETE permissions
- `SCHEMA_DDL_PERMISSIONS` - Schema-specific DDL permissions

#### Monitoring
- `MYSQL_ENABLE_LOGGING` - Enable query logging (default: "false")
- `MYSQL_LOG_LEVEL` - Logging level (default: "info")
- `MYSQL_METRICS_ENABLED` - Enable performance metrics (default: "false")

## Multi-DB Mode

MCP-Server-MySQL รองรับการเชื่อมต่อกับหลาย databases เมื่อไม่ระบุ `MYSQL_DB`. ในโหมดนี้ queries ต้องระบุ schema:

```sql
-- ใช้ fully qualified table names
SELECT * FROM database_name.table_name;

-- หรือใช้ USE statements เพื่อสลับระหว่าง databases
USE database_name;
SELECT * FROM table_name;
```

### การเปิดใช้ Multi-DB Mode

เว้นว่าง `MYSQL_DB` environment variable:

```json
{
  "env": {
    "MYSQL_HOST": "localhost",
    "MYSQL_PORT": "3306",
    "MYSQL_USER": "root",
    "MYSQL_PASS": "12345678"
    // ไม่ระบุ MYSQL_DB เพื่อเปิดใช้ multi-DB mode
  }
}
```

## Schema-Specific Permissions

สำหรับการควบคุม permissions แบบละเอียด สามารถกำหนด permissions แยกตาม schema:

```json
{
  "env": {
    "MYSQL_HOST": "localhost",
    "MYSQL_PORT": "3306",
    "MYSQL_USER": "root",
    "MYSQL_PASS": "12345678",
    "MYSQL_DB": "mini_erp",
    "SCHEMA_INSERT_PERMISSIONS": "development:true,test:true,production:false",
    "SCHEMA_UPDATE_PERMISSIONS": "development:true,test:true,production:false",
    "SCHEMA_DELETE_PERMISSIONS": "development:false,test:true,production:false",
    "SCHEMA_DDL_PERMISSIONS": "development:false,test:true,production:false"
  }
}
```

## การเปิดใช้ Write Operations

ถ้าต้องการให้สามารถทำ INSERT, UPDATE, DELETE:

```json
{
  "env": {
    "MYSQL_HOST": "localhost",
    "MYSQL_PORT": "3306",
    "MYSQL_USER": "root",
    "MYSQL_PASS": "12345678",
    "MYSQL_DB": "mini_erp",
    "ALLOW_INSERT_OPERATION": "true",
    "ALLOW_UPDATE_OPERATION": "true",
    "ALLOW_DELETE_OPERATION": "true"
  }
}
```

**คำเตือน**: ตรวจสอบให้แน่ใจว่า MySQL user มี permissions ที่เหมาะสมสำหรับ operations ที่เปิดใช้

## การทดสอบการเชื่อมต่อ

หลังจากตั้งค่าแล้ว:

1. **Restart Cursor** - ต้อง restart เพื่อให้ MCP server โหลดการตั้งค่าใหม่
2. **ตรวจสอบ MCP Server** - ตรวจสอบว่า MySQL MCP server ทำงานใน Cursor
3. **ทดสอบคำสั่ง**:
   - List tables
   - Execute simple SELECT query
   - Inspect schema

## Troubleshooting

### ปัญหา: Connection failed
- ตรวจสอบว่า MySQL server ทำงานอยู่
- ตรวจสอบ firewall settings
- ตรวจสอบ username/password
- ตรวจสอบว่า MySQL user มี permissions ที่เหมาะสม
- ลองเชื่อมต่อด้วย MySQL client เพื่อยืนยันการเข้าถึง

### ปัญหา: Module not found
- ใช้ `npx -y -p @benborla29/mcp-server-mysql -p dotenv mcp-server-mysql` (ตามที่ตั้งค่าไว้แล้ว)
- หรือติดตั้งแบบ global: `npm install -g @benborla29/mcp-server-mysql`

### ปัญหา: Permission denied
- ตรวจสอบ MySQL user permissions
- ตรวจสอบ database access rights
- ตรวจสอบว่า user มีสิทธิ์เข้าถึง database ที่ระบุ

### ปัญหา: Path resolution error
ถ้าเจอ error "Could not connect to MCP server mcp-server-mysql", ตั้งค่า PATH อย่างชัดเจน:

```json
{
  "env": {
    "PATH": "/path/to/node/bin:/usr/bin:/bin",
    "MYSQL_HOST": "localhost",
    // ... other vars
  }
}
```

หา node bin path:
```bash
# Windows PowerShell
where.exe node

# หรือ
echo "$(where.exe node)"
```

### ปัญหา: Authentication issues (MySQL 8.0+)
สำหรับ MySQL 8.0+, ตรวจสอบว่า server รองรับ `caching_sha2_password` authentication plugin

ถ้ามีปัญหา ลองสร้าง user ด้วย legacy authentication:
```sql
CREATE USER 'user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';
GRANT ALL PRIVILEGES ON database_name.* TO 'user'@'localhost';
FLUSH PRIVILEGES;
```

## Security Best Practices

1. **สร้าง MySQL User เฉพาะสำหรับ MCP** - อย่าใช้ root account โดยตรง
2. **ให้สิทธิ์เฉพาะที่จำเป็น** - จำกัด permissions ตามความต้องการ
3. **ใช้ Read-Only Mode เป็นค่าเริ่มต้น** - เปิด write operations เฉพาะเมื่อจำเป็น
4. **ใช้ Schema-Specific Permissions** - สำหรับการควบคุมแบบละเอียด
5. **เปิดใช้ SSL/TLS สำหรับข้อมูลสำคัญ**
6. **ตรวจสอบ Logs** - เปิดใช้ logging เพื่อตรวจสอบ queries

## ตัวอย่างการตั้งค่าที่แนะนำ

### Read-Only Mode (แนะนำสำหรับการตรวจสอบข้อมูล)
```json
{
  "mysql": {
    "command": "npx",
    "args": ["-y", "-p", "@benborla29/mcp-server-mysql", "-p", "dotenv", "mcp-server-mysql"],
    "env": {
      "MYSQL_HOST": "localhost",
      "MYSQL_PORT": "3306",
      "MYSQL_USER": "mcp_readonly",
      "MYSQL_PASS": "secure_password",
      "MYSQL_DB": "mini_erp",
      "MYSQL_ENABLE_LOGGING": "true",
      "MYSQL_LOG_LEVEL": "info"
    }
  }
}
```

### Read-Write Mode (สำหรับการแก้ไขข้อมูล)
```json
{
  "mysql": {
    "command": "npx",
    "args": ["-y", "-p", "@benborla29/mcp-server-mysql", "-p", "dotenv", "mcp-server-mysql"],
    "env": {
      "MYSQL_HOST": "localhost",
      "MYSQL_PORT": "3306",
      "MYSQL_USER": "mcp_user",
      "MYSQL_PASS": "secure_password",
      "MYSQL_DB": "mini_erp",
      "ALLOW_INSERT_OPERATION": "true",
      "ALLOW_UPDATE_OPERATION": "true",
      "ALLOW_DELETE_OPERATION": "true",
      "MYSQL_ENABLE_LOGGING": "true"
    }
  }
}
```

## References

- [GitHub Repository](https://github.com/benborla/mcp-server-mysql)
- [MCP Documentation](https://modelcontextprotocol.io/)
- [MySQL Documentation](https://dev.mysql.com/doc/)

## หมายเหตุ

- MCP Server นี้ใช้สำหรับเชื่อมต่อกับ **MySQL** database
- ตั้งค่าปัจจุบันเชื่อมต่อกับ database `mini_erp` บน localhost
- Server ทำงานในโหมด read-only โดยค่าเริ่มต้น (ต้องเปิด write operations เองถ้าต้องการ)

