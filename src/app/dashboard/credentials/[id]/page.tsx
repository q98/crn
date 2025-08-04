'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { EyeIcon, EyeSlashIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface Credential {
  id: string;
  name: string;
  type: 'Website' | 'Database' | 'API' | 'SSH' | 'FTP' | 'Email' | 'Other';
  username: string;
  password: string;
  url?: string;
  client: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
}

export default function CredentialDetailPage() {
  const params = useParams();
  const credentialId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockCredential: Credential = {
      id: credentialId,
      name: 'Acme Corp Admin Panel',
      type: 'Website',
      username: 'admin@acme.com',
      password: 'SecureP@ssw0rd123!',
      url: 'https://admin.acme.com/login',
      client: 'Acme Corporation',
      notes: 'Main admin account for client website. Use with caution.',
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-15T14:30:00Z',
      lastUsed: '2024-01-20T09:15:00Z'
    };

    setCredential(mockCredential);
    setLoading(false);
  }, [credentialId]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(field);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Website': return 'bg-blue-100 text-blue-800';
      case 'Database': return 'bg-green-100 text-green-800';
      case 'API': return 'bg-purple-100 text-purple-800';
      case 'SSH': return 'bg-orange-100 text-orange-800';
      case 'FTP': return 'bg-yellow-100 text-yellow-800';
      case 'Email': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Credential not found</h2>
        <p className="mt-2 text-gray-600">The credential you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard/credentials"
          className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to Credentials
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{credential.name}</h1>
          <p className="mt-1 text-gray-600">Credential #{credential.id}</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href={`/dashboard/credentials/${credential.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit Credential
          </Link>
          <Link
            href="/dashboard/credentials"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Credentials
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Credential Details */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Credential Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(credential.type)}`}>
                    {credential.type}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client</label>
                  <p className="mt-1 text-gray-900">{credential.client}</p>
                </div>
              </div>

              {credential.url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">URL</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <a
                      href={credential.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 break-all"
                    >
                      {credential.url}
                    </a>
                    <button
                      onClick={() => copyToClipboard(credential.url!, 'url')}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copy URL"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </button>
                    {copySuccess === 'url' && (
                      <span className="text-green-600 text-sm">Copied!</span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <div className="mt-1 flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                    {credential.username}
                  </code>
                  <button
                    onClick={() => copyToClipboard(credential.username, 'username')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy Username"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                  {copySuccess === 'username' && (
                    <span className="text-green-600 text-sm">Copied!</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1 flex items-center space-x-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                    {showPassword ? credential.password : '••••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => copyToClipboard(credential.password, 'password')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy Password"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                  {copySuccess === 'password' && (
                    <span className="text-green-600 text-sm">Copied!</span>
                  )}
                </div>
              </div>

              {credential.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <div className="mt-1 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-gray-900">{credential.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Security Information</h2>
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Security Notice
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Never share these credentials with unauthorized personnel</li>
                      <li>Use these credentials only for authorized purposes</li>
                      <li>Report any suspicious activity immediately</li>
                      <li>Change passwords regularly for enhanced security</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Usage Statistics */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Usage</h2>
            <div className="space-y-3">
              {credential.lastUsed && (
                <div>
                  <span className="text-sm text-gray-600">Last Used:</span>
                  <p className="text-gray-900">{new Date(credential.lastUsed).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-600">Created:</span>
                <p className="text-gray-900">{new Date(credential.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Last Updated:</span>
                <p className="text-gray-900">{new Date(credential.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {credential.url && (
                <a
                  href={credential.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Open URL
                </a>
              )}
              <button
                onClick={() => {
                  copyToClipboard(credential.username, 'username-quick');
                  setTimeout(() => {
                    copyToClipboard(credential.password, 'password-quick');
                  }, 100);
                }}
                className="block w-full bg-green-600 text-white text-center px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Copy Username & Password
              </button>
              <Link
                href={`/dashboard/credentials/${credential.id}/edit`}
                className="block w-full bg-gray-600 text-white text-center px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Edit Credential
              </Link>
            </div>
          </div>

          {/* Related Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Related</h2>
            <div className="space-y-3">
              <Link
                href={`/dashboard/clients`}
                className="block text-blue-600 hover:text-blue-800"
              >
                View Client: {credential.client}
              </Link>
              <Link
                href={`/dashboard/credentials?client=${encodeURIComponent(credential.client)}`}
                className="block text-blue-600 hover:text-blue-800"
              >
                Other {credential.client} Credentials
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}