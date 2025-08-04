import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(request) {
    const path = request.nextUrl.pathname;
    
    // If user is authenticated and trying to access login, redirect to dashboard
    if (path === '/login' && request.nextauth.token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        
        // Define public paths that don't require authentication
        const isPublicPath = path === '/' || path === '/login' || path.startsWith('/api/auth') || path.startsWith('/_next') || path.startsWith('/favicon');
        
        // Allow access to public paths
        if (isPublicPath) {
          return true;
        }
        
        // Require authentication for all other paths
        return !!token;
      },
    },
  }
);

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes that don't require authentication (e.g., public API routes)
     * 2. /_next (Next.js internals)
     * 3. /static (static files)
     * 4. /favicon.ico, /robots.txt (SEO files)
     */
    '/((?!_next|static|favicon.ico|robots.txt).*)',
  ],
};