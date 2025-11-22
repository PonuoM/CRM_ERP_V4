# คู่มือการตั้งค่า MCP SQL Server

## ข้อมูลจาก GitHub Repository
- **Repository**: [mssql_mcp_server](https://github.com/RichardHan/mssql_mcp_server)
- **License**: MIT
- **Features**:
  - 🔍 List database tables
  - 📊 Execute SQL queries (SELECT, INSERT, UPDATE, DELETE)
  - 🔐 Multiple authentication methods (SQL, Windows, Azure AD)
  - 🏢 LocalDB and Azure SQL support
  - 🔌 Custom port configuration

## ขั้นตอนการติดตั้ง

### 1. ติดตั้งแพ็กเกจ

**วิธีที่ 1: ใช้ pip (แนะนำ)**
```bash
pip install microsoft_sql_server_mcp
```

**วิธีที่ 2: ใช้ uvx (ไม่ต้องติดตั้งก่อน)**
```bash
# ไม่ต้องติดตั้งก่อน สามารถใช้ได้เลย
uvx microsoft_sql_server_mcp
```

### 2. ตั้งค่าไฟล์ Config

ไฟล์ config อยู่ที่: `C:\Users\user\AppData\Roaming\Claude\claude_desktop_config.json`

## วิธีการ Authentication

### A. SQL Authentication (พื้นฐาน)

```json
{
  "mcpServers": {
    "mssql": {
      "command": "python",
      "args": ["-m", "mssql_mcp_server"],
      "env": {
        "MSSQL_SERVER": "localhost",
        "MSSQL_DATABASE": "your_database",
        "MSSQL_USER": "your_username",
        "MSSQL_PASSWORD": "your_password"
      }
    }
  }
}
```

### B. Windows Authentication

```json
{
  "mcpServers": {
    "mssql": {
      "command": "python",
      "args": ["-m", "mssql_mcp_server"],
      "env": {
        "MSSQL_SERVER": "localhost",
        "MSSQL_DATABASE": "your_database",
        "MSSQL_WINDOWS_AUTH": "true"
      }
    }
  }
}
```

### C. Azure SQL Database

```json
{
  "mcpServers": {
    "mssql": {
      "command": "python",
      "args": ["-m", "mssql_mcp_server"],
      "env": {
        "MSSQL_SERVER": "your-server.database.windows.net",
        "MSSQL_DATABASE": "your_database",
        "MSSQL_USER": "your_username",
        "MSSQL_PASSWORD": "your_password"
      }
    }
  }
}
```

### D. ใช้ uvx (ไม่ต้องติดตั้งก่อน)

```json
{
  "mcpServers": {
    "mssql": {
      "command": "uvx",
      "args": ["microsoft_sql_server_mcp"],
      "env": {
        "MSSQL_SERVER": "localhost",
        "MSSQL_DATABASE": "your_database",
        "MSSQL_USER": "your_username",
        "MSSQL_PASSWORD": "your_password"
      }
    }
  }
}
```

## Environment Variables

### Required (สำหรับ SQL Auth)
- `MSSQL_SERVER` - ชื่อ server หรือ IP address
- `MSSQL_DATABASE` - ชื่อ database

### Required (เลือกอย่างใดอย่างหนึ่ง)
- `MSSQL_USER` + `MSSQL_PASSWORD` - สำหรับ SQL Authentication
- `MSSQL_WINDOWS_AUTH=true` - สำหรับ Windows Authentication

### Optional
- `MSSQL_PORT` - Port number (default: 1433)
- `MSSQL_ENCRYPT` - Force encryption (true/false)

## ตัวอย่างการตั้งค่าสำหรับ Local SQL Server

```json
{
  "mcpServers": {
    "mssql": {
      "command": "python",
      "args": ["-m", "mssql_mcp_server"],
      "env": {
        "MSSQL_SERVER": "localhost",
        "MSSQL_DATABASE": "master",
        "MSSQL_USER": "sa",
        "MSSQL_PASSWORD": "your_password",
        "MSSQL_PORT": "1433"
      }
    }
  }
}
```

## ตัวอย่างการตั้งค่าสำหรับ SQL Server Express (LocalDB)

```json
{
  "mcpServers": {
    "mssql": {
      "command": "python",
      "args": ["-m", "mssql_mcp_server"],
      "env": {
        "MSSQL_SERVER": "(localdb)\\MSSQLLocalDB",
        "MSSQL_DATABASE": "your_database",
        "MSSQL_WINDOWS_AUTH": "true"
      }
    }
  }
}
```

## Security Best Practices

1. **สร้าง SQL User เฉพาะสำหรับ MCP** - อย่าใช้ admin/sa account
2. **ให้สิทธิ์เฉพาะที่จำเป็น** - จำกัด permissions ตามความต้องการ
3. **ใช้ Windows Authentication เมื่อเป็นไปได้** - ปลอดภัยกว่า
4. **เปิดใช้ Encryption สำหรับข้อมูลสำคัญ**

## การทดสอบการเชื่อมต่อ

หลังจากตั้งค่าแล้ว:
1. Restart Claude Desktop
2. ตรวจสอบว่า MCP server ทำงานใน Claude Desktop
3. ลองใช้คำสั่ง:
   - List tables
   - Execute simple SELECT query

## Troubleshooting

### ปัญหา: Connection failed
- ตรวจสอบว่า SQL Server ทำงานอยู่
- ตรวจสอบ firewall settings
- ตรวจสอบ username/password
- ตรวจสอบว่า SQL Server Browser service ทำงาน (สำหรับ named instances)

### ปัญหา: Module not found
- ติดตั้งแพ็กเกจ: `pip install microsoft_sql_server_mcp`
- หรือใช้ `uvx` แทน

### ปัญหา: Permission denied
- ตรวจสอบ SQL user permissions
- ตรวจสอบ database access rights

## หมายเหตุ

- โปรเจกต์นี้ใช้ **MySQL** เป็นหลัก (ดูจาก `api/config.php`)
- MCP SQL Server ใช้สำหรับเชื่อมต่อกับ **Microsoft SQL Server** เท่านั้น
- หากต้องการเชื่อมต่อ MySQL ผ่าน MCP ต้องใช้ MCP server อื่น

## References

- [GitHub Repository](https://github.com/RichardHan/mssql_mcp_server)
- [MCP Documentation](https://modelcontextprotocol.io/)

