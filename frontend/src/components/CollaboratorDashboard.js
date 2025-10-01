import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from '../App';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  LogOut,
  Bell,
  Award,
  TrendingUp,
  Calendar,
  BarChart3,
  User
} from 'lucide-react';
import axios from 'axios';
import TaskList from './TaskList';
import NotificationPanel from './NotificationPanel';

const CollaboratorDashboard = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({});
  const [tasks, setTasks] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, tasksRes, performanceRes, notificationsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/tasks`),
        axios.get(`${API}/performance/${user.id}`),
        axios.get(`${API}/notifications`)
      ]);

      setStats(statsRes.data);
      setTasks(tasksRes.data);
      setPerformance(performanceRes.data);
      setNotifications(notificationsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
              <div className="p-2 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">My Dashboard</h1>
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
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-slideUp">
          <Card className="stats-card" data-testid="my-tasks-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">My Tasks</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.my_tasks || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">Active assignments</span>
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
                {stats.my_tasks > 0 
                  ? `${Math.round((stats.completed_tasks / stats.my_tasks) * 100)}% completion rate`
                  : 'No tasks yet'
                }
              </div>
            </CardContent>
          </Card>

          <Card className="stats-card" data-testid="punctuality-score-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Punctuality</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.avg_punctuality_score || 0}/5
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4">
                <Progress 
                  value={(stats.avg_punctuality_score || 0) * 20} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="stats-card" data-testid="quality-score-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Quality</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.avg_quality_score || 0}/5
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Award className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4">
                <Progress 
                  value={(stats.avg_quality_score || 0) * 20} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="tasks" className="animate-slideUp" style={{animationDelay: '0.2s'}}>
          <TabsList className="mb-6 bg-white/80 border border-slate-200/50">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-50">
              <Calendar className="h-4 w-4 mr-2" />
              My Tasks
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-50">
              <BarChart3 className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card className="glass-effect border-slate-200/50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-900">My Tasks</CardTitle>
                <CardDescription>Track your assigned tasks and deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                <TaskList 
                  tasks={tasks} 
                  onTaskUpdate={fetchDashboardData}
                  userRole="collaborator"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <div className="grid gap-6">
              <Card className="glass-effect border-slate-200/50">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-slate-900">Performance History</CardTitle>
                  <CardDescription>View your performance evaluations and feedback</CardDescription>
                </CardHeader>
                <CardContent>
                  {performance.length > 0 ? (
                    <div className="space-y-4">
                      {performance.slice(0, 5).map((evaluation) => (
                        <div key={evaluation.id} className="p-4 bg-white/60 rounded-lg border border-slate-200/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <Award className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">Task Evaluation</p>
                                <p className="text-sm text-slate-600">
                                  {new Date(evaluation.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-sm font-medium text-slate-700">Punctuality</p>
                              <div className="flex items-center mt-1">
                                <Progress value={evaluation.punctuality_score * 20} className="h-2 flex-1 mr-2" />
                                <span className="text-sm font-medium">{evaluation.punctuality_score}/5</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">Quality</p>
                              <div className="flex items-center mt-1">
                                <Progress value={evaluation.quality_score * 20} className="h-2 flex-1 mr-2" />
                                <span className="text-sm font-medium">{evaluation.quality_score}/5</span>
                              </div>
                            </div>
                          </div>
                          
                          {evaluation.comments && (
                            <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                              <p className="text-sm text-slate-700">{evaluation.comments}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No performance evaluations yet</p>
                      <p className="text-sm">Complete tasks to receive feedback</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
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

export default CollaboratorDashboard;