'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowDownTrayIcon, ShareIcon, PrinterIcon } from '@heroicons/react/24/outline';

interface Report {
  id: string;
  title: string;
  type: 'Security Audit' | 'Vulnerability Scan' | 'Penetration Test' | 'Compliance Check' | 'Risk Assessment';
  client: string;
  status: 'Draft' | 'In Progress' | 'Review' | 'Completed' | 'Delivered';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  summary: string;
  findings: Finding[];
  recommendations: Recommendation[];
  metadata: {
    scope: string;
    methodology: string;
    tools: string[];
    duration: string;
  };
}

interface Finding {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  description: string;
  impact: string;
  evidence?: string;
  cvss?: number;
}

interface Recommendation {
  id: string;
  title: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  effort: 'Low' | 'Medium' | 'High';
  timeline: string;
}

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'recommendations'>('overview');

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockReport: Report = {
      id: reportId,
      title: 'Acme Corporation Security Audit Report',
      type: 'Security Audit',
      client: 'Acme Corporation',
      status: 'Completed',
      createdBy: 'John Doe',
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-20T16:30:00Z',
      deliveredAt: '2024-01-21T09:00:00Z',
      summary: 'Comprehensive security audit of Acme Corporation\'s web application and infrastructure. The assessment identified several critical vulnerabilities that require immediate attention, along with recommendations for improving overall security posture.',
      findings: [
        {
          id: '1',
          title: 'SQL Injection in Contact Form',
          severity: 'Critical',
          description: 'The contact form is vulnerable to SQL injection attacks due to improper input validation.',
          impact: 'Attackers could potentially access, modify, or delete sensitive database information.',
          evidence: 'Payload: \' OR 1=1 -- successfully bypassed authentication',
          cvss: 9.1
        },
        {
          id: '2',
          title: 'Cross-Site Scripting (XSS)',
          severity: 'High',
          description: 'Reflected XSS vulnerability found in the search functionality.',
          impact: 'Could lead to session hijacking and unauthorized actions on behalf of users.',
          evidence: 'Payload: <script>alert(\'XSS\')</script> executed successfully',
          cvss: 7.4
        },
        {
          id: '3',
          title: 'Weak Password Policy',
          severity: 'Medium',
          description: 'Current password policy allows weak passwords with minimum 6 characters.',
          impact: 'Increases risk of successful brute force and dictionary attacks.',
          cvss: 5.3
        },
        {
          id: '4',
          title: 'Missing Security Headers',
          severity: 'Low',
          description: 'Several important security headers are missing from HTTP responses.',
          impact: 'Reduces defense against various client-side attacks.',
          cvss: 3.1
        }
      ],
      recommendations: [
        {
          id: '1',
          title: 'Implement Parameterized Queries',
          priority: 'Critical',
          description: 'Replace all dynamic SQL queries with parameterized queries or prepared statements to prevent SQL injection attacks.',
          effort: 'Medium',
          timeline: '1-2 weeks'
        },
        {
          id: '2',
          title: 'Input Validation and Output Encoding',
          priority: 'High',
          description: 'Implement comprehensive input validation and output encoding to prevent XSS attacks.',
          effort: 'Medium',
          timeline: '2-3 weeks'
        },
        {
          id: '3',
          title: 'Strengthen Password Policy',
          priority: 'Medium',
          description: 'Implement stronger password requirements including minimum 12 characters, complexity requirements, and password history.',
          effort: 'Low',
          timeline: '1 week'
        },
        {
          id: '4',
          title: 'Add Security Headers',
          priority: 'Low',
          description: 'Implement security headers including CSP, HSTS, X-Frame-Options, and X-Content-Type-Options.',
          effort: 'Low',
          timeline: '3-5 days'
        }
      ],
      metadata: {
        scope: 'Web application, API endpoints, and supporting infrastructure',
        methodology: 'OWASP Testing Guide v4.0, NIST Cybersecurity Framework',
        tools: ['Burp Suite Professional', 'OWASP ZAP', 'Nmap', 'SQLMap', 'Custom Scripts'],
        duration: '5 business days'
      }
    };

    setReport(mockReport);
    setLoading(false);
  }, [reportId]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Info': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Delivered': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Review': return 'bg-purple-100 text-purple-800';
      case 'Draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExport = (format: 'pdf' | 'docx' | 'html') => {
    // TODO: Implement export functionality
    console.log(`Exporting report as ${format}`);
    alert(`Export as ${format.toUpperCase()} functionality will be implemented`);
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log('Sharing report');
    alert('Share functionality will be implemented');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Report not found</h2>
        <p className="mt-2 text-gray-600">The report you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard/reports"
          className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{report.title}</h1>
          <div className="mt-2 flex items-center space-x-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
              {report.status}
            </span>
            <span className="text-sm text-gray-600">Report #{report.id}</span>
            <span className="text-sm text-gray-600">Client: {report.client}</span>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            <ShareIcon className="h-4 w-4" />
            <span>Share</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>Print</span>
          </button>
          <Link
            href="/dashboard/reports"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Reports
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'findings', name: `Findings (${report.findings.length})` },
            { id: 'recommendations', name: `Recommendations (${report.recommendations.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'findings' | 'recommendations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Executive Summary */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Executive Summary</h2>
                <p className="text-gray-700 leading-relaxed">{report.summary}</p>
              </div>

              {/* Methodology */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Methodology & Scope</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Scope</h3>
                    <p className="mt-1 text-gray-900">{report.metadata.scope}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Methodology</h3>
                    <p className="mt-1 text-gray-900">{report.metadata.methodology}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Tools Used</h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {report.metadata.tools.map((tool) => (
                        <span
                          key={tool}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Duration</h3>
                    <p className="mt-1 text-gray-900">{report.metadata.duration}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Report Info */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Report Information</h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Type:</span>
                    <p className="text-gray-900">{report.type}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Created By:</span>
                    <p className="text-gray-900">{report.createdBy}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Created:</span>
                    <p className="text-gray-900">{new Date(report.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Last Updated:</span>
                    <p className="text-gray-900">{new Date(report.updatedAt).toLocaleDateString()}</p>
                  </div>
                  {report.deliveredAt && (
                    <div>
                      <span className="text-sm text-gray-600">Delivered:</span>
                      <p className="text-gray-900">{new Date(report.deliveredAt).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Summary Statistics</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Findings:</span>
                    <span className="font-medium">{report.findings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Critical:</span>
                    <span className="font-medium text-red-600">
                      {report.findings.filter(f => f.severity === 'Critical').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">High:</span>
                    <span className="font-medium text-orange-600">
                      {report.findings.filter(f => f.severity === 'High').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Medium:</span>
                    <span className="font-medium text-yellow-600">
                      {report.findings.filter(f => f.severity === 'Medium').length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Low:</span>
                    <span className="font-medium text-blue-600">
                      {report.findings.filter(f => f.severity === 'Low').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'findings' && (
          <div className="space-y-4">
            {report.findings.map((finding) => (
              <div key={finding.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{finding.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(finding.severity)}`}>
                      {finding.severity}
                    </span>
                    {finding.cvss && (
                      <span className="text-sm text-gray-600">CVSS: {finding.cvss}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Description</h4>
                    <p className="mt-1 text-gray-900">{finding.description}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Impact</h4>
                    <p className="mt-1 text-gray-900">{finding.impact}</p>
                  </div>
                  {finding.evidence && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Evidence</h4>
                      <code className="mt-1 block bg-gray-100 p-2 rounded text-sm font-mono">
                        {finding.evidence}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {report.recommendations.map((rec) => (
              <div key={rec.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{rec.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(rec.priority)}`}>
                      {rec.priority} Priority
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">Description</h4>
                    <p className="mt-1 text-gray-900">{rec.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Effort Required</h4>
                      <p className="mt-1 text-gray-900">{rec.effort}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">Timeline</h4>
                      <p className="mt-1 text-gray-900">{rec.timeline}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}