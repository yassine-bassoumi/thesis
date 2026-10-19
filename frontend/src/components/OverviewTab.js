// src/components/OverviewTab.js
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, CheckCircle, Clock, ArrowRight } from 'lucide-react';

// 🎨 Styles des badges de priorité
const getPriorityBadgeProps = (priority) => {
  switch (priority) {
    case 'high':
      return {
        variant: 'destructive',
        className: '',
        label: 'High',
      };
    case 'medium':
      return {
        variant: 'outline',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        label: 'Medium',
      };
    case 'low':
      return {
        variant: 'outline',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        label: 'Low',
      };
    default:
      return {
        variant: 'outline',
        className: 'bg-slate-50 text-slate-700 border-slate-200',
        label: priority || 'N/A',
      };
  }
};

const OverviewTab = ({ stats, tasks, users, meetings, onShowCreateTask, onShowCreateMeeting, onViewAllTasks }) => {
  // Tâches récentes (5 maximum)
  const recentTasks = tasks.slice(0, 5);

  // Meetings à venir (nouvelle structure)
  const upcomingMeetings = meetings
    .filter(meeting => {
      try {
        if (meeting.meeting_date && meeting.start_time) {
          const meetingDateTime = new Date(`${meeting.meeting_date}T${meeting.start_time}`);
          return meetingDateTime > new Date();
        } else if (meeting.start) {
          return new Date(meeting.start) > new Date();
        }
        return false;
      } catch {
        return false;
      }
    })
    .slice(0, 5);

  const formatMeetingDateTime = (meeting) => {
    try {
      if (meeting.meeting_date && meeting.start_time && meeting.end_time) {
        const meetingDate = new Date(meeting.meeting_date);
        const formattedDate = meetingDate.toLocaleDateString('fr-FR', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        return `${formattedDate} • ${meeting.start_time} - ${meeting.end_time}`;
      } else if (meeting.start && meeting.end) {
        const startDate = new Date(meeting.start);
        const endDate = new Date(meeting.end);
        const formattedDate = startDate.toLocaleDateString('fr-FR', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const startTime = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const endTime = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `${formattedDate} • ${startTime} - ${endTime}`;
      }
      return 'Date and time not specified';
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Total Tasks</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_tasks || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Completed</p>
                <p className="text-2xl font-bold text-slate-900">{stats.completed_tasks || 0}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Team Members</p>
                <p className="text-2xl font-bold text-slate-900">
                  {users.filter(u => u.role === 'collaborator').length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Meetings</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_meetings || 0}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Latest assigned tasks</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAllTasks}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <span>View All Tasks</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTasks.length > 0 ? (
                recentTasks.map((task) => {
                  const { variant, className, label } = getPriorityBadgeProps(task.priority);

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            task.status === 'completed'
                              ? 'bg-green-500'
                              : task.status === 'overdue'
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }`}
                        />
                        <div>
                          <p className="font-medium text-sm">{task.title}</p>
                          <p className="text-xs text-slate-500">
                            Due:{' '}
                            {task.due_date
                              ? new Date(task.due_date).toLocaleDateString()
                              : 'Not set'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={variant} className={className}>
                        {label}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No tasks yet</p>
                  <Button
                    onClick={onShowCreateTask}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Task
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your team efficiently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                onClick={onShowCreateTask}
                className="w-full justify-start h-12"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Task
              </Button>
              <Button
                onClick={onShowCreateMeeting}
                className="w-full justify-start h-12"
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
              <Button
                onClick={onViewAllTasks}
                className="w-full justify-start h-12"
                variant="outline"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                View All Tasks
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
          <CardDescription>Next scheduled meetings with your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingMeetings.length > 0 ? (
              upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        meeting.status === 'accepted'
                          ? 'bg-green-500'
                          : meeting.status === 'declined'
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{meeting.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatMeetingDateTime(meeting)}
                      </p>
                      {meeting.location && meeting.location !== 'Virtual' && (
                        <p className="text-xs text-slate-400 mt-1">📍 {meeting.location}</p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      meeting.status === 'accepted'
                        ? 'default'
                        : meeting.status === 'declined'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {meeting.status || 'scheduled'}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-500">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No upcoming meetings</p>
                <Button
                  onClick={onShowCreateMeeting}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Your First Meeting
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewTab;
