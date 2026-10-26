// src/components/KanbanView.js
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MoreHorizontal, 
  Calendar, 
  User, 
  Eye, 
  CheckCircle,
  PlayCircle,
  Trash2,
  Edit,
  Loader,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import EditTaskModal from './EditTaskModal';

const KanbanView = ({ 
  tasks = [], 
  onTaskUpdate,      // 🔁 reçoit updatedTask
  onTaskDeleted,     // 🔁 reçoit taskId
  onEvaluateTask,    // 🔁 pour ouvrir le modal d’évaluation
  userRole, 
  collaborators = [] 
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // ✅ Navigation vers les détails avec état
  const handleViewTaskDetails = (taskId) => {
    navigate(`/tasks/${taskId}`, {
      state: {
        fromKanban: true,
        activeTab: 'tasks',
        viewType: 'kanban',
      },
    });
  };

  const handleEditTask = (task) => {
    setEditTask(task);
    setShowEditModal(true);
  };

  // ✅ Reçoit la task mise à jour depuis EditTaskModal (pas de refresh global)
  const handleTaskUpdated = (updatedTask) => {
    setShowEditModal(false);
    setEditTask(null);
    if (updatedTask && onTaskUpdate) {
      onTaskUpdate(updatedTask);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone and will also delete related performance evaluations.')) {
      return;
    }

    try {
      setDeleteLoading(taskId);

      const token = localStorage.getItem('token');
      await axios.delete(`${API}/tasks/${taskId}`, {
        headers: token
          ? { 'Authorization': `Bearer ${token}` }
          : undefined,
      });

      toast.success('Task deleted successfully');

      // ✅ Pas de refresh global, on remonte juste l’ID
      if (onTaskDeleted) {
        onTaskDeleted(taskId);
      } else if (onTaskUpdate) {
        onTaskUpdate({ id: taskId, deleted: true });
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task. Please try again.');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      setLoading(taskId);

      // ✅ Pour les collaborateurs, completed → not_evaluated (en attente d’évaluation)
      const finalStatus =
        userRole === 'collaborator' && newStatus === 'completed'
          ? 'not_evaluated'
          : newStatus;

      const originalTask = tasks.find(t => t.id === taskId) || null;

      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API}/tasks/${taskId}`,
        {
          status: finalStatus,
          completed_at:
            finalStatus === 'not_evaluated' || finalStatus === 'completed'
              ? new Date().toISOString()
              : null,
        },
        {
          headers: token
            ? { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            : { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      let updatedTask = null;
      if (response && response.data) {
        updatedTask = {
          ...(originalTask || {}),
          ...response.data,
        };
      } else if (originalTask) {
        updatedTask = {
          ...originalTask,
          status: finalStatus,
          completed_at:
            finalStatus === 'not_evaluated' || finalStatus === 'completed'
              ? new Date().toISOString()
              : null,
        };
      }

      toast.success(
        userRole === 'collaborator' && newStatus === 'completed'
          ? 'Task completed! Waiting for manager evaluation.'
          : `Task marked as ${finalStatus.replace('_', ' ')}`
      );

      // ✅ Mise à jour instantanée du dashboard via callback
      if (updatedTask && onTaskUpdate) {
        onTaskUpdate(updatedTask);
      } else if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    } finally {
      setLoading(null);
    }
  };

  // ✅ helper note > 0
  const isPositiveScore = (value) =>
    typeof value === 'number' && value > 0;

  // ✅ même logique que TaskDetails / TaskList / EditTaskModal
  const isTaskEvaluated = (task) => {
    if (!task) return false;

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

  // ✅ Tâche en retard (état calculé + support status='overdue', logique par jour)
  const isTaskOverdue = (task) => {
    if (!task) return false;

    // si le backend a déjà mis status='overdue'
    if (task.status === 'overdue') return true;

    if (!task.due_date) return false;

    try {
      const due = new Date(task.due_date);
      const now = new Date();

      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      return (
        dueDay < todayDay &&
        task.status !== 'completed' &&
        task.status !== 'not_evaluated'
      );
    } catch {
      return false;
    }
  };

  // ✅ Colonnes basées sur la chaîne logique + overdue calculé
  const columns = {
    pending: {
      title: "To Do",
      color: "bg-yellow-50 border-yellow-200",
      textColor: "text-yellow-800",
      tasks: tasks.filter(
        (task) =>
          task.status === 'pending' &&
          !isTaskOverdue(task)
      ),
    },
    in_progress: {
      title: "In Progress",
      color: "bg-blue-50 border-blue-200",
      textColor: "text-blue-800",
      tasks: tasks.filter(
        (task) =>
          task.status === 'in_progress' &&
          !isTaskOverdue(task)
      ),
    },
    not_evaluated: {
      title: "Awaiting Evaluation",
      color: "bg-orange-50 border-orange-200",
      textColor: "text-orange-800",
      tasks: tasks.filter((task) => {
        if (isTaskOverdue(task)) return false;
        const evaluated = isTaskEvaluated(task);
        const isCompletedOrNotEval =
          task.status === 'not_evaluated' || task.status === 'completed';
        // ✅ Toutes les tâches terminées mais non évaluées
        return isCompletedOrNotEval && !evaluated;
      }),
    },
    completed: {
      title: "Completed",
      color: "bg-green-50 border-green-200",
      textColor: "text-green-800",
      tasks: tasks.filter((task) => {
        if (isTaskOverdue(task)) return false;
        // ✅ Completed = vraiment évaluées
        return isTaskEvaluated(task);
      }),
    },
    overdue: {
      title: "Overdue",
      color: "bg-red-50 border-red-200",
      textColor: "text-red-800",
      tasks: tasks.filter((task) => isTaskOverdue(task)),
    },
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });
  };

  const TaskCard = ({ task }) => {
    const overdue = isTaskOverdue(task);
    const evaluated = isTaskEvaluated(task);
    const awaitingEval =
      !evaluated &&
      (task.status === 'not_evaluated' || task.status === 'completed');

    // 🔹 Base: statut logique comme dans TaskList
    let statusLabel;
    let statusClass;

    if (evaluated) {
      statusLabel = 'Completed & evaluated';
      statusClass = 'text-green-600';
    } else if (awaitingEval) {
      statusLabel = 'Completed – awaiting evaluation';
      statusClass = 'text-orange-600';
    } else if (task.status === 'in_progress') {
      statusLabel = 'In progress';
      statusClass = 'text-blue-600';
    } else {
      // pending ou autres
      statusLabel = 'Awaiting start';
      statusClass = 'text-yellow-600';
    }

    // 🔹 Ensuite: on ajoute la couche "overdue / deadline passed"
    if (overdue) {
      if (task.status === 'in_progress') {
        statusLabel = `${statusLabel} (deadline passed)`;
      } else if (
        task.status !== 'completed' &&
        task.status !== 'not_evaluated'
      ) {
        statusLabel = `${statusLabel} (overdue)`;
        statusClass = 'text-red-600';
      }
    }

    return (
      <Card className="mb-3 cursor-pointer hover:shadow-md transition-all duration-200 border bg-white">
        <CardContent className="p-3">
          <div className="flex justify-between items-start mb-2">
            <h4
              className="font-semibold text-sm text-slate-900 line-clamp-2 hover:text-blue-600 cursor-pointer flex-1 mr-2"
              onClick={() => handleViewTaskDetails(task.id)}
            >
              {task.title || 'Untitled task'}
            </h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-xs text-slate-600">
                <User className="h-3 w-3" />
                <span className="max-w-[80px] truncate">
                  {task.assignee_name || 'Unassigned'}
                </span>
              </div>
              <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                {(task.priority || 'medium').toUpperCase()}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1 text-slate-600">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(task.due_date)}</span>
                {overdue && (
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                )}
              </div>

              <div className="flex items-center space-x-1">
                {statusLabel && (
                  <span className={`${statusClass} flex items-center`}>
                    {overdue && (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {!overdue && evaluated && (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {!overdue && task.status === 'in_progress' && (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {!overdue && task.status === 'pending' && (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {!overdue && awaitingEval && (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    <span className="text-xs">{statusLabel}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
              onClick={() => handleViewTaskDetails(task.id)}
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => handleViewTaskDetails(task.id)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Task Details
                </DropdownMenuItem>

                {userRole === 'manager' && (
                  <>
                    <DropdownMenuItem onClick={() => handleEditTask(task)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Update Task
                    </DropdownMenuItem>

                    {awaitingEval && typeof onEvaluateTask === 'function' && (
                      <DropdownMenuItem onClick={() => onEvaluateTask(task)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Evaluate
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600"
                      disabled={deleteLoading === task.id}
                    >
                      {deleteLoading === task.id ? (
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete
                    </DropdownMenuItem>
                  </>
                )}

                {userRole === 'collaborator' &&
                  task.status !== 'completed' &&
                  task.status !== 'not_evaluated' && (
                    <>
                      {task.status !== 'in_progress' && (
                        <DropdownMenuItem
                          onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                          disabled={loading === task.id}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Start
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem
                        onClick={() => {
                          if (
                            window.confirm(
                              "Mark this task as completed? It will be sent to your manager for evaluation."
                            )
                          ) {
                            handleStatusUpdate(task.id, 'completed');
                          }
                        }}
                        disabled={loading === task.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete
                      </DropdownMenuItem>
                    </>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-lg border border-dashed border-slate-300">
        <div className="text-4xl mb-2">📋</div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">No tasks</h3>
        <p className="text-slate-500">Create your first task to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="kanban-container w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 w-full">
          {Object.entries(columns).map(([status, column]) => (
            <div key={status} className="w-full">
              <Card className={`h-full ${column.color} border min-h-[600px] flex flex-col w-full`}>
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className={`flex justify-between items-center text-sm font-semibold ${column.textColor}`}>
                    <span className="flex items-center">
                      {status === 'pending' && '📝'}
                      {status === 'in_progress' && '⚡'}
                      {status === 'not_evaluated' && '⏳'}
                      {status === 'completed' && '✅'}
                      {status === 'overdue' && '⚠️'}
                      <span className="ml-2">{column.title}</span>
                    </span>
                    <Badge variant="secondary" className="bg-white">
                      {column.tasks.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1 overflow-hidden">
                  <div className="space-y-2 h-full overflow-y-auto px-1">
                    {column.tasks.length > 0 ? (
                      column.tasks.map(task => (
                        <TaskCard key={task.id} task={task} />
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-400 border border-dashed border-slate-300 rounded-lg">
                        <div className="text-2xl mb-1">
                          {status === 'pending' && '💤'}
                          {status === 'in_progress' && '🎯'}
                          {status === 'not_evaluated' && '📊'}
                          {status === 'completed' && '🏆'}
                          {status === 'overdue' && '📅'}
                        </div>
                        <p className="text-xs">No tasks</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {showEditModal && (
        <EditTaskModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          task={editTask}
          collaborators={collaborators}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </>
  );
};

export default KanbanView;
