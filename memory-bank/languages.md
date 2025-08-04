# Languages and Technologies

Last updated: 2025-01-28

## Core Technologies

### Frontend
- **Next.js v15.1.3** – React-based full-stack framework for SSR/SSG and API routes
- **React v19.0.0** – Frontend library for building user interfaces
- **TypeScript v5.7.2** – Type-safe JavaScript superset for better development experience
- **Tailwind CSS v3.4.17** – Utility-first CSS framework for rapid UI development
- **Lucide React v0.468.0** – Icon library for consistent UI elements

### Backend
- **Node.js v20+** – JavaScript runtime for server-side development
- **Next.js API Routes** – Built-in API functionality for backend endpoints
- **Prisma v6.1.0** – Modern ORM for database operations and schema management
- **NextAuth.js v4.24.11** – Authentication library for Next.js applications

### Database
- **SQLite** – Lightweight relational database for development (via Prisma)
- **PostgreSQL** – Production-ready relational database (Prisma compatible)

### Development Tools
- **ESLint v9.17.0** – Code linting and style enforcement
- **PostCSS v8.5.1** – CSS processing and optimization
- **bcryptjs v2.4.3** – Password hashing and security

### UI Components
- **@radix-ui/react-dialog v1.1.4** – Accessible dialog components
- **@radix-ui/react-select v2.1.4** – Accessible select components
- **@radix-ui/react-switch v1.1.2** – Accessible switch components
- **@radix-ui/react-tabs v1.1.2** – Accessible tab components
- **class-variance-authority v0.7.1** – Utility for creating variant-based component APIs
- **clsx v2.1.1** – Conditional className utility
- **tailwind-merge v2.5.5** – Utility for merging Tailwind CSS classes

### External Integrations
- **whois v2.13.5** – Domain information lookup for domain verification features

## Technology Advantages

### Next.js
- **Advantages**: Full-stack framework, excellent developer experience, built-in API routes, SSR/SSG capabilities
- **Purpose**: Main application framework handling both frontend and backend

### Prisma
- **Advantages**: Type-safe database operations, excellent migration system, multi-database support
- **Purpose**: Database ORM for all data operations

### TypeScript
- **Advantages**: Type safety, better IDE support, reduced runtime errors
- **Purpose**: Primary development language for type safety

### Tailwind CSS
- **Advantages**: Rapid development, consistent design system, small bundle size
- **Purpose**: Primary styling solution

### NextAuth.js
- **Advantages**: Secure authentication, multiple provider support, session management
- **Purpose**: Complete authentication solution

## Potential Limitations

- **SQLite**: Limited for production use, will need PostgreSQL migration
- **Next.js API Routes**: May need separate backend service for complex operations
- **Client-side state**: No global state management library (Redux/Zustand) yet implemented
- **Real-time features**: No WebSocket implementation for real-time updates