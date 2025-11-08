import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Calendar, User } from 'lucide-react';

const KanbanView = ({ tasks, onTaskUpdate }) => {
  // Organiser les tâches par statut
  const columns = {
    pending: {
      title: "Pending",
      color: "bg-yellow-50 border-yellow-200",
      tasks: tasks.filter(task => task.status === 'pending')
    },
    in_progress: {
      title: "In Progress", 
      color: "bg-blue-50 border-blue-200",
      tasks: tasks.filter(task => task.status === 'in_progress')
    },
    completed: {
      title: "Completed",
      color: "bg-green-50 border-green-200",
      tasks: tasks.filter(task => task.status === 'completed')
    },
    overdue: {
      title: "Overdue",
      color: "bg-red-50 border-red-200",
      tasks: tasks.filter(task => task.status === 'overdue')
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const TaskCard = ({ task }) => (
    <Card className="mb-3 cursor-grab hover:shadow-md transition-shadow duration-200 task-card">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-semibold text-sm text-slate-900 line-clamp-2">
            {task.title}
          </h4>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-xs text-slate-600 mb-3 line-clamp-2">
          {task.description}
        </p>
        
        <div className="flex items-center justify-between mb-2">
          <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {task.status.replace('_', ' ')}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(task.due_date)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[80px]">
              {task.assignee_name || 'Unassigned'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="kanban-container">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(columns).map(([status, column]) => (
          <div key={status} className="kanban-column">
            <Card className={`h-full ${column.color} border-2`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex justify-between items-center text-sm font-semibold">
                  <span>{column.title}</span>
                  <Badge variant="secondary" className="bg-white">
                    {column.tasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {column.tasks.length > 0 ? (
                    column.tasks.map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <p className="text-sm">No tasks</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanView;