# Frontend Architecture and Evolution

Last updated: 2025-01-28

## Architecture Overview

### Framework and Structure
- **Framework**: Next.js 15.1.3 with App Router
- **Language**: TypeScript 5.7.2
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: Radix UI primitives with custom styling
- **Icons**: Lucide React 0.468.0

### Folder Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Main dashboard pages
│   ├── data-management/   # Data import/export pages
│   ├── login/            # Authentication pages
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # Reusable components
│   ├── domains/          # Domain-specific components
│   ├── providers/        # Context providers
│   └── ui/              # UI component library
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
└── types/               # TypeScript type definitions
```

## Key Architectural Decisions

### 1. Next.js App Router
- **Decision**: Use App Router instead of Pages Router
- **Justification**: Better performance, improved developer experience, built-in layouts
- **Implementation**: File-based routing with layout components

### 2. Component Architecture
- **Decision**: Atomic design principles with Radix UI primitives
- **Justification**: Accessibility, consistency, maintainability
- **Implementation**: Custom components built on Radix primitives

### 3. State Management
- **Decision**: React built-in state (useState, useContext) for now
- **Justification**: Sufficient for current complexity, avoid over-engineering
- **Future**: Consider Zustand or Redux for complex state needs

### 4. Styling Strategy
- **Decision**: Tailwind CSS with custom component variants
- **Justification**: Rapid development, consistent design system, small bundle
- **Implementation**: Class Variance Authority for component variants

## Component Library

### UI Components (`src/components/ui/`)

#### Form Components
- **Button**: Variant-based button component with multiple styles
- **Input**: Styled input fields with validation support
- **Select**: Accessible select component using Radix UI
- **Switch**: Toggle switch component
- **Tabs**: Tab navigation component

#### Layout Components
- **Dialog**: Modal dialog component
- **Card**: Content container component
- **Badge**: Status and category indicators

#### Utility Components
- **Loading**: Loading states and spinners
- **Error**: Error display components

### Domain Components (`src/components/domains/`)

#### Authentication
- **LoginForm**: User authentication form
- **AuthGuard**: Protected route wrapper

#### Dashboard
- **Sidebar**: Navigation sidebar
- **Header**: Page headers with breadcrumbs
- **StatsCard**: Metric display cards

#### Data Management
- **ImportForm**: CSV import interface
- **ExportButton**: Data export functionality

## Page Structure and Routing

### Dashboard Pages (`src/app/dashboard/`)

#### Core Pages
- **`/dashboard`**: Main dashboard with overview
- **`/dashboard/clients`**: Client management
- **`/dashboard/tasks`**: Task management
- **`/dashboard/time-tracking`**: Time tracking interface
- **`/dashboard/billing`**: Billing and invoicing
- **`/dashboard/credentials`**: Credential vault
- **`/dashboard/health`**: Health monitoring
- **`/dashboard/reports`**: Reporting dashboard

#### Project Management
- **`/dashboard/projects`**: Project listing
- **`/dashboard/projects/new`**: New project creation
- **`/dashboard/projects/[id]`**: Project details

#### Specialized Pages
- **`/data-management`**: Data import/export
- **`/login`**: Authentication

## State Management Patterns

### Local State
- **useState**: Component-level state for forms and UI interactions
- **useEffect**: Side effects and data fetching
- **useReducer**: Complex state logic (used sparingly)

### Global State
- **React Context**: User authentication state
- **NextAuth Session**: Authentication session management

### Server State
- **Native fetch**: API calls to Next.js API routes
- **No external library**: Direct API integration without React Query/SWR

## Authentication Flow

### Implementation
1. **NextAuth.js**: Handles authentication logic
2. **Session Provider**: Wraps app for session access
3. **Middleware**: Protects routes at the edge
4. **AuthGuard**: Component-level protection

### User Flow
1. User visits protected route
2. Middleware checks authentication
3. Redirects to login if unauthenticated
4. Login form submits to NextAuth
5. Successful login redirects to dashboard

## API Communication

### Pattern
- **Endpoints**: Next.js API routes (`/api/*`)
- **Methods**: RESTful HTTP methods
- **Format**: JSON request/response
- **Authentication**: Session-based via NextAuth

### Error Handling
- **Try-catch blocks**: Wrap API calls
- **User feedback**: Toast notifications and error states
- **Fallback UI**: Error boundaries (planned)

## Responsive Design

### Breakpoints (Tailwind)
- **sm**: 640px and up
- **md**: 768px and up
- **lg**: 1024px and up
- **xl**: 1280px and up

### Mobile-First Approach
- Base styles for mobile
- Progressive enhancement for larger screens
- Touch-friendly interface elements

## Performance Optimizations

### Next.js Features
- **App Router**: Improved performance and caching
- **Server Components**: Reduced client-side JavaScript
- **Image Optimization**: Next.js Image component (when needed)

### Code Splitting
- **Automatic**: Next.js handles route-based splitting
- **Dynamic Imports**: For heavy components (planned)

### Bundle Optimization
- **Tree Shaking**: Automatic with Next.js
- **CSS Purging**: Tailwind removes unused styles

## Accessibility

### Standards
- **WCAG 2.1 AA**: Target compliance level
- **Radix UI**: Provides accessible primitives
- **Semantic HTML**: Proper element usage

### Implementation
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: ARIA labels and descriptions
- **Focus Management**: Visible focus indicators
- **Color Contrast**: Meets WCAG standards

## Testing Strategy (Planned)

### Unit Testing
- **Framework**: Jest + React Testing Library
- **Coverage**: Component logic and utilities

### Integration Testing
- **Framework**: Cypress or Playwright
- **Coverage**: User workflows and API integration

### Visual Testing
- **Framework**: Storybook (planned)
- **Coverage**: Component variations and states

## Build and Deployment

### Development
- **Command**: `npm run dev`
- **Port**: 3001
- **Hot Reload**: Enabled
- **TypeScript**: Real-time checking

### Production Build
- **Command**: `npm run build`
- **Optimization**: Minification, compression
- **Static Generation**: Where applicable

## Current Limitations

### State Management
- No global state library for complex state
- Manual prop drilling in some components

### Error Handling
- No React error boundaries implemented
- Basic error handling in API calls

### Performance
- No performance monitoring
- No bundle analysis setup

### Testing
- No automated testing implemented
- No visual regression testing

## Future Enhancements

### Short Term
1. Implement React error boundaries
2. Add loading states and skeletons
3. Improve error handling and user feedback
4. Add form validation library (Zod/Yup)

### Medium Term
1. Implement global state management (Zustand)
2. Add comprehensive testing suite
3. Performance monitoring and optimization
4. Progressive Web App features

### Long Term
1. Micro-frontend architecture (if needed)
2. Advanced caching strategies
3. Real-time features with WebSockets
4. Advanced accessibility features