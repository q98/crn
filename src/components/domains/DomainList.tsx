'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle, Clock, Shield, RefreshCw, Plus, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Domain {
  id: string;
  domainName: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'OWNERSHIP_CHANGED' | 'PRIVACY_PROTECTED';
  lastVerified: string | null;
  nextVerificationDue: string;
  registrantName: string | null;
  registrantEmail: string | null;
  registrar: string | null;
  expirationDate: string | null;
  isActive: boolean;
  autoVerify: boolean;
  ownershipChanged: boolean;
  client: {
    id: string;
    domainName: string;
  };
  verificationHistory: Array<{
    id: string;
    verificationStatus: string;
    verifiedAt: string;
    verifiedByUser: {
      name: string;
    } | null;
  }>;
}

interface Client {
  id: string;
  domainName: string;
}

interface DomainListProps {
  clients: Client[];
}

const statusConfig = {
  PENDING: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
  VERIFIED: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Verified' },
  FAILED: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Failed' },
  EXPIRED: { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: 'Expired' },
  OWNERSHIP_CHANGED: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Ownership Changed' },
  PRIVACY_PROTECTED: { color: 'bg-blue-100 text-blue-800', icon: Shield, label: 'Privacy Protected' }
};

export default function DomainList({ clients }: DomainListProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [verifyingDomains, setVerifyingDomains] = useState<Set<string>>(new Set());
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());

  // Form state for adding new domain
  const [newDomain, setNewDomain] = useState({
    domainName: '',
    clientId: '',
    verificationInterval: 30,
    autoVerify: true,
    notes: ''
  });

  const fetchDomains = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (clientFilter !== 'all') params.append('clientId', clientFilter);
      
      const response = await fetch(`/api/domains?${params}`);
      if (!response.ok) throw new Error('Failed to fetch domains');
      
      const data = await response.json();
      setDomains(data.domains);
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast.error('Failed to fetch domains');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, clientFilter]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDomain)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add domain');
      }

      toast.success('Domain added successfully');
      setShowAddDialog(false);
      setNewDomain({
        domainName: '',
        clientId: '',
        verificationInterval: 30,
        autoVerify: true,
        notes: ''
      });
      fetchDomains();
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add domain');
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomains(prev => new Set(prev).add(domainId));
    
    try {
      const response = await fetch(`/api/domains/${domainId}/verify`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Verification failed');
      }

      const result = await response.json();
      toast.success('Domain verified successfully');
      
      if (result.alerts?.ownershipChanged) {
        toast.warning('Warning: Domain ownership has changed!');
      }
      
      fetchDomains();
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setVerifyingDomains(prev => {
        const newSet = new Set(prev);
        newSet.delete(domainId);
        return newSet;
      });
    }
  };

  const handleBulkVerify = async () => {
    if (selectedDomains.size === 0) {
      toast.error('Please select domains to verify');
      return;
    }

    setBulkVerifying(true);
    
    try {
      const response = await fetch('/api/domains/bulk-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainIds: Array.from(selectedDomains),
          priority: 'normal'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Bulk verification failed');
      }

      const result = await response.json();
      toast.success(result.message);
      setSelectedDomains(new Set());
      fetchDomains();
    } catch (error) {
      console.error('Error in bulk verification:', error);
      toast.error(error instanceof Error ? error.message : 'Bulk verification failed');
    } finally {
      setBulkVerifying(false);
    }
  };

  const filteredDomains = domains.filter(domain => {
    const matchesSearch = domain.domainName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         domain.client.domainName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const isOverdue = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading domains...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Domain Management</h2>
          <p className="text-gray-600">Monitor and verify domain ownership</p>
        </div>
        
        <div className="flex gap-2">
          {selectedDomains.size > 0 && (
            <Button
              onClick={handleBulkVerify}
              disabled={bulkVerifying}
              variant="outline"
            >
              {bulkVerifying ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verify Selected ({selectedDomains.size})
            </Button>
          )}
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Domain</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddDomain} className="space-y-4">
                <div>
                  <Label htmlFor="domainName">Domain Name</Label>
                  <Input
                    id="domainName"
                    value={newDomain.domainName}
                    onChange={(e) => setNewDomain(prev => ({ ...prev, domainName: e.target.value }))}
                    placeholder="example.com"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="clientId">Client</Label>
                  <Select
                    value={newDomain.clientId}
                    onValueChange={(value) => setNewDomain(prev => ({ ...prev, clientId: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.domainName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="verificationInterval">Verification Interval (days)</Label>
                  <Input
                    id="verificationInterval"
                    type="number"
                    min="1"
                    max="365"
                    value={newDomain.verificationInterval}
                    onChange={(e) => setNewDomain(prev => ({ ...prev, verificationInterval: parseInt(e.target.value) }))}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoVerify"
                    checked={newDomain.autoVerify}
                    onCheckedChange={(checked) => setNewDomain(prev => ({ ...prev, autoVerify: checked }))}
                  />
                  <Label htmlFor="autoVerify">Enable automatic verification</Label>
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={newDomain.notes}
                    onChange={(e) => setNewDomain(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes about this domain"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    Add Domain
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search domains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="VERIFIED">Verified</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="OWNERSHIP_CHANGED">Ownership Changed</SelectItem>
            <SelectItem value="PRIVACY_PROTECTED">Privacy Protected</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                {client.domainName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Domain List */}
      <div className="grid gap-4">
        {filteredDomains.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">No domains found</p>
            </CardContent>
          </Card>
        ) : (
          filteredDomains.map(domain => {
            const StatusIcon = statusConfig[domain.verificationStatus].icon;
            const isVerifying = verifyingDomains.has(domain.id);
            const isDue = isOverdue(domain.nextVerificationDue);
            
            return (
              <Card key={domain.id} className={`${domain.ownershipChanged ? 'border-orange-200 bg-orange-50' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedDomains.has(domain.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedDomains);
                          if (e.target.checked) {
                            newSelected.add(domain.id);
                          } else {
                            newSelected.delete(domain.id);
                          }
                          setSelectedDomains(newSelected);
                        }}
                        className="mt-1"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{domain.domainName}</h3>
                          <Badge className={statusConfig[domain.verificationStatus].color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[domain.verificationStatus].label}
                          </Badge>
                          {domain.ownershipChanged && (
                            <Badge className="bg-orange-100 text-orange-800">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Ownership Changed
                            </Badge>
                          )}
                          {isDue && (
                            <Badge className="bg-red-100 text-red-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Verification Due
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Client:</span> {domain.client.domainName}
                          </div>
                          <div>
                            <span className="font-medium">Last Verified:</span> {formatDate(domain.lastVerified)}
                          </div>
                          <div>
                            <span className="font-medium">Next Due:</span> {formatDate(domain.nextVerificationDue)}
                          </div>
                          <div>
                            <span className="font-medium">Registrar:</span> {domain.registrar || 'Unknown'}
                          </div>
                          {domain.registrantEmail && (
                            <div>
                              <span className="font-medium">Registrant:</span> {domain.registrantEmail}
                            </div>
                          )}
                          {domain.expirationDate && (
                            <div>
                              <span className="font-medium">Expires:</span> {formatDate(domain.expirationDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerifyDomain(domain.id)}
                        disabled={isVerifying || !domain.isActive}
                      >
                        {isVerifying ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}