# Thai Address Database Setup

This directory contains the files needed to set up and populate Thai address data in your database.

## Files

- `create_address_tables.sql` - SQL script to create the address database tables
- `import_address_data.php` - PHP script to import JSON data into the database
- `get_address_data.php` - API endpoint to query address data
- `geographies.json` - Thai geographical regions data
- `provinces.json` - Thai provinces data
- `districts.json` - Thai districts (amphoe) data
- `sub_districts.json` - Thai sub-districts (tambon) data

## Database Tables

The script will create the following tables:

1. `address_geographies` - Stores the 6 main geographical regions of Thailand
2. `address_provinces` - Stores all 77 provinces of Thailand
3. `address_districts` - Stores all districts (amphoe) of Thailand
4. `address_sub_districts` - Stores all sub-districts (tambon) of Thailand with zip codes

## Setup Instructions

### Step 1: Create Database Tables

Execute the SQL script in your MySQL database:

```sql
mysql -u username -p database_name < create_address_tables.sql
```

Or you can run it through your database management tool (phpMyAdmin, MySQL Workbench, etc.).

The SQL script is designed to be safe to run multiple times:
- Tables are only created if they don't exist
- Columns are only added if they don't exist
- Indexes are only created if they don't exist
- Foreign key constraints are set up properly

### Step 2: Import Data

Run the PHP import script from the command line or through a web browser:

**Command Line:**
```bash
php import_address_data.php
```

**Web Browser:**
Navigate to: `http://your-domain/api/Address_DB/import_address_data.php`

The import script will:
- Read each JSON file
- Import the data into the corresponding table
- Use INSERT ON DUPLICATE KEY UPDATE to handle existing data
- Report the number of records imported for each table

## Table Relationships

```
address_geographies (6 records)
└── address_provinces (77 records)
    └── address_districts (~928 records)
        └── address_sub_districts (~7,425 records)
```

## Table Structures

### address_geographies
- `id` (Primary Key) - Geography ID
- `name` - Geography name (Thai)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp
- `deleted_at` - Soft delete timestamp

### address_provinces
- `id` (Primary Key) - Province ID
- `name_th` - Province name (Thai)
- `name_en` - Province name (English)
- `geography_id` (Foreign Key) - Reference to address_geographies
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp
- `deleted_at` - Soft delete timestamp

### address_districts
- `id` (Primary Key) - District ID
- `name_th` - District name (Thai)
- `name_en` - District name (English)
- `province_id` (Foreign Key) - Reference to address_provinces
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp
- `deleted_at` - Soft delete timestamp

### address_sub_districts
- `id` (Primary Key) - Sub-district ID
- `zip_code` - Postal code
- `name_th` - Sub-district name (Thai)
- `name_en` - Sub-district name (English)
- `district_id` (Foreign Key) - Reference to address_districts
- `lat` - Latitude (if available)
- `long` - Longitude (if available)
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp
- `deleted_at` - Soft delete timestamp

## Example Queries

### Get all provinces in a specific geography:
```sql
SELECT p.* FROM address_provinces p
JOIN address_geographies g ON p.geography_id = g.id
WHERE g.name = 'ภาคกลาง';
```

### Get all districts in a specific province:
```sql
SELECT * FROM address_districts
WHERE province_id = 1;  Bangkok
```

### Get all sub-districts with their zip codes for a specific district:
```sql
SELECT * FROM address_sub_districts
WHERE district_id = 1001;  Phra Nakhon District
```

### Get complete address hierarchy:
```sql
SELECT 
    sd.name_th AS sub_district,
    sd.zip_code,
    d.name_th AS district,
    p.name_th AS province,
    g.name_th AS geography
FROM address_sub_districts sd
JOIN address_districts d ON sd.district_id = d.id
JOIN address_provinces p ON d.province_id = p.id
JOIN address_geographies g ON p.geography_id = g.id
WHERE sd.id = 100101;  Specific sub-district
```

## Notes

- All tables use UTF8MB4 charset to properly support Thai characters
- The SQL script includes proper foreign key constraints with ON DELETE SET NULL
- Indexes are created for frequently queried columns (geography_id, province_id, district_id, zip_code)
- The import script handles both new and existing data gracefully
- All tables include soft delete functionality with the `deleted_at` column

## Troubleshooting

If you encounter issues:

1. Make sure your database connection details are correct in `api/config.php`
2. Ensure the database user has CREATE, INSERT, and UPDATE privileges
3. Check that the JSON files are readable and not corrupted
4. Verify that the SQL script was executed successfully before running the import

## API Usage

The `get_address_data.php` file provides a RESTful API to query the address data. Use the `endpoint` parameter to specify the type of data you want:

### Available Endpoints

1. **Get all geographies**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=geographies
   ```

2. **Get a specific geography**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=geographies&id=1
   ```

3. **Get all provinces**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=provinces
   ```

4. **Get provinces by geography**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=provinces&id=2
   ```

5. **Get all districts**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=districts
   ```

6. **Get districts by province**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=districts&id=1
   ```

7. **Get all sub-districts**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=sub_districts
   ```

8. **Get sub-districts by district**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=sub_districts&id=1001
   ```

9. **Search by zip code**:
   ```
   GET /api/Address_DB/get_address_data.php?endpoint=search&search=10200
   ```

10. **Get complete address hierarchy**:
    ```
    GET /api/Address_DB/get_address_data.php?endpoint=complete_address&id=100101
    ```

11. **Get statistics**:
    ```
    GET /api/Address_DB/get_address_data.php?endpoint=stats
    ```

### Additional Parameters

- `limit` - Maximum number of records to return (default: 100)
- `offset` - Number of records to skip (default: 0)

Example with pagination:
```
GET /api/Address_DB/get_address_data.php?endpoint=provinces&limit=10&offset=20
```

### Response Format

All responses follow this format:
```json
{
  "success": true,
  "data": [...] // Array of results or single object
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Data Source

This address data is based on the official Thai administrative divisions and includes:
- 6 geographical regions
- 77 provinces
- 928 districts (amphoe)
- 7,425 sub-districts (tambon) with postal codes