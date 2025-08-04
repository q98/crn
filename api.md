# SHP Management Platform API Documentation

## Overview

This document provides comprehensive documentation for the SHP Management Platform API, covering both implemented endpoints and features that need to be developed. The platform is built with Next.js, TypeScript, Prisma ORM, and SQLite database.

## Base URL
```
http://localhost:3001/api
```

## Authentication

All API endpoints require authentication via NextAuth.js. Include the session cookie in requests.

### Authentication Headers
```http
Cookie: next-auth.session-token=<session-token>
```

## API Endpoints

### 1. Authentication

#### GET /api/auth/session
Get current user session information.

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "ADMIN"
  },
  "expires": "2024-12-31T23:59:59.999Z"
}
```

### 2. Clients Management

#### GET /api/clients
Get all clients with optional filtering.

**Query Parameters:**
- `search` (string): Search by domain name or notes
- `status` (string): Filter by status (ACTIVE, INACTIVE, AT_RISK)
- `page` (number): Page number for pagination
- `limit` (number): Items per page

**Response:**
```json
{
  "clients": [
    {
      "id": "client-id",
      "domainName": "example.com",
      "registrar": "GoDaddy",
      "notes": "Client notes",
      "annualHourAllowance": 2,
      "yearlyHoursUsed": 1.5,
      "verificationStatus": "ACTIVE_SHP_REGISTRAR",
      "createdAt": "2024-01-01T00:00:00Z",
      "credentials": [],
      "tasks": [],
      "healthChecks": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

#### POST /api/clients
Create a new client.

**Request Body:**
```json
{
  "domainName": "example.com",
  "registrar": "GoDaddy",
  "notes": "Client notes",
  "annualHourAllowance": 2,
  "contactPerson": "John Doe",
  "email": "contact@example.com",
  "phone": "+1234567890"
}
```

#### GET /api/clients/[id]
Get a specific client by ID.

#### PUT /api/clients/[id]
Update a client.

#### DELETE /api/clients/[id]
Delete a client (cascades to related data).

### 3. Credentials Management

#### GET /api/credentials
Get all credentials with optional filtering.

**Query Parameters:**
- `clientId` (string): Filter by client
- `service` (string): Filter by service type
- `search` (string): Search in name or username

**Response:**
```json
{
  "credentials": [
    {
      "id": "credential-id",
      "name": "cPanel Access",
      "service": "CPANEL",
      "username": "encrypted-username",
      "password": "encrypted-password",
      "url": "https://cpanel.example.com",
      "notes": "Access notes",
      "clientId": "client-id",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/credentials
Create a new credential (automatically encrypted).

#### GET /api/credentials/[id]
Get a specific credential.

#### PUT /api/credentials/[id]
Update a credential.

#### DELETE /api/credentials/[id]
Delete a credential.

### 4. Tasks Management

#### GET /api/tasks
Get all tasks with optional filtering.

**Query Parameters:**
- `clientId` (string): Filter by client
- `status` (string): Filter by status (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)
- `priority` (string): Filter by priority (LOW, MEDIUM, HIGH)
- `assigneeId` (string): Filter by assignee
- `search` (string): Search in title or description

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-id",
      "title": "Fix contact form",
      "description": "Contact form is not working",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "estimatedHours": 2,
      "actualHours": 1.5,
      "dueDate": "2024-12-31T23:59:59Z",
      "clientId": "client-id",
      "assigneeId": "user-id",
      "createdAt": "2024-01-01T00:00:00Z",
      "timeEntries": [],
      "client": {
        "id": "client-id",
        "domainName": "example.com"
      }
    }
  ]
}
```

#### POST /api/tasks
Create a new task.

**Request Body:**
```json
{
  "title": "Fix contact form",
  "description": "Contact form is not working",
  "status": "OPEN",
  "priority": "HIGH",
  "estimatedHours": 2,
  "dueDate": "2024-12-31T23:59:59Z",
  "clientId": "client-id",
  "assigneeId": "user-id",
  "tags": ["bug", "frontend"]
}
```

#### GET /api/tasks/[id]
Get a specific task.

#### PUT /api/tasks/[id]
Update a task.

#### DELETE /api/tasks/[id]
Delete a task.

### 5. Time Entries

#### GET /api/time-entries
Get all time entries with optional filtering.

**Query Parameters:**
- `taskId` (string): Filter by task
- `clientId` (string): Filter by client
- `developerId` (string): Filter by developer
- `billingStatus` (string): Filter by billing status (PENDING, BILLED, PAID, WRITTEN_OFF)

**Response:**
```json
{
  "timeEntries": [
    {
      "id": "time-entry-id",
      "startTime": "2024-01-01T09:00:00Z",
      "endTime": "2024-01-01T10:30:00Z",
      "duration": 90,
      "description": "Fixed contact form validation",
      "billingStatus": "PENDING",
      "billableAmount": 112.5,
      "developerAmount": 112.5,
      "isWithinAllowance": false,
      "taskId": "task-id",
      "developerId": "user-id",
      "hourlyRate": 75,
      "task": {
        "id": "task-id",
        "title": "Fix contact form",
        "client": {
          "id": "client-id",
          "domainName": "example.com",
          "annualHourAllowance": 2,
          "yearlyHoursUsed": 1.5
        }
      }
    }
  ]
}
```

#### POST /api/time-entries
Create a new time entry.

**Request Body:**
```json
{
  "startTime": "2024-01-01T09:00:00Z",
  "endTime": "2024-01-01T10:30:00Z",
  "description": "Fixed contact form validation",
  "taskId": "task-id",
  "developerId": "user-id",
  "hourlyRate": 75
}
```

#### GET /api/time-entries/[id]
Get a specific time entry.

#### PUT /api/time-entries/[id]
Update a time entry.

#### DELETE /api/time-entries/[id]
Delete a time entry.

### 6. Health Monitoring

#### GET /api/health
Get all health checks.

**Response:**
```json
{
  "healthChecks": [
    {
      "id": "health-check-id",
      "checkType": "UPTIME",
      "status": "HEALTHY",
      "details": "HTTP 200 OK",
      "checkedAt": "2024-01-01T12:00:00Z",
      "clientId": "client-id",
      "client": {
        "id": "client-id",
        "domainName": "example.com"
      }
    }
  ]
}
```

#### POST /api/health
Create a new health check.

**Request Body:**
```json
{
  "checkType": "UPTIME",
  "status": "HEALTHY",
  "details": "HTTP 200 OK",
  "clientId": "client-id"
}
```

#### GET /api/health/[id]
Get a specific health check.

#### PUT /api/health/[id]
Update a health check.

#### DELETE /api/health/[id]
Delete a health check.

### 7. Reports

#### GET /api/reports
Get all reports and templates.

**Response:**
```json
{
  "reports": [
    {
      "id": "1",
      "name": "Client Activity Summary",
      "type": "Client Activity",
      "description": "Overview of all client activities and interactions",
      "createdAt": "2024-01-01T00:00:00Z",
      "status": "Generated"
    }
  ]
}
```

#### GET /api/reports/[id]
Get a specific report with generated data.

**Response:**
```json
{
  "id": "1",
  "name": "Client Activity Summary",
  "type": "Client Activity",
  "description": "Overview of all client activities and interactions",
  "generatedAt": "2024-01-01T00:00:00Z",
  "status": "Generated",
  "data": {
    "totalClients": 25,
    "clients": [
      {
        "id": "client-id",
        "domainName": "example.com",
        "totalTasks": 15,
        "totalCredentials": 3,
        "totalHealthChecks": 45,
        "lastActivity": 1704067200000
      }
    ]
  }
}
```

### 8. Billing & Invoices

#### GET /api/invoices
Get all invoices.

**Query Parameters:**
- `clientId` (string): Filter by client
- `status` (string): Filter by status (DRAFT, SENT, PAID, OVERDUE, CANCELLED)
- `limit` (number): Limit results

**Response:**
```json
{
  "invoices": [
    {
      "id": "invoice-id",
      "invoiceNumber": "INV-2024-001",
      "clientId": "client-id",
      "status": "SENT",
      "totalAmount": 225.0,
      "billedHours": 3.0,
      "hourlyRate": 75.0,
      "generatedAt": "2024-01-01T00:00:00Z",
      "dueDate": "2024-01-31T23:59:59Z",
      "client": {
        "id": "client-id",
        "domainName": "example.com",
        "annualHourAllowance": 2,
        "yearlyHoursUsed": 5.0
      }
    }
  ]
}
```

#### POST /api/invoices
Create a new invoice.

**Request Body:**
```json
{
  "clientId": "client-id",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "hourlyRate": 75.0
}
```

#### GET /api/invoices/[id]
Get a specific invoice.

#### PUT /api/invoices/[id]
Update an invoice.

#### DELETE /api/invoices/[id]
Delete an invoice.

### 9. Billing Utilities

#### POST /api/billing/utils
Execute billing utility operations.

**Request Body:**
```json
{
  "operation": "recalculate-billing",
  "clientId": "client-id"
}
```

**Available Operations:**
- `reset-yearly-hours` - Reset yearly hours for a client
- `recalculate-billing` - Recalculate billing for a client
- `bulk-year-reset` - Reset yearly hours for all clients
- `update-allowance` - Update client's annual allowance
- `generate-overdue-report` - Generate overdue invoice report

### 10. Data Import/Export

#### POST /api/import/tasks/csv
Import tasks from CSV file.

**Request Body:**
```json
{
  "csvData": "title,description,priority,clientId\nFix form,Contact form broken,HIGH,client-id",
  "options": {
    "skipHeader": true,
    "validateData": true
  }
}
```

#### GET /api/import/history
Get import history.

**Response:**
```json
{
  "imports": [
    {
      "id": "import-id",
      "type": "TASK",
      "status": "SUCCESS",
      "importedCount": 25,
      "errorCount": 0,
      "fileName": "tasks.csv",
      "importedAt": "2024-01-01T00:00:00Z",
      "importedBy": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

### 11. Bulk Operations

#### POST /api/bulk/clients
Perform bulk operations on clients.

**Request Body:**
```json
{
  "operation": "update",
  "clientIds": ["client-1", "client-2"],
  "updates": {
    "verificationStatus": "ACTIVE_SHP_REGISTRAR"
  }
}
```

#### POST /api/bulk/tasks
Perform bulk operations on tasks.

**Request Body:**
```json
{
  "operation": "assign",
  "taskIds": ["task-1", "task-2"],
  "assigneeId": "user-id"
}
```

### 12. Domain Verification

#### GET /api/domain/verification
Get domain verification results.

**Query Parameters:**
- `domain` (string): Single domain to verify
- `clientId` (string): Client ID for bulk verification
- `type` (string): 'single', 'bulk', or 'history'

#### POST /api/domain/verification
Perform domain verification.

**Request Body:**
```json
{
  "action": "verify_single",
  "domain": "example.com",
  "clientId": "client-id",
  "updateDatabase": true
}
```

### 13. System Monitoring

#### GET /api/system/monitoring
Get system monitoring data.

**Query Parameters:**
- `type` (string): 'current', 'history', 'alerts', 'health'
- `timeRange` (string): '1h', '6h', '24h', '7d', '30d'

#### GET /api/monitoring/dashboard
Get monitoring dashboard data.

**Query Parameters:**
- `timeRange` (string): Time range for data
- `includeMetrics` (boolean): Include detailed metrics
- `includePerformance` (boolean): Include performance data
- `includeSecurity` (boolean): Include security data

### 14. SSL Monitoring

#### GET /api/ssl/monitoring
Get SSL certificate monitoring data.

**Query Parameters:**
- `clientId` (string): Filter by client
- `status` (string): Filter by status (VALID, EXPIRING, EXPIRED)
- `page` (number): Page number
- `limit` (number): Items per page

## Missing Frontend Features

### 1. Owner's Dashboard (High Priority)
**Status:** Not implemented
**Description:** Simplified interface for non-technical users (Mark)

**Required Features:**
- High-level business metrics (Total Active Clients, At-Risk Clients)
- List of currently open tasks across all clients
- View of recently generated billing reports
- Simple form to submit "New Work Request"
- Read-only access with simplified navigation

**API Endpoints Needed:**
```http
GET /api/owner/dashboard
GET /api/owner/tasks
GET /api/owner/reports
POST /api/owner/work-requests
```

### 2. Domain Verification Dashboard (High Priority)
**Status:** API implemented, frontend missing
**Description:** Interface for managing domain verification status

**Required Features:**
- Domain verification status overview
- Bulk domain verification operations
- SSL certificate expiration alerts
- Domain ownership verification tools
- Registrar integration status

**Frontend Pages Needed:**
- `/dashboard/domains` - Domain listing and management
- `/dashboard/domains/verification` - Verification status dashboard
- `/dashboard/domains/[id]` - Individual domain details

### 3. Advanced Task Management (Medium Priority)
**Status:** Basic implementation exists, advanced features missing

**Missing Features:**
- Task dependency mapping and visualization
- Gantt chart view for project timelines
- Recurring task templates
- Kanban board view
- Calendar integration
- Sprint planning and management

**API Endpoints Needed:**
```http
GET /api/tasks/dependencies
POST /api/tasks/templates
GET /api/tasks/calendar
GET /api/tasks/kanban
```

### 4. Advanced Health Monitoring (Medium Priority)
**Status:** Basic implementation exists, advanced features missing

**Missing Features:**
- Configurable check intervals
- Multi-location monitoring
- Performance metrics (page load time, response time)
- Uptime SLA tracking
- Advanced alerting system
- Status page generation

**API Endpoints Needed:**
```http
GET /api/health/performance
GET /api/health/uptime
POST /api/health/alerts
GET /api/health/status-pages
```

### 5. Advanced Reporting (Medium Priority)
**Status:** Basic implementation exists, advanced features missing

**Missing Features:**
- Automated report scheduling
- Custom report builder
- Data visualization widgets
- Business intelligence dashboard
- Report sharing and collaboration

**API Endpoints Needed:**
```http
POST /api/reports/schedule
GET /api/reports/templates
POST /api/reports/share
GET /api/reports/analytics
```

### 6. Credential Vault Enhancements (Low Priority)
**Status:** Basic implementation exists, advanced features missing

**Missing Features:**
- Role-based access control
- Time-limited access tokens
- Usage tracking and analytics
- Automated password rotation
- Breach detection integration

**API Endpoints Needed:**
```http
POST /api/credentials/access-tokens
GET /api/credentials/usage
POST /api/credentials/rotate
GET /api/credentials/breach-check
```

### 7. Data Management Enhancements (Low Priority)
**Status:** Basic implementation exists, advanced features missing

**Missing Features:**
- Import history and rollback functionality
- Scheduled automated backups
- Data quality validation
- Bulk credential rotation
- Advanced audit logging

**API Endpoints Needed:**
```http
GET /api/data/import-history
POST /api/data/rollback
GET /api/data/backups
POST /api/data/validate
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

Currently no rate limiting implemented. Consider implementing for production.

## Security Considerations

1. **Authentication:** All endpoints require valid session
2. **Encryption:** Credentials are encrypted using AES-256
3. **Input Validation:** All inputs are validated using Zod schemas
4. **SQL Injection:** Protected by Prisma ORM
5. **XSS Protection:** Implement CSP headers

## Development Guidelines

### Adding New Endpoints

1. Create route file in `src/app/api/`
2. Implement authentication check
3. Add input validation using Zod
4. Handle errors consistently
5. Add TypeScript types
6. Update this documentation

### Database Schema Changes

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev`
3. Update seed data if needed
4. Update API endpoints
5. Update frontend components

### Testing

1. Test all CRUD operations
2. Test authentication requirements
3. Test input validation
4. Test error handling
5. Test with real data

## Deployment

### Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3001"
```

### Production Considerations

1. Use PostgreSQL instead of SQLite
2. Implement Redis for caching
3. Add rate limiting
4. Set up monitoring and alerting
5. Configure SSL certificates
6. Implement backup strategies

## Support

For API support and questions:
- Check the codebase for implementation details
- Review the Prisma schema for data models
- Test endpoints using tools like Postman or curl
- Check the browser's Network tab for request/response details 