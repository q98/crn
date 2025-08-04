'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Edit, 
  Calendar, 
  DollarSign, 
  Clock, 
  User, 
  Target, 
  CheckCircle, 
  AlertCircle,
  Play,
  Plus,
  FileText,
  BarChart3
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string;
  endDate: string;
  budget: number;
  hourlyRate: number;
  estimatedHours: number;
  actualHours: number;
  progress: number;
  tags: string[];
  billable: boolean;
  requiresApproval: boolean;
  client: {
    id: string;
    name: string;
    company: string;
    email: string;
  };
  milestones: Milestone[];
  timeEntries: TimeEntry[];
  tasks: Task[];
  teamMembers: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  budget: number;
  completedAt?: string;
}

interface TimeEntry {
  id: string;
  description: string;
  duration: number;
  hourlyRate: number;
  earnings: number;
  date: string;
  billable: boolean;
  user: {
    name: string;
    email: string;
  };
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignee?: {
    name: string;
    email: string;
  };
  dueDate?: string;
  estimatedHours: number;
  actualHours: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  hourlyRate: number;
}

const statusOptions = {
  planning: { label: 'Planning', color: 'bg-gray-100 text-gray-800' },
  active: { label: 'Active', color: 'bg-green-100 text-green-800' },
  'on-hold': { label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' }
};

const priorityOptions = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-800' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' }
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchProject = useCallback(async (projectId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
      } else {
        throw new Error('Project not found');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/dashboard/projects');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (params.id) {
      fetchProject(params.id as string);
    }
  }, [params.id, fetchProject]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateProjectMetrics = () => {
    if (!project) return null;
    
    const totalEarnings = project.timeEntries.reduce((sum, entry) => sum + entry.earnings, 0);
    const totalMilestoneBudget = project.milestones.reduce((sum, milestone) => sum + milestone.budget, 0);
    const completedMilestones = project.milestones.filter(m => m.completed).length;
    const overdueTasks = project.tasks.filter(task => 
      task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed'
    ).length;
    
    return {
      totalEarnings,
      totalBudget: project.budget + totalMilestoneBudget,
      completedMilestones,
      totalMilestones: project.milestones.length,
      overdueTasks,
      profitMargin: project.budget > 0 ? ((totalEarnings - project.budget) / project.budget) * 100 : 0
    };
  };

  const getProjectDuration = () => {
    if (!project || !project.startDate || !project.endDate) return 'Not set';
    
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`;
    return `${Math.ceil(diffDays / 30)} months`;
  };

  const getTimeRemaining = () => {
    if (!project || !project.endDate) return null;
    
    const now = new Date();
    const end = new Date(project.endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `${Math.abs(diffDays)} days overdue`, color: 'text-red-600' };
    if (diffDays === 0) return { text: 'Due today', color: 'text-orange-600' };
    if (diffDays < 7) return { text: `${diffDays} days remaining`, color: 'text-yellow-600' };
    return { text: `${diffDays} days remaining`, color: 'text-green-600' };
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

  if (!project) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
        <Link href="/dashboard/projects">
          <Button>Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const metrics = calculateProjectMetrics();
  const timeRemaining = getTimeRemaining();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">{project.client.name} - {project.client.company}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge className={statusOptions[project.status].color}>
            {statusOptions[project.status].label}
          </Badge>
          <Badge className={priorityOptions[project.priority].color}>
            {priorityOptions[project.priority].label}
          </Badge>
          <Link href={`/dashboard/projects/${project.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Progress</p>
              <p className="text-2xl font-bold">{project.progress}%</p>
            </div>
          </div>
          <Progress value={project.progress} className="mt-3" />
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Earnings</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics?.totalEarnings || 0)}</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Budget: {formatCurrency(metrics?.totalBudget || 0)}
          </p>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Hours Tracked</p>
              <p className="text-2xl font-bold">{project.actualHours}h</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Est: {project.estimatedHours}h
          </p>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Timeline</p>
              <p className="text-lg font-bold">{getProjectDuration()}</p>
            </div>
          </div>
          {timeRemaining && (
            <p className={`text-sm mt-1 ${timeRemaining.color}`}>
              {timeRemaining.text}
            </p>
          )}
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="time">Time Tracking</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Project Description */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Project Description</h2>
                <p className="text-gray-700 leading-relaxed">
                  {project.description || 'No description provided.'}
                </p>
              </Card>

              {/* Recent Activity */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
                <div className="space-y-4">
                  {project.timeEntries.slice(0, 5).map(entry => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{entry.description}</p>
                        <p className="text-sm text-gray-600">
                          {entry.user.name} • {formatDuration(entry.duration)} • {formatDate(entry.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(entry.earnings)}</p>
                        <Badge variant={entry.billable ? 'default' : 'secondary'} className="text-xs">
                          {entry.billable ? 'Billable' : 'Non-billable'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {project.timeEntries.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      No time entries recorded yet.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Project Details */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Project Details</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Client</span>
                    <span className="font-medium">{project.client.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date</span>
                    <span className="font-medium">{formatDate(project.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">End Date</span>
                    <span className="font-medium">{project.endDate ? formatDate(project.endDate) : 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hourly Rate</span>
                    <span className="font-medium">{formatCurrency(project.hourlyRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Billable</span>
                    <Badge variant={project.billable ? 'default' : 'secondary'}>
                      {project.billable ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Tags */}
              {project.tags.length > 0 && (
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Quick Actions */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link href={`/dashboard/time-tracking/new?project=${project.id}`} className="block">
                    <Button className="w-full justify-start">
                      <Play className="h-4 w-4 mr-2" />
                      Start Time Tracking
                    </Button>
                  </Link>
                  <Link href={`/dashboard/tasks/new?project=${project.id}`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </Link>
                  <Link href={`/dashboard/billing/new?project=${project.id}`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Create Invoice
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Project Milestones</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Milestone
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {project.milestones.map(milestone => (
              <Card key={milestone.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{milestone.title}</h3>
                  <Badge variant={milestone.completed ? 'default' : 'secondary'}>
                    {milestone.completed ? 'Completed' : 'Pending'}
                  </Badge>
                </div>
                
                {milestone.description && (
                  <p className="text-gray-600 mb-3">{milestone.description}</p>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Due Date</span>
                    <span>{formatDate(milestone.dueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Budget</span>
                    <span>{formatCurrency(milestone.budget)}</span>
                  </div>
                  {milestone.completed && milestone.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed</span>
                      <span>{formatDate(milestone.completedAt)}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            
            {project.milestones.length === 0 && (
              <div className="col-span-2 text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No milestones yet</h3>
                <p className="text-gray-600 mb-4">Add milestones to track project progress</p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Milestone
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Project Tasks</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
          
          <div className="space-y-4">
            {project.tasks.map(task => (
              <Card key={task.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-4 w-4 rounded-full ${
                      task.status === 'completed' ? 'bg-green-500' :
                      task.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                    <div>
                      <h3 className="font-medium">{task.title}</h3>
                      <p className="text-sm text-gray-600">{task.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge className={priorityOptions[task.priority].color}>
                      {priorityOptions[task.priority].label}
                    </Badge>
                    {task.assignee && (
                      <div className="text-sm text-gray-600">
                        {task.assignee.name}
                      </div>
                    )}
                    {task.dueDate && (
                      <div className="text-sm text-gray-600">
                        Due: {formatDate(task.dueDate)}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            
            {project.tasks.length === 0 && (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
                <p className="text-gray-600 mb-4">Break down your project into manageable tasks</p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Task
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="time" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Time Tracking</h2>
            <Link href={`/dashboard/time-tracking/new?project=${project.id}`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Time Entry
              </Button>
            </Link>
          </div>
          
          <div className="space-y-4">
            {project.timeEntries.map(entry => (
              <Card key={entry.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{entry.description}</h3>
                    <p className="text-sm text-gray-600">
                      {entry.user.name} • {formatDate(entry.date)}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold">{formatDuration(entry.duration)}</p>
                    <p className="text-sm text-gray-600">{formatCurrency(entry.earnings)}</p>
                    <Badge variant={entry.billable ? 'default' : 'secondary'} className="text-xs">
                      {entry.billable ? 'Billable' : 'Non-billable'}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
            
            {project.timeEntries.length === 0 && (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No time entries yet</h3>
                <p className="text-gray-600 mb-4">Start tracking time to monitor project progress</p>
                <Link href={`/dashboard/time-tracking/new?project=${project.id}`}>
                  <Button>
                    <Play className="h-4 w-4 mr-2" />
                    Start Time Tracking
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Team Members</h2>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {project.teamMembers.map(member => (
              <Card key={member.id} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{member.name}</h3>
                    <p className="text-sm text-gray-600">{member.role}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email</span>
                    <span>{member.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rate</span>
                    <span>{formatCurrency(member.hourlyRate)}/hr</span>
                  </div>
                </div>
              </Card>
            ))}
            
            {project.teamMembers.length === 0 && (
              <div className="col-span-3 text-center py-12">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
                <p className="text-gray-600 mb-4">Add team members to collaborate on this project</p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team Member
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <h2 className="text-xl font-semibold">Project Analytics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Completion Rate</h3>
              </div>
              <div className="text-3xl font-bold mb-2">{project.progress}%</div>
              <Progress value={project.progress} />
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <Target className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Milestones</h3>
              </div>
              <div className="text-3xl font-bold mb-2">
                {metrics?.completedMilestones}/{metrics?.totalMilestones}
              </div>
              <p className="text-sm text-gray-600">Completed</p>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold">Overdue Tasks</h3>
              </div>
              <div className="text-3xl font-bold mb-2">{metrics?.overdueTasks}</div>
              <p className="text-sm text-gray-600">Need attention</p>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold">Profit Margin</h3>
              </div>
              <div className="text-3xl font-bold mb-2">
                {metrics?.profitMargin.toFixed(1)}%
              </div>
              <p className={`text-sm ${
                (metrics?.profitMargin || 0) > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(metrics?.profitMargin || 0) > 0 ? 'Profitable' : 'Over budget'}
              </p>
            </Card>
          </div>
          
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Project Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Budget utilization</span>
                <div className="flex items-center gap-2">
                  <Progress value={((metrics?.totalEarnings || 0) / (metrics?.totalBudget || 1)) * 100} className="w-24" />
                  <span className="text-sm font-medium">
                    {(((metrics?.totalEarnings || 0) / (metrics?.totalBudget || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Time utilization</span>
                <div className="flex items-center gap-2">
                  <Progress value={(project.actualHours / project.estimatedHours) * 100} className="w-24" />
                  <span className="text-sm font-medium">
                    {((project.actualHours / project.estimatedHours) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Milestone completion</span>
                <div className="flex items-center gap-2">
                  <Progress value={((metrics?.completedMilestones || 0) / (metrics?.totalMilestones || 1)) * 100} className="w-24" />
                  <span className="text-sm font-medium">
                    {(((metrics?.completedMilestones || 0) / (metrics?.totalMilestones || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}