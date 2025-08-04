'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Progress } from '../../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { 
  Upload, 
  Download, 
  FileText, 
  Database, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Users,
  ListTodo,
  Key,
  Trash2,
  Edit,
  UserCheck,
  Clock,
  Calendar,
  Shield
} from 'lucide-react';

interface OperationResult {
  success: boolean;
  operation: string;
  totalRequested: number;
  successful: number;
  failed: number;
  errors: Array<{
    id?: string;
    domainName?: string;
    title?: string;
    error: string;
  }>;
  results?: unknown[];
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  duplicates: string[];
}

interface ScheduledBackup {
  id: string;
  name: string;
  frequency: string;
  time: string;
  includeCredentials: boolean;
  format: string;
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
  createdAt: string;
}

interface BackupHistory {
  id: string;
  title: string;
  fileName: string;
  recordCount: number;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

export default function DataManagementPage() {
  const { data: session } = useSession() as { data: Session | null };
  const [activeTab, setActiveTab] = useState('import');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<OperationResult | ImportResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File | null }>({});
  const [scheduledBackups, setScheduledBackups] = useState<ScheduledBackup[]>([]);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    frequency: 'daily',
    time: '02:00',
    includeCredentials: false,
    format: 'json',
    enabled: true
  });
  
  const fileInputRefs = {
    clients: useRef<HTMLInputElement>(null),
    credentials: useRef<HTMLInputElement>(null),
    tasks: useRef<HTMLInputElement>(null)
  };

  const handleFileSelect = (type: string, file: File | null) => {
    setSelectedFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleImport = async (type: string) => {
    const file = selectedFiles[type];
    if (!file) {
      alert('Please select a file first');
      return;
    }

    setLoading(true);
    setProgress(0);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/import/${type}/csv`, {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setProgress(100);

      const result: { success?: boolean; message?: string; errors?: Array<{ row: number; field: string; message: string }> } = await response.json() as { success?: boolean; message?: string; errors?: Array<{ row: number; field: string; message: string }> };
      setResults({
        success: result.success || false,
        imported: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        errors: result.errors?.map(e => `${e.row}:${e.field} - ${e.message}`) || [result.message || 'Unknown error'],
        duplicates: []
      });

      if (result.success) {
        // Clear the file input
        if (fileInputRefs[type as keyof typeof fileInputRefs]?.current) {
          fileInputRefs[type as keyof typeof fileInputRefs].current!.value = '';
        }
        setSelectedFiles(prev => ({ ...prev, [type]: null }));
      }

    } catch (error) {
      console.error('Import error:', error);
      setResults({
        success: false,
        imported: 0,
        failed: 1,
        errors: ['Network error occurred'],
        duplicates: []
      });
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const handleExport = async (type: string, format: string = 'csv') => {
    setLoading(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 90));
      }, 300);

      const response = await fetch(`/api/export/${type}?format=${format}`);
      
      clearInterval(progressInterval);
      setProgress(100);

      if (response.ok) {
        if (format === 'json') {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        throw new Error('Export failed');
      }

    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const downloadTemplate = async (type: string) => {
    try {
      const response = await fetch(`/api/import/${type}/csv`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_import_template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Template download error:', error);
      alert('Failed to download template');
    }
  };

  // Backup-related functions
  const fetchScheduledBackups = async () => {
    try {
      const response = await fetch('/api/backup/schedule');
      if (response.ok) {
        const data = await response.json();
        setScheduledBackups(data.schedules || []);
      }
    } catch (error) {
      console.error('Error fetching scheduled backups:', error);
    }
  };

  const fetchBackupHistory = async () => {
    try {
      const response = await fetch('/api/backup');
      if (response.ok) {
        const data = await response.json();
        setBackupHistory(data.backups || []);
      }
    } catch (error) {
      console.error('Error fetching backup history:', error);
    }
  };

  const createScheduledBackup = async () => {
    if (!newSchedule.name.trim()) {
      alert('Please enter a backup name');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/backup/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSchedule),
      });

      if (response.ok) {
        await fetchScheduledBackups();
        setShowCreateSchedule(false);
        setNewSchedule({
          name: '',
          frequency: 'daily',
          time: '02:00',
          includeCredentials: false,
          format: 'json',
          enabled: true
        });
        alert('Scheduled backup created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create scheduled backup: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating scheduled backup:', error);
      alert('Failed to create scheduled backup');
    } finally {
      setLoading(false);
    }
  };

  const deleteScheduledBackup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled backup?')) {
      return;
    }

    try {
      const response = await fetch(`/api/backup/schedule?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchScheduledBackups();
        alert('Scheduled backup deleted successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to delete scheduled backup: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting scheduled backup:', error);
      alert('Failed to delete scheduled backup');
    }
  };

  const toggleScheduledBackup = async (id: string, enabled: boolean) => {
    try {
      const backup = scheduledBackups.find(b => b.id === id);
      if (!backup) return;

      const response = await fetch('/api/backup/schedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          enabled,
          name: backup.name,
          frequency: backup.frequency,
          time: backup.time,
          includeCredentials: backup.includeCredentials,
          format: backup.format
        }),
      });

      if (response.ok) {
        await fetchScheduledBackups();
      } else {
        const error = await response.json();
        alert(`Failed to update scheduled backup: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating scheduled backup:', error);
      alert('Failed to update scheduled backup');
    }
  };

  const createManualBackup = async (format: string = 'json', includeCredentials: boolean = false) => {
    setLoading(true);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format, includeCredentials }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.ok) {
        const result = await response.json();
        if (format === 'json' && result.data) {
          const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        await fetchBackupHistory();
        alert('Backup created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create backup: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Failed to create backup');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchScheduledBackups();
      fetchBackupHistory();
    }
  }, [activeTab]);

  const renderImportSection = (type: string, icon: React.ReactNode, title: string, description: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor={`${type}-file`}>Select CSV File</Label>
            <Input
              id={`${type}-file`}
              type="file"
              accept=".csv"
              ref={fileInputRefs[type as keyof typeof fileInputRefs]}
              onChange={(e) => handleFileSelect(type, e.target.files?.[0] || null)}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(type)}
            >
              <FileText className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button
              onClick={() => handleImport(type)}
              disabled={!selectedFiles[type] || loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Import
            </Button>
          </div>
        </div>
        {selectedFiles[type] && (
          <div className="text-sm text-muted-foreground">
            Selected: {selectedFiles[type]!.name} ({(selectedFiles[type]!.size / 1024).toFixed(1)} KB)
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderExportSection = (type: string, icon: React.ReactNode, title: string, description: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport(type, 'csv')}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport(type, 'json')}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderBulkSection = (type: string, icon: React.ReactNode, title: string, operations: string[]) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>
          Perform bulk operations on multiple {type.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {operations.map((operation) => (
            <Button
              key={operation}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => {
                // This would open a modal or navigate to a detailed bulk operation page
                alert(`${operation} operation for ${type} - Feature coming soon!`);
              }}
            >
              {operation === 'Create' && <Users className="w-4 h-4 mr-2" />}
              {operation === 'Update' && <Edit className="w-4 h-4 mr-2" />}
              {operation === 'Delete' && <Trash2 className="w-4 h-4 mr-2" />}
              {operation === 'Verify' && <UserCheck className="w-4 h-4 mr-2" />}
              {operation === 'Complete' && <CheckCircle className="w-4 h-4 mr-2" />}
              {operation === 'Assign' && <Users className="w-4 h-4 mr-2" />}
              {operation}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderResults = () => {
    if (!results) return null;

    const isImportResult = 'imported' in results;
    const isSuccess = results.success;

    return (
      <Alert className={`mt-6 ${isSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <div className="flex-1">
            <h4 className="font-semibold">
              {isSuccess ? 'Operation Completed Successfully' : 'Operation Failed'}
            </h4>
            <AlertDescription className="mt-2">
              {isImportResult ? (
                <div className="space-y-2">
                  <div className="flex gap-4">
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      Imported: {results.imported}
                    </Badge>
                    {results.failed > 0 && (
                      <Badge variant="outline" className="bg-red-100 text-red-800">
                        Failed: {results.failed}
                      </Badge>
                    )}
                    {results.duplicates.length > 0 && (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                        Duplicates: {results.duplicates.length}
                      </Badge>
                    )}
                  </div>
                  {results.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-sm">Errors:</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {results.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {results.errors.length > 5 && (
                          <li>... and {results.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-4">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      Total: {results.totalRequested}
                    </Badge>
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      Successful: {results.successful}
                    </Badge>
                    {results.failed > 0 && (
                      <Badge variant="outline" className="bg-red-100 text-red-800">
                        Failed: {results.failed}
                      </Badge>
                    )}
                  </div>
                  {results.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-sm">Errors:</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {results.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>
                            {error.domainName || error.title || error.id}: {error.error}
                          </li>
                        ))}
                        {results.errors.length > 5 && (
                          <li>... and {results.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  };

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Please sign in to access data management features.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Data Management</h1>
        <p className="text-muted-foreground">
          Import, export, and perform bulk operations on your data
        </p>
      </div>

      {progress > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Processing...</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Backup
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Bulk Operations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-6">
          {renderImportSection(
            'clients',
            <Users className="w-5 h-5" />,
            'Import Clients',
            'Import client data from CSV files'
          )}
          {renderImportSection(
            'credentials',
            <Key className="w-5 h-5" />,
            'Import Credentials',
            'Import credential data from CSV files'
          )}
          {renderImportSection(
            'tasks',
            <ListTodo className="w-5 h-5" />,
            'Import Tasks',
            'Import task data from CSV files'
          )}
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          {renderExportSection(
            'clients',
            <Users className="w-5 h-5" />,
            'Export Clients',
            'Export client data with filtering options'
          )}
          {renderExportSection(
            'credentials',
            <Key className="w-5 h-5" />,
            'Export Credentials',
            'Export credential data (passwords masked for security)'
          )}
          {renderExportSection(
            'tasks',
            <ListTodo className="w-5 h-5" />,
            'Export Tasks',
            'Export task data with time tracking information'
          )}
        </TabsContent>

        <TabsContent value="backup" className="mt-6">
          {/* Manual Backup Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Manual Backup
              </CardTitle>
              <CardDescription>
                Create an immediate backup of your system data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  onClick={() => createManualBackup('json', false)}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Backup (JSON)
                </Button>
                <Button
                  onClick={() => createManualBackup('csv', false)}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Backup (CSV)
                </Button>
                <Button
                  onClick={() => createManualBackup('json', true)}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4 mr-2" />
                  )}
                  Full Backup (with credentials)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Backups Section */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Scheduled Backups
                  </CardTitle>
                  <CardDescription>
                    Automate your backup process with scheduled backups
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowCreateSchedule(!showCreateSchedule)}
                  size="sm"
                >
                  {showCreateSchedule ? 'Cancel' : 'Create Schedule'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showCreateSchedule && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="backup-name">Backup Name</Label>
                        <Input
                          id="backup-name"
                          value={newSchedule.name}
                          onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Daily System Backup"
                        />
                      </div>
                      <div>
                        <Label htmlFor="backup-frequency">Frequency</Label>
                        <Select
                          value={newSchedule.frequency}
                          onValueChange={(value) => setNewSchedule(prev => ({ ...prev, frequency: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="backup-time">Time</Label>
                        <Input
                          id="backup-time"
                          type="time"
                          value={newSchedule.time}
                          onChange={(e) => setNewSchedule(prev => ({ ...prev, time: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="backup-format">Format</Label>
                        <Select
                          value={newSchedule.format}
                          onValueChange={(value) => setNewSchedule(prev => ({ ...prev, format: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="include-credentials"
                          checked={newSchedule.includeCredentials}
                          onCheckedChange={(checked) => setNewSchedule(prev => ({ ...prev, includeCredentials: checked }))}
                        />
                        <Label htmlFor="include-credentials">Include Credentials</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="enabled"
                          checked={newSchedule.enabled}
                          onCheckedChange={(checked) => setNewSchedule(prev => ({ ...prev, enabled: checked }))}
                        />
                        <Label htmlFor="enabled">Enabled</Label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={createScheduledBackup}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Calendar className="w-4 h-4 mr-2" />
                        )}
                        Create Schedule
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateSchedule(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {scheduledBackups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No scheduled backups configured</p>
                  <p className="text-sm">Create your first scheduled backup to automate your data protection</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledBackups.map((backup) => (
                    <Card key={backup.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{backup.name}</h4>
                              <Badge variant={backup.enabled ? 'default' : 'secondary'}>
                                {backup.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              {backup.includeCredentials && (
                                <Badge variant="outline" className="text-orange-600 border-orange-200">
                                  <Key className="w-3 h-3 mr-1" />
                                  With Credentials
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Frequency: {backup.frequency} at {backup.time}</p>
                              <p>Format: {backup.format.toUpperCase()}</p>
                              <p>Next run: {new Date(backup.nextRun).toLocaleString()}</p>
                              {backup.lastRun && (
                                <p>Last run: {new Date(backup.lastRun).toLocaleString()}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={backup.enabled}
                              onCheckedChange={(checked) => toggleScheduledBackup(backup.id, checked)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteScheduledBackup(backup.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Backup History Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Backup History
              </CardTitle>
              <CardDescription>
                View and manage your backup history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backupHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No backup history available</p>
                  <p className="text-sm">Create your first backup to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {backupHistory.map((backup) => (
                    <Card key={backup.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{backup.title}</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>File: {backup.fileName}</p>
                              <p>Records: {backup.recordCount.toLocaleString()}</p>
                              <p>Created: {new Date(backup.createdAt).toLocaleString()}</p>
                              <p>By: {backup.user.name} ({backup.user.email})</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="mt-6">
          {session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER' ? (
            <>
              {renderBulkSection(
                'Clients',
                <Users className="w-5 h-5" />,
                'Bulk Client Operations',
                ['Create', 'Update', 'Verify', 'Delete']
              )}
              {renderBulkSection(
                'Tasks',
                <ListTodo className="w-5 h-5" />,
                'Bulk Task Operations',
                ['Create', 'Update', 'Complete', 'Assign', 'Delete']
              )}
            </>
          ) : (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Bulk operations require ADMIN or MANAGER permissions.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {renderResults()}
    </div>
  );
}