'use client';

import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import Link from 'next/link';
import { 
  CurrencyDollarIcon, 
  UserGroupIcon, 
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { 
  CheckCircle, 
  Plus, 
  Users, 
  FileText, 
  DollarSign, 
  Clock
} from 'lucide-react';
import { Session } from 'next-auth';

interface BusinessMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  totalClients: number;
  activeClients: number;
  atRiskClients: number;
  openTasks: number;
  urgentTasks: number;
  completedTasksThisMonth: number;
  profitMargin: number;
  averageProjectValue: number;
  totalHours: number;
}

interface RevenueTrend {
  month: string;
  revenue: number;
  hours: number;
}

interface RecentActivity {
  id: string;
  type: 'task_completed' | 'task_created' | 'new_client' | 'invoice_sent' | 'payment_received';
  description: string;
  date: string;
  priority?: string;
}

interface TopClient {
  name: string;
  revenue: number;
  hours: number;
  tasks: number;
}

interface InvoiceStats {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
}

interface HealthIndicators {
  cashFlow: number;
  clientRetention: number;
  taskCompletion: number;
  profitability: number;
}

interface DashboardData {
  metrics: BusinessMetrics;
  trends: {
    revenue: RevenueTrend[];
    growth: number;
  };
  topClients: TopClient[];
  recentActivity: RecentActivity[];
  invoices: InvoiceStats;
  health: HealthIndicators;
  timeRange: string;
  generatedAt: string;
}

interface OwnerDashboardContentProps {
  session: Session | null;
}

export default function OwnerDashboardContent({ session }: OwnerDashboardContentProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOwnerDashboardData = async () => {
      try {
        setLoading(true);
        
        const response = await fetch('/api/owner/dashboard');
        
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchOwnerDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'task_created':
        return <Plus className="h-4 w-4 text-blue-600" />;
      case 'new_client':
        return <Users className="h-4 w-4 text-purple-600" />;
      case 'invoice_sent':
        return <FileText className="h-4 w-4 text-orange-600" />;
      case 'payment_received':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white shadow-xl rounded-2xl p-8 text-center max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-6 text-gray-600 text-lg">Loading your business overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white shadow-xl rounded-2xl p-8 text-center max-w-md">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Unable to Load Dashboard</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Overview</h1>
              <p className="mt-1 text-gray-600">
                Welcome back, {session?.user?.name || 'Mark'}. Here&apos;s how Sweet Home Productions is performing.
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/owner/request-task"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Request New Work
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Technical Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-lg p-3">
                <CurrencyDollarIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(dashboardData?.metrics.monthlyRevenue || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-lg p-3">
                <UserGroupIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Clients</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.metrics.activeClients || 0}</p>
                <p className="text-xs text-gray-500">of {dashboardData?.metrics.totalClients || 0} total</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-500 rounded-lg p-3">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData?.metrics.openTasks || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-lg p-3">
                <ArrowTrendingUpIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                <p className="text-2xl font-bold text-gray-900">{(dashboardData?.metrics.profitMargin || 0).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Client Portfolio */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Client Portfolio</h3>
              <p className="text-sm text-gray-600">Overview of your key clients</p>
            </div>
            <div className="p-6">
              {(dashboardData?.metrics.atRiskClients || 0) > 0 && (
                 <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                   <div className="flex items-center">
                     <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
                     <span className="text-sm font-medium text-yellow-800">
                       {dashboardData?.metrics.atRiskClients} client{(dashboardData?.metrics.atRiskClients || 0) > 1 ? 's' : ''} need{(dashboardData?.metrics.atRiskClients || 0) !== 1 ? 's' : ''} attention
                     </span>
                   </div>
                 </div>
               )}
              
              <div className="space-y-4">
                {(dashboardData?.topClients || []).map((client, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900">{client.name}</h4>
                        <span className="px-2 py-1 text-xs font-medium rounded-full text-green-600 bg-green-100">
                          {client.tasks} tasks
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {client.hours} hours • {formatCurrency(client.revenue)} revenue
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(client.revenue)}</p>
                      <p className="text-xs text-gray-500">total value</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Link
                  href="/dashboard/clients"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all clients →
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-sm text-gray-600">Latest updates across your business</p>
            </div>
            <div className="p-6">
              {(dashboardData?.recentActivity || []).length > 0 ? (
                <div className="space-y-4">
                  {(dashboardData?.recentActivity || []).map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{activity.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              )}
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <Link
                  href="/dashboard/reports"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View detailed reports →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Business Summary */}
        <div className="mt-8 bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Business Summary</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{formatCurrency(dashboardData?.metrics.totalRevenue || 0)}</div>
                <div className="text-sm text-gray-600 mt-1">Total Revenue (YTD)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{dashboardData?.metrics.completedTasksThisMonth || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Tasks Completed This Month</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{formatCurrency(dashboardData?.metrics.averageProjectValue || 0)}</div>
                <div className="text-sm text-gray-600 mt-1">Average Client Value</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}