// src/components/EditTaskModal.js
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

// ✅ helper : notes > 0 / feedback / date d'évaluation
const isTaskEvaluated = (task) => {
  if (!task) return false;

  const isPositiveScore = (value) =>
    typeof value === 'number' && value > 0;

  const hasAnyNumericScore =
    isPositiveScore(task.punctuality_score) ||
    isPositiveScore(task.quality_score) ||
    isPositiveScore(task.performance_rating);

  const hasFeedback =
    typeof task.feedback === 'string' && task.feedback.trim() !== '';

  const hasEvaluationDate =
    task.evaluation_date != null && String(task.evaluation_date).trim() !== '';

  return hasAnyNumericScore || hasFeedback || hasEvaluationDate;
};

// ✅ helper : tâche en retard (par date)
const isTaskOverdue = (task) => {
  if (!task || !task.due_date) return false;

  try {
    const due = new Date(task.due_date);
    const now = new Date();

    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return (
      dueDay < today &&
      task.status !== 'completed' &&
      task.status !== 'not_evaluated'
    );
  } catch {
    return false;
  }
};

// ✅ helper : date dans le passé (par jour)
const isPastDay = (value) => {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return false;

  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return day < todayDay;
};

const EditTaskModal = ({ isOpen, onClose, task, collaborators, onTaskUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: null,
    assignee_id: '',
    status: 'pending'
  });

  const [initialData, setInitialData] = useState(null);

  // 🔥 STYLES FORCÉS POUR RÉSOUDRE LE PROBLÈME DE COULEUR
  const modalStyles = {
    dialogContent: {
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
    },
    input: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: 'black',
    },
    textarea: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: 'black',
    },
    select: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: 'black',
    },
    button: {
      backgroundColor: '#2563eb',
      color: 'white',
    },
    buttonOutline: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: '#374151',
    },
    infoBox: {
      backgroundColor: '#dbeafe',
      border: '1px solid #93c5fd',
      color: '#1e40af',
    },
    warningBox: {
      backgroundColor: '#fef3c7',
      border: '1px solid #f59e0b',
      color: '#92400e',
    }
  };

  // ✅ Labels de statut (inclut overdue)
  const getStatusLabel = (status) => {
    switch (status) {
      case 'not_evaluated':
        return 'Completed (Awaiting Evaluation)';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed & Evaluated';
      case 'pending':
        return 'Pending';
      case 'overdue':
        return 'Overdue (Due date passed)';
      default:
        return status || 'Unknown';
    }
  };

  // ✅ Options de statut disponibles
  // On autorise toujours "Completed (Awaiting Evaluation)" (not_evaluated),
  // et on ajoute "Completed & Evaluated" (completed) uniquement si la tâche
  // a déjà une évaluation existante.
  const getAvailableStatusOptions = (currentTask) => {
    const baseOptions = [
      { value: 'pending', label: 'Pending' },
      { value: 'in_progress', label: 'In Progress' },
    ];

    const overdueNow =
      isTaskOverdue(currentTask) || currentTask?.status === 'overdue';

    if (overdueNow) {
      baseOptions.push({
        value: 'overdue',
        label: 'Overdue (Due date passed)'
      });
    }

    const options = [
      ...baseOptions,
      { value: 'not_evaluated', label: 'Completed (Awaiting Evaluation)' },
    ];

    if (isTaskEvaluated(currentTask)) {
      options.push({
        value: 'completed',
        label: 'Completed & Evaluated',
      });
    }

    return options;
  };

  // ✅ Initialisation robuste du formulaire
  useEffect(() => {
    if (task && isOpen) {
      let dueDate = null;
      try {
        if (task.due_date) {
          dueDate = new Date(task.due_date);
          if (isNaN(dueDate.getTime())) {
            dueDate = new Date();
          }
        }
      } catch {
        dueDate = new Date();
      }

      // Statut initial à partir de la tâche
      let initialStatus = task.status || 'pending';

      // Si completed mais pas évaluée → not_evaluated
      if (initialStatus === 'completed' && !isTaskEvaluated(task)) {
        initialStatus = 'not_evaluated';
      }

      // ✅ Si la tâche est en retard (par date) → on force le status d’affichage à overdue
      if (isTaskOverdue(task)) {
        initialStatus = 'overdue';
      }

      const normalized = {
        title: (task.title || '').trim(),
        description: (task.description || '').trim(),
        priority: task.priority || 'medium',
        status: initialStatus,
        assignee_id: task.assignee_id || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      };

      setFormData({
        title: normalized.title,
        description: normalized.description,
        priority: normalized.priority,
        due_date: dueDate,
        assignee_id: normalized.assignee_id || '',
        status: normalized.status,
      });

      setInitialData(normalized);
    }
  }, [task, isOpen]);

  // ✅ Reset du loading à la fermeture
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!formData.due_date) {
      toast.error('Due date is required');
      return;
    }

    // 🔴 Règle : si la tâche était overdue et qu’on enlève le status "overdue",
    // on OBLIGE à mettre une nouvelle due date >= aujourd’hui.
    const wasOverdue = isTaskOverdue(task) || task.status === 'overdue';
    const newStatus = formData.status;
    const newDueDate = formData.due_date; // Date object

    if (wasOverdue && newStatus !== 'overdue') {
      if (!newDueDate) {
        toast.error('This task is overdue. Please update the due date before changing its status.');
        return;
      }
      if (isPastDay(newDueDate)) {
        toast.error('The new due date must be today or a future date.');
        return;
      }
    }

    const updateData = {
      title: formData.title.trim(),
      description: formData.description.trim() || '',
      priority: formData.priority,
      due_date: formData.due_date.toISOString(),
      status: formData.status,
      assignee_id: formData.assignee_id || null
    };

    // 🔹 Vérifier s'il y a vraiment un changement
    if (initialData) {
      const normalizedUpdate = {
        ...updateData,
        assignee_id: updateData.assignee_id,
      };

      const noChanges = Object.keys(initialData).every(
        (key) => initialData[key] === normalizedUpdate[key]
      );

      if (noChanges) {
        toast.info('No changes to save.');
        onClose();
        return;
      }
    }

    try {
      setLoading(true);

      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      const response = await axios.put(
        `${API}/tasks/${task.id}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      let updatedTask;
      if (response && response.data) {
        updatedTask = {
          ...response.data,
          assignee_name: updateData.assignee_id
            ? (collaborators?.find(c => c.id === updateData.assignee_id)?.full_name || task.assignee_name)
            : task.assignee_name
        };
      } else {
        updatedTask = {
          id: task.id,
          ...formData,
          assignee_id: updateData.assignee_id,
          assignee_name: updateData.assignee_id
            ? (collaborators?.find(c => c.id === updateData.assignee_id)?.full_name || task.assignee_name)
            : task.assignee_name,
          created_at: task.created_at,
          updated_at: new Date().toISOString(),
          completion_evidence: task.completion_evidence,
          completion_notes: task.completion_notes,
          completed_at: task.completed_at
        };
      }

      if (onTaskUpdated) {
        const normalizedUpdatedTask = {
          ...updatedTask,
          id: updatedTask.id || updatedTask._id || task.id,
        };

        onTaskUpdated(normalizedUpdatedTask);
      }

      toast.success('Task updated successfully!');
      onClose();

    } catch (error) {
      console.error('❌ Error updating task:', error);

      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 2000);
      } else if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          const errorMessages = error.response.data.detail.map(err =>
            `${err.loc?.join('.') || 'unknown'}: ${err.msg}`
          ).join(', ');
          toast.error(`Validation errors: ${errorMessages}`);
        } else {
          toast.error(`Update failed: ${error.response.data.detail}`);
        }
      } else if (error.response?.status) {
        toast.error(`Server error: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout. Please check your connection and try again.');
      } else {
        toast.error('Failed to update task. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    // 🔒 Bloquer le passage manuel à "completed" si aucune évaluation n'existe encore
    if (field === 'status' && value === 'completed' && !isTaskEvaluated(task)) {
      toast.error(
        'You must evaluate this task before marking it as "Completed & Evaluated". ' +
        'Use the "Evaluate" action in the manager dashboard.'
      );
      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!task) {
    console.warn('EditTaskModal: No task provided');
    return null;
  }

  const statusOptions = getAvailableStatusOptions(task);
  const currentStatusLabel = getStatusLabel(formData.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        style={modalStyles.dialogContent}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'black' }} className="text-xl font-semibold">
            Edit Task
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Information */}
          <div style={modalStyles.infoBox} className="p-4 rounded-lg border">
            <h4 style={{ color: '#1e40af' }} className="font-medium mb-2">Task Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span style={{ color: '#1e40af' }} className="font-medium">Task ID:</span>
                <p style={{ color: '#1e40af' }} className="truncate font-mono text-xs">
                  {task.id || task._id}
                </p>
              </div>
              <div>
                <span style={{ color: '#1e40af' }} className="font-medium">Current Assignee:</span>
                <p style={{ color: '#1e40af' }}>{task.assignee_name || 'Unassigned'}</p>
              </div>
              <div>
                <span style={{ color: '#1e40af' }} className="font-medium">Created:</span>
                <p style={{ color: '#1e40af' }}>
                  {task.created_at
                    ? new Date(task.created_at).toLocaleDateString()
                    : 'Unknown'}
                </p>
              </div>
              <div>
                <span style={{ color: '#1e40af' }} className="font-medium">Current Status:</span>
                <p style={{ color: '#1e40af' }} className="capitalize">
                  {isTaskOverdue(task)
                    ? getStatusLabel('overdue')
                    : getStatusLabel(task.status)}
                </p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" style={{ color: 'black' }} className="text-sm font-medium">
              Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter task title"
              required
              className="w-full"
              disabled={loading}
              style={modalStyles.input}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" style={{ color: 'black' }} className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter detailed task description"
              rows={4}
              className="w-full resize-none"
              disabled={loading}
              style={modalStyles.textarea}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority" style={{ color: 'black' }} className="text-sm font-medium">
                Priority
              </Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => handleChange('priority', value)}
                disabled={loading}
              >
                <SelectTrigger style={modalStyles.select}>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent
                  style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}
                >
                  <SelectItem value="low" style={{ color: 'black' }}>Low</SelectItem>
                  <SelectItem value="medium" style={{ color: 'black' }}>Medium</SelectItem>
                  <SelectItem value="high" style={{ color: 'black' }}>High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status" style={{ color: 'black' }} className="text-sm font-medium">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
                disabled={loading}
              >
                <SelectTrigger style={modalStyles.select}>
                  <SelectValue placeholder="Select status">
                    {currentStatusLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}
                >
                  {statusOptions.map(option => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      style={{ color: 'black' }}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="space-y-2">
              <Label style={{ color: 'black' }} className="text-sm font-medium">
                Due Date *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                    disabled={loading}
                    style={modalStyles.buttonOutline}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date
                      ? format(formData.due_date, "MMM dd, yyyy")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}
                >
                  <Calendar
                    mode="single"
                    selected={formData.due_date}
                    onSelect={(date) => handleChange('due_date', date)}
                    initialFocus
                    disabled={(date) =>
                      date < new Date().setHours(0, 0, 0, 0)
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label htmlFor="assignee" style={{ color: 'black' }} className="text-sm font-medium">
                Assigned To
              </Label>
              <Select
                value={formData.assignee_id}
                onValueChange={(value) => handleChange('assignee_id', value)}
                disabled={loading}
              >
                <SelectTrigger style={modalStyles.select}>
                  <SelectValue placeholder="Select a collaborator" />
                </SelectTrigger>
                <SelectContent
                  style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}
                >
                  {collaborators && collaborators.length > 0 ? (
                    collaborators.map((user) => (
                      <SelectItem key={user.id} value={user.id} style={{ color: 'black' }}>
                        {user.full_name} ({user.email})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-collaborators" disabled>
                      No collaborators available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info sur changements Assignee / Status */}
          {(formData.assignee_id !== (task.assignee_id || '') ||
            formData.status !== (isTaskOverdue(task) ? 'overdue' : task.status)) && (
            <div style={modalStyles.warningBox} className="p-3 rounded-lg border">
              <p className="text-sm font-medium">
                <span className="inline-block w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                Important Changes Detected
              </p>
              <ul className="text-xs mt-1 space-y-1">
                {formData.assignee_id !== (task.assignee_id || '') && (
                  <li>• Assignee will be changed</li>
                )}
                {formData.status !== (isTaskOverdue(task) ? 'overdue' : task.status) && (
                  <li>
                    • Status will be updated from "
                    {getStatusLabel(isTaskOverdue(task) ? 'overdue' : task.status)}" to "
                    {getStatusLabel(formData.status)}"
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="min-w-20"
              style={modalStyles.buttonOutline}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-w-24"
              style={modalStyles.button}
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Task'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTaskModal;
