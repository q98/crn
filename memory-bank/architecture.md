# System Architecture

Last updated: 2025-01-28

## Overall Architecture

### High-Level Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   (SQLite/PG)   │
│                 │    │                 │    │                 │
│ - React UI      │    │ - REST APIs     │    │ - Prisma ORM    │
│ - Tailwind CSS  │    │ - NextAuth.js   │    │ - Migrations    │
│ - TypeScript    │    │ - Validation    │    │ - Seeding       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   External      │    │   File System   │
│                 │    │   Services      │    │                 │
│ - Session Mgmt  │    │ - WHOIS API     │    │ - Uploads       │
│ - Local Storage │    │ - Email (TBD)   │    │ - Logs          │
│ - Cookies       │    │ - Payments(TBD) │    │ - Backups       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Application Layers

### 1. Presentation Layer (Frontend)

**Technology Stack:**
- Next.js 15.1.3 (React Framework)
- TypeScript 5.7.2
- Tailwind CSS 3.4.17
- Radix UI Components

**Responsibilities:**
- User interface rendering
- User interaction handling
- Client-side routing
- Form validation
- State management
- API communication

**Key Components:**
- Dashboard pages
- Form components
- Navigation system
- Authentication UI

### 2. API Layer (Backend)

**Technology Stack:**
- Next.js API Routes
- NextAuth.js 4.24.11
- TypeScript 5.7.2
- Prisma 6.1.0

**Responsibilities:**
- Business logic processing
- Data validation
- Authentication/authorization
- Database operations
- External API integration
- Error handling

**Key Modules:**
- Authentication service
- Client management
- Task management
- Time tracking
- Billing system
- Credential vault
- Health monitoring

### 3. Data Layer (Database)

**Technology Stack:**
- SQLite (Development)
- PostgreSQL (Production - Planned)
- Prisma ORM

**Responsibilities:**
- Data persistence
- Data integrity
- Query optimization
- Transaction management
- Schema versioning

## System Components

### Core Modules

#### 1. Authentication Module
```
┌─────────────────────────────────────────┐
│           Authentication                │
├─────────────────────────────────────────┤
│ Components:                             │
│ • NextAuth.js Configuration             │
│ • Session Management                    │
│ • Credential Provider                   │
│ • Route Protection Middleware           │
│                                         │
│ Flow:                                   │
│ User → Login Form → NextAuth →          │
│ Database → Session → Protected Routes   │
└─────────────────────────────────────────┘
```

#### 2. Client Management Module
```
┌─────────────────────────────────────────┐
│          Client Management              │
├─────────────────────────────────────────┤
│ Components:                             │
│ • Client CRUD Operations                │
│ • Contact Information                   │
│ • Client Dashboard                      │
│ • Search and Filtering                  │
│                                         │
│ Data Flow:                              │
│ UI Forms → Validation → API →           │
│ Database → Response → UI Update         │
└─────────────────────────────────────────┘
```

#### 3. Task Management Module
```
┌─────────────────────────────────────────┐
│          Task Management                │
├─────────────────────────────────────────┤
│ Components:                             │
│ • Task CRUD Operations                  │
│ • Client Association                    │
│ • Status Tracking                       │
│ • Estimated Hours                       │
│                                         │
│ Relationships:                          │
│ Client (1) → Tasks (Many)               │
│ Task (1) → Time Entries (Many)          │
└─────────────────────────────────────────┘
```

#### 4. Time Tracking Module
```
┌─────────────────────────────────────────┐
│          Time Tracking                  │
├─────────────────────────────────────────┤
│ Components:                             │
│ • Timer Functionality                   │
│ • Manual Time Entry                     │
│ • Earnings Calculation                  │
│ • Time Reports                          │
│                                         │
│ Features:                               │
│ • Start/Stop Timer                      │
│ • Task Association                      │
│ • Hourly Rate Calculation               │
└─────────────────────────────────────────┘
```

#### 5. Billing Module
```
┌─────────────────────────────────────────┐
│            Billing System               │
├─────────────────────────────────────────┤
│ Components:                             │
│ • Invoice Generation                    │
│ • Time Entry Integration                │
│ • Tax Calculation                       │
│ • Payment Tracking                      │
│                                         │
│ Workflow:                               │
│ Time Entries → Invoice Creation →       │
│ Tax/Discount → Total → Payment          │
└─────────────────────────────────────────┘
```

## Data Flow Architecture

### Request/Response Flow

```
1. User Interaction
   ↓
2. Frontend Validation
   ↓
3. API Request (HTTP)
   ↓
4. Middleware (Auth Check)
   ↓
5. API Route Handler
   ↓
6. Business Logic
   ↓
7. Database Operation (Prisma)
   ↓
8. Response Formation
   ↓
9. Frontend Update
   ↓
10. UI Re-render
```

### Authentication Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Browser   │    │  NextAuth   │    │  Database   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       │ 1. Login Request │                  │
       ├─────────────────►│                  │
       │                  │ 2. Validate      │
       │                  ├─────────────────►│
       │                  │ 3. User Data     │
       │                  │◄─────────────────┤
       │ 4. Session Token │                  │
       │◄─────────────────┤                  │
       │                  │ 5. Store Session │
       │                  ├─────────────────►│
       │ 6. Redirect      │                  │
       │◄─────────────────┤                  │
```

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────┐
│              Security Layers            │
├─────────────────────────────────────────┤
│ 1. Network Security                     │
│    • HTTPS Enforcement                  │
│    • CORS Configuration                 │
│    • Rate Limiting (Planned)            │
│                                         │
│ 2. Application Security                 │
│    • Authentication (NextAuth.js)       │
│    • Session Management                 │
│    • Route Protection                   │
│                                         │
│ 3. Data Security                        │
│    • Input Validation                   │
│    • SQL Injection Prevention           │
│    • Data Encryption (Credentials)      │
│                                         │
│ 4. Infrastructure Security              │
│    • Environment Variables              │
│    • Secure Headers (Planned)           │
│    • Monitoring (Planned)               │
└─────────────────────────────────────────┘
```

### Data Encryption

```
Credential Storage Flow:

Plain Text → AES Encryption → Database Storage
    ↓              ↓               ↓
User Input → Encryption Key → Encrypted Field
    ↑              ↑               ↑
Decryption ← Decryption Key ← Database Retrieval
```

## Integration Points

### External Service Integration

```
┌─────────────────┐    ┌─────────────────┐
│   Application   │    │  External APIs  │
├─────────────────┤    ├─────────────────┤
│                 │    │                 │
│ Domain Verify   │◄──►│ WHOIS Service   │
│                 │    │                 │
│ Email (Planned) │◄──►│ SendGrid/SES    │
│                 │    │                 │
│ Payments(Plan.) │◄──►│ Stripe/PayPal   │
│                 │    │                 │
│ Storage(Plan.)  │◄──►│ AWS S3/Cloud    │
└─────────────────┘    └─────────────────┘
```

## Deployment Architecture

### Development Environment

```
┌─────────────────────────────────────────┐
│         Development Setup               │
├─────────────────────────────────────────┤
│ • Next.js Dev Server (Port 3001)       │
│ • SQLite Database (File-based)          │
│ • Hot Reload Enabled                    │
│ • TypeScript Compilation                │
│ • ESLint Checking                       │
└─────────────────────────────────────────┘
```

### Production Architecture (Planned)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │  App Instances  │    │   Database      │
│                 │    │                 │    │                 │
│ • SSL Term.     │◄──►│ • Next.js App   │◄──►│ • PostgreSQL    │
│ • Rate Limiting │    │ • Multiple Inst.│    │ • Connection    │
│ • Health Checks │    │ • Auto Scaling  │    │   Pooling       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN/Static    │    │   Monitoring    │    │   Backup        │
│                 │    │                 │    │                 │
│ • Static Assets │    │ • APM           │    │ • Automated     │
│ • Image Optim.  │    │ • Error Track.  │    │ • Point-in-time │
│ • Caching       │    │ • Metrics       │    │ • Retention     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Scalability Considerations

### Horizontal Scaling

```
Current (Monolithic):
┌─────────────────┐
│   Single App    │
│   Instance      │
└─────────────────┘

Future (Scaled):
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   App Instance  │  │   App Instance  │  │   App Instance  │
│       #1        │  │       #2        │  │       #3        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────────────┐
                    │  Shared Database │
                    │  + Redis Cache   │
                    └─────────────────┘
```

### Database Scaling

```
Current:
┌─────────────────┐
│   SQLite File   │
└─────────────────┘

Production:
┌─────────────────┐    ┌─────────────────┐
│   Primary DB    │    │   Read Replica  │
│   (Write/Read)  │───►│   (Read Only)   │
└─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│   Redis Cache   │
│   (Frequent     │
│    Queries)     │
└─────────────────┘
```

## Performance Architecture

### Caching Strategy (Planned)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Application   │    │   Database      │
│   Cache         │    │   Cache         │    │                 │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Static Assets │    │ • Redis Cache   │    │ • Query Cache   │
│ • API Responses │    │ • Session Store │    │ • Index Optim.  │
│ • User Data     │    │ • Frequent Data │    │ • Connection    │
│                 │    │                 │    │   Pooling       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Monitoring and Observability

### Monitoring Stack (Planned)

```
┌─────────────────────────────────────────┐
│            Monitoring Stack             │
├─────────────────────────────────────────┤
│ Application Performance Monitoring      │
│ • Response Times                        │
│ • Error Rates                           │
│ • Throughput                            │
│                                         │
│ Infrastructure Monitoring               │
│ • CPU/Memory Usage                      │
│ • Database Performance                  │
│ • Network Metrics                       │
│                                         │
│ Business Metrics                        │
│ • User Activity                         │
│ • Feature Usage                         │
│ • Revenue Tracking                      │
│                                         │
│ Security Monitoring                     │
│ • Failed Login Attempts                 │
│ • Suspicious Activity                   │
│ • API Abuse                             │
└─────────────────────────────────────────┘
```

## Disaster Recovery

### Backup Strategy (Planned)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   File Storage  │    │   Configuration │
│   Backups       │    │   Backups       │    │   Backups       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Daily Full    │    │ • User Uploads  │    │ • Env Variables │
│ • Hourly Incr.  │    │ • Generated     │    │ • App Config    │
│ • Point-in-time │    │   Reports       │    │ • SSL Certs     │
│ • Cross-region  │    │ • Logs          │    │ • API Keys      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Technology Evolution Path

### Current → Future

```
Current State:
• Monolithic Next.js App
• SQLite Database
• No Caching
• Basic Security

        ↓

Near Term (3-6 months):
• PostgreSQL Migration
• Redis Caching
• Enhanced Security
• Monitoring Setup

        ↓

Long Term (6-12 months):
• Microservices (if needed)
• Advanced Caching
• Multi-region Deployment
• AI/ML Integration
```