# MarketingPage.tsx Documentation

This component implements the Marketing Dashboard and Management interface. It serves as the central hub for tracking advertising performance, managing ad spend inputs, and configuring user access to marketing assets (pages and products).

## Key Features

### 1. Dashboard View (`dashboard`)
- **Purpose**: Visualization of marketing performance metrics.
- **Modes**:
    - **Page Mode**: Aggregates data by Facebook Page.
    - **Product Mode**: Aggregates data by Product (SKU).
- **Metrics**: Ads Cost, Sales, New Customer Sales, Reorder Sales, Impression, Reach, Clicks, ROAS (Return on Ad Spend), %Ads (Ads Cost / Sales).
- **Filters**: Date Range (Custom, This Week, This Month), Page/Product Filter, User Filter (Admin only).
- **Export**: CSV export capability for the displayed data.

### 2. Ads Input View (`adsInput`)
- **Purpose**: Manual entry form for daily advertising data.
- **Modes**:
    - **Page Mode**: Input Ads Cost, Impressions, Reach, Clicks per Page.
    - **Product Mode**: Input similar metrics per Product.
- **Functionality**:
    - Use `loadExistingAdsData` to fetch previously entered data for a specific date.
    - `handleSaveAllAdsData` (Page) and `handleSaveProductAdsData` (Product) handle batch insert/update operations.
    - **Uniqueness Logic**: Ads input uniqueness is determined by **Page + Date** (or **Product + Date**). User ID is ignored for uniqueness checks, meaning only one record persists per page/product per day, regardless of which user enters it.
    - Validates that if one metric is entered, all 4 key metrics (Cost, Imp, Reach, Clicks) should ideally be provided.

### 3. Ads History View (`adsHistory`)
- **Purpose**: Review and edit historical ad input logs.
- **Features**:
    - Server-side pagination (`adsHistoryServerPagination`).
    - Edit/Delete functionality for individual log entries.
    - distinct "Page" and "Product" history modes.
    - Filterable by Date, Page/Product, and User.

### 4. User Management (`userManagement`)
- **Access**: Restricted to System Admins or Users with `is_system` role flag.
- **Functionality**:
    - **Page Access**: Assign/Remove users to specific Facebook Pages (`marketing_user_page` table).
    - **Product Access**: Assign/Remove users to specific Products (`marketing_user_product` table).
- **UI**: Expandable lists of Pages and Products showing currently assigned users.

## Data Flow & API Integration
- **Base URL**: Resolved via `resolveApiBasePath`.
- **Primary Endpoints**:
    - `Marketing_DB/dashboard_data.php`: Main dashboard stats (Page level).
    - `Marketing_DB/product_ads_dashboard_data.php`: Product level dashboard stats.
    - `Marketing_DB/ads_log_get.php` / `insert.php` / `update.php` / `delete.php`: Page-level ads CRUD.
    - `Marketing_DB/product_ads_log_get.php` ...: Product-level ads CRUD.
    - `Marketing_DB/get_user_pages.php` / `get_marketing_page_users.php`: User permission mapping.

## Roles & Permissions
- **System Users**: Can see all pages/products and filter by any user. Can manage user assignments.
- **Regular Marketing Users**: Restricted to seeing and inputting data only for pages/products explicitly assigned to them.

## Important State Variables
- `activeTab`: Controls current view (`dashboard`, `adsInput`, `adsHistory`, `userManagement`).
- `adsInputMode` / `adsHistoryMode`: Toggles between 'page' and 'product' context.
- `currentUser`: Contains user ID and Company ID, used for permission checks and data scoping.
- `dateRange`: Global date filter for dashboard.
