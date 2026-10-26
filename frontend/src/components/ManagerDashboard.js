import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from '../App';
import AnalyticsDashboard from './AnalyticsDashboard';
import RealTimeMetrics from './RealTimeMetrics';
import TaskTemplates from './TaskTemplates';
import FilterTasks from './FilterTasks';
import KanbanView from './KanbanView';
import OverviewTab from './OverviewTab';
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
  FileText,
  Home
} from 'lucide-react';
import axios from 'axios';
import CreateTaskModal from './CreateTaskModal';
import TaskList from './TaskList';
import NotificationPanel from './NotificationPanel';

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'kanban'

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
      setFilteredTasks(tasksRes.data); // Initialize filtered tasks
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

  // Handle filter changes
  const handleFilterChange = (filteredTasks) => {
    setFilteredTasks(filteredTasks);
  };

  // Reset filters
  const handleClearFilters = () => {
    setFilteredTasks(tasks);
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
        {/* Real-Time Metrics - Keep this as it's lightweight */}
        <RealTimeMetrics tasks={tasks} users={users} stats={stats} />

        {/* Main Content Tabs - MODIFIED SECTION */}
        <Tabs defaultValue="overview" className="animate-slideUp" style={{animationDelay: '0.2s'}}>
          <TabsList className="mb-6 bg-white/80 border border-slate-200/50">
            {/* NEW OVERVIEW TAB */}
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50">
              <Home className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            
            {/* EXISTING TABS */}
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

          {/* NEW OVERVIEW TAB CONTENT */}
          <TabsContent value="overview">
            <OverviewTab 
              stats={stats}
              tasks={tasks}
              users={users}
              onShowCreateTask={() => setShowCreateTask(true)}
            />
          </TabsContent>

          {/* EXISTING TASKS TAB - UNCHANGED */}
          <TabsContent value="tasks">
            <Card className="glass-effect border-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900">
                    Recent Tasks {filteredTasks.length !== tasks.length && (
                      <span className="text-sm text-slate-500 ml-2">
                        (filtered from {tasks.length} total)
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>Manage and track task progress</CardDescription>
                </div>
                <div className="flex space-x-2">
                  {/* View Mode Toggle */}
                  <div className="flex bg-slate-100 rounded-lg p-1">
                    <Button
                      variant={viewMode === 'list' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={viewMode === 'list' ? "bg-white shadow-sm" : ""}
                    >
                      List
                    </Button>
                    <Button
                      variant={viewMode === 'kanban' ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode('kanban')}
                      className={viewMode === 'kanban' ? "bg-white shadow-sm" : ""}
                    >
                      Kanban
                    </Button>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={showFilters ? "bg-blue-50" : ""}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {showFilters ? 'Hide Filters' : 'Filter'}
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

              {/* Filter component */}
              {showFilters && (
                <div className="px-6 pb-4 border-b border-slate-200/50">
                  <FilterTasks
                    tasks={tasks}
                    onFilterChange={handleFilterChange}
                    onClearFilters={handleClearFilters}
                    collaborators={users.filter(u => u.role === 'collaborator')}
                  />
                </div>
              )}

              <CardContent>
                {viewMode === 'list' ? (
                  <TaskList 
                    tasks={filteredTasks} 
                    onTaskUpdate={fetchDashboardData}
                    userRole="manager"
                  />
                ) : (
                  <KanbanView 
                    tasks={filteredTasks} 
                    onTaskUpdate={fetchDashboardData}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* OTHER TABS REMAIN UNCHANGED */}
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