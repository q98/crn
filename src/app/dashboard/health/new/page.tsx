'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';

interface Client {
  id: string;
  domainName: string;
}

export default function NewHealthMonitorPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    clientId: '',
    checkInterval: '300', // 5 minutes
    timeout: '30',
    expectedStatusCode: '200',
    checkSSL: true,
    checkContent: false,
    expectedContent: '',
    alertEmail: '',
    alertThreshold: '3',
    enabled: true
  });

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients');
        if (response.ok) {
          const clientsData = await response.json();
          setClients(clientsData);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement API call to create health monitor
    console.log('Creating health monitor:', formData);
    // For now, just redirect back to health page
    router.push('/dashboard/health');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Add New Health Monitor</h1>
        <Link
          href="/dashboard/health"
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          Back to Health Dashboard
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Monitor Name *
              </label>
              <Input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Main Website Monitor"
              />
            </div>

            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                URL to Monitor *
              </label>
              <Input
                type="url"
                name="url"
                id="url"
                required
                value={formData.url}
                onChange={handleChange}
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700">
                Client
              </label>
              <select
                name="clientId"
                id="clientId"
                value={formData.clientId}
                onChange={handleChange}
                disabled={loadingClients}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">{loadingClients ? 'Loading clients...' : 'Select a client...'}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.domainName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="checkInterval" className="block text-sm font-medium text-gray-700">
                Check Interval (seconds) *
              </label>
              <select
                name="checkInterval"
                id="checkInterval"
                required
                value={formData.checkInterval}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="60">1 minute</option>
                <option value="300">5 minutes</option>
                <option value="600">10 minutes</option>
                <option value="1800">30 minutes</option>
                <option value="3600">1 hour</option>
              </select>
            </div>

            <div>
              <label htmlFor="timeout" className="block text-sm font-medium text-gray-700">
                Timeout (seconds) *
              </label>
              <Input
                type="number"
                name="timeout"
                id="timeout"
                required
                min="5"
                max="120"
                value={formData.timeout}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="expectedStatusCode" className="block text-sm font-medium text-gray-700">
                Expected Status Code *
              </label>
              <select
                name="expectedStatusCode"
                id="expectedStatusCode"
                required
                value={formData.expectedStatusCode}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="200">200 (OK)</option>
                <option value="201">201 (Created)</option>
                <option value="301">301 (Moved Permanently)</option>
                <option value="302">302 (Found)</option>
              </select>
            </div>

            <div>
              <label htmlFor="alertEmail" className="block text-sm font-medium text-gray-700">
                Alert Email
              </label>
              <Input
                type="email"
                name="alertEmail"
                id="alertEmail"
                value={formData.alertEmail}
                onChange={handleChange}
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="alertThreshold" className="block text-sm font-medium text-gray-700">
                Alert After (failed checks) *
              </label>
              <Input
                type="number"
                name="alertThreshold"
                id="alertThreshold"
                required
                min="1"
                max="10"
                value={formData.alertThreshold}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="checkSSL"
                name="checkSSL"
                type="checkbox"
                checked={formData.checkSSL}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="checkSSL" className="ml-2 block text-sm text-gray-900">
                Check SSL Certificate validity
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="checkContent"
                name="checkContent"
                type="checkbox"
                checked={formData.checkContent}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="checkContent" className="ml-2 block text-sm text-gray-900">
                Check for specific content
              </label>
            </div>

            {formData.checkContent && (
              <div className="ml-6">
                <label htmlFor="expectedContent" className="block text-sm font-medium text-gray-700">
                  Expected Content
                </label>
                <Input
                  type="text"
                  name="expectedContent"
                  id="expectedContent"
                  value={formData.expectedContent}
                  onChange={handleChange}
                  placeholder="Text that should be present on the page"
                />
              </div>
            )}

            <div className="flex items-center">
              <input
                id="enabled"
                name="enabled"
                type="checkbox"
                checked={formData.enabled}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
                Enable monitoring immediately
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Link
              href="/dashboard/health"
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Monitor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}