# Marketing Ads Log API Documentation

## Overview
API endpoints for managing marketing advertisement logs including cost, impressions, reach, and clicks data.

## Base URL
`api/Marketing_DB/`

## Endpoints

### 1. Insert Ads Log
**File:** `ads_log_insert.php`
**Method:** POST
**Required Fields:**
- `page_id` (int) - Page ID
- `user_id` (int) - User ID
- `date` (string) - Date in YYYY-MM-DD format

**Optional Fields:**
- `ads_cost` (decimal) - Advertising cost
- `impressions` (int) - Number of impressions
- `reach` (int) - Number of reach
- `clicks` (int) - Number of clicks

**Example Request:**
```json
{
  "page_id": 1,
  "user_id": 5,
  "date": "2024-01-15",
  "ads_cost": 150.50,
  "impressions": 5000,
  "reach": 3500,
  "clicks": 125
}
```

### 2. Update Ads Log
**File:** `ads_log_update.php`
**Method:** POST
**Required Fields:**
- `id` (int) - Log record ID

**Optional Fields:**
- `page_id`, `user_id`, `date`, `ads_cost`, `impressions`, `reach`, `clicks`

**Example Request:**
```json
{
  "id": 123,
  "ads_cost": 200.00,
  "impressions": 6000
}
```

### 3. Delete Ads Log
**File:** `ads_log_delete.php`
**Method:** POST
**Required Fields:**
- `id` (int) - Log record ID

**Example Request:**
```json
{
  "id": 123
}
```

### 4. Get Ads Logs
**File:** `ads_log_get.php`
**Method:** GET
**Optional Query Parameters:**
- `page_id` (int) - Filter by page ID
- `user_id` (int) - Filter by user ID
- `date_from` (string) - Filter from date (YYYY-MM-DD)
- `date_to` (string) - Filter to date (YYYY-MM-DD)
- `limit` (int) - Limit number of results
- `offset` (int) - Offset for pagination

**Example Request:**
```
GET ads_log_get.php?page_id=1&date_from=2024-01-01&date_to=2024-01-31&limit=50
```

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "page_id": 1,
      "user_id": 5,
      "date": "2024-01-15",
      "ads_cost": "150.50",
      "impressions": 5000,
      "reach": 3500,
      "clicks": 125,
      "created_at": "2024-01-15 10:30:00",
      "updated_at": "2024-01-15 10:30:00",
      "page_name": "Facebook Business Page",
      "page_platform": "Facebook",
      "user_username": "john_doe",
      "user_fullname": "John Doe"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true
  },
  "filters": {
    "page_id": 1,
    "user_id": null,
    "date_from": "2024-01-01",
    "date_to": "2024-01-31"
  }
}
```

## Response Format
All endpoints return JSON with:
- `success` (boolean) - Whether the operation succeeded
- `message` (string) - Success/error message
- `data` (object/array) - Response data (varies by endpoint)
- `error` (string) - Error details (when success is false)

## Error Codes
- 400: Bad Request (missing/invalid data)
- 404: Not Found (record doesn't exist)
- 409: Conflict (duplicate record)
- 500: Internal Server Error

## Database Table
The API manages the `marketing_ads_log` table with the following structure:
- `id` (INT, Primary Key)
- `page_id` (INT, Foreign Key to pages)
- `user_id` (INT, Foreign Key to users)
- `date` (DATE)
- `ads_cost` (DECIMAL 10,2, nullable)
- `impressions` (INT, nullable)
- `reach` (INT, nullable)
- `clicks` (INT, nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Usage in React Component
The MarketingPage.tsx component uses these APIs through the following functions:
- `handleSaveAllAdsData()` - Uses ads_log_insert.php for bulk insert
- `loadAdsLogs()` - Uses ads_log_get.php to retrieve data
- `updateAdsLog()` - Uses ads_log_update.php to update existing records
- `deleteAdsLog()` - Uses ads_log_delete.php to remove records