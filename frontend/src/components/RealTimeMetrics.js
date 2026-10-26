import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { 
  Clock, 
  Target, 
  TrendingUp, 
  Calendar,
  Users,
  Zap,
  Timer,
  Award
} from 'lucide-react';

const RealTimeMetrics = ({ tasks, users, stats }) => {
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    calculateRealTimeMetrics();
  }, [tasks, users]);

  const calculateRealTimeMetrics = () => {
    if (!tasks || tasks.length === 0) {
      setMetrics({
        avgCompletionTime: 0,
        onTimeDeliveryRate: 0,
        workloadDistribution: 0,
        productivityTrend: 0,
        activeCollaborators: users?.filter(u => u.role === 'collaborator').length || 0,
        tasksToday: 0,
        avgTasksPerCollaborator: 0,
        urgentTasksCount: 0
      });
      return;
    }

    // 1. Average Completion Time (in days)
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at && t.created_at);
    const avgCompletionTime = completedTasks.length > 0 
      ? completedTasks.reduce((sum, task) => {
          const created = new Date(task.created_at);
          const completed = new Date(task.completed_at);
          const diffDays = (completed - created) / (1000 * 60 * 60 * 24);
          return sum + diffDays;
        }, 0) / completedTasks.length
      : 0;

    // 2. On-Time Delivery Rate
    const tasksWithDeadlines = tasks.filter(t => t.due_date && t.status === 'completed');
    const onTimeDeliveries = tasksWithDeadlines.filter(t => {
      const dueDate = new Date(t.due_date);
      const completedDate = new Date(t.completed_at);
      return completedDate <= dueDate;
    }).length;
    const onTimeDeliveryRate = tasksWithDeadlines.length > 0 
      ? (onTimeDeliveries / tasksWithDeadlines.length) * 100 
      : 0;

    // 3. Workload Distribution (standard deviation of tasks per collaborator)
    const collaborators = users?.filter(u => u.role === 'collaborator') || [];
    const taskCounts = collaborators.map(c => 
      tasks.filter(t => t.assignee_id === c.id).length
    );
    const avgTasks = taskCounts.length > 0 ? taskCounts.reduce((sum, count) => sum + count, 0) / taskCounts.length : 0;
    const workloadVariance = taskCounts.length > 0 
      ? taskCounts.reduce((sum, count) => sum + Math.pow(count - avgTasks, 2), 0) / taskCounts.length
      : 0;
    const workloadDistribution = Math.sqrt(workloadVariance);

    // 4. Tasks Created Today
    const today = new Date().toISOString().split('T')[0];
    const tasksToday = tasks.filter(t => 
      t.created_at && t.created_at.split('T')[0] === today
    ).length;

    // 5. Urgent Tasks (high priority + close to deadline)
    const urgentTasksCount = tasks.filter(t => {
      if (t.priority === 'high') return true;
      if (t.due_date) {
        const dueDate = new Date(t.due_date);
        const now = new Date();
        const diffDays = (dueDate - now) / (1000 * 60 * 60 * 24);
        return diffDays <= 1 && diffDays >= 0; // Due within 1 day
      }
      return false;
    }).length;

    // 6. Productivity Trend (compare this week vs last week)
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekCompleted = tasks.filter(t => {
      if (!t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      return completedDate >= thisWeekStart;
    }).length;

    const lastWeekCompleted = tasks.filter(t => {
      if (!t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      return completedDate >= lastWeekStart && completedDate < thisWeekStart;
    }).length;

    const productivityTrend = lastWeekCompleted > 0 
      ? ((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100 
      : thisWeekCompleted > 0 ? 100 : 0;

    setMetrics({
      avgCompletionTime: avgCompletionTime.toFixed(1),
      onTimeDeliveryRate: onTimeDeliveryRate.toFixed(1),
      workloadDistribution: workloadDistribution.toFixed(1),
      productivityTrend: productivityTrend.toFixed(1),
      activeCollaborators: collaborators.length,
      tasksToday,
      avgTasksPerCollaborator: avgTasks.toFixed(1),
      urgentTasksCount
    });
  };

  const getMetricColor = (value, type) => {
    switch (type) {
      case 'onTime':
        return parseFloat(value) >= 80 ? 'text-green-600' : parseFloat(value) >= 60 ? 'text-yellow-600' : 'text-red-600';
      case 'trend':
        return parseFloat(value) > 0 ? 'text-green-600' : parseFloat(value) < 0 ? 'text-red-600' : 'text-gray-600';
      case 'workload':
        return parseFloat(value) <= 2 ? 'text-green-600' : parseFloat(value) <= 4 ? 'text-yellow-600' : 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  const getTrendIcon = (value) => {
    return parseFloat(value) > 0 ? '↗' : parseFloat(value) < 0 ? '↘' : '→';
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Average Completion Time */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">Avg Completion</p>
              <p className="text-xl font-bold text-blue-900">{metrics.avgCompletionTime} days</p>
            </div>
            <Timer className="h-6 w-6 text-blue-500" />
          </div>
          <div className="mt-2 text-xs text-blue-700">
            Per task completion time
          </div>
        </CardContent>
      </Card>

      {/* On-Time Delivery Rate */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium">On-Time Rate</p>
              <p className={`text-xl font-bold ${getMetricColor(metrics.onTimeDeliveryRate, 'onTime')}`}>
                {metrics.onTimeDeliveryRate}%
              </p>
            </div>
            <Target className="h-6 w-6 text-green-500" />
          </div>
          <div className="mt-2 text-xs text-green-700">
            Delivered by deadline
          </div>
        </CardContent>
      </Card>

      {/* Productivity Trend */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-600 font-medium">Weekly Trend</p>
              <p className={`text-xl font-bold ${getMetricColor(metrics.productivityTrend, 'trend')}`}>
                {getTrendIcon(metrics.productivityTrend)} {Math.abs(metrics.productivityTrend)}%
              </p>
            </div>
            <TrendingUp className="h-6 w-6 text-purple-500" />
          </div>
          <div className="mt-2 text-xs text-purple-700">
            vs last week
          </div>
        </CardContent>
      </Card>

      {/* Urgent Tasks */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 font-medium">Urgent Tasks</p>
              <p className="text-xl font-bold text-orange-900">{metrics.urgentTasksCount}</p>
            </div>
            <Zap className="h-6 w-6 text-orange-500" />
          </div>
          <div className="mt-2 text-xs text-orange-700">
            Need immediate attention
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeMetrics;