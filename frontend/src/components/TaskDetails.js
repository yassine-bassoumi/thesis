import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  Edit
} from 'lucide-react';
import axios from 'axios';
import { toast } from "sonner";
import PerformanceEvaluationModal from './PerformanceEvaluationModal';

const TaskDetails = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  const fetchTaskDetails = async () => {
    try {
      const response = await axios.get(`${API}/tasks/${taskId}`);
      setTask(response.data);
    } catch (error) {
      console.error('Error fetching task details:', error);
      toast.error('Failed to load task details');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      await axios.put(`${API}/tasks/${taskId}`, {
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      });
      toast.success('Task status updated successfully');
      fetchTaskDetails();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'status-pending',
      in_progress: 'status-in-progress',
      completed: 'status-completed',
      overdue: 'status-overdue'
    };
    return classes[status] || 'bg-gray-500';
  };

  const getPriorityBadgeClass = (priority) => {
    const classes = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high'
    };
    return classes[priority] || 'bg-gray-500';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (dueDate, status) => {
    return new Date(dueDate) < new Date() && status !== 'completed';
  };

  const handleEvaluationComplete = () => {
    setShowEvaluation(false);
    toast.success('Performance evaluation submitted successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Task Not Found</h1>
          <p className="text-slate-600 mb-6">The task you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b border-slate-200/50 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/dashboard')}
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
              {user?.role === 'manager' && task.status === 'completed' && (
                <Button
                  onClick={() => setShowEvaluation(true)}
                  className="btn-primary"
                  data-testid="evaluate-performance-button"
                >
                  <Award className="h-4 w-4 mr-2" />
                  Evaluate Performance
                </Button>
              )}
              
              {user?.role === 'collaborator' && task.status !== 'completed' && (
                <Button
                  onClick={() => handleStatusUpdate('completed')}
                  disabled={updating}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  data-testid="complete-task-button"
                >
                  {updating ? (
                    <div className="flex items-center">
                      <div className="loading-spinner mr-2"></div>
                      Updating...
                    </div>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-custom py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Task Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass-effect border-slate-200/50 animate-slideUp">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl font-bold text-slate-900 mb-2">
                      {task.title}
                    </CardTitle>
                    <div className="flex items-center space-x-3">
                      <Badge className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusBadgeClass(task.status)}`}>
                        {task.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityBadgeClass(task.priority)}`}>
                        {task.priority.toUpperCase()} PRIORITY
                      </Badge>
                      {isOverdue(task.due_date, task.status) && (
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

                  {task.attachments && task.attachments.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-3">Attachments</h3>
                      <div className="space-y-2">
                        {task.attachments.map((attachment, index) => (
                          <div key={index} className="p-3 bg-white border border-slate-200 rounded-lg">
                            <p className="text-slate-700">{attachment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {task.evidence_files && task.evidence_files.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-3">Evidence Files</h3>
                      <div className="space-y-2">
                        {task.evidence_files.map((evidence, index) => (
                          <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-slate-700">{evidence}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Completed</p>
                      <p className="text-slate-900">{formatDate(task.completed_at)}</p>
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
                    <div className={`w-3 h-3 rounded-full ${
                      task.status === 'completed' ? 'bg-green-500' :
                      task.status === 'in_progress' ? 'bg-blue-500' :
                      isOverdue(task.due_date, task.status) ? 'bg-red-500' : 'bg-yellow-500'
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Current Status</p>
                      <p className="text-xs text-slate-600">
                        {task.status.replace('_', ' ').charAt(0).toUpperCase() + task.status.replace('_', ' ').slice(1)}
                      </p>
                    </div>
                  </div>

                  {task.status !== 'completed' && user?.role === 'collaborator' && (
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Performance Evaluation Modal */}
      {showEvaluation && (
        <PerformanceEvaluationModal
          isOpen={showEvaluation}
          onClose={() => setShowEvaluation(false)}
          onComplete={handleEvaluationComplete}
          taskId={task.id}
          collaboratorId={task.assignee_id}
        />
      )}
    </div>
  );
};

export default TaskDetails;