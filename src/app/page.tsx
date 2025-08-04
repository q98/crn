import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <main className="flex-grow">
        <section className="bg-gradient-to-b from-blue-600 to-blue-800 text-white py-20">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="md:w-1/2">
                <h1 className="text-4xl md:text-5xl font-bold mb-6">Sweet Home Productions Management Platform</h1>
                <p className="text-xl mb-8">A comprehensive solution for managing clients, credentials, tasks, and website health monitoring.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link 
                    href="/login" 
                    className="bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-lg font-medium text-lg transition-colors"
                  >
                    Login
                  </Link>
                  <Link 
                    href="/dashboard" 
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium text-lg border border-blue-400 transition-colors"
                  >
                    Dashboard
                  </Link>
                </div>
              </div>
              <div className="md:w-1/2 flex justify-center">
                <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl shadow-2xl w-full max-w-md">
                  <div className="space-y-6">
                    <div className="bg-blue-700/50 p-4 rounded-lg flex items-center gap-4">
                      <div className="bg-blue-600 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold">Secure Credential Vault</h3>
                        <p className="text-sm opacity-80">AES-256 encrypted storage</p>
                      </div>
                    </div>
                    <div className="bg-blue-700/50 p-4 rounded-lg flex items-center gap-4">
                      <div className="bg-blue-600 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold">Task Management</h3>
                        <p className="text-sm opacity-80">Track time and bill clients</p>
                      </div>
                    </div>
                    <div className="bg-blue-700/50 p-4 rounded-lg flex items-center gap-4">
                      <div className="bg-blue-600 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold">Health Monitoring</h3>
                        <p className="text-sm opacity-80">Automated website checks</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="bg-blue-100 text-blue-600 p-3 rounded-full w-fit mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Client & Asset Dashboard</h3>
                <p className="text-gray-600">Centralized view of all clients, domains, and hosting accounts with search and filter capabilities.</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="bg-blue-100 text-blue-600 p-3 rounded-full w-fit mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Secure Credential Vault</h3>
                <p className="text-gray-600">Encrypted storage for all login credentials with secure access controls and password generation.</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="bg-blue-100 text-blue-600 p-3 rounded-full w-fit mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Task Management & Time Tracking</h3>
                <p className="text-gray-600">Manage tasks, track billable hours, and generate reports for invoicing clients.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h2 className="text-xl font-bold">SHP Management Platform</h2>
              <p className="text-gray-400">© {new Date().getFullYear()} Sweet Home Productions</p>
            </div>
            <div className="flex gap-6">
              <Link href="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">Dashboard</Link>
              <Link href="/help" className="text-gray-300 hover:text-white transition-colors">Help</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
