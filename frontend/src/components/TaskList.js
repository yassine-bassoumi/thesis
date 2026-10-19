// src/components/TaskList.js
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  User,
  ArrowRight,
  FileText,
  Download,
  PlayCircle,
  Trash2,
  Edit,
  Loader,
  Star,
  Award,
  Eye,
} from 'lucide-react';
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";
import EditTaskModal from './EditTaskModal';

const TaskList = ({ 
  tasks, 
  onTaskUpdate,
  onTaskDeleted,
  userRole, 
  collaborators = [],
  onEvaluateTask,
  onTaskCompletion,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const displayTasks = tasks || [];

  const cleanText = (text) => {
    if (!text) return '';
    return String(text)
      .replace('NON EVALUÉ', '')
      .replace(' - NON EVALUÉ', '')
      .replace('NON ÉVALUÉ', '')
      .replace(' - NON ÉVALUÉ', '')
      .trim();
  };

  const isPositiveScore = (value) =>
    typeof value === 'number' && value > 0;

  // ✅ même logique que TaskDetails / EditTaskModal
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

  const getPriorityBadgeClass = (priority) => {
    const classes = {
      low: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-red-100 text-red-800 border-red-200'
    };
    return classes[priority] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // 🔎 Evidence helper (support completion_evidence OU evidence_files)
  const getEvidenceList = (task) => {
    if (!task) return [];
    if (Array.isArray(task.completion_evidence)) return task.completion_evidence;
    if (Array.isArray(task.evidence_files)) return task.evidence_files;
    return [];
  };

  const getEvidenceLabel = (evidence, index) => {
    if (!evidence) return `Evidence ${index + 1}`;
    if (typeof evidence === 'string') return evidence;
    if (evidence.original_name) return evidence.original_name;
    if (evidence.file_name) return evidence.file_name;
    if (evidence.filename) return evidence.filename;
    return `Evidence ${index + 1}`;
  };

  const getEvidenceFileName = (evidence) => {
    if (!evidence) return '';
    if (typeof evidence === 'string') return evidence;
    return (
      evidence.file_name ||
      evidence.filename ||
      evidence.original_name ||
      ''
    );
  };

  // ✅ Update status SANS refresh global
  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      setLoading(taskId);
      
      const finalStatus = (userRole === 'collaborator' && newStatus === 'completed') 
        ? 'not_evaluated' 
        : newStatus;

      const body = {
        status: finalStatus,
        completed_at:
          finalStatus === 'not_evaluated' || finalStatus === 'completed'
            ? new Date().toISOString()
            : null,
      };

      const response = await axios.put(
        `${API}/tasks/${taskId}`,
        body,
        { headers: getAuthHeaders() }
      );

      const updatedFromServer = response.data || {};

      const successMessage =
        userRole === 'collaborator' && newStatus === 'completed'
          ? 'Task completed! Waiting for manager evaluation.'
          : `Task marked as ${finalStatus.replace('_', ' ')}`;

      toast.success(successMessage);

      if (typeof onTaskUpdate === 'function') {
        const originalTask = (tasks || []).find(t => t.id === taskId) || {};
        const updatedTask = {
          ...originalTask,
          ...updatedFromServer,
          status: updatedFromServer.status || finalStatus,
          completed_at:
            updatedFromServer.completed_at ?? body.completed_at ?? originalTask.completed_at,
        };

        onTaskUpdate(updatedTask);
      }

    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    } finally {
      setLoading(null);
    }
  };

  // ✅ Delete SANS refresh global
  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone and will also delete related performance evaluations.')) {
      return;
    }

    try {
      setDeleteLoading(taskId);
      
      await axios.delete(`${API}/tasks/${taskId}`, {
        headers: getAuthHeaders()
      });
      
      toast.success('Task deleted successfully');
      
      if (onTaskDeleted) {
        onTaskDeleted(taskId);
      }
      
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task. Please try again.');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleEditTask = (task) => {
    setEditTask(task);
    setShowEditModal(true);
  };

  // ✅ Edit SANS refresh global
  const handleTaskUpdated = (updatedTask) => {
    setShowEditModal(false);
    setEditTask(null);
    
    if (updatedTask && updatedTask.id) {
      const enrichedTask = {
        ...updatedTask,
        assignee_name: updatedTask.assignee_id ? 
          (collaborators.find(c => c.id === updatedTask.assignee_id)?.full_name || updatedTask.assignee_name) 
          : null
      };
      
      if (typeof onTaskUpdate === 'function') {
        onTaskUpdate(enrichedTask);
      }
    }
  };

  const handleEvaluateTask = (task) => {
    if (!onEvaluateTask) {
      toast.error('Evaluation function not available');
      return;
    }

    if (task.status !== 'not_evaluated' && task.status !== 'completed') {
      toast.error('This task is not ready for evaluation');
      return;
    }

    onEvaluateTask(task);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ✅ même logique OVERDUE par jour + status 'overdue'
  const isOverdue = (dueDate, status) => {
    // si le backend a déjà mis status='overdue'
    if (status === 'overdue') return true;
    if (!dueDate) return false;

    try {
      const due = new Date(dueDate);
      const now = new Date();

      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      return (
        dueDay < todayDay &&
        status !== 'completed' &&
        status !== 'not_evaluated'
      );
    } catch {
      return false;
    }
  };

  // 👁️ View evidence → ouvre dans un nouvel onglet (route preview)
  const viewEvidence = (evidence) => {
    const fileName = getEvidenceFileName(evidence);
    if (!fileName) {
      toast.error('Invalid file name');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login again');
      return;
    }

    const url = `${API}/files/evidence/preview/${encodeURIComponent(fileName)}?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 💾 Download evidence → force le téléchargement
  const downloadEvidence = (evidence) => {
    const fileName = getEvidenceFileName(evidence);
    if (!fileName) {
      toast.error('Invalid file name');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login again');
      return;
    }

    const url = `${API}/files/evidence/${encodeURIComponent(fileName)}?token=${encodeURIComponent(token)}`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || 'evidence');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const sortedTasks = displayTasks;

  if (sortedTasks.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No tasks found</p>
        <p className="text-sm">
          {userRole === 'manager' 
            ? 'Create your first task to get started'
            : 'No tasks have been assigned to you yet'
          }
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {sortedTasks.map((task) => {
          const taskIsEvaluated = isTaskEvaluated(task);
          const isTaskOverdue = isOverdue(task.due_date, task.status);

          const needsEvaluation =
            !taskIsEvaluated &&
            (task.status === 'not_evaluated' || task.status === 'completed');

          const evidenceList = getEvidenceList(task);

          let scoreLabel = '';
          if (taskIsEvaluated) {
            let displayedScore = null;

            if (isPositiveScore(task.performance_rating)) {
              displayedScore = task.performance_rating;
            } else {
              const scores = [];
              if (isPositiveScore(task.punctuality_score)) scores.push(task.punctuality_score);
              if (isPositiveScore(task.quality_score)) scores.push(task.quality_score);
              if (scores.length) {
                displayedScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
              }
            }

            if (displayedScore != null) {
              scoreLabel = ` (Score: ${displayedScore}/5)`;
            }
          }

          // 🔹 Base: statut normal (sans tenir compte d'overdue)
          let statusDotClass;
          let statusTextClass;
          let statusText;

          if (taskIsEvaluated) {
            statusDotClass = 'bg-green-500';
            statusTextClass = 'text-green-700';
            statusText = `Task completed and evaluated${scoreLabel}`;
          } else if (needsEvaluation) {
            statusDotClass = 'bg-orange-500';
            statusTextClass = 'text-orange-700';
            statusText = 'Task completed - Awaiting evaluation';
          } else if (task.status === 'in_progress') {
            statusDotClass = 'bg-blue-500';
            statusTextClass = 'text-blue-700';
            statusText = 'Currently in progress';
          } else {
            // pending ou autres
            statusDotClass = 'bg-yellow-500';
            statusTextClass = 'text-yellow-700';
            statusText = 'Awaiting start';
          }

          // 🔹 Ensuite: on ajoute la couche "overdue" par-dessus SI la date est dépassée
          if (isTaskOverdue) {
            if (task.status === 'in_progress') {
              // Overdue mais déjà en cours → on respecte le bleu et on ajoute une mention
              statusText = `${statusText} (deadline passed)`;
            } else if (
              task.status !== 'completed' &&
              task.status !== 'not_evaluated'
            ) {
              // Overdue et pas encore complétée → rouge + "(overdue)"
              statusDotClass = 'bg-red-500';
              statusTextClass = 'text-red-700';
              statusText = `${statusText} (overdue)`;
            }
          }

          return (
            <Card 
              key={task.id} 
              className={`task-card transition-all duration-200 hover:shadow-md ${
                isTaskOverdue
                  ? 'border-red-300 bg-red-50/50'
                  : taskIsEvaluated
                    ? 'border-green-200 bg-green-50/30'
                    : needsEvaluation
                      ? 'border-orange-300 bg-orange-50/30'
                      : 'border-slate-200'
              }`}
              data-testid={`task-card-${task.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 
                        className="text-lg font-semibold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                        onClick={() => 
                          navigate(`/tasks/${task.id}`, { 
                            state: { 
                              fromDashboardTab: 'tasks',
                              viewType: 'list',
                            } 
                          })
                        }
                      >
                        {cleanText(task.title)}
                      </h3>
                      
                      <div className="flex items-center space-x-2">
                        <Badge className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityBadgeClass(task.priority)}`}>
                          {cleanText(task.priority).toUpperCase()}
                        </Badge>
                        
                        {userRole === 'manager' && needsEvaluation && (
                          <Badge className="bg-orange-500 text-white border-orange-600 px-2 py-1">
                            <Award className="h-3 w-3 mr-1" />
                            Needs Evaluation
                          </Badge>
                        )}
                        
                        {taskIsEvaluated && (
                          <Badge className="bg-green-500 text-white border-green-600 px-2 py-1">
                            <Star className="h-3 w-3 mr-1" />
                            Evaluated
                          </Badge>
                        )}
                        
                        {task.title && task.title.includes('Template') && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <FileText className="h-3 w-3 mr-1" />
                            Template
                          </Badge>
                        )}
                        
                        {userRole === 'manager' && evidenceList.length > 0 && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <FileText className="h-3 w-3 mr-1" />
                            {evidenceList.length} evidence file(s)
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-slate-600 mb-4 line-clamp-2 leading-relaxed">
                      {cleanText(task.description) || 'No description provided.'}
                    </p>
                    
                    {task.completion_notes && (
                      <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-green-800 font-medium mb-1">Completion Notes:</p>
                        <p className="text-sm text-green-700">{cleanText(task.completion_notes)}</p>
                      </div>
                    )}
                    
                    {taskIsEvaluated && (
                      (isPositiveScore(task.punctuality_score) ||
                       isPositiveScore(task.quality_score) ||
                       isPositiveScore(task.performance_rating)) && (
                        <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                          <p className="text-sm font-medium text-green-800 mb-2">Performance Evaluation:</p>
                          <div className="flex items-center space-x-6 text-sm">
                            {isPositiveScore(task.punctuality_score) && (
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-green-600" />
                                <span className="text-green-700">
                                  <strong>Punctuality:</strong> {task.punctuality_score}/5
                                </span>
                              </div>
                            )}
                            {isPositiveScore(task.quality_score) && (
                              <div className="flex items-center space-x-2">
                                <Award className="h-4 w-4 text-green-600" />
                                <span className="text-green-700">
                                  <strong>Quality:</strong> {task.quality_score}/5
                                </span>
                              </div>
                            )}
                            {isPositiveScore(task.performance_rating) && (
                              <div className="flex items-center space-x-2">
                                <Star className="h-4 w-4 text-green-600" />
                                <span className="text-green-700">
                                  <strong>Overall:</strong> {task.performance_rating}/5
                                </span>
                              </div>
                            )}
                          </div>
                          {task.feedback && task.feedback.trim() !== '' && (
                            <div className="mt-2 p-2 bg-white rounded border border-green-100">
                              <p className="text-xs text-green-600 font-medium">Feedback:</p>
                              <p className="text-xs text-green-700 mt-1">{cleanText(task.feedback)}</p>
                            </div>
                          )}
                        </div>
                      )
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">Due:</span>
                          <span>{formatDateTime(task.due_date)}</span>
                          {isTaskOverdue && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">Created:</span>
                          <span>{formatDate(task.created_at)}</span>
                        </div>
                      </div>
                      
                      {userRole === 'manager' && task.assignee_name && (
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <div className="flex items-center space-x-1">
                            <span className="font-medium">Assigned to:</span>
                            <span className="text-slate-700">{cleanText(task.assignee_name)}</span>
                          </div>
                        </div>
                      )}
                      
                      {task.completed_at && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <div className="flex items-center space-x-1">
                            <span className="font-medium">Completed:</span>
                            <span className="text-green-600">{formatDate(task.completed_at)}</span>
                          </div>
                        </div>
                      )}

                      {taskIsEvaluated && task.evaluation_date && (
                        <div className="flex items-center space-x-2">
                          <Star className="h-4 w-4 text-green-500" />
                          <div className="flex items-center space-x-1">
                            <span className="font-medium">Evaluated:</span>
                            <span className="text-green-600">{formatDate(task.evaluation_date)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {userRole === 'manager' && evidenceList.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-blue-600" />
                          Evidence Files:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {evidenceList.map((evidence, index) => {
                            const label = getEvidenceLabel(evidence, index);
                            return (
                              <div
                                key={index}
                                className="flex items-center space-x-2 px-3 py-2 bg-white rounded-lg border border-blue-200 shadow-sm"
                              >
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="text-sm text-blue-700 font-medium truncate max-w-[140px]">
                                  {label}
                                </span>

                                {/* View */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-blue-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    viewEvidence(evidence);
                                  }}
                                  title="View evidence"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>

                                {/* Download */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-blue-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadEvidence(evidence);
                                  }}
                                  title="Download evidence"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-6 flex-shrink-0">
                    {/* Collaborator buttons */}
                    {userRole === 'collaborator' && task.status !== 'completed' && task.status !== 'not_evaluated' && (
                      <div className="flex flex-col space-y-2">
                        {task.status !== 'in_progress' && (
                          <Button
                            onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                            size="sm"
                            className="bg-blue-500 hover:bg-blue-600 text-white"
                            data-testid={`start-task-${task.id}`}
                            disabled={loading === task.id}
                          >
                            {loading === task.id ? (
                              <Loader className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <PlayCircle className="h-4 w-4 mr-1" />
                            )}
                            Start
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => {
                            if (window.confirm(
                              "Are you sure you want to mark this task as complete? It will be sent to your manager for evaluation."
                            )) {
                              if (userRole === 'collaborator' && typeof onTaskCompletion === 'function') {
                                onTaskCompletion(task.id);
                              } else {
                                handleStatusUpdate(task.id, 'completed');
                              }
                            }
                          }}
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          data-testid={`complete-task-${task.id}`}
                          disabled={loading === task.id}
                        >
                          {loading === task.id ? (
                            <Loader className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Complete
                        </Button>
                      </div>
                    )}

                    {/* Manager → Evaluate / Re-evaluate */}
                    {userRole === 'manager' && (task.status === 'not_evaluated' || task.status === 'completed') && (
                      <div className="flex flex-col space-y-2">
                        <Button
                          onClick={() => handleEvaluateTask(task)}
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all"
                          data-testid={`evaluate-task-${task.id}`}
                        >
                          <Star className="h-4 w-4 mr-1" />
                          {taskIsEvaluated ? 'Re-evaluate Performance' : 'Evaluate Performance'}
                        </Button>
                      </div>
                    )}
                    
                    {/* Manager → Edit / Delete */}
                    {userRole === 'manager' && (
                      <div className="flex flex-col space-y-2">
                        <Button
                          onClick={() => handleEditTask(task)}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          disabled={deleteLoading === task.id}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        
                        <Button
                          onClick={() => handleDeleteTask(task.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          disabled={deleteLoading === task.id}
                          data-testid={`delete-task-${task.id}`}
                        >
                          {deleteLoading === task.id ? (
                            <Loader className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-1" />
                          )}
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${statusDotClass}`} />
                      
                      <span className={`text-sm font-medium ${statusTextClass}`}>
                        {statusText}
                      </span>
                    </div>
                    
                    <Button
                      onClick={() => 
                        navigate(`/tasks/${task.id}`, { 
                          state: { 
                            fromDashboardTab: 'tasks',
                            viewType: 'list',
                          } 
                        })
                      }
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2"
                      disabled={deleteLoading === task.id}
                    >
                      View Full Details
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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

export default TaskList;
