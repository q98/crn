'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface HealthCheckResult {
  domain: string;
  status: 'HEALTHY' | 'WARNING' | 'ERROR';
  responseTime: number;
  statusCode: number | null;
  sslValid: boolean;
  error?: string;
  timestamp: string;
}

interface Client {
  id: string;
  domainName: string;
}

export default function HealthCheckPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Fetch existing clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients');
        if (response.ok) {
          const clientData = await response.json();
          setClients(clientData);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const handleSiteToggle = (domain: string) => {
    setSelectedSites(prev => 
      prev.includes(domain) 
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  const handleSelectAll = () => {
    const allDomains = clients.map(client => client.domainName);
    setSelectedSites(selectedSites.length === allDomains.length ? [] : allDomains);
  };

  const addCustomDomain = () => {
    if (customDomain.trim() && !selectedSites.includes(customDomain.trim())) {
      setSelectedSites(prev => [...prev, customDomain.trim()]);
      setCustomDomain('');
      setShowCustomInput(false);
    }
  };

  const removeCustomDomain = (domain: string) => {
    setSelectedSites(prev => prev.filter(d => d !== domain));
  };

  const runHealthChecks = async () => {
    if (selectedSites.length === 0) {
      alert('Please select at least one site to check.');
      return;
    }

    setIsRunning(true);
    setResults([]);

    try {
      const response = await fetch('/api/health/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domains: selectedSites,
          createClientIfNotExists: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Health check results:', data);
      
      // Validate and sanitize the results
      const sanitizedResults = (data.results || []).map((result: any) => ({
        domain: result.domain || 'Unknown',
        status: result.status || 'ERROR',
        responseTime: typeof result.responseTime === 'number' ? result.responseTime : null,
        statusCode: typeof result.statusCode === 'number' ? result.statusCode : null,
        sslValid: Boolean(result.sslValid),
        error: result.error || null,
        timestamp: result.timestamp || new Date().toISOString()
      }));
      
      setResults(sanitizedResults);
    } catch (error) {
      console.error('Error running health checks:', error);
      alert('Failed to run health checks. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Run Health Check</h1>
        <Link
          href="/dashboard/health"
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          Back to Health Dashboard
        </Link>
      </div>

      {/* Site Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Select Sites to Check</h2>
          <button
            onClick={handleSelectAll}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {selectedSites.length === clients.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="text-gray-500">Loading clients...</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {clients.map((client) => (
                <div key={client.id} className="flex items-center">
                  <input
                    id={`client-${client.id}`}
                    type="checkbox"
                    checked={selectedSites.includes(client.domainName)}
                    onChange={() => handleSiteToggle(client.domainName)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`client-${client.id}`} className="ml-3 block text-sm text-gray-900">
                    <div className="font-medium">{client.domainName}</div>
                    <div className="text-gray-500">Existing client</div>
                  </label>
                </div>
              ))}
              
              {/* Custom domains that aren't in clients list */}
              {selectedSites
                .filter(domain => !clients.some(client => client.domainName === domain))
                .map((domain) => (
                  <div key={domain} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => removeCustomDomain(domain)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{domain}</div>
                        <div className="text-sm text-blue-600">Custom domain (will create client)</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeCustomDomain(domain)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))
              }
            </div>

            {/* Add custom domain section */}
            <div className="border-t pt-4">
              {!showCustomInput ? (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <span>+</span>
                  <span>Add custom domain</span>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="Enter domain (e.g., google.com)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomDomain()}
                  />
                  <button
                    onClick={addCustomDomain}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomInput(false);
                      setCustomDomain('');
                    }}
                    className="px-3 py-2 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        
        <div className="mt-6">
          <button
            onClick={runHealthChecks}
            disabled={isRunning || selectedSites.length === 0}
            className={`w-full md:w-auto px-6 py-3 rounded-md font-medium ${
              isRunning || selectedSites.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } transition-colors`}
          >
            {isRunning ? 'Running Health Checks...' : 'Run Health Check'}
          </button>
        </div>
      </div>

      {/* Results */}
      {(results.length > 0 || isRunning) && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Health Check Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SSL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={`${result.domain}-${index}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{result.domain}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        result.status === 'HEALTHY' ? 'bg-green-100 text-green-800' :
                        result.status === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.responseTime != null ? `${result.responseTime}ms` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.statusCode != null ? result.statusCode : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        result.sslValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {result.sslValid ? 'Valid' : 'Invalid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {result.error || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.timestamp && !isNaN(new Date(result.timestamp).getTime()) 
                        ? new Date(result.timestamp).toLocaleString() 
                        : 'Invalid Date'}
                    </td>
                  </tr>
                ))}
                {isRunning && results.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                        <span className="text-sm text-gray-500">Running health checks...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}