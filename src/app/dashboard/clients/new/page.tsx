'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export default function NewClientPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    contactPerson: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement API call to create client
    console.log('Creating client:', formData);
    // For now, just redirect back to clients page
    router.push('/dashboard/clients');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <Container>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Add New Client</h1>
          <Button variant="secondary" asChild>
            <Link href="/dashboard/clients">
              Back to Clients
            </Link>
          </Button>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Input
                label="Client Name"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
              />

              <Input
                label="Email"
                type="email"
                name="email"
                id="email"
                required
                value={formData.email}
                onChange={handleChange}
              />

              <Input
                label="Phone"
                type="tel"
                name="phone"
                id="phone"
                value={formData.phone}
                onChange={handleChange}
              />

              <Input
                label="Website"
                type="url"
                name="website"
                id="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://"
              />

              <Input
                label="Contact Person"
                name="contactPerson"
                id="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
              />
            </div>

            <Textarea
              label="Address"
              name="address"
              id="address"
              rows={3}
              value={formData.address}
              onChange={handleChange}
            />

            <Textarea
              label="Notes"
              name="notes"
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
            />

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button variant="ghost" asChild>
                <Link href="/dashboard/clients">
                  Cancel
                </Link>
              </Button>
              <Button type="submit">
                Create Client
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Container>
  );
}