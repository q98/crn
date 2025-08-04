'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';

interface HealthCheck {
  id: string;
  checkType: string;
  status: string;
  details?: {
    responseTime?: number;
    sslValid?: boolean;
    sslExpiry?: string;
    uptime?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  clientId: string;
  client: {
    id: string;
    domainName: string;
  };
}

export default function HealthMonitoringPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch health checks from API
  useEffect(() => {
    const fetchHealthChecks = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/health');
        if (!response.ok) {
          throw new Error('Failed to fetch health checks');
        }
        const data = await response.json();
        setHealthChecks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHealthChecks();
  }, []);

  // Filter health checks based on search term and status filter
  const filteredHealthChecks = healthChecks.filter((check) => {
    const matchesSearch =
      check.checkType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      check.client.domainName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' || check.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'success':
      case 'up':
        return 'bg-green-100 text-green-800';
      case 'warning':
      case 'slow':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
      case 'error':
      case 'down':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get response time color (from details if available)
  const getResponseTimeColor = (details?: { responseTime?: number; [key: string]: unknown }) => {
    try {
      const parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
      if (!parsedDetails?.responseTime) return 'text-gray-600';
      const responseTime = parsedDetails.responseTime;
      if (responseTime < 300) return 'text-green-600';
      if (responseTime < 800) return 'text-yellow-600';
      return 'text-red-600';
    } catch {
      return 'text-gray-600';
    }
  };

  // Get SSL expiry status
  const getSslExpiryStatus = (details?: { sslValid?: boolean; sslExpiry?: string; [key: string]: unknown }) => {
    try {
      const parsedDetails = typeof details === 'string' ? JSON.parse(details) : details;
      if (!parsedDetails?.sslValid) return 'bg-red-100 text-red-800';
      
      if (!parsedDetails?.sslExpiry) return 'bg-gray-100 text-gray-800';
      
      const expiryDate = new Date(parsedDetails.sslExpiry);
      const today = new Date();
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 7) return 'bg-red-100 text-red-800';
      if (daysUntilExpiry <= 30) return 'bg-yellow-100 text-yellow-800';
      return 'bg-green-100 text-green-800';
    } catch {
      return 'bg-gray-100 text-gray-800';
    }
  };

  // Run all health checks
  const runAllHealthChecks = () => {
    // In a real application, this would trigger health checks for all sites
    alert('Running health checks for all sites...');
  };

  // Run health check for a specific site
  const runSingleHealthCheck = (id: string) => {
    // In a real application, this would trigger a health check for the specific site
    alert(`Running health check for site ID: ${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Health Monitoring</h1>
        <div className="flex space-x-4">
          <button
            onClick={runAllHealthChecks}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Run All Health Checks
          </button>
          <Link
            href="/dashboard/health/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
          >
            Add New Monitor
          </Link>
        </div>
      </div>

      {/* Health Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg
                className="h-6 w-6 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Healthy</div>
              <div className="text-lg font-semibold text-gray-900">
                {healthChecks.filter((check) => 
                  ['healthy', 'success', 'up'].includes(check.status.toLowerCase())
                ).length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <svg
                className="h-6 w-6 text-yellow-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Warning</div>
              <div className="text-lg font-semibold text-gray-900">
                {healthChecks.filter((check) => 
                  ['warning', 'slow'].includes(check.status.toLowerCase())
                ).length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
              <svg
                className="h-6 w-6 text-red-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Critical</div>
              <div className="text-lg font-semibold text-gray-900">
                {healthChecks.filter((check) => 
                  ['critical', 'error', 'down'].includes(check.status.toLowerCase())
                ).length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg
                className="h-6 w-6 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">SSL Expiring Soon</div>
              <div className="text-lg font-semibold text-gray-900">
                {healthChecks.filter((check) => {
                  try {
                    const details = typeof check.details === 'string' ? JSON.parse(check.details) : check.details;
                    if (!details?.sslExpiry) return false;
                    const expiryDate = new Date(details.sslExpiry);
                    const today = new Date();
                    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return !details.sslValid || daysUntilExpiry <= 30;
                  } catch {
                    return false;
                  }
                }).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <Input
                type="text"
                name="search"
                id="search"
                className="pl-10"
                placeholder="Search by URL or client name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Healthy">Healthy</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading health checks...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading health checks</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Health Checks Table */}
      {!loading && !error && (
        <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Website
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Response Time
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Uptime
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  SSL Expiry
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Client
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Last Checked
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHealthChecks.map((check) => (
                <tr key={check.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {check.client?.domainName || 'Unknown Domain'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(
                        check.status
                      )}`}
                    >
                      {check.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-500">
                      {(() => {
                        try {
                          const details = typeof check.details === 'string' ? JSON.parse(check.details) : check.details;
                          return details?.responseTime ? `${details.responseTime} ms` : 'N/A';
                        } catch {
                          return 'N/A';
                        }
                      })()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(() => {
                      try {
                        const details = typeof check.details === 'string' ? JSON.parse(check.details) : check.details;
                        return details?.uptime || 'N/A';
                      } catch {
                        return 'N/A';
                      }
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      try {
                        const details = typeof check.details === 'string' ? JSON.parse(check.details) : check.details;
                        if (details?.sslExpiry) {
                          return (
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSslExpiryStatus(
                                details
                              )}`}
                            >
                              {details.sslValid ? details.sslExpiry : 'Invalid'}
                            </span>
                          );
                        }
                        return <span className="text-sm text-gray-500">N/A</span>;
                      } catch {
                        return <span className="text-sm text-gray-500">N/A</span>;
                      }
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/dashboard/clients/${check.clientId}`}
                      className="text-sm text-blue-600 hover:text-blue-900"
                    >
                      {check.client?.domainName || 'Unknown Client'}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {check.checkedAt ? new Date(check.checkedAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => runSingleHealthCheck(check.id)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Run Check
                    </button>
                    <Link
                      href={`/dashboard/health/${check.id}`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View
                    </Link>
                    <Link
                      href={`/dashboard/health/${check.id}/edit`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredHealthChecks.length === 0 && (
          <div className="px-6 py-4 text-center text-gray-500">
            No health checks found matching your search criteria.
          </div>
        )}
      </div>
      )}
    </div>
  );
}