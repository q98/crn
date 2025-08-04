'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Play, Square, Clock, Calendar, User, FolderOpen, Plus, Filter, Download, Timer } from 'lucide-react';

interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  clientId: string;
  clientName: string;
  projectName: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number; // in minutes
  hourlyRate: number;
  billable: boolean;
  status: 'RUNNING' | 'STOPPED' | 'COMPLETED';
  createdAt: string;
}

interface TimeStats {
  totalHoursToday: number;
  totalHoursWeek: number;
  totalHoursMonth: number;
  billableHoursToday: number;
  billableHoursWeek: number;
  billableHoursMonth: number;
  activeTimers: number;
  totalEarningsMonth: number;
}

interface ActiveTimer {
  id: string;
  taskTitle: string;
  clientName: string;
  startTime: string;
  description: string;
}

export default function TimeTrackingPage() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState('today');
  const [clientFilter, setClientFilter] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchTimeData();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTimeData = async () => {
    try {
      setLoading(true);
      const [entriesRes, statsRes, activeRes] = await Promise.all([
        fetch('/api/time-entries'),
        fetch('/api/time-tracking/stats'),
        fetch('/api/time-tracking/active')
      ]);
      
      if (entriesRes.ok) {
        const entriesData = await entriesRes.json();
        setTimeEntries(Array.isArray(entriesData.entries) ? entriesData.entries : []);
      } else {
        console.error('Failed to fetch time entries:', entriesRes.status);
        setTimeEntries([]);
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        // Ensure all required properties exist with default values
        setStats({
          totalHoursToday: statsData.totalHoursToday || 0,
          totalHoursWeek: statsData.totalHoursWeek || 0,
          totalHoursMonth: statsData.totalHoursMonth || 0,
          billableHoursToday: statsData.billableHoursToday || 0,
          billableHoursWeek: statsData.billableHoursWeek || 0,
          billableHoursMonth: statsData.billableHoursMonth || 0,
          activeTimers: statsData.activeTimers || 0,
          totalEarningsMonth: statsData.totalEarningsMonth || 0
        });
      } else {
        console.error('Failed to fetch stats:', statsRes.status);
        setStats({
          totalHoursToday: 0,
          totalHoursWeek: 0,
          totalHoursMonth: 0,
          billableHoursToday: 0,
          billableHoursWeek: 0,
          billableHoursMonth: 0,
          activeTimers: 0,
          totalEarningsMonth: 0
        });
      }
      
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveTimer(activeData.activeTimer || null);
      } else {
        console.error('Failed to fetch active timer:', activeRes.status);
        setActiveTimer(null);
      }
    } catch (error) {
      console.error('Error fetching time data:', error);
      // Set safe defaults on error
      setTimeEntries([]);
      setStats({
        totalHoursToday: 0,
        totalHoursWeek: 0,
        totalHoursMonth: 0,
        billableHoursToday: 0,
        billableHoursWeek: 0,
        billableHoursMonth: 0,
        activeTimers: 0,
        totalEarningsMonth: 0
      });
      setActiveTimer(null);
    } finally {
      setLoading(false);
    }
  };

  const stopTimer = async () => {
    try {
      const response = await fetch('/api/time-tracking/stop', {
        method: 'POST'
      });
      
      if (response.ok) {
        fetchTimeData();
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const formatDuration = (minutes: number) => {
    const safeMinutes = minutes || 0;
    const hours = Math.floor(safeMinutes / 60);
    const mins = Math.floor(safeMinutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getElapsedTime = () => {
    if (!activeTimer) return '00:00:00';
    const start = new Date(activeTimer.startTime);
    const elapsed = Math.floor((currentTime.getTime() - start.getTime()) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const filteredEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.createdAt);
    const today = new Date();
    
    let dateMatch = true;
    if (dateFilter === 'today') {
      dateMatch = entryDate.toDateString() === today.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateMatch = entryDate >= weekAgo;
    } else if (dateFilter === 'month') {
      dateMatch = entryDate.getMonth() === today.getMonth() && entryDate.getFullYear() === today.getFullYear();
    }
    
    const clientMatch = clientFilter === 'all' || entry.clientId === clientFilter;
    
    return dateMatch && clientMatch;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-gray-600 mt-1">Track work hours, manage time entries, and monitor productivity</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/time-tracking/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Timer */}
      {activeTimer && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Timer className="h-6 w-6 text-blue-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{activeTimer.taskTitle}</h3>
                <p className="text-sm text-gray-600">{activeTimer.clientName}</p>
                <p className="text-xs text-gray-500">{activeTimer.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-blue-600">
                {getElapsedTime()}
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={stopTimer} variant="outline" size="sm">
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today</p>
                <p className="text-2xl font-bold text-blue-600">{formatDuration((stats.totalHoursToday || 0) * 60)}</p>
                <p className="text-xs text-gray-500">{formatDuration((stats.billableHoursToday || 0) * 60)} billable</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-green-600">{formatDuration((stats.totalHoursWeek || 0) * 60)}</p>
                <p className="text-xs text-gray-500">{formatDuration((stats.billableHoursWeek || 0) * 60)} billable</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-purple-600">{formatDuration((stats.totalHoursMonth || 0) * 60)}</p>
                <p className="text-xs text-gray-500">{formatDuration((stats.billableHoursMonth || 0) * 60)} billable</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <User className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Earnings</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.totalEarningsMonth || 0)}</p>
                <p className="text-xs text-gray-500">{stats.activeTimers || 0} active timers</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between border-b">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('entries')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'entries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Time Entries
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Reports
            </button>
          </div>
          
          {activeTab === 'entries' && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm mr-2"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Clients</option>
                {/* Add client options dynamically */}
              </select>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Time Entries</h3>
                  <div className="space-y-3">
                    {timeEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{entry.taskTitle}</p>
                          <p className="text-sm text-gray-600">{entry.clientName}</p>
                          <p className="text-xs text-gray-500">{formatDate(entry.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatDuration(entry.duration)}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant={entry.billable ? 'default' : 'secondary'}>
                              {entry.billable ? 'Billable' : 'Non-billable'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/dashboard/time-tracking?tab=entries" className="block mt-4">
                    <Button variant="outline" className="w-full">
                      View All Entries
                    </Button>
                  </Link>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Link href="/dashboard/time-tracking/new">
                      <Button variant="outline" className="w-full justify-start">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Time Entry
                      </Button>
                    </Link>
                    <Link href="/dashboard/tasks">
                      <Button variant="outline" className="w-full justify-start">
                        <Play className="h-4 w-4 mr-2" />
                        Start Timer from Task
                      </Button>
                    </Link>
                    <Link href="/dashboard/time-tracking/reports">
                      <Button variant="outline" className="w-full justify-start">
                        <Download className="h-4 w-4 mr-2" />
                        Export Timesheet
                      </Button>
                    </Link>
                    <Link href="/dashboard/billing">
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="h-4 w-4 mr-2" />
                        Create Invoice
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'entries' && (
            <Card className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Task
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {entry.taskTitle}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.description}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {entry.clientName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.projectName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDuration(entry.duration)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatTime(entry.startTime)}
                            {entry.endTime && ` - ${formatTime(entry.endTime)}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(entry.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(entry.hourlyRate)}/hr
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <Badge variant={entry.status === 'RUNNING' ? 'default' : 'secondary'}>
                              {entry.status}
                            </Badge>
                            <Badge variant={entry.billable ? 'default' : 'outline'}>
                              {entry.billable ? 'Billable' : 'Non-billable'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Link href={`/dashboard/time-tracking/${entry.id}`}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            <Link href={`/dashboard/time-tracking/${entry.id}/edit`}>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {filteredEntries.length === 0 && (
                  <div className="text-center py-12">
                    <Clock className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No time entries found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Start tracking your time by creating your first entry.
                    </p>
                    <div className="mt-6">
                      <Link href="/dashboard/time-tracking/new">
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Time Entry
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Time Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-24 flex-col">
                    <Download className="h-6 w-6 mb-2" />
                    <span>Daily Timesheet</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col">
                    <Download className="h-6 w-6 mb-2" />
                    <span>Weekly Report</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col">
                    <Download className="h-6 w-6 mb-2" />
                    <span>Monthly Summary</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col">
                    <Download className="h-6 w-6 mb-2" />
                    <span>Client Report</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col">
                    <Download className="h-6 w-6 mb-2" />
                    <span>Project Report</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col">
                    <Download className="h-6 w-6 mb-2" />
                    <span>Billable Hours</span>
                  </Button>
                </div>
              </Card>
              
              <Card className="p-6">
                <h4 className="font-semibold mb-3">Productivity Analytics</h4>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <Clock className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">Productivity charts will be displayed here</p>
                    <p className="text-xs text-gray-500">Integration with charting library needed</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}