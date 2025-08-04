'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { useToast } from '@/components/ui/Toast';

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const clientId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    domainName: '',
    cPanelUsername: '',
    diskUsage: '',
    verificationStatus: 'UNKNOWN',
    registrar: '',
    notes: ''
  });

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch client');
        }
        const client = await response.json();
        setFormData({
          id: client.id,
          domainName: client.domainName,
          cPanelUsername: client.cPanelUsername || '',
          diskUsage: client.diskUsage || '',
          verificationStatus: client.verificationStatus,
          registrar: client.registrar || '',
          notes: client.notes || ''
        });
      } catch (error) {
        console.error('Error fetching client:', error);
        addToast('Failed to load client data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientId, addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update client');
      }

      addToast('Client updated successfully', 'success');
      router.push(`/dashboard/clients/${clientId}`);
    } catch (error) {
      console.error('Error updating client:', error);
      addToast('Failed to update client. Please try again.', 'error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete client');
        } else {
          // If response is not JSON (likely HTML error page)
          const text = await response.text();
          console.error('Non-JSON response:', text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      router.push('/dashboard/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      addToast('Failed to delete client. Please try again.', 'error');
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
        <h1 className="text-2xl font-semibold text-gray-900">Edit Client</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Delete Client
          </button>
          <Link
            href={`/dashboard/clients/${clientId}`}
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
              <label htmlFor="domainName" className="block text-sm font-medium text-gray-700">
                Domain Name *
              </label>
              <Input
                type="text"
                name="domainName"
                id="domainName"
                required
                value={formData.domainName}
                onChange={handleChange}
                placeholder="example.com"
              />
            </div>

            <div>
              <label htmlFor="cPanelUsername" className="block text-sm font-medium text-gray-700">
                cPanel Username
              </label>
              <Input
                type="text"
                name="cPanelUsername"
                id="cPanelUsername"
                value={formData.cPanelUsername}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="diskUsage" className="block text-sm font-medium text-gray-700">
                Disk Usage
              </label>
              <Input
                type="text"
                name="diskUsage"
                id="diskUsage"
                value={formData.diskUsage}
                onChange={handleChange}
                placeholder="e.g., 2.5 GB"
              />
            </div>

            <div>
              <label htmlFor="registrar" className="block text-sm font-medium text-gray-700">
                Registrar
              </label>
              <Input
                type="text"
                name="registrar"
                id="registrar"
                value={formData.registrar}
                onChange={handleChange}
                placeholder="e.g., GoDaddy, Namecheap"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="verificationStatus" className="block text-sm font-medium text-gray-700">
                Verification Status *
              </label>
              <select
                name="verificationStatus"
                id="verificationStatus"
                required
                value={formData.verificationStatus}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ACTIVE_SHP_REGISTRAR">Active SHP Registrar</option>
                <option value="ACTIVE_NEEDS_LOGIN">Active Needs Login</option>
                <option value="AT_RISK">At Risk</option>
                <option value="LOST">Lost</option>
                <option value="WASTED_SPACE">Wasted Space</option>
                <option value="UNKNOWN">Unknown</option>
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
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Link
              href={`/dashboard/clients/${clientId}`}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Update Client
            </button>
          </div>
        </form>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Client"
        message="Are you sure you want to delete this client"
        itemName={formData.domainName}
        isLoading={isDeleting}
      />
    </div>
  );
}