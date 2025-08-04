# SHP Management Platform

A comprehensive web-based solution designed to address the operational crisis at Sweet Home Productions (SHP) and provide a centralized system for managing clients, credentials, tasks, and monitoring website health.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd shp-management-platform
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Set up the database

```bash
npx prisma migrate dev --name init
```

This will create the SQLite database file and apply the schema.

4. Start the development server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a custom font.

## Features

- **Client & Asset Dashboard**: Centralized view of all clients, domains, and hosting accounts
- **Secure Credential Vault**: Encrypted storage for all login credentials
- **Task Management & Time Tracking**: Manage tasks and track billable hours
- **Automated Health Monitoring**: Monitor website status and SSL certificates
- **Owner's Dashboard**: Simplified interface for high-level business metrics

## Technology Stack

### Frontend
- Next.js with TypeScript
- Tailwind CSS for styling
- NextAuth.js for authentication
- React Query for data fetching
- Recharts for data visualization

### Backend
- Node.js
- Prisma ORM
- SQLite database
- AES-256 encryption for sensitive data

## Project Structure

```
/src
  /app - Next.js app directory structure
  /components - Reusable UI components
  /lib - Utility functions and shared code
  /api - API routes and handlers
  /types - TypeScript type definitions
/prisma - Database schema and migrations
```

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)

## Deployment

Follow the deployment guide in the project documentation for production deployment instructions.
