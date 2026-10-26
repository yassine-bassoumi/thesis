import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { 
  Clock, 
  Target, 
  TrendingUp, 
  Calendar,
  Zap,
  Timer,
  AlertTriangle
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
        tasksToday: 0,
        avgTasksPerCollaborator: 0,
        urgentTasksCount: 0,
        unevaluatedTasksCount: 0,
        evaluationRate: 0
      });
      return;
    }

    // Définitions des statuts
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const notEvaluatedTasks = tasks.filter(t => t.status === 'not_evaluated');
    
    // Tâches complétées (évaluées + non évaluées)
    const allCompletedTasks = [...completedTasks, ...notEvaluatedTasks];

    // 1. Average Completion Time - Seulement les tâches complétées avec dates
    const completedTasksWithDates = completedTasks.filter(t => 
      t.completed_at && t.created_at
    );
    const avgCompletionTime = completedTasksWithDates.length > 0 
      ? completedTasksWithDates.reduce((sum, task) => {
          const created = new Date(task.created_at);
          const completed = new Date(task.completed_at);
          const diffDays = (completed - created) / (1000 * 60 * 60 * 24);
          return sum + diffDays;
        }, 0) / completedTasksWithDates.length
      : 0;

    // 2. On-Time Delivery Rate - Toutes les tâches complétées avec deadline
    const tasksWithDeadlines = allCompletedTasks.filter(t => t.due_date);
    const onTimeDeliveries = tasksWithDeadlines.filter(t => {
      const dueDate = new Date(t.due_date);
      const completedDate = new Date(t.completed_at || t.updated_at);
      return completedDate <= dueDate;
    }).length;
    const onTimeDeliveryRate = tasksWithDeadlines.length > 0 
      ? (onTimeDeliveries / tasksWithDeadlines.length) * 100 
      : 0;

    // 3. Productivity Trend
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekCompleted = allCompletedTasks.filter(t => {
      if (!t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      return completedDate >= thisWeekStart;
    }).length;

    const lastWeekCompleted = allCompletedTasks.filter(t => {
      if (!t.completed_at) return false;
      const completedDate = new Date(t.completed_at);
      return completedDate >= lastWeekStart && completedDate < thisWeekStart;
    }).length;

    const productivityTrend = lastWeekCompleted > 0 
      ? ((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100 
      : thisWeekCompleted > 0 ? 100 : 0;

    // Taux d'évaluation
    const evaluatedTasks = tasks.filter(t => 
      (t.performance_rating !== null && t.feedback && t.status === 'completed') ||
      (t.punctuality_score !== null && t.quality_score !== null && t.status === 'completed') ||
      (t.evaluation_date !== null && t.status === 'completed')
    );
    
    const evaluationRate = allCompletedTasks.length > 0 
      ? (evaluatedTasks.length / allCompletedTasks.length) * 100 
      : 0;

    // Urgent Tasks
    const urgentTasksCount = tasks.filter(t => {
      if (t.priority === 'high') return true;
      if (t.due_date) {
        const dueDate = new Date(t.due_date);
        const now = new Date();
        const diffDays = (dueDate - now) / (1000 * 60 * 60 * 24);
        return diffDays <= 1 && diffDays >= 0;
      }
      return false;
    }).length;

    // Tasks Created Today
    const today = new Date().toISOString().split('T')[0];
    const tasksToday = tasks.filter(t => 
      t.created_at && t.created_at.split('T')[0] === today
    ).length;

    setMetrics({
      avgCompletionTime: avgCompletionTime.toFixed(1),
      onTimeDeliveryRate: onTimeDeliveryRate.toFixed(1),
      productivityTrend: productivityTrend.toFixed(1),
      tasksToday,
      urgentTasksCount,
      evaluationRate: evaluationRate.toFixed(1)
    });
  };

  const getMetricColor = (value, type) => {
    const numValue = parseFloat(value);
    
    switch (type) {
      case 'onTime':
        return numValue >= 80 ? 'text-green-600' : 
               numValue >= 60 ? 'text-yellow-600' : 'text-red-600';
      case 'trend':
        return numValue > 0 ? 'text-green-600' : 
               numValue < 0 ? 'text-red-600' : 'text-gray-600';
      case 'evaluation':
        return numValue >= 90 ? 'text-green-600' : 
               numValue >= 70 ? 'text-yellow-600' : 'text-red-600';
      case 'count':
        return numValue === 0 ? 'text-gray-600' : 
               numValue > 5 ? 'text-red-600' : 'text-orange-600';
      default:
        return 'text-blue-600';
    }
  };

  const getMetricBg = (type) => {
    switch (type) {
      case 'evaluation':
        return 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200';
      case 'urgent':
        return 'bg-gradient-to-br from-red-50 to-red-100 border-red-200';
      case 'warning':
        return 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200';
      case 'success':
        return 'bg-gradient-to-br from-green-50 to-green-100 border-green-200';
      case 'info':
        return 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200';
      default:
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200';
    }
  };

  const getTrendIcon = (value) => {
    const numValue = parseFloat(value);
    return numValue > 0 ? '↗' : numValue < 0 ? '↘' : '→';
  };

  return (
    <div className="space-y-6">
      {/* Main Metrics - 4 cartes principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Average Completion Time */}
        <Card className={getMetricBg('info')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Avg Completion Time</p>
                <p className="text-xl font-bold text-blue-900">
                  {metrics.avgCompletionTime} days
                </p>
              </div>
              <Timer className="h-6 w-6 text-blue-500" />
            </div>
            <div className="mt-2 text-xs text-blue-700">
              Per completed task
            </div>
          </CardContent>
        </Card>

        {/* On-Time Delivery Rate */}
        <Card className={getMetricBg('success')}>
          <CardContent className="p-6">
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

        {/* Evaluation Rate */}
        <Card className={getMetricBg('evaluation')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Evaluation Rate</p>
                <p className={`text-xl font-bold ${getMetricColor(metrics.evaluationRate, 'evaluation')}`}>
                  {metrics.evaluationRate || 0}%
                </p>
              </div>
              <TrendingUp className="h-6 w-6 text-purple-500" />
            </div>
            <div className="mt-2 text-xs text-purple-700">
              Tasks evaluated
            </div>
          </CardContent>
        </Card>

        {/* Tasks Today */}
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-teal-600 font-medium">New Tasks</p>
                <p className="text-xl font-bold text-teal-900">
                  {metrics.tasksToday || 0}
                </p>
              </div>
              <Calendar className="h-6 w-6 text-teal-500" />
            </div>
            <div className="mt-2 text-xs text-teal-700">
              Created today
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics - 2 cartes secondaires */}
      <div className="grid grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Urgent Tasks */}
        <Card className={getMetricBg('urgent')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Urgent Tasks</p>
                <p className="text-xl font-bold text-red-900">
                  {metrics.urgentTasksCount || 0}
                </p>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div className="mt-2 text-xs text-red-700">
              High priority + near deadline
            </div>
          </CardContent>
        </Card>

        {/* Productivity */}
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 font-medium">Productivity Trend</p>
                <p className={`text-xl font-bold ${getMetricColor(metrics.productivityTrend, 'trend')}`}>
                  {getTrendIcon(metrics.productivityTrend)} {metrics.productivityTrend}%
                </p>
              </div>
              <Zap className="h-6 w-6 text-indigo-500" />
            </div>
            <div className="mt-2 text-xs text-indigo-700">
              vs last week
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealTimeMetrics;