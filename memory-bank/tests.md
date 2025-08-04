# Testing Documentation

Last updated: 2025-01-28

## Testing Overview

The SHP Management Platform currently has minimal automated testing but follows a comprehensive testing strategy for future implementation. This document outlines the current testing status, planned testing framework, and testing best practices.

## Current Testing Status

### Test Coverage
- **Unit Tests**: 0% (Not implemented)
- **Integration Tests**: 0% (Not implemented)
- **E2E Tests**: 0% (Not implemented)
- **Manual Testing**: 80% (Ongoing during development)
- **Code Quality**: 100% (ESLint + TypeScript)

### Current Quality Assurance
- ✅ **TypeScript**: 100% type coverage
- ✅ **ESLint**: Zero errors, zero warnings
- ✅ **Prettier**: Consistent code formatting
- ✅ **Manual Testing**: Feature validation during development
- ✅ **Code Reviews**: Security and quality focused

### Testing Gaps
- ⚠️ No automated test suite
- ⚠️ No test-driven development (TDD)
- ⚠️ No continuous integration testing
- ⚠️ No performance testing
- ⚠️ No security testing automation
- ⚠️ No accessibility testing

## Planned Testing Framework

### Testing Stack (v2.0.0-rc1)

#### Unit Testing
- **Framework**: Jest 29.x
- **React Testing**: React Testing Library
- **Mocking**: Jest mocks + MSW (Mock Service Worker)
- **Coverage**: Istanbul/NYC

#### Integration Testing
- **API Testing**: Supertest
- **Database Testing**: Jest with test database
- **Component Integration**: React Testing Library

#### End-to-End Testing
- **Framework**: Cypress 13.x
- **Browser Testing**: Chrome, Firefox, Safari
- **Mobile Testing**: Cypress mobile viewport

#### Performance Testing
- **Load Testing**: Artillery.js
- **Bundle Analysis**: @next/bundle-analyzer
- **Lighthouse**: Performance auditing

### Test Configuration

#### Jest Configuration
```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './'
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1'
  }
};

module.exports = createJestConfig(customJestConfig);
```

#### Jest Setup
```javascript
// jest.setup.js
import '@testing-library/jest-dom';
import { server } from './src/mocks/server';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/'
  })
}));

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      }
    },
    status: 'authenticated'
  }),
  signIn: jest.fn(),
  signOut: jest.fn()
}));

// Setup MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

#### Cypress Configuration
```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack'
    },
    supportFile: 'cypress/support/component.js',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}'
  }
});
```

## Unit Testing Strategy

### Component Testing

#### Example: Client Form Component
```typescript
// src/components/ClientForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientForm } from './ClientForm';
import { server } from '@/mocks/server';
import { rest } from 'msw';

describe('ClientForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form fields correctly', () => {
    render(
      <ClientForm 
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />
    );

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    
    render(
      <ClientForm 
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />
    );

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    
    render(
      <ClientForm 
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />
    );

    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.post('/api/clients', (req, res, ctx) => {
        return res(
          ctx.status(201),
          ctx.json({
            success: true,
            data: {
              id: 'new-client-id',
              name: 'Test Company',
              email: 'test@company.com'
            }
          })
        );
      })
    );

    render(
      <ClientForm 
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />
    );

    await user.type(screen.getByLabelText(/name/i), 'Test Company');
    await user.type(screen.getByLabelText(/email/i), 'test@company.com');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');
    
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith({
        id: 'new-client-id',
        name: 'Test Company',
        email: 'test@company.com'
      });
    });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    server.use(
      rest.post('/api/clients', (req, res, ctx) => {
        return res(
          ctx.status(400),
          ctx.json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Email already exists'
          })
        );
      })
    );

    render(
      <ClientForm 
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />
    );

    await user.type(screen.getByLabelText(/name/i), 'Test Company');
    await user.type(screen.getByLabelText(/email/i), 'existing@company.com');
    
    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });
});
```

### API Route Testing

#### Example: Clients API
```typescript
// src/app/api/clients/route.test.ts
import { GET, POST } from './route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('next-auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn()
    }
  }
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/clients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/clients');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('returns paginated clients when authenticated', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-id', email: 'test@example.com' }
      });

      const mockClients = [
        {
          id: 'client-1',
          name: 'Company A',
          email: 'contact@companya.com',
          phone: '+1234567890',
          address: '123 Main St',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      const request = new Request('http://localhost:3000/api/clients?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.clients).toEqual(mockClients);
      expect(data.data.total).toBe(1);
      expect(data.data.page).toBe(1);
      expect(data.data.totalPages).toBe(1);
    });

    it('handles search parameter', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-id', email: 'test@example.com' }
      });

      const request = new Request('http://localhost:3000/api/clients?search=Company');
      await GET(request);

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'Company', mode: 'insensitive' } },
              { email: { contains: 'Company', mode: 'insensitive' } }
            ]
          }
        })
      );
    });
  });

  describe('POST', () => {
    it('creates new client with valid data', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-id', email: 'test@example.com' }
      });

      const newClient = {
        id: 'new-client-id',
        name: 'New Company',
        email: 'new@company.com',
        phone: '+1234567890',
        address: '456 Business Ave',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.client.create.mockResolvedValue(newClient);

      const request = new Request('http://localhost:3000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Company',
          email: 'new@company.com',
          phone: '+1234567890',
          address: '456 Business Ave'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(newClient);
    });

    it('validates required fields', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-id', email: 'test@example.com' }
      });

      const request = new Request('http://localhost:3000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required fields
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('VALIDATION_ERROR');
    });
  });
});
```

### Utility Function Testing

#### Example: Date Utilities
```typescript
// src/lib/utils/date.test.ts
import { formatDate, calculateDuration, isValidDate } from './date';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('formats date correctly', () => {
      const date = new Date('2025-01-28T10:30:00Z');
      expect(formatDate(date)).toBe('2025-01-28');
    });

    it('handles invalid date', () => {
      expect(formatDate(new Date('invalid'))).toBe('Invalid Date');
    });
  });

  describe('calculateDuration', () => {
    it('calculates duration between dates', () => {
      const start = new Date('2025-01-28T09:00:00Z');
      const end = new Date('2025-01-28T17:00:00Z');
      expect(calculateDuration(start, end)).toBe(8); // 8 hours
    });

    it('returns 0 for same dates', () => {
      const date = new Date('2025-01-28T09:00:00Z');
      expect(calculateDuration(date, date)).toBe(0);
    });
  });

  describe('isValidDate', () => {
    it('validates correct date', () => {
      expect(isValidDate(new Date('2025-01-28'))).toBe(true);
    });

    it('invalidates incorrect date', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
    });
  });
});
```

## Integration Testing Strategy

### Database Integration Tests

#### Example: Client Service Integration
```typescript
// src/services/client.integration.test.ts
import { PrismaClient } from '@prisma/client';
import { ClientService } from './client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL
    }
  }
});

const clientService = new ClientService(prisma);

describe('ClientService Integration', () => {
  beforeAll(async () => {
    // Setup test database
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup test database
    await prisma.client.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean data before each test
    await prisma.client.deleteMany();
  });

  it('creates and retrieves client', async () => {
    const clientData = {
      name: 'Test Company',
      email: 'test@company.com',
      phone: '+1234567890',
      address: '123 Test St'
    };

    const createdClient = await clientService.create(clientData);
    expect(createdClient.id).toBeDefined();
    expect(createdClient.name).toBe(clientData.name);

    const retrievedClient = await clientService.findById(createdClient.id);
    expect(retrievedClient).toEqual(createdClient);
  });

  it('handles duplicate email constraint', async () => {
    const clientData = {
      name: 'Test Company',
      email: 'duplicate@company.com',
      phone: '+1234567890'
    };

    await clientService.create(clientData);

    await expect(
      clientService.create({ ...clientData, name: 'Another Company' })
    ).rejects.toThrow('Email already exists');
  });

  it('searches clients by name and email', async () => {
    await clientService.create({
      name: 'Alpha Company',
      email: 'alpha@company.com'
    });

    await clientService.create({
      name: 'Beta Corp',
      email: 'beta@corp.com'
    });

    const searchResults = await clientService.search('Alpha');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].name).toBe('Alpha Company');
  });
});
```

## End-to-End Testing Strategy

### Authentication Flow

#### Example: Login E2E Test
```typescript
// cypress/e2e/auth/login.cy.ts
describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('displays login form', () => {
    cy.get('[data-testid="login-form"]').should('be.visible');
    cy.get('input[name="email"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('contain', 'Sign In');
  });

  it('shows validation errors for empty fields', () => {
    cy.get('button[type="submit"]').click();
    
    cy.get('[data-testid="email-error"]')
      .should('be.visible')
      .and('contain', 'Email is required');
    
    cy.get('[data-testid="password-error"]')
      .should('be.visible')
      .and('contain', 'Password is required');
  });

  it('shows error for invalid credentials', () => {
    cy.get('input[name="email"]').type('invalid@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.get('[data-testid="login-error"]')
      .should('be.visible')
      .and('contain', 'Invalid credentials');
  });

  it('successfully logs in with valid credentials', () => {
    cy.get('input[name="email"]').type('admin@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('be.visible');
  });

  it('redirects to dashboard if already logged in', () => {
    // Login first
    cy.login('admin@example.com', 'password123');
    
    // Try to visit login page
    cy.visit('/login');
    
    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
  });
});
```

### Client Management E2E

#### Example: Client CRUD Operations
```typescript
// cypress/e2e/clients/client-management.cy.ts
describe('Client Management', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'password123');
    cy.visit('/dashboard/clients');
  });

  it('displays clients list', () => {
    cy.get('[data-testid="clients-table"]').should('be.visible');
    cy.get('[data-testid="add-client-button"]').should('be.visible');
  });

  it('creates new client', () => {
    cy.get('[data-testid="add-client-button"]').click();
    
    cy.get('[data-testid="client-form"]').should('be.visible');
    
    cy.get('input[name="name"]').type('Test Company');
    cy.get('input[name="email"]').type('test@company.com');
    cy.get('input[name="phone"]').type('+1234567890');
    cy.get('textarea[name="address"]').type('123 Test Street');
    
    cy.get('button[type="submit"]').click();
    
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Client created successfully');
    
    cy.get('[data-testid="clients-table"]')
      .should('contain', 'Test Company')
      .and('contain', 'test@company.com');
  });

  it('edits existing client', () => {
    // Assuming a client exists
    cy.get('[data-testid="client-row"]').first().within(() => {
      cy.get('[data-testid="edit-button"]').click();
    });
    
    cy.get('[data-testid="client-form"]').should('be.visible');
    
    cy.get('input[name="name"]').clear().type('Updated Company Name');
    cy.get('button[type="submit"]').click();
    
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Client updated successfully');
    
    cy.get('[data-testid="clients-table"]')
      .should('contain', 'Updated Company Name');
  });

  it('deletes client with confirmation', () => {
    cy.get('[data-testid="client-row"]').first().within(() => {
      cy.get('[data-testid="delete-button"]').click();
    });
    
    cy.get('[data-testid="delete-confirmation"]').should('be.visible');
    cy.get('[data-testid="confirm-delete"]').click();
    
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Client deleted successfully');
  });

  it('searches clients', () => {
    cy.get('[data-testid="search-input"]').type('Test Company');
    
    cy.get('[data-testid="clients-table"]')
      .should('contain', 'Test Company');
    
    cy.get('[data-testid="search-input"]').clear().type('Nonexistent');
    
    cy.get('[data-testid="no-results"]')
      .should('be.visible')
      .and('contain', 'No clients found');
  });
});
```

## Performance Testing

### Load Testing Configuration

#### Example: Artillery.js Configuration
```yaml
# artillery.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
  processor: "./test-functions.js"
  variables:
    testUser:
      - "admin@example.com"
    testPassword:
      - "password123"

scenarios:
  - name: "Authentication and Dashboard"
    weight: 30
    flow:
      - post:
          url: "/api/auth/signin"
          json:
            email: "{{ testUser }}"
            password: "{{ testPassword }}"
          capture:
            - json: "$.url"
              as: "redirectUrl"
      - get:
          url: "/dashboard"
          
  - name: "Client Management"
    weight: 40
    flow:
      - post:
          url: "/api/auth/signin"
          json:
            email: "{{ testUser }}"
            password: "{{ testPassword }}"
      - get:
          url: "/api/clients"
      - post:
          url: "/api/clients"
          json:
            name: "Load Test Client {{ $randomString() }}"
            email: "loadtest{{ $randomString() }}@example.com"
            
  - name: "Time Tracking"
    weight: 30
    flow:
      - post:
          url: "/api/auth/signin"
          json:
            email: "{{ testUser }}"
            password: "{{ testPassword }}"
      - get:
          url: "/api/time-entries"
      - post:
          url: "/api/time-entries"
          json:
            description: "Load test entry"
            hours: 2.5
            date: "2025-01-28"
            taskId: "test-task-id"
```

### Bundle Size Testing

#### Example: Bundle Analysis
```javascript
// scripts/analyze-bundle.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  webpack: (config, { isServer }) => {
    if (process.env.ANALYZE === 'true') {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
          openAnalyzer: false
        })
      );
    }
    return config;
  }
};
```

## Test Data Management

### Test Database Setup

#### Example: Test Database Configuration
```typescript
// src/lib/test-db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const testPrisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'file:./test.db'
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = testPrisma;
}

// Test data factories
export const createTestClient = async (overrides = {}) => {
  return await testPrisma.client.create({
    data: {
      name: 'Test Company',
      email: `test${Date.now()}@company.com`,
      phone: '+1234567890',
      address: '123 Test Street',
      ...overrides
    }
  });
};

export const createTestTask = async (clientId: string, overrides = {}) => {
  return await testPrisma.task.create({
    data: {
      title: 'Test Task',
      description: 'Test task description',
      status: 'active',
      priority: 'medium',
      estimatedHours: 10,
      hourlyRate: 75.00,
      clientId,
      ...overrides
    }
  });
};

export const createTestTimeEntry = async (taskId: string, overrides = {}) => {
  return await testPrisma.timeEntry.create({
    data: {
      description: 'Test time entry',
      hours: 2.5,
      date: new Date(),
      taskId,
      ...overrides
    }
  });
};

export const cleanupTestData = async () => {
  await testPrisma.timeEntry.deleteMany();
  await testPrisma.task.deleteMany();
  await testPrisma.client.deleteMany();
  await testPrisma.user.deleteMany();
};
```

### Mock Service Worker Setup

#### Example: API Mocks
```typescript
// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Auth handlers
  rest.post('/api/auth/signin', (req, res, ctx) => {
    const { email, password } = req.body as any;
    
    if (email === 'admin@example.com' && password === 'password123') {
      return res(
        ctx.status(200),
        ctx.json({ url: '/dashboard' })
      );
    }
    
    return res(
      ctx.status(401),
      ctx.json({ error: 'Invalid credentials' })
    );
  }),

  rest.get('/api/auth/session', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: {
          id: 'test-user-id',
          email: 'admin@example.com',
          name: 'Test Admin'
        },
        expires: '2025-02-28T00:00:00.000Z'
      })
    );
  }),

  // Client handlers
  rest.get('/api/clients', (req, res, ctx) => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search');

    let clients = [
      {
        id: 'client-1',
        name: 'Test Company A',
        email: 'contact@companya.com',
        phone: '+1234567890',
        address: '123 Main St',
        createdAt: '2025-01-28T00:00:00.000Z',
        updatedAt: '2025-01-28T00:00:00.000Z'
      },
      {
        id: 'client-2',
        name: 'Test Company B',
        email: 'contact@companyb.com',
        phone: '+0987654321',
        address: '456 Business Ave',
        createdAt: '2025-01-28T00:00:00.000Z',
        updatedAt: '2025-01-28T00:00:00.000Z'
      }
    ];

    if (search) {
      clients = clients.filter(client => 
        client.name.toLowerCase().includes(search.toLowerCase()) ||
        client.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    const total = clients.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedClients = clients.slice(startIndex, endIndex);

    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: {
          clients: paginatedClients,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        }
      })
    );
  }),

  rest.post('/api/clients', (req, res, ctx) => {
    const clientData = req.body as any;
    
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          id: `client-${Date.now()}`,
          ...clientData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
    );
  })
];
```

## Continuous Integration Testing

### GitHub Actions Workflow

#### Example: CI/CD Pipeline
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Setup test database
      run: |
        npx prisma generate
        npx prisma db push
      env:
        TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Build application
      run: npm run build
    
    - name: Start application
      run: npm start &
      env:
        NODE_ENV: test
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Wait for application
      run: npx wait-on http://localhost:3000
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
```

## Testing Best Practices

### Test Organization
- **File Structure**: Tests alongside source files or in `__tests__` directories
- **Naming Convention**: `*.test.ts` for unit tests, `*.integration.test.ts` for integration tests
- **Test Grouping**: Use `describe` blocks to group related tests
- **Test Isolation**: Each test should be independent and not rely on others

### Test Writing Guidelines
- **AAA Pattern**: Arrange, Act, Assert
- **Descriptive Names**: Test names should clearly describe what is being tested
- **Single Responsibility**: Each test should test one specific behavior
- **Mock External Dependencies**: Use mocks for external services and APIs
- **Test Edge Cases**: Include tests for error conditions and boundary cases

### Code Coverage Goals
- **Unit Tests**: 80%+ line coverage
- **Integration Tests**: 70%+ feature coverage
- **E2E Tests**: 90%+ critical path coverage
- **Overall**: 85%+ combined coverage

## Testing Roadmap

### Phase 1: Foundation (v2.0.0-rc1)
- ✅ Jest and React Testing Library setup
- ✅ Basic unit tests for components
- ✅ API route testing
- ✅ Test database configuration
- ✅ CI/CD pipeline integration

### Phase 2: Comprehensive Testing (v2.0.0)
- 🔄 Complete unit test coverage
- 🔄 Integration test suite
- 🔄 Cypress E2E tests
- 🔄 Performance testing
- 🔄 Security testing automation

### Phase 3: Advanced Testing (v2.1.0)
- 📋 Visual regression testing
- 📋 Accessibility testing
- 📋 Cross-browser testing
- 📋 Mobile testing
- 📋 Load testing automation

### Phase 4: Quality Assurance (v3.0.0)
- 📋 Mutation testing
- 📋 Property-based testing
- 📋 Chaos engineering
- 📋 Advanced monitoring
- 📋 Automated test generation

---

*This testing documentation is maintained as part of the Memory Bank system and should be updated with each testing enhancement or framework change.*