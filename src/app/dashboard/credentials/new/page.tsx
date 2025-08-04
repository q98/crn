'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface Client {
  id: string;
  domainName: string;
}

export default function NewCredentialPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    type: 'hosting',
    username: '',
    password: '',
    url: '',
    clientId: '',
    notes: ''
  });

  const [showPassword, setShowPassword] = useState(false);

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
    // TODO: Implement API call to create credential
    console.log('Creating credential:', formData);
    // For now, just redirect back to credentials page
    router.push('/dashboard/credentials');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Add New Credential</h1>
        <Link
          href="/dashboard/credentials"
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          Back to Credentials
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Main Hosting Account"
                label="Credential Name *"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                Type *
              </label>
              <select
                name="type"
                id="type"
                required
                value={formData.type}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="hosting">Hosting</option>
                <option value="domain">Domain</option>
                <option value="email">Email</option>
                <option value="ftp">FTP</option>
                <option value="database">Database</option>
                <option value="ssl">SSL Certificate</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Input
                type="text"
                name="username"
                id="username"
                required
                value={formData.username}
                onChange={handleChange}
                label="Username *"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Input
                type="url"
                name="url"
                id="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="https://cpanel.example.com"
                label="URL/Server"
              />
            </div>

            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-2">
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
          </div>

          <div>
            <Textarea
              name="notes"
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional information about this credential..."
              label="Notes"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Link
              href="/dashboard/credentials"
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Credential
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}