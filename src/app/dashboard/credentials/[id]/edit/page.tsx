'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { useToast } from '@/components/ui/Toast';

interface Client {
  id: string;
  domainName: string;
}

interface Credential {
  id: string;
  name: string;
  type: 'Website' | 'Database' | 'API' | 'SSH' | 'FTP' | 'Email' | 'Other';
  username: string;
  password: string;
  url?: string;
  client: string;
  notes?: string;
}

export default function EditCredentialPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const credentialId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<Credential>({
    id: '',
    name: '',
    type: 'Website',
    username: '',
    password: '',
    url: '',
    client: '',
    notes: ''
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

    // Mock data - replace with actual API call
    const mockCredential: Credential = {
      id: credentialId,
      name: 'Acme Corp Admin Panel',
      type: 'Website',
      username: 'admin@acme.com',
      password: 'SecureP@ssw0rd123!',
      url: 'https://admin.acme.com/login',
      client: 'Acme Corporation',
      notes: 'Main admin account for client website. Use with caution.'
    };

    setFormData(mockCredential);
    setLoading(false);
  }, [credentialId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement API call to update credential
    console.log('Updating credential:', formData);
    // For now, just redirect back to credential detail page
    router.push(`/dashboard/credentials/${credentialId}`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const generatePassword = () => {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/credentials/${credentialId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete credential');
      }

      router.push('/dashboard/credentials');
    } catch (error) {
      console.error('Error deleting credential:', error);
      addToast('Failed to delete credential. Please try again.', 'error');
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Credential</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Delete Credential
          </button>
          <Link
            href={`/dashboard/credentials/${credentialId}`}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Credential Name *
              </label>
              <Input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
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
                <option value="Website">Website</option>
                <option value="Database">Database</option>
                <option value="API">API</option>
                <option value="SSH">SSH</option>
                <option value="FTP">FTP</option>
                <option value="Email">Email</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username *
              </label>
              <Input
                type="text"
                name="username"
                id="username"
                required
                value={formData.username}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <div className="mt-1 relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="pr-20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-2 py-1 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 border-l border-gray-300"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                URL
              </label>
              <Input
                type="url"
                name="url"
                id="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="https://"
              />
            </div>

            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700">
                Associated Client *
              </label>
              <select
                name="client"
                id="client"
                required
                value={formData.client}
                onChange={handleChange}
                disabled={loadingClients}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-bold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">{loadingClients ? 'Loading clients...' : 'Select a client'}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.domainName}>
                    {client.domainName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <Textarea
              name="notes"
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes about this credential..."
            />
          </div>

          {/* Security Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Security Reminder
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Ensure this credential information is accurate and secure. 
                    Use strong, unique passwords and update them regularly.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Link
              href={`/dashboard/credentials/${credentialId}`}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Update Credential
            </button>
          </div>
        </form>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Credential"
        message={`Are you sure you want to delete "${formData.name}"? This action cannot be undone.`}
        isLoading={isDeleting}
      />
    </div>
  );
}