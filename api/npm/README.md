# Database Management API

This directory contains API endpoints for running database operations using npm scripts through HTTP requests.

## Available Endpoints

### `push.php`
Runs `npm run db:push` to push the Prisma schema changes to the database and updates the Prisma client.

**Usage:** Access via web browser or HTTP request:
```
http://your-domain.com/api/npm/push.php
```

### `pull.php`
Runs `npm run db:pull` to pull the database schema and update the Prisma schema file.

**Usage:** Access via web browser or HTTP request:
```
http://your-domain.com/api/npm/pull.php
```

### `seed.php`
Runs `npm run db:seed` to populate the database with initial seed data.

**Usage:** Access via web browser or HTTP request:
```
http://your-domain.com/api/npm/seed.php
```

### `sync.php`
Runs `npm run db:sync` to synchronize the database URL between `api/config.php` and the Prisma configuration.

**Usage:** Access via web browser or HTTP request:
```
http://your-domain.com/api/npm/sync.php
```

### `migrate.php`
Runs `npm run db:migrate` to create and apply database migrations.

**Usage:** Access via web browser or HTTP request:
```
http://your-domain.com/api/npm/migrate.php
```

### `index.php`
Provides a web interface to access all database management endpoints with descriptions and security warnings.

**Usage:** Access via web browser:
```
http://your-domain.com/api/npm/
```

## API Response Format

All endpoints return JSON responses:

```json
{
    "success": true|false,
    "message": "Status message",
    "output": "Output from running the command"
}
```

## Requirements

- Node.js and npm must be installed on the server
- Project dependencies must be installed (run `npm install` from the project root)
- Database connection must be configured in `api/config.php`
- Web server must have permission to execute shell commands

## Security Considerations

- These endpoints execute shell commands on your server
- Consider restricting access by IP address
- Consider adding authentication in production
- Always backup your database before running operations like `migrate` or `seed`

## JavaScript Integration

```javascript
// Example function to call the push endpoint
async function runDatabasePush() {
  try {
    const response = await fetch('/api/npm/push.php');
    const result = await response.json();
    
    if (result.success) {
      console.log('Database push successful:', result.output);
    } else {
      console.error('Database push failed:', result.message);
    }
  } catch (error) {
    console.error('Error calling API:', error);
  }
}
```

## Notes

- All commands run from the project root directory
- The .htaccess file provides additional security headers
- Each endpoint captures both stdout and stderr for complete output
- Consider setting appropriate time limits in your PHP configuration for long-running operations