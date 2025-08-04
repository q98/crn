'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Clock, Save, Play, Calendar, User, FolderOpen } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  company: string;
}

interface Task {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  projectName: string;
  defaultRate: number;
}

interface TimeEntryFormData {
  taskId: string;
  clientId: string;
  description: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  hourlyRate: number;
  billable: boolean;
  date: string;
}

export default function NewTimeEntryPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [useTimer, setUseTimer] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [formData, setFormData] = useState<TimeEntryFormData>({
    taskId: '',
    clientId: '',
    description: '',
    startTime: '',
    endTime: '',
    duration: 0,
    hourlyRate: 0,
    billable: true,
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchInitialData();
    
    // Update current time every second for timer
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter tasks based on selected client
    if (formData.clientId) {
      const clientTasks = tasks.filter(task => task.clientId === formData.clientId);
      setFilteredTasks(clientTasks);
    } else {
      setFilteredTasks([]);
    }
  }, [formData.clientId, tasks]);

  useEffect(() => {
    // Auto-calculate duration when start/end times change
    if (formData.startTime && formData.endTime && !useTimer) {
      const start = new Date(`${formData.date}T${formData.startTime}`);
      const end = new Date(`${formData.date}T${formData.endTime}`);
      
      if (end > start) {
        const durationMs = end.getTime() - start.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        setFormData(prev => ({ ...prev, duration: durationMinutes }));
      }
    }
  }, [formData.startTime, formData.endTime, formData.date, useTimer]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [clientsRes, tasksRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/tasks')
      ]);
      
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData || []);
      }
      
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientChange = (clientId: string) => {
    setFormData(prev => ({ 
      ...prev, 
      clientId,
      taskId: '', // Reset task when client changes
      hourlyRate: 0
    }));
  };

  const handleTaskChange = (taskId: string) => {
    const selectedTask = tasks.find(task => task.id === taskId);
    if (selectedTask) {
      setFormData(prev => ({
        ...prev,
        taskId,
        hourlyRate: selectedTask.defaultRate || 0,
        description: prev.description || selectedTask.title
      }));
    }
  };

  const startTimer = () => {
    const now = new Date();
    setTimerStart(now);
    setIsTimerRunning(true);
    setUseTimer(true);
    
    // Set start time to current time
    const timeString = now.toTimeString().slice(0, 5);
    setFormData(prev => ({
      ...prev,
      startTime: timeString,
      endTime: ''
    }));
  };

  const stopTimer = () => {
    if (timerStart) {
      const now = new Date();
      const durationMs = now.getTime() - timerStart.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      const timeString = now.toTimeString().slice(0, 5);
      setFormData(prev => ({
        ...prev,
        endTime: timeString,
        duration: durationMinutes
      }));
      
      setIsTimerRunning(false);
      setTimerStart(null);
    }
  };

  const getElapsedTime = () => {
    if (!timerStart || !isTimerRunning) return '00:00:00';
    
    const elapsed = Math.floor((currentTime.getTime() - timerStart.getTime()) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateEarnings = () => {
    return (formData.duration / 60) * formData.hourlyRate;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.taskId || !formData.clientId || formData.duration <= 0) {
      alert('Please fill in all required fields and ensure duration is greater than 0.');
      return;
    }
    
    try {
      setSaving(true);
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          earnings: calculateEarnings()
        })
      });
      
      if (response.ok) {
        router.push('/dashboard/time-tracking');
      } else {
        throw new Error('Failed to create time entry');
      }
    } catch (error) {
      console.error('Error creating time entry:', error);
      alert('Failed to create time entry. Please try again.');
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
        <Link href="/dashboard/time-tracking">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Time Tracking
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add Time Entry</h1>
          <p className="text-gray-600 mt-1">Track your work hours manually or with a timer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timer Section */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Time Tracking Method</h2>
              <div className="flex items-center gap-2">
                <Label htmlFor="useTimer">Use Timer</Label>
                <Switch
                  id="useTimer"
                  checked={useTimer}
                  onCheckedChange={setUseTimer}
                  disabled={isTimerRunning}
                />
              </div>
            </div>
            
            {useTimer && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold text-blue-600 mb-4">
                    {getElapsedTime()}
                  </div>
                  <div className="flex justify-center gap-3">
                    {!isTimerRunning ? (
                      <Button
                        type="button"
                        onClick={startTimer}
                        disabled={!formData.taskId}
                        className="flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start Timer
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={stopTimer}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        Stop Timer
                      </Button>
                    )}
                  </div>
                  {!formData.taskId && (
                    <p className="text-sm text-gray-600 mt-2">
                      Please select a task before starting the timer
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Basic Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Entry Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1"
                  required
                />
              </div>
              
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
              
              <div className="md:col-span-2">
                <Label htmlFor="task">Task *</Label>
                <select
                  id="task"
                  value={formData.taskId}
                  onChange={(e) => handleTaskChange(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!formData.clientId}
                >
                  <option value="">Select a task</option>
                  {filteredTasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.title} - {task.projectName}
                    </option>
                  ))}
                </select>
                {!formData.clientId && (
                  <p className="text-sm text-gray-500 mt-1">Please select a client first</p>
                )}
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what you worked on..."
                />
              </div>
            </div>
          </Card>

          {/* Time Details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Time Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!useTimer && (
                <>
                  <div>
                    <Label htmlFor="startTime">Start Time *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="mt-1"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="endTime">End Time *</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      className="mt-1"
                      required
                    />
                  </div>
                </>
              )}
              
              <div>
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                  className="mt-1"
                  required
                  disabled={useTimer && isTimerRunning}
                />
                {formData.duration > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDuration(formData.duration)}
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="hourlyRate">Hourly Rate *</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                  required
                />
              </div>
              
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="billable"
                    checked={formData.billable}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, billable: checked }))}
                  />
                  <Label htmlFor="billable">This time is billable to the client</Label>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Entry Summary</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-semibold">
                    {formData.duration > 0 ? formatDuration(formData.duration) : '0h 0m'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Hourly Rate</p>
                  <p className="font-semibold">
                    {formatCurrency(formData.hourlyRate)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Earnings</p>
                  <p className="font-semibold">
                    {formatCurrency(calculateEarnings())}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="h-10 w-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Billable</p>
                  <p className="font-semibold">
                    {formData.billable ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-3">Actions</h3>
            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={saving || !formData.taskId || !formData.clientId || formData.duration <= 0 || isTimerRunning}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Time Entry'}
              </Button>
              
              {isTimerRunning && (
                <p className="text-sm text-center text-gray-600">
                  Stop the timer before saving
                </p>
              )}
              
              <Link href="/dashboard/time-tracking" className="block">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </Card>

          {/* Quick Tips */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Quick Tips</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Use the timer for real-time tracking</p>
              <p>• Mark entries as billable for invoicing</p>
              <p>• Add detailed descriptions for better records</p>
              <p>• Set accurate hourly rates for proper billing</p>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}