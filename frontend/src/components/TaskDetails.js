// src/components/TaskDetails.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth, API } from '../App';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  AlertTriangle,
  CheckCircle,
  FileText,
  MessageCircle,
  Award,
  Download,
  Star,
  Loader,
  Eye,
} from 'lucide-react';
import axios from 'axios';
import { toast } from "sonner";
import PerformanceEvaluationModal from './PerformanceEvaluationModal';
import TaskCompletion from './TaskCompletion';

// ✅ Helpers hors composant
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const isPositiveScore = (value) =>
  typeof value === 'number' && value > 0;

// ✅ Task évaluée ? (ne dépend PAS directement du status)
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

// 🔎 Helpers pour l’evidence (string ou objet)
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

// ✅ Overdue logique par jour (comme TaskList / Kanban) + support status='overdue'
const isOverdue = (dueDate, status) => {
  if (!dueDate) return false;

  // si le backend a déjà mis status='overdue'
  if (status === 'overdue') return true;

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

// ✅ Badges de status alignés avec logique evaluated / needsEvaluation / overdue
const getStatusBadgeClass = (task) => {
  if (!task) return 'bg-gray-100 text-gray-800 border-gray-200';

  const evaluated = isTaskEvaluated(task);
  const overdue = isOverdue(task.due_date, task.status);
  const needsEvaluation =
    !evaluated && (task.status === 'not_evaluated' || task.status === 'completed');

  if (overdue && task.status !== 'completed' && task.status !== 'not_evaluated') {
    return 'bg-red-100 text-red-800 border-red-200';
  }

  if (evaluated) {
    return 'bg-green-100 text-green-800 border-green-200';
  }

  if (needsEvaluation) {
    return 'bg-orange-100 text-orange-800 border-orange-200';
  }

  const classes = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    overdue: 'bg-red-100 text-red-800 border-red-200'
  };
  return classes[task.status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getPriorityBadgeClass = (priority) => {
  const classes = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-red-100 text-red-800 border-red-200'
  };
  return classes[priority] || 'bg-gray-100 text-gray-800 border-gray-200';
};

// ✅ Display status texte aligné avec evaluated / awaiting evaluation
const getDisplayStatus = (task) => {
  if (!task) return 'UNKNOWN';

  const evaluated = isTaskEvaluated(task);
  const needsEvaluation =
    !evaluated && (task.status === 'not_evaluated' || task.status === 'completed');

  if (evaluated) return 'EVALUATED';
  if (needsEvaluation) return 'COMPLETED - AWAITING EVALUATION';

  if (task.display_status) {
    return task.display_status;
  }

  return task.status ? task.status.replace('_', ' ').toUpperCase() : 'UNKNOWN';
};

// ✅ Message status harmonisé avec Kanban (overlay overdue)
const getStatusMessage = (task) => {
  if (!task) return 'Unknown status';
  
  const evaluated = isTaskEvaluated(task);
  const overdue = isOverdue(task.due_date, task.status);
  const needsEvaluation =
    !evaluated && (task.status === 'not_evaluated' || task.status === 'completed');

  let base;

  if (evaluated) {
    base = 'Task completed and evaluated';
  } else if (needsEvaluation) {
    base = 'Task completed - Awaiting evaluation';
  } else if (task.status === 'in_progress') {
    base = 'Currently in progress';
  } else {
    base = 'Awaiting start';
  }

  if (overdue) {
    if (task.status === 'in_progress') {
      base = `${base} (deadline passed)`;
    } else if (task.status !== 'completed' && task.status !== 'not_evaluated') {
      base = `${base} (overdue)`;
    }
  }

  return base;
};

const getStatusColor = (task) => {
  if (!task) return 'bg-gray-500';

  const evaluated = isTaskEvaluated(task);
  const overdue = isOverdue(task.due_date, task.status);
  const needsEvaluation =
    !evaluated && (task.status === 'not_evaluated' || task.status === 'completed');

  if (overdue && task.status !== 'completed' && task.status !== 'not_evaluated') {
    return 'bg-red-500';
  }

  if (evaluated) return 'bg-green-500';
  if (needsEvaluation) return 'bg-orange-500';
  if (task.status === 'in_progress') return 'bg-blue-500';

  return 'bg-yellow-500';
};

const getStatusTextColor = (task) => {
  if (!task) return 'text-gray-700';

  const evaluated = isTaskEvaluated(task);
  const overdue = isOverdue(task.due_date, task.status);
  const needsEvaluation =
    !evaluated && (task.status === 'not_evaluated' || task.status === 'completed');

  if (overdue && task.status !== 'completed' && task.status !== 'not_evaluated') {
    return 'text-red-700';
  }

  if (evaluated) return 'text-green-700';
  if (needsEvaluation) return 'text-orange-700';
  if (task.status === 'in_progress') return 'text-blue-700';

  return 'text-yellow-700';
};

const TaskDetails = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // 👉 Infos de navigation (d’où on vient)
  const navState = location.state || {};
  const fromKanban = !!navState.fromKanban;
  const fromViewType = navState.viewType || null;

  // onglet du dashboard depuis lequel on vient (overview / tasks / calendar / etc.)
  const fromDashboardTab =
    navState.tab ||             
    navState.activeTab ||       
    navState.fromDashboardTab || 
    null;

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // ✅ fetchTaskDetails mémoïsé
  const fetchTaskDetails = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/tasks/${taskId}`, {
        headers: getAuthHeaders()
      });
      
      const taskData = response.data || {};

      // 🔗 Normalisation des fichiers d’evidence
      const evidenceFiles =
        taskData.completion_evidence ||
        taskData.evidence_files ||
        [];

      setTask({
        ...taskData,
        completion_evidence: Array.isArray(evidenceFiles) ? evidenceFiles : [],
        attachments: Array.isArray(taskData.attachments) ? taskData.attachments : []
      });
      
    } catch (error) {
      console.error('❌ Error fetching task details:', error);
      
      if (error.response?.status === 404) {
        toast.error('Task not found');
      } else if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      } else {
        toast.error('Failed to load task details');
      }
      
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [taskId, navigate]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  // ✅ Aligne avec TaskList / Kanban pour collaborator (completed → not_evaluated)
  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      const finalStatus =
        user?.role === 'collaborator' && newStatus === 'completed'
          ? 'not_evaluated'
          : newStatus;

      await axios.put(
        `${API}/tasks/${taskId}`,
        {
          status: finalStatus,
          completed_at:
            finalStatus === 'completed' || finalStatus === 'not_evaluated'
              ? new Date().toISOString()
              : null,
        },
        { headers: getAuthHeaders() }
      );
      
      toast.success(
        user?.role === 'collaborator' && newStatus === 'completed'
          ? 'Task completed! Waiting for manager evaluation.'
          : 'Task status updated successfully'
      );

      await fetchTaskDetails();
      
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    } finally {
      setUpdating(false);
    }
  };

  // ✅ Manager peut évaluer ou ré-évaluer quand status = not_evaluated OU completed
  const handleEvaluatePerformance = () => {
    if (!task) return;

    if (task.status !== 'not_evaluated' && task.status !== 'completed') {
      toast.error('This task is not completed yet');
      return;
    }

    setShowEvaluation(true);
  };

  const handleEvaluationComplete = async () => {
    setShowEvaluation(false);
    setEvaluating(true);
    
    try {
      await fetchTaskDetails();
      toast.success('Performance evaluation submitted successfully');
    } catch (error) {
      console.error('Error refreshing task after evaluation:', error);
      toast.error('Error refreshing task data');
    } finally {
      setEvaluating(false);
    }
  };

  // ✅ Peut-on évaluer / ré-évaluer ?
  const canEvaluateTask = (task) => {
    if (!task || !user) return false;
    return (
      user.role === 'manager' &&
      (task.status === 'not_evaluated' || task.status === 'completed')
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // ✅ Retour au dashboard (Tasks / Kanban si besoin)
  const handleBack = () => {
    const targetTab = fromDashboardTab || (fromKanban ? 'tasks' : 'overview');
    const state = { tab: targetTab };

    if (fromKanban) {
      state.viewType = fromViewType || 'kanban';
      state.fromKanban = true;
    }

    navigate('/dashboard', { state });
  };

  // 👁️ View evidence → ouvre dans un nouvel onglet (preview route)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Task Not Found</h1>
          <p className="text-slate-600 mb-6">The task you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const taskIsEvaluated = isTaskEvaluated(task);
  const canEvaluate = canEvaluateTask(task);
  const overdueFlag = isOverdue(task.due_date, task.status);
  const needsEvaluation =
    !taskIsEvaluated && (task.status === 'not_evaluated' || task.status === 'completed');

  const evidenceList = Array.isArray(task.completion_evidence)
    ? task.completion_evidence
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="border-b border-slate-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
                data-testid="back-to-dashboard"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1 className="text-2xl font-bold text-slate-900">Task Details</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              {user?.role === 'manager' && (
                <Button
                  onClick={handleEvaluatePerformance}
                  variant="default"
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
                  data-testid="evaluate-performance-button"
                  disabled={evaluating || !canEvaluate}
                >
                  {evaluating ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Award className="h-4 w-4 mr-2" />
                  )}
                  {taskIsEvaluated ? 'Re-evaluate Performance' : 'Evaluate Performance'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale : description, notes, evidences */}
          <div className="lg:col-span-2 space-y-6">
            <Card className={`glass-effect border-slate-200/50 animate-slideUp ${
              taskIsEvaluated
                ? 'border-green-300 bg-green-50/20'
                : needsEvaluation
                  ? 'border-orange-300 bg-orange-50/20'
                  : ''
            }`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl font-bold text-slate-900 mb-2">
                      {task.title || 'Untitled Task'}
                    </CardTitle>
                    <div className="flex items-center space-x-3">
                      <Badge className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClass(task)}`}>
                        {getDisplayStatus(task)}
                      </Badge>
                      
                      <Badge className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityBadgeClass(task.priority)}`}>
                        {(task.priority || 'medium').toUpperCase()} PRIORITY
                      </Badge>
                      
                      {needsEvaluation && (
                        <Badge className="px-3 py-1 text-sm font-medium rounded-full bg-orange-500 text-white border-orange-600">
                          <Star className="h-3 w-3 mr-1" />
                          AWAITING EVALUATION
                        </Badge>
                      )}
                      
                      {taskIsEvaluated && (
                        <Badge className="px-3 py-1 text-sm font-medium rounded-full bg-green-500 text-white border-green-600">
                          <Award className="h-3 w-3 mr-1" />
                          EVALUATED
                        </Badge>
                      )}
                      
                      {overdueFlag && (
                        <Badge className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          OVERDUE
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-blue-600" />
                      Description
                    </h3>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-slate-700 leading-relaxed">
                        {task.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  {task.completion_notes && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                        <MessageCircle className="h-5 w-5 mr-2 text-green-600" />
                        Completion Notes
                      </h3>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-slate-700 leading-relaxed">{task.completion_notes}</p>
                      </div>
                    </div>
                  )}

                  {evidenceList.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-green-600" />
                        Evidence Files
                      </h3>
                      <div className="space-y-2">
                        {evidenceList.map((evidence, index) => {
                          const label = getEvidenceLabel(evidence, index);
                          return (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                            >
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-slate-800 truncate max-w-xs">
                                  {label}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1">
                                {/* 👁️ View */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 hover:bg-green-100"
                                  onClick={() => viewEvidence(evidence)}
                                  title="View evidence"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>

                                {/* 💾 Download */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 hover:bg-green-100"
                                  onClick={() => downloadEvidence(evidence)}
                                  title="Download evidence"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Colonne latérale : infos, statut, évaluation, completion */}
          <div className="space-y-6">
            {/* Task Information */}
            <Card className="glass-effect border-slate-200/50 animate-slideUp" style={{animationDelay: '0.2s'}}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Task Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Due Date</p>
                    <p className="text-slate-900">{formatDate(task.due_date)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Clock className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Created</p>
                    <p className="text-slate-900">{formatDate(task.created_at)}</p>
                  </div>
                </div>

                {task.completed_at && (
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      needsEvaluation ? 'bg-orange-100' : 
                      taskIsEvaluated ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      <CheckCircle className={`h-5 w-5 ${
                        needsEvaluation ? 'text-orange-600' : 
                        taskIsEvaluated ? 'text-green-600' : 'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Completed</p>
                      <p className={`${
                        needsEvaluation ? 'text-orange-700' : 
                        taskIsEvaluated ? 'text-green-700' : 'text-slate-900'
                      }`}>
                        {formatDate(task.completed_at)}
                        {needsEvaluation && (
                          <span className="block text-xs text-orange-600 mt-1">Awaiting evaluation</span>
                        )}
                        {taskIsEvaluated && (
                          <span className="block text-xs text-green-600 mt-1">Evaluation completed</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <User className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {user?.role === 'manager' ? 'Assigned To' : 'Created By'}
                    </p>
                    <p className="text-slate-900">
                      {user?.role === 'manager' ? (task.assignee_name || 'Collaborator') : 'Manager'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Timeline */}
            <Card className="glass-effect border-slate-200/50 animate-slideUp" style={{animationDelay: '0.4s'}}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">Status Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(task)}`}></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Current Status</p>
                      <p className={`text-xs ${getStatusTextColor(task)} font-medium`}>
                        {getStatusMessage(task)}
                      </p>
                    </div>
                  </div>

                  {task.status !== 'completed' && task.status !== 'not_evaluated' && user?.role === 'collaborator' && (
                    <div className="pt-4 border-t border-slate-200">
                      <Button
                        onClick={() => handleStatusUpdate('in_progress')}
                        disabled={updating || task.status === 'in_progress'}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid="mark-in-progress-button"
                      >
                        {task.status === 'in_progress' ? 'In Progress' : 'Start Working'}
                      </Button>
                    </div>
                  )}

                  {needsEvaluation && user?.role === 'manager' && (
                    <div className="pt-4 border-t border-slate-200">
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm text-orange-800 font-medium mb-2">
                          <Award className="h-4 w-4 inline mr-1" />
                          Ready for Evaluation
                        </p>
                        <p className="text-xs text-orange-700">
                          This task has been completed and is waiting for your performance evaluation.
                        </p>
                      </div>
                    </div>
                  )}

                  {taskIsEvaluated && user?.role === 'manager' && (
                    <div className="pt-4 border-t border-slate-200">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800 font-medium mb-2">
                          <Award className="h-4 w-4 inline mr-1" />
                          Evaluation Completed
                        </p>
                        <p className="text-xs text-green-700">
                          This task has been evaluated successfully.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance Evaluation - détails visibles quand la tâche est évaluée */}
            {taskIsEvaluated && (
              <Card className="glass-effect border-slate-200/50 animate-slideUp" style={{animationDelay: '0.6s'}}>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900 flex items-center">
                    <Star className="h-5 w-5 mr-2 text-green-600" />
                    Performance Evaluation
                  </CardTitle>
                  <CardDescription>
                    Detailed scores and feedback for this task
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {isPositiveScore(task.punctuality_score) && (
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-green-600" />
                        <span className="text-slate-800">
                          <strong>Punctuality:</strong> {task.punctuality_score}/5
                        </span>
                      </div>
                    )}

                    {isPositiveScore(task.quality_score) && (
                      <div className="flex items-center space-x-2">
                        <Award className="h-4 w-4 text-green-600" />
                        <span className="text-slate-800">
                          <strong>Quality:</strong> {task.quality_score}/5
                        </span>
                      </div>
                    )}

                    {isPositiveScore(task.performance_rating) && (
                      <div className="flex items-center space-x-2">
                        <Star className="h-4 w-4 text-green-600" />
                        <span className="text-slate-800">
                          <strong>Overall Rating:</strong> {task.performance_rating}/5
                        </span>
                      </div>
                    )}

                    {task.evaluation_date && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-green-600" />
                        <span className="text-slate-800">
                          <strong>Evaluated on:</strong> {formatDate(task.evaluation_date)}
                        </span>
                      </div>
                    )}
                  </div>

                  {task.feedback && task.feedback.trim() !== '' && (
                    <div className="mt-2 p-3 bg-white rounded-lg border border-green-100">
                      <p className="text-xs text-green-600 font-medium mb-1">Manager Feedback</p>
                      <p className="text-sm text-slate-800 leading-relaxed">
                        {task.feedback}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bloc pour collaborateur pour compléter la tâche + upload */}
            {user?.role === 'collaborator' && task.status !== 'completed' && task.status !== 'not_evaluated' && (
              <Card className="glass-effect border-slate-200/50 animate-slideUp" style={{animationDelay: '0.8s'}}>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">Complete and Upload File</CardTitle>
                  <CardDescription>
                    Mark this task as complete and upload evidence files
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TaskCompletion 
                    task={task} 
                    onTaskCompleted={fetchTaskDetails}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {showEvaluation && (
        <PerformanceEvaluationModal
          isOpen={showEvaluation}
          onClose={() => setShowEvaluation(false)}
          onComplete={handleEvaluationComplete}
          taskId={task.id}
          collaboratorId={task.assignee_id}
          taskTitle={task.title}
          collaboratorName={task.assignee_name}
        />
      )}
    </div>
  );
};

export default TaskDetails;
