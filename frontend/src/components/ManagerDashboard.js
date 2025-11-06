import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from '../App';
import AnalyticsDashboard from './AnalyticsDashboard';
import RealTimeMetrics from './RealTimeMetrics';
import TaskTemplates from './TaskTemplates';
import { 
  Users, 
  Plus, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  LogOut,
  Bell,
  Settings,
  TrendingUp,
  Calendar,
  Filter,
  FileText
} from 'lucide-react';
import axios from 'axios';
import CreateTaskModal from './CreateTaskModal';
import TaskList from './TaskList';
import NotificationPanel from './NotificationPanel';

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, tasksRes, usersRes, notificationsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/tasks`),
        axios.get(`${API}/users`),
        axios.get(`${API}/notifications`)
      ]);

      setStats(statsRes.data);
      setTasks(tasksRes.data);
      setUsers(usersRes.data);
      setNotifications(notificationsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = () => {
    setShowCreateTask(false);
    fetchDashboardData();
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

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
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
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Manager Dashboard</h1>
                <p className="text-slate-600">Welcome back, {user?.full_name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowNotifications(true)}
                variant="ghost"
                size="sm"
                className={`notification-bell ${unreadNotifications > 0 ? 'has-notifications' : ''} relative`}
                data-testid="notifications-button"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowCreateTask(true)}
                  className="btn-primary"
                  data-testid="create-task-button"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </div>
              
              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
                data-testid="logout-button"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-custom py-8">
        {/* Real-Time Metrics */}
        <RealTimeMetrics tasks={tasks} users={users} stats={stats} />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slideUp">
          <Card className="stats-card" data-testid="total-tasks-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total Tasks</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.total_tasks || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+12% from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="stats-card" data-testid="completed-tasks-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Completed</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.completed_tasks || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                {stats.total_tasks > 0 
                  ? `${Math.round((stats.completed_tasks / stats.total_tasks) * 100)}% completion rate`
                  : 'No tasks yet'
                }
              </div>
            </CardContent>
          </Card>

          <Card className="stats-card" data-testid="pending-tasks-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Pending</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.pending_tasks || 0}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                Awaiting completion
              </div>
            </CardContent>
          </Card>

          <Card className="stats-card" data-testid="overdue-tasks-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Overdue</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.overdue_tasks || 0}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-600">
                Requires attention
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="tasks" className="animate-slideUp" style={{animationDelay: '0.2s'}}>
          <TabsList className="mb-6 bg-white/80 border border-slate-200/50">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-50">
              <Calendar className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-blue-50">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-blue-50">
              <Users className="h-4 w-4 mr-2" />
              Team
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-blue-50">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card className="glass-effect border-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900">Recent Tasks</CardTitle>
                  <CardDescription>Manage and track task progress</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button 
                    onClick={() => setShowCreateTask(true)}
                    size="sm"
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TaskList 
                  tasks={tasks} 
                  onTaskUpdate={fetchDashboardData}
                  userRole="manager"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card className="glass-effect border-slate-200/50">
              <CardContent className="p-6">
                <TaskTemplates 
                  collaborators={users.filter(u => u.role === 'collaborator')}
                  onTaskCreated={fetchDashboardData}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card className="glass-effect border-slate-200/50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-900">Team Members</CardTitle>
                <CardDescription>Manage your team and their performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {users.filter(u => u.role === 'collaborator').map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-white/60 rounded-lg border border-slate-200/50">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {member.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{member.full_name}</p>
                          <p className="text-sm text-slate-600">{member.email}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Active
                      </Badge>
                    </div>
                  ))}
                  
                  {users.filter(u => u.role === 'collaborator').length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No team members yet</p>
                      <p className="text-sm">Collaborators will appear here once they register</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard 
              stats={stats}
              tasks={tasks}
              users={users}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      {showCreateTask && (
        <CreateTaskModal
          isOpen={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          onTaskCreated={handleTaskCreated}
          collaborators={users.filter(u => u.role === 'collaborator')}
        />
      )}

      {showNotifications && (
        <NotificationPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onNotificationUpdate={fetchDashboardData}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;