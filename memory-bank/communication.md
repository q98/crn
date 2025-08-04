# System Communication Patterns

Last updated: 2025-01-28

## Overview

This document details how different components of the SHP Management Platform communicate with each other, including API contracts, data formats, authentication patterns, and message flows.

## Frontend to Backend Communication

### Protocol and Standards
- **Protocol**: HTTP/HTTPS
- **Format**: JSON
- **Architecture**: RESTful API
- **Authentication**: Session-based via NextAuth.js
- **Base URL**: `/api/*` (Next.js API routes)

### Request/Response Pattern

```javascript
// Standard Request Format
{
  method: 'GET|POST|PUT|DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'next-auth.session-token=...'
  },
  body: JSON.stringify(data) // for POST/PUT
}

// Standard Response Format
{
  success: boolean,
  data?: any,
  error?: string,
  message?: string
}
```

## API Endpoint Communication

### Authentication Endpoints

#### Login
```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "url": "/dashboard",
  "ok": true
}
```

#### Session Check
```http
GET /api/auth/session

Response:
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name"
  },
  "expires": "2025-02-28T00:00:00.000Z"
}
```

### Client Management

#### Get Clients
```http
GET /api/clients?page=1&limit=10&search=company

Response:
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "client-id",
        "name": "Company Name",
        "email": "contact@company.com",
        "phone": "+1234567890",
        "address": "123 Main St",
        "createdAt": "2025-01-28T00:00:00.000Z",
        "updatedAt": "2025-01-28T00:00:00.000Z"
      }
    ],
    "total": 25,
    "page": 1,
    "totalPages": 3
  }
}
```

#### Create Client
```http
POST /api/clients
Content-Type: application/json

{
  "name": "New Company",
  "email": "contact@newcompany.com",
  "phone": "+1234567890",
  "address": "456 Business Ave"
}

Response:
{
  "success": true,
  "data": {
    "id": "new-client-id",
    "name": "New Company",
    "email": "contact@newcompany.com",
    "phone": "+1234567890",
    "address": "456 Business Ave",
    "createdAt": "2025-01-28T00:00:00.000Z",
    "updatedAt": "2025-01-28T00:00:00.000Z"
  }
}
```

### Task Management

#### Get Tasks
```http
GET /api/tasks?clientId=client-id&status=active

Response:
{
  "success": true,
  "data": [
    {
      "id": "task-id",
      "title": "Website Development",
      "description": "Build responsive website",
      "status": "active",
      "priority": "high",
      "estimatedHours": 40,
      "hourlyRate": 75.00,
      "clientId": "client-id",
      "client": {
        "name": "Company Name"
      },
      "createdAt": "2025-01-28T00:00:00.000Z"
    }
  ]
}
```

#### Create Task
```http
POST /api/tasks
Content-Type: application/json

{
  "title": "Mobile App Development",
  "description": "Create iOS and Android app",
  "clientId": "client-id",
  "estimatedHours": 80,
  "hourlyRate": 85.00,
  "priority": "high",
  "status": "active"
}

Response:
{
  "success": true,
  "data": {
    "id": "new-task-id",
    "title": "Mobile App Development",
    "description": "Create iOS and Android app",
    "clientId": "client-id",
    "estimatedHours": 80,
    "hourlyRate": 85.00,
    "priority": "high",
    "status": "active",
    "createdAt": "2025-01-28T00:00:00.000Z"
  }
}
```

### Time Tracking

#### Get Time Entries
```http
GET /api/time-entries?taskId=task-id&startDate=2025-01-01&endDate=2025-01-31

Response:
{
  "success": true,
  "data": [
    {
      "id": "entry-id",
      "description": "Frontend development",
      "hours": 4.5,
      "date": "2025-01-28",
      "taskId": "task-id",
      "task": {
        "title": "Website Development",
        "hourlyRate": 75.00,
        "client": {
          "name": "Company Name"
        }
      },
      "earnings": 337.50,
      "createdAt": "2025-01-28T00:00:00.000Z"
    }
  ]
}
```

#### Create Time Entry
```http
POST /api/time-entries
Content-Type: application/json

{
  "description": "Backend API development",
  "hours": 6.0,
  "date": "2025-01-28",
  "taskId": "task-id"
}

Response:
{
  "success": true,
  "data": {
    "id": "new-entry-id",
    "description": "Backend API development",
    "hours": 6.0,
    "date": "2025-01-28",
    "taskId": "task-id",
    "earnings": 450.00,
    "createdAt": "2025-01-28T00:00:00.000Z"
  }
}
```

### Billing System

#### Get Invoices
```http
GET /api/billing?clientId=client-id&status=draft

Response:
{
  "success": true,
  "data": [
    {
      "id": "invoice-id",
      "invoiceNumber": "INV-2025-001",
      "clientId": "client-id",
      "client": {
        "name": "Company Name",
        "email": "contact@company.com"
      },
      "status": "draft",
      "issueDate": "2025-01-28",
      "dueDate": "2025-02-28",
      "subtotal": 1000.00,
      "taxRate": 0.10,
      "taxAmount": 100.00,
      "discountRate": 0.05,
      "discountAmount": 50.00,
      "total": 1050.00,
      "items": [
        {
          "id": "item-id",
          "description": "Website Development",
          "quantity": 10,
          "rate": 75.00,
          "amount": 750.00
        }
      ]
    }
  ]
}
```

#### Create Invoice
```http
POST /api/billing
Content-Type: application/json

{
  "clientId": "client-id",
  "issueDate": "2025-01-28",
  "dueDate": "2025-02-28",
  "items": [
    {
      "description": "Consulting Services",
      "quantity": 8,
      "rate": 100.00,
      "amount": 800.00
    }
  ],
  "taxRate": 0.08,
  "discountRate": 0.00
}

Response:
{
  "success": true,
  "data": {
    "id": "new-invoice-id",
    "invoiceNumber": "INV-2025-002",
    "clientId": "client-id",
    "status": "draft",
    "subtotal": 800.00,
    "taxAmount": 64.00,
    "total": 864.00,
    "createdAt": "2025-01-28T00:00:00.000Z"
  }
}
```

### Credential Management

#### Get Credentials
```http
GET /api/credentials?clientId=client-id

Response:
{
  "success": true,
  "data": [
    {
      "id": "credential-id",
      "name": "FTP Access",
      "type": "ftp",
      "clientId": "client-id",
      "client": {
        "name": "Company Name"
      },
      "createdAt": "2025-01-28T00:00:00.000Z",
      "updatedAt": "2025-01-28T00:00:00.000Z"
      // Note: Actual credentials are encrypted and not returned in list
    }
  ]
}
```

#### Create Credential
```http
POST /api/credentials
Content-Type: application/json

{
  "name": "Database Access",
  "type": "database",
  "clientId": "client-id",
  "username": "db_user",
  "password": "secure_password",
  "url": "mysql://localhost:3306/database",
  "notes": "Production database credentials"
}

Response:
{
  "success": true,
  "data": {
    "id": "new-credential-id",
    "name": "Database Access",
    "type": "database",
    "clientId": "client-id",
    "createdAt": "2025-01-28T00:00:00.000Z"
    // Sensitive data is encrypted and stored securely
  }
}
```

## Database Communication

### Prisma ORM Patterns

#### Query Examples
```typescript
// Get client with related data
const client = await prisma.client.findUnique({
  where: { id: clientId },
  include: {
    tasks: {
      include: {
        timeEntries: true
      }
    },
    invoices: true,
    credentials: true
  }
});

// Create time entry with task relation
const timeEntry = await prisma.timeEntry.create({
  data: {
    description,
    hours,
    date: new Date(date),
    task: {
      connect: { id: taskId }
    }
  },
  include: {
    task: {
      include: {
        client: true
      }
    }
  }
});

// Complex aggregation query
const stats = await prisma.timeEntry.aggregate({
  where: {
    task: {
      clientId: clientId
    },
    date: {
      gte: startDate,
      lte: endDate
    }
  },
  _sum: {
    hours: true
  },
  _count: {
    id: true
  }
});
```

## Error Handling Communication

### Error Response Format
```javascript
// Standard Error Response
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "field": "email",
    "code": "INVALID_FORMAT",
    "message": "Email format is invalid"
  }
}

// Authentication Error
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Authentication required"
}

// Not Found Error
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Client not found"
}

// Server Error
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "message": "An unexpected error occurred"
}
```

### HTTP Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate data)
- **422**: Unprocessable Entity (business logic errors)
- **500**: Internal Server Error

## Authentication Communication

### Session Management
```javascript
// Session Cookie Format
{
  name: 'next-auth.session-token',
  value: 'encrypted-session-data',
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 // 30 days
}

// Session Data Structure
{
  user: {
    id: 'user-id',
    email: 'user@example.com',
    name: 'User Name'
  },
  expires: '2025-02-28T00:00:00.000Z'
}
```

### Protected Route Communication
```javascript
// Middleware checks session
export async function middleware(request) {
  const token = await getToken({ req: request });
  
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// API route authentication
export async function GET(request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  
  // Continue with authenticated logic
}
```

## External Service Communication

### WHOIS Service Integration
```javascript
// Domain verification request
const domainInfo = await whois.lookup(domain);

// Response format
{
  domain: 'example.com',
  registrar: 'Example Registrar',
  creationDate: '2020-01-01',
  expirationDate: '2025-01-01',
  nameServers: ['ns1.example.com', 'ns2.example.com'],
  status: ['clientTransferProhibited']
}
```

## Real-time Communication (Planned)

### WebSocket Integration
```javascript
// Future WebSocket implementation for real-time updates

// Client connection
const ws = new WebSocket('wss://app.example.com/ws');

// Message format
{
  type: 'TIME_ENTRY_CREATED',
  data: {
    id: 'entry-id',
    taskId: 'task-id',
    hours: 2.5,
    userId: 'user-id'
  },
  timestamp: '2025-01-28T00:00:00.000Z'
}

// Event types
- TIME_ENTRY_CREATED
- TIME_ENTRY_UPDATED
- TASK_STATUS_CHANGED
- INVOICE_GENERATED
- SYSTEM_NOTIFICATION
```

## Data Validation Communication

### Input Validation Patterns
```typescript
// Zod schema example (planned implementation)
import { z } from 'zod';

const ClientSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional()
});

// Validation in API route
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = ClientSchema.parse(body);
    
    // Continue with validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors
      }, { status: 400 });
    }
  }
}
```

## Performance Communication

### Caching Headers (Planned)
```http
# Static data caching
Cache-Control: public, max-age=3600
ETag: "abc123"

# Dynamic data caching
Cache-Control: private, max-age=300
Last-Modified: Mon, 28 Jan 2025 00:00:00 GMT

# No caching for sensitive data
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
```

### Rate Limiting (Planned)
```http
# Rate limit headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643328000

# Rate limit exceeded response
HTTP/1.1 429 Too Many Requests
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "retryAfter": 60
}
```

## Monitoring Communication

### Health Check Endpoints
```http
GET /api/health

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-28T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "external_apis": "healthy"
  },
  "version": "2.0.0-beta"
}
```

### Metrics Collection (Planned)
```javascript
// Custom metrics format
{
  metric: 'api_request_duration',
  value: 150, // milliseconds
  labels: {
    endpoint: '/api/clients',
    method: 'GET',
    status: '200'
  },
  timestamp: '2025-01-28T00:00:00.000Z'
}
```