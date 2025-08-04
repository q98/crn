'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Textarea } from '@/components/ui/Textarea';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate: string | null;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  client?: {
    id: string;
    domainName: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
    description: string;
    status: string;
  };
  comments: Comment[];
  timeEntries: any[];
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch task');
        }
        
        const taskData = await response.json();
        setTask(taskData);
        setComments(taskData.comments || []);
      } catch (err) {
        console.error('Error fetching task:', err);
        setError('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const newCommentData = await response.json();
      setComments([...comments, newCommentData]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'OPEN': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'In Progress';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
      case 'OPEN': return 'Open';
      default: return status;
    }
  };

  const formatPriority = (priority: string) => {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Error</h2>
        <p className="mt-2 text-gray-600">{error}</p>
        <Link
          href="/dashboard/tasks"
          className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to Tasks
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Task not found</h2>
        <p className="mt-2 text-gray-600">The task you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/dashboard/tasks"
          className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{task.title}</h1>
          <p className="mt-1 text-gray-600">Task #{task.id}</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href={`/dashboard/tasks/${task.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit Task
          </Link>
          <Link
            href="/dashboard/tasks"
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Tasks
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Details */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Task Details</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Description</h3>
                <p className="mt-1 text-gray-900">{task.description || 'No description provided'}</p>
              </div>
              {task.project && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Project</h3>
                  <p className="mt-1 text-gray-900">{task.project.name}</p>
                  {task.project.description && (
                    <p className="mt-1 text-sm text-gray-600">{task.project.description}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Comments</h2>
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium text-gray-900">{comment.author.name}</h4>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-700">{comment.content}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="mt-6">
              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                  Add Comment
                </label>
                <Textarea
                  id="comment"
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add your comment..."
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Comment
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Status</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                  {formatStatus(task.status)}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Priority:</span>
                <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {formatPriority(task.priority)}
                </span>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Assignment</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Client:</span>
                <p className="text-gray-900">{task.client?.domainName || 'Not assigned'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Assignee:</span>
                <p className="text-gray-900">{task.assignedTo?.name || 'Not assigned'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Due Date:</span>
                <p className="text-gray-900">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
              </div>
            </div>
          </div>

          {/* Time Tracking */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Time Tracking</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Estimated Hours:</span>
                <p className="text-gray-900">{task.estimatedHours ? `${task.estimatedHours}h` : 'Not set'}</p>
              </div>
              {task.actualHours && (
                <div>
                  <span className="text-sm text-gray-600">Actual Hours:</span>
                  <p className="text-gray-900">{task.actualHours}h</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-600">Progress:</span>
                <div className="mt-1">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${task.actualHours ? (task.actualHours / task.estimatedHours) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {task.actualHours ? Math.round((task.actualHours / task.estimatedHours) * 100) : 0}% complete
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Created:</span>
                <p className="text-gray-900">{new Date(task.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Last Updated:</span>
                <p className="text-gray-900">{new Date(task.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}