'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

import { 
  Upload, 
  Download, 
  FileText, 
  Users, 
  Key, 
  CheckSquare, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  RotateCcw
} from 'lucide-react';

interface ImportResult {
  success: boolean;
  imported: number;
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
  warnings?: Array<{
    row: number;
    warning: string;
    data?: Record<string, unknown>;
  }>;
  duplicates?: Array<{
    row: number;
    domainName?: string;
  }>;
}

interface ImportHistoryItem {
  id: string;
  title: string;
  type: 'CLIENT' | 'CREDENTIAL' | 'TASK';
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  importedCount: number;
  errorCount: number;
  warningCount: number;
  fileName: string;
  importedAt: Date;
  canRollback: boolean;
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState('clients');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch import history when component mounts or when history tab is accessed
  useEffect(() => {
    if (activeTab === 'history') {
      fetchImportHistory();
    }
  }, [activeTab]);

  // Fetch import history on component mount
  useEffect(() => {
    fetchImportHistory();
  }, []);
  
  const fileInputRefs = {
    clients: useRef<HTMLInputElement>(null),
    credentials: useRef<HTMLInputElement>(null),
    tasks: useRef<HTMLInputElement>(null)
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async (type: 'clients' | 'credentials' | 'tasks') => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch(`/api/import/${type}`, {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        // Refresh import history
        fetchImportHistory();
        // Clear selected file
        setSelectedFile(null);
        if (fileInputRefs[type].current) {
          fileInputRefs[type].current.value = '';
        }
      }

    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        imported: 0,
        errors: [{ row: 0, error: 'Network error occurred' }]
      });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  const downloadTemplate = async (type: 'clients' | 'credentials' | 'tasks') => {
    try {
      const response = await fetch(`/api/import/${type}`, {
        method: 'GET'
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_import_template.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  const fetchImportHistory = async () => {
    try {
      const response = await fetch('/api/import/history');
      if (response.ok) {
        const data = await response.json();
        setImportHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching import history:', error);
    }
  };

  const handleRollback = async (importId: string) => {
    if (!confirm('Are you sure you want to rollback this import? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/import/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ importId })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully rolled back ${result.deletedCount} ${result.importType.toLowerCase()} records`);
        // Refresh import history to show updated status
        fetchImportHistory();
      } else {
        const error = await response.json();
        alert(`Failed to rollback: ${error.error}`);
      }
    } catch (error) {
      console.error('Error rolling back import:', error);
      alert('An error occurred while rolling back the import');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'PARTIAL':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CLIENT':
        return <Users className="h-4 w-4" />;
      case 'CREDENTIAL':
        return <Key className="h-4 w-4" />;
      case 'TASK':
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Import</h1>
          <p className="text-muted-foreground">
            Import clients, credentials, and tasks from CSV files
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="credentials" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Clients Import */}
        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Import Clients
              </CardTitle>
              <CardDescription>
                Upload a CSV file to import client data including domain names, cPanel usernames, and verification status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('clients')}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
                <div className="text-sm text-muted-foreground">
                  Download the CSV template to see the required format
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select CSV File</label>
                <Input
                  ref={fileInputRefs.clients}
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e)}
                  disabled={isUploading}
                />
              </div>

              {selectedFile && activeTab === 'clients' && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <Button
                onClick={() => handleImport('clients')}
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Importing...' : 'Import Clients'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credentials Import */}
        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Import Credentials
              </CardTitle>
              <CardDescription>
                Upload a CSV file to import encrypted credentials including service details, usernames, and passwords.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Passwords will be automatically encrypted during import. Ensure your CSV file contains sensitive data securely.
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('credentials')}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select CSV File</label>
                <Input
                  ref={fileInputRefs.credentials}
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e)}
                  disabled={isUploading}
                />
              </div>

              {selectedFile && activeTab === 'credentials' && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <Button
                onClick={() => handleImport('credentials')}
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Importing...' : 'Import Credentials'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Import */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Import Tasks
              </CardTitle>
              <CardDescription>
                Upload a CSV file to import tasks with assignments, priorities, and due dates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate('tasks')}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select CSV File</label>
                <Input
                  ref={fileInputRefs.tasks}
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e)}
                  disabled={isUploading}
                />
              </div>

              {selectedFile && activeTab === 'tasks' && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              <Button
                onClick={() => handleImport('tasks')}
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Importing...' : 'Import Tasks'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Import History
              </CardTitle>
              <CardDescription>
                View past import operations and their results.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={fetchImportHistory}
                variant="outline"
                className="mb-4"
              >
                Refresh History
              </Button>
              
              {importHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No import history found
                </div>
              ) : (
                <div className="space-y-2">
                  {importHistory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(item.type)}
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(item.importedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.status === 'SUCCESS' ? 'default' : item.status === 'PARTIAL' ? 'secondary' : 'destructive'}>
                          {getStatusIcon(item.status)}
                          {item.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.importedCount} imported
                        </span>
                        {item.canRollback && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRollback(item.id)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Rollback
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                <div className="text-sm text-green-700">Successfully Imported</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                <div className="text-sm text-red-700">Errors</div>
              </div>
              {importResult.warnings && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{importResult.warnings.length}</div>
                  <div className="text-sm text-yellow-700">Warnings</div>
                </div>
              )}
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Errors:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-sm p-2 bg-red-50 rounded border-l-2 border-red-200">
                      <span className="font-medium">Row {error.row}:</span> {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.warnings && importResult.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-yellow-600">Warnings:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.warnings.map((warning, index) => (
                    <div key={index} className="text-sm p-2 bg-yellow-50 rounded border-l-2 border-yellow-200">
                      <span className="font-medium">Row {warning.row}:</span> {warning.warning}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.duplicates && importResult.duplicates.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-blue-600">Duplicates Skipped:</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.duplicates.map((duplicate, index) => (
                    <div key={index} className="text-sm p-2 bg-blue-50 rounded border-l-2 border-blue-200">
                      <span className="font-medium">Row {duplicate.row}:</span> {duplicate.domainName} already exists
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}