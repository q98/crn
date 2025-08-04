'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { useToast } from '@/components/ui/Toast';

interface Client {
  id: string;
  domainName: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  client: string;
  assignee: string;
  dueDate: string;
  estimatedHours: number;
  actualHours?: number;
  tags: string[];
  projectId?: string;
  projectName?: string;
}

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const taskId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [formData, setFormData] = useState<Task>({
    id: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'OPEN',
    client: '',
    assignee: '',
    dueDate: '',
    estimatedHours: 0,
    actualHours: 0,
    tags: [],
    projectId: '',
    projectName: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch task');
        }
        const taskData = await response.json();
        
        // Transform API data to form data format
        setFormData({
          id: taskData.id,
          title: taskData.title || '',
          description: taskData.description || '',
          priority: taskData.priority || 'MEDIUM',
          status: taskData.status || 'OPEN',
          client: taskData.client?.domainName || '',
          assignee: taskData.assignedTo?.name || '',
          dueDate: taskData.dueDate ? taskData.dueDate.split('T')[0] : '',
          estimatedHours: taskData.estimatedHours || 0,
          actualHours: 0, // API doesn't have actualHours, calculate from timeEntries if needed
          tags: [], // API doesn't have tags field yet
          projectId: taskData.project?.id || '',
          projectName: taskData.project?.name || ''
        });
      } catch (error) {
        console.error('Error fetching task:', error);
        addToast('Failed to load task data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId, addToast]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients');
        if (response.ok) {
          const clientsData = await response.json();
          setClients(clientsData);
        }
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const updateData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        estimatedHours: formData.estimatedHours,
        // Note: clientId and assignedToId would need to be resolved from names
        // For now, we'll only update the basic fields
      };
      
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task');
      }
      
      addToast('Task updated successfully', 'success');
      router.push(`/dashboard/tasks/${taskId}`);
    } catch (error) {
      console.error('Error updating task:', error);
      addToast('Failed to update task', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'estimatedHours' || name === 'actualHours' ? parseFloat(value) || 0 : value
    });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData({
          ...formData,
          tags: [...formData.tags, tagInput.trim()]
        });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete task');
      }

      router.push('/dashboard/tasks');
    } catch (error) {
      console.error('Error deleting task:', error);
      addToast('Failed to delete task. Please try again.', 'error');
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Task</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Delete Task
          </button>
          <Link
            href={`/dashboard/tasks/${taskId}`}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Task Title *
              </label>
              <Input
                type="text"
                name="title"
                id="title"
                required
                value={formData.title}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                Priority *
              </label>
              <select
                name="priority"
                id="priority"
                required
                value={formData.priority}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status *
              </label>
              <select
                name="status"
                id="status"
                required
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700">
                Client *
              </label>
              <select
                name="client"
                id="client"
                required
                value={formData.client}
                onChange={handleChange}
                disabled={loadingClients}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">{loadingClients ? 'Loading clients...' : 'Select a client'}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.domainName}>
                    {client.domainName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
                Project
              </label>
              <Input
                type="text"
                name="projectName"
                id="projectName"
                value={formData.projectName}
                onChange={handleChange}
                placeholder="Project name (if applicable)"
                disabled
                className="bg-gray-50"
              />
            </div>

            <div>
              <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
                Assignee *
              </label>
              <select
                name="assignee"
                id="assignee"
                required
                value={formData.assignee}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white !text-gray-900 !font-semibold placeholder-gray-500 px-4 py-3 text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an assignee</option>
                <option value="John Doe">John Doe</option>
                <option value="Jane Smith">Jane Smith</option>
                <option value="Mike Johnson">Mike Johnson</option>
                <option value="Sarah Wilson">Sarah Wilson</option>
              </select>
            </div>

            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">
                Due Date *
              </label>
              <Input
                type="date"
                name="dueDate"
                id="dueDate"
                required
                value={formData.dueDate}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="estimatedHours" className="block text-sm font-medium text-gray-700">
                Estimated Hours *
              </label>
              <Input
                type="number"
                name="estimatedHours"
                id="estimatedHours"
                required
                min="0"
                step="0.5"
                value={formData.estimatedHours}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="actualHours" className="block text-sm font-medium text-gray-700">
                Actual Hours
              </label>
              <Input
                type="number"
                name="actualHours"
                id="actualHours"
                min="0"
                step="0.5"
                value={formData.actualHours || ''}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <Textarea
              name="description"
              id="description"
              rows={4}
              required
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <div className="mt-1">
              <Input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type a tag and press Enter"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Link
              href={`/dashboard/tasks/${taskId}`}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Update Task
            </button>
          </div>
        </form>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        isLoading={isDeleting}
      />
    </div>
  );
}