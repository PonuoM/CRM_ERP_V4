# User Status and Login Tracking API

## Overview

This API provides functionality for tracking user status (active, inactive, resigned) and login history. It includes features for:

1. User status management
2. Login history tracking
3. Session duration tracking

## Database Schema

### Users Table

The `users` table has been updated with the following new fields:

- `status` - ENUM('active', 'inactive', 'resigned') with default 'active'
- `created_at` - Timestamp when the user record was created
- `updated_at` - Timestamp when the user record was last updated
- `last_login` - Timestamp of the last login
- `login_count` - Counter for total number of logins

### User Login History Table

A new table `user_login_history` has been added to track detailed login information:

- `id` - Primary key
- `user_id` - Foreign key to users table
- `login_time` - Timestamp when the user logged in
- `ip_address` - IP address of the login
- `user_agent` - Browser user agent string
- `logout_time` - Timestamp when the user logged out
- `session_duration` - Duration of the session in seconds

## API Endpoints

### User Management

#### Get Users

```
GET /api/users
```

Query Parameters:
- `companyId` (optional) - Filter by company ID
- `status` (optional) - Filter by status (active, inactive, resigned)

Response:
```json
[
  {
    "id": 1,
    "username": "admin1",
    "first_name": "Somchai",
    "last_name": "Admin",
    "email": "admin1@example.com",
    "phone": "0810000001",
    "role": "Admin Page",
    "company_id": 1,
    "team_id": null,
    "supervisor_id": null,
    "status": "active",
    "created_at": "2025-01-01 10:00:00",
    "updated_at": "2025-01-01 10:00:00",
    "last_login": "2025-01-10 09:30:00",
    "login_count": 25
  }
]
```

#### Get Single User

```
GET /api/users/{id}
```

#### Create User

```
POST /api/users
```

Request Body:
```json
{
  "username": "newuser",
  "password": "password123",
  "firstName": "New",
  "lastName": "User",
  "email": "newuser@example.com",
  "phone": "0810000000",
  "role": "Telesale",
  "companyId": 1,
  "teamId": 1,
  "supervisorId": 2,
  "status": "active"
}
```

#### Update User

```
PATCH /api/users/{id}
```

Request Body:
```json
{
  "firstName": "Updated",
  "status": "inactive"
}
```

#### Delete User (Mark as Resigned)

```
DELETE /api/users/{id}
```

Note: This doesn't actually delete the user but marks them as 'resigned'.

### Authentication

#### Login

```
POST /api/auth/login
```

Request Body:
```json
{
  "username": "admin1",
  "password": "admin123"
}
```

Response:
```json
{
  "ok": true,
  "user": {
    "id": 1,
    "username": "admin1",
    "first_name": "Somchai",
    "last_name": "Admin",
    "email": "admin1@example.com",
    "phone": "0810000001",
    "role": "Admin Page",
    "company_id": 1,
    "team_id": null,
    "supervisor_id": null,
    "status": "active",
    "created_at": "2025-01-01 10:00:00",
    "updated_at": "2025-01-01 10:00:00",
    "last_login": "2025-01-10 09:30:00",
    "login_count": 25
  }
}
```

Note: The login endpoint automatically:
1. Updates the `last_login` timestamp
2. Increments the `login_count`
3. Creates a new record in `user_login_history`
4. Checks if the user status is 'active' before allowing login

### Login History

#### Get Login History

```
GET /api/user_login_history
```

Query Parameters:
- `userId` (optional) - Filter by user ID
- `limit` (optional) - Number of records to return (default: 50)
- `offset` (optional) - Number of records to skip (default: 0)

Response:
```json
[
  {
    "id": 1,
    "user_id": 1,
    "login_time": "2025-01-10 09:30:00",
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "logout_time": "2025-01-10 17:45:00",
    "session_duration": 29700,
    "username": "admin1",
    "first_name": "Somchai",
    "last_name": "Admin"
  }
]
```

#### Record Logout

```
POST /api/user_login_history
```

Request Body:
```json
{
  "historyId": 1
}
```

This updates the logout time and calculates the session duration.

## Database Setup

To set up the database schema, run the following script:

```
GET /api/update_user_schema.php
```

This will execute the SQL script to add the new fields and tables.

## Usage Examples

### Checking if a user is active

```javascript
// Get user details
fetch('/api/users/1')
  .then(response => response.json())
  .then(user => {
    if (user.status === 'active') {
      console.log('User is active');
    } else {
      console.log('User is not active:', user.status);
    }
  });
```

### Getting login history for a user

```javascript
// Get login history for user with ID 1
fetch('/api/user_login_history?userId=1&limit=10')
  .then(response => response.json())
  .then(history => {
    console.log('Login history:', history);
  });
```

### Changing user status to resigned

```javascript
// Mark user as resigned
fetch('/api/users/1', {
  method: 'DELETE'
})
  .then(response => response.json())
  .then(result => {
    console.log('User marked as resigned:', result);
  });
```
