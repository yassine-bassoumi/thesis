import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Eye, 
  CheckCircle,
  User,
  ArrowRight
} from 'lucide-react';
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const TaskList = ({ tasks, onTaskUpdate, userRole }) => {
  const navigate = useNavigate();

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

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      await axios.put(`${API}/tasks/${taskId}`, {
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      });
      toast.success('Task status updated successfully');
      onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task status');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = (dueDate, status) => {
    return new Date(dueDate) < new Date() && status !== 'completed';
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No tasks found</p>
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
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card 
          key={task.id} 
          className={`task-card ${isOverdue(task.due_date, task.status) ? 'border-red-200' : ''}`}
          data-testid={`task-card-${task.id}`}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900 hover:text-blue-600 cursor-pointer"
                      onClick={() => navigate(`/tasks/${task.id}`)}>
                    {task.title}
                  </h3>
                  <Badge className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(task.status)}`}>
                    {task.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <Badge className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadgeClass(task.priority)}`}>
                    {task.priority.toUpperCase()}
                  </Badge>
                </div>
                
                <p className="text-slate-600 mb-4 line-clamp-2">
                  {task.description}
                </p>
                
                <div className="flex items-center space-x-6 text-sm text-slate-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {formatDate(task.due_date)}</span>
                    {isOverdue(task.due_date, task.status) && (
                      <AlertTriangle className="h-4 w-4 text-red-500 ml-1" />
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>Created: {formatDate(task.created_at)}</span>
                  </div>
                  
                  {userRole === 'manager' && (
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Assigned to collaborator</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                {userRole === 'collaborator' && task.status !== 'completed' && (
                  <Button
                    onClick={() => handleStatusUpdate(task.id, 'completed')}
                    size="sm"
                    className="bg-green-500 hover:bg-green-600 text-white"
                    data-testid={`complete-task-${task.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                )}
                
                <Button
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900"
                  data-testid={`view-task-${task.id}`}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
              </div>
            </div>
            
            {/* Progress Indicator */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    task.status === 'completed' ? 'bg-green-500' :
                    task.status === 'in_progress' ? 'bg-blue-500' :
                    isOverdue(task.due_date, task.status) ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  <span className="text-slate-600">
                    {task.status === 'completed' ? 'Task completed' :
                     task.status === 'in_progress' ? 'In progress' :
                     isOverdue(task.due_date, task.status) ? 'Overdue' : 'Pending'}
                  </span>
                </div>
                
                <Button
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                >
                  View Details
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TaskList;