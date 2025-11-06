import React from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

const ExportManager = ({ tasks, users, stats, analyticsData }) => {
  
  const exportToCSV = (type = 'tasks') => {
    let csvData = [];
    let filename = '';

    switch (type) {
      case 'tasks':
        csvData = [
          ['Task ID', 'Title', 'Description', 'Assignee', 'Status', 'Priority', 'Created At', 'Due Date', 'Completed At'],
          ...tasks.map(task => [
            task.id,
            task.title || '',
            task.description || '',
            task.assignee_name || '',
            task.status || '',
            task.priority || '',
            task.created_at || '',
            task.due_date || '',
            task.completed_at || ''
          ])
        ];
        filename = 'tasks-export';
        break;

      case 'performance':
        const collaborators = users.filter(u => u.role === 'collaborator');
        csvData = [
          ['Collaborator', 'Email', 'Total Tasks', 'Completed Tasks', 'Pending Tasks', 'Completion Rate'],
          ...collaborators.map(collaborator => {
            const userTasks = tasks.filter(t => t.assignee_id === collaborator.id);
            const completedTasks = userTasks.filter(t => t.status === 'completed').length;
            const pendingTasks = userTasks.filter(t => t.status !== 'completed').length;
            const totalTasks = userTasks.length;
            const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0';
            
            return [
              collaborator.full_name,
              collaborator.email,
              totalTasks,
              completedTasks,
              pendingTasks,
              `${completionRate}%`
            ];
          })
        ];
        filename = 'performance-export';
        break;

      case 'analytics':
        // Weekly completion data
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          return date.toISOString().split('T')[0];
        });

        const weeklyData = last7Days.map(date => {
          const completedOnDate = tasks.filter(task => 
            task.completed_at && task.completed_at.split('T')[0] === date
          ).length;
          return [date, completedOnDate];
        });

        csvData = [
          ['Date', 'Tasks Completed'],
          ...weeklyData,
          [],
          ['Summary Statistics'],
          ['Total Tasks', stats.total_tasks || 0],
          ['Completed Tasks', stats.completed_tasks || 0],
          ['Pending Tasks', stats.pending_tasks || 0],
          ['Overdue Tasks', stats.overdue_tasks || 0],
          ['Completion Rate', stats.total_tasks > 0 ? `${((stats.completed_tasks / stats.total_tasks) * 100).toFixed(1)}%` : '0%']
        ];
        filename = 'analytics-export';
        break;

      default:
        return;
    }

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const generateReport = () => {
    // Generate a comprehensive text report
    const collaborators = users.filter(u => u.role === 'collaborator');
    const today = new Date().toLocaleDateString();
    
    let report = `COLLABORATOR TASK PLATFORM - MANAGEMENT REPORT\n`;
    report += `Generated on: ${today}\n`;
    report += `Report by: Yassine Bassoumi (YB)\n`;
    report += `${'='.repeat(50)}\n\n`;

    // Executive Summary
    report += `EXECUTIVE SUMMARY\n`;
    report += `-`.repeat(20) + '\n';
    report += `Total Tasks: ${stats.total_tasks || 0}\n`;
    report += `Completed: ${stats.completed_tasks || 0} (${stats.total_tasks > 0 ? ((stats.completed_tasks / stats.total_tasks) * 100).toFixed(1) : 0}%)\n`;
    report += `Pending: ${stats.pending_tasks || 0}\n`;
    report += `Overdue: ${stats.overdue_tasks || 0}\n`;
    report += `Active Collaborators: ${collaborators.length}\n\n`;

    // Team Performance
    report += `TEAM PERFORMANCE\n`;
    report += `-`.repeat(20) + '\n';
    collaborators.forEach(collaborator => {
      const userTasks = tasks.filter(t => t.assignee_id === collaborator.id);
      const completedTasks = userTasks.filter(t => t.status === 'completed').length;
      const totalTasks = userTasks.length;
      const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0';
      
      report += `${collaborator.full_name}:\n`;
      report += `  - Total Tasks: ${totalTasks}\n`;
      report += `  - Completed: ${completedTasks}\n`;
      report += `  - Completion Rate: ${completionRate}%\n\n`;
    });

    // Task Breakdown by Priority
    const highPriority = tasks.filter(t => t.priority === 'high').length;
    const mediumPriority = tasks.filter(t => t.priority === 'medium').length;
    const lowPriority = tasks.filter(t => t.priority === 'low').length;

    report += `TASK PRIORITY BREAKDOWN\n`;
    report += `-`.repeat(25) + '\n';
    report += `High Priority: ${highPriority}\n`;
    report += `Medium Priority: ${mediumPriority}\n`;
    report += `Low Priority: ${lowPriority}\n\n`;

    // Recent Activity (Last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    report += `RECENT ACTIVITY (LAST 7 DAYS)\n`;
    report += `-`.repeat(30) + '\n';
    last7Days.forEach(date => {
      const completedOnDate = tasks.filter(task => 
        task.completed_at && task.completed_at.split('T')[0] === date
      ).length;
      const formattedDate = new Date(date).toLocaleDateString();
      report += `${formattedDate}: ${completedOnDate} tasks completed\n`;
    });

    report += `\n${'='.repeat(50)}\n`;
    report += `End of Report - Collaborator Task Platform by YB\n`;

    // Download as text file
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `management-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button 
        onClick={() => exportToCSV('tasks')} 
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Export Tasks CSV
      </Button>
      
      <Button 
        onClick={() => exportToCSV('performance')} 
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Export Performance CSV
      </Button>
      
      <Button 
        onClick={() => exportToCSV('analytics')} 
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Export Analytics CSV
      </Button>
      
      <Button 
        onClick={generateReport} 
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        Generate Report
      </Button>
    </div>
  );
};

export default ExportManager;