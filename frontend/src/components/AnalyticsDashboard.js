import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { 
  Download, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react';
import axios from 'axios';
import { API } from '../App';
import ExportManager from './ExportManager';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const AnalyticsDashboard = ({ stats, tasks, users }) => {
  const [analyticsData, setAnalyticsData] = useState({});
  const [timeRange, setTimeRange] = useState('month'); // week, month, quarter
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    processAnalyticsData();
  }, [tasks, users, timeRange]);

  const processAnalyticsData = () => {
    setLoading(true);
    
    // 1. Task Completion Trend (Last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const completionTrend = last7Days.map(date => {
      const completedOnDate = tasks.filter(task => 
        task.completed_at && task.completed_at.split('T')[0] === date
      ).length;
      return completedOnDate;
    });

    // 2. Task Status Distribution
    const statusCounts = {
      completed: tasks.filter(t => t.status === 'completed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      overdue: tasks.filter(t => t.status === 'overdue').length,
    };

    // 3. Performance by Collaborator
    const collaborators = users.filter(u => u.role === 'collaborator');
    const performanceData = collaborators.map(collaborator => {
      const userTasks = tasks.filter(t => t.assignee_id === collaborator.id);
      const completedTasks = userTasks.filter(t => t.status === 'completed').length;
      const totalTasks = userTasks.length;
      return {
        name: collaborator.full_name,
        completed: completedTasks,
        total: totalTasks,
        rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      };
    });

    // 4. Priority Distribution
    const priorityCounts = {
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    };

    setAnalyticsData({
      completionTrend,
      statusCounts,
      performanceData,
      priorityCounts,
      last7Days
    });
    
    setLoading(false);
  };

  // Chart configurations
  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Task Completion Trend (Last 7 Days)',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const lineChartData = {
    labels: analyticsData.last7Days?.map(date => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }) || [],
    datasets: [
      {
        label: 'Tasks Completed',
        data: analyticsData.completionTrend || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Performance by Collaborator',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const barChartData = {
    labels: analyticsData.performanceData?.map(p => p.name) || [],
    datasets: [
      {
        label: 'Completed Tasks',
        data: analyticsData.performanceData?.map(p => p.completed) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Total Tasks',
        data: analyticsData.performanceData?.map(p => p.total) || [],
        backgroundColor: 'rgba(148, 163, 184, 0.8)',
        borderColor: 'rgba(148, 163, 184, 1)',
        borderWidth: 1,
      },
    ],
  };

  const pieChartData = {
    labels: ['Completed', 'Pending', 'In Progress', 'Overdue'],
    datasets: [
      {
        data: [
          analyticsData.statusCounts?.completed || 0,
          analyticsData.statusCounts?.pending || 0,
          analyticsData.statusCounts?.in_progress || 0,
          analyticsData.statusCounts?.overdue || 0,
        ],
        backgroundColor: [
          '#22c55e', // green
          '#f59e0b', // amber
          '#3b82f6', // blue
          '#ef4444', // red
        ],
        borderColor: [
          '#16a34a',
          '#d97706',
          '#2563eb',
          '#dc2626',
        ],
        borderWidth: 2,
      },
    ],
  };

  const doughnutChartData = {
    labels: ['High Priority', 'Medium Priority', 'Low Priority'],
    datasets: [
      {
        data: [
          analyticsData.priorityCounts?.high || 0,
          analyticsData.priorityCounts?.medium || 0,
          analyticsData.priorityCounts?.low || 0,
        ],
        backgroundColor: [
          '#ef4444', // red
          '#f59e0b', // amber
          '#22c55e', // green
        ],
        borderColor: [
          '#dc2626',
          '#d97706',
          '#16a34a',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Export functionality moved to ExportManager component

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Export Options */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h2>
          <p className="text-slate-600">Comprehensive insights into team performance</p>
        </div>
        <ExportManager 
          tasks={tasks} 
          users={users} 
          stats={stats} 
          analyticsData={analyticsData}
        />
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg Completion Rate</p>
                <p className="text-2xl font-bold">
                  {analyticsData.performanceData?.length > 0 
                    ? `${(analyticsData.performanceData.reduce((sum, p) => sum + p.rate, 0) / analyticsData.performanceData.length).toFixed(1)}%`
                    : '0%'
                  }
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Collaborators</p>
                <p className="text-2xl font-bold">{users.filter(u => u.role === 'collaborator').length}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Tasks This Week</p>
                <p className="text-2xl font-bold">{analyticsData.completionTrend?.reduce((sum, count) => sum + count, 0) || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg Tasks/Day</p>
                <p className="text-2xl font-bold">
                  {analyticsData.completionTrend?.length > 0 
                    ? (analyticsData.completionTrend.reduce((sum, count) => sum + count, 0) / 7).toFixed(1)
                    : '0'
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Task Completion Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Completion Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Line options={lineChartOptions} data={lineChartData} />
          </CardContent>
        </Card>

        {/* Bar Chart - Performance by Collaborator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Team Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bar options={barChartOptions} data={barChartData} />
          </CardContent>
        </Card>

        {/* Pie Chart - Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              Task Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Pie data={pieChartData} />
          </CardContent>
        </Card>

        {/* Doughnut Chart - Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Doughnut data={doughnutChartData} />
          </CardContent>
        </Card>
      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Performance Metrics</CardTitle>
          <CardDescription>Individual collaborator statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Collaborator</th>
                  <th className="text-left py-2">Total Tasks</th>
                  <th className="text-left py-2">Completed</th>
                  <th className="text-left py-2">Completion Rate</th>
                  <th className="text-left py-2">Performance</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.performanceData?.map((collaborator, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 font-medium">{collaborator.name}</td>
                    <td className="py-3">{collaborator.total}</td>
                    <td className="py-3">{collaborator.completed}</td>
                    <td className="py-3">{collaborator.rate.toFixed(1)}%</td>
                    <td className="py-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${collaborator.rate}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;