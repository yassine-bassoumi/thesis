import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle, Clock, AlertTriangle, Users, Calendar, Target, Rocket } from 'lucide-react';

const OverviewTab = ({ stats, tasks, users, onShowCreateTask, onNavigate }) => {
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  const overdueTasks = tasks.filter(task => task.status === 'overdue').length;
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length;

  const collaborators = users.filter(u => u.role === 'collaborator');

  return (
    <div className="space-y-6">
      {/* Main Metrics - Big and Clear */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-blue-900">{tasks.length}</p>
                <p className="text-sm text-blue-700">Total Tasks</p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-green-900">{completedTasks}</p>
                <p className="text-sm text-green-700">Completed</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-orange-900">{inProgressTasks}</p>
                <p className="text-sm text-orange-700">In Progress</p>
              </div>
              <Rocket className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-red-900">{overdueTasks}</p>
                <p className="text-sm text-red-700">Overdue</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Overview - Only if we have team members */}
      {collaborators.length > 0 && (
        <Card className="border-slate-200/50">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-500" />
              Your Team
            </CardTitle>
            <CardDescription>
              {collaborators.length} active collaborator{collaborators.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collaborators.slice(0, 4).map((user) => (
                <div key={user.id} className="flex items-center space-x-3 p-3 bg-white/60 rounded-lg border">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {user.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{user.full_name}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Tasks */}
      <Card className="border-slate-200/50">
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-500" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest updates in your tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    task.status === 'completed' ? 'bg-green-500' :
                    task.status === 'in_progress' ? 'bg-blue-500' :
                    task.status === 'overdue' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <span className="font-medium text-slate-900">{task.title}</span>
                </div>
                <Badge className={
                  task.status === 'completed' ? 'bg-green-100 text-green-700' :
                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  task.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }>
                  {task.status}
                </Badge>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p>No tasks yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewTab;