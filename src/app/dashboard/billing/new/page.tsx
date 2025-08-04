'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, Clock, FileText, Save } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface TimeEntry {
  id: string;
  taskTitle: string;
  description: string;
  duration: number; // in minutes
  hourlyRate: number;
  date: string;
  billable: boolean;
  selected: boolean;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  timeEntryId?: string;
}

interface InvoiceFormData {
  clientId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  notes: string;
  taxRate: number;
  discountAmount: number;
  items: InvoiceItem[];
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTimeEntries, setShowTimeEntries] = useState(false);
  
  const [formData, setFormData] = useState<InvoiceFormData>({
    clientId: '',
    invoiceNumber: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    terms: 'Net 30',
    notes: '',
    taxRate: 0,
    discountAmount: 0,
    items: []
  });

  useEffect(() => {
    fetchInitialData();
    generateInvoiceNumber();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [clientsRes, timeEntriesRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/time-entries?billable=true&uninvoiced=true')
      ]);
      
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData || []);
      }
      
      if (timeEntriesRes.ok) {
        const timeEntriesData = await timeEntriesRes.json();
        setTimeEntries(timeEntriesData?.map((entry: TimeEntry) => ({
          ...entry,
          selected: false
        })) || []);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const invoiceNumber = `INV-${year}${month}-${random}`;
    
    setFormData(prev => ({ ...prev, invoiceNumber }));
  };

  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({ ...prev, clientId }));
    
    // Filter time entries for selected client
    const filteredEntries = timeEntries.map(entry => ({
      ...entry,
      selected: false // Reset selection when client changes
    }));
    setTimeEntries(filteredEntries);
  };

  const toggleTimeEntry = (entryId: string) => {
    setTimeEntries(prev => prev.map(entry => 
      entry.id === entryId 
        ? { ...entry, selected: !entry.selected }
        : entry
    ));
  };

  const addSelectedTimeEntries = () => {
    const selectedEntries = timeEntries.filter(entry => entry.selected);
    const newItems: InvoiceItem[] = selectedEntries.map(entry => ({
      id: `time-${entry.id}`,
      description: `${entry.taskTitle} - ${entry.description}`,
      quantity: entry.duration / 60, // Convert minutes to hours
      rate: entry.hourlyRate,
      amount: (entry.duration / 60) * entry.hourlyRate,
      timeEntryId: entry.id
    }));
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, ...newItems]
    }));
    
    // Reset time entry selections
    setTimeEntries(prev => prev.map(entry => ({ ...entry, selected: false })));
    setShowTimeEntries(false);
  };

  const addCustomItem = () => {
    const newItem: InvoiceItem = {
      id: `custom-${Date.now()}`,
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const updateItem = (itemId: string, field: keyof InvoiceItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updatedItem.amount = updatedItem.quantity * updatedItem.rate;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const removeItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTax = () => {
    return (calculateSubtotal() * formData.taxRate) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - formData.discountAmount;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleSubmit = async (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();
    
    if (!formData.clientId || formData.items.length === 0) {
      alert('Please select a client and add at least one item.');
      return;
    }
    
    try {
      setSaving(true);
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          status: isDraft ? 'DRAFT' : 'SENT',
          subtotal: calculateSubtotal(),
          taxAmount: calculateTax(),
          total: calculateTotal()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        router.push(`/dashboard/billing/${result.invoice.id}`);
      } else {
        throw new Error('Failed to create invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/billing">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Invoice</h1>
          <p className="text-gray-600 mt-1">Generate an invoice for your client</p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client">Client *</Label>
                  <select
                    id="client"
                    value={formData.clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} - {client.company}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="mt-1"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                    className="mt-1"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="mt-1"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="terms">Payment Terms</Label>
                  <select
                    id="terms"
                    value={formData.terms}
                    onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Time Entries */}
            {formData.clientId && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Add Time Entries</h2>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTimeEntries(!showTimeEntries)}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {showTimeEntries ? 'Hide' : 'Show'} Time Entries
                  </Button>
                </div>
                
                {showTimeEntries && (
                  <div className="space-y-4">
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                      {timeEntries.length > 0 ? (
                        <div className="space-y-2 p-4">
                          {timeEntries.map(entry => (
                            <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={entry.selected}
                                  onChange={() => toggleTimeEntry(entry.id)}
                                  className="rounded"
                                />
                                <div>
                                  <p className="font-medium">{entry.taskTitle}</p>
                                  <p className="text-sm text-gray-600">{entry.description}</p>
                                  <p className="text-xs text-gray-500">{entry.date}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">{formatDuration(entry.duration)}</p>
                                <p className="text-sm text-gray-600">{formatCurrency(entry.hourlyRate)}/hr</p>
                                <Badge variant="default">Billable</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <Clock className="mx-auto h-8 w-8 mb-2" />
                          <p>No billable time entries found for this client</p>
                        </div>
                      )}
                    </div>
                    
                    {timeEntries.some(entry => entry.selected) && (
                      <Button
                        type="button"
                        onClick={addSelectedTimeEntries}
                        className="w-full"
                      >
                        Add Selected Time Entries ({timeEntries.filter(e => e.selected).length})
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Invoice Items */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Invoice Items</h2>
                <Button type="button" variant="outline" onClick={addCustomItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Item
                </Button>
              </div>
              
              <div className="space-y-4">
                {formData.items.map((item, _index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-4 border rounded-lg">
                    <div className="col-span-5">
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Amount</Label>
                      <div className="mt-1 px-3 py-2 bg-gray-50 border rounded-md">
                        {formatCurrency(item.amount)}
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {formData.items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="mx-auto h-8 w-8 mb-2" />
                    <p>No items added yet</p>
                    <p className="text-sm">Add time entries or custom items to get started</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Notes */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Additional Information</h2>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes or terms..."
                />
              </div>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Invoice Summary</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(calculateTax())}</span>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount Amount</Label>
                  <Input
                    id="discount"
                    type="number"
                    step="0.01"
                    value={formData.discountAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountAmount: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{formatCurrency(formData.discountAmount)}</span>
                </div>
                
                <hr />
                
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Actions</h3>
              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={saving || !formData.clientId || formData.items.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Creating...' : 'Create & Send Invoice'}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={saving || !formData.clientId || formData.items.length === 0}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Save as Draft
                </Button>
                
                <Link href="/dashboard/billing" className="block">
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}