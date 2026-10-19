import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from '../App';
import { 
  CheckCircle, 
  Clock, 
  LogOut,
  Bell,
  Award,
  TrendingUp,
  Calendar,
  BarChart3,
  User,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Star,
  Target
} from 'lucide-react';
import axios from 'axios';
import TaskList from './TaskList';
import NotificationPanel from './NotificationPanel';
import EnhancedCalendar from './EnhancedCalendar';
import { toast } from "sonner";

/* ✅ Helpers de scoring / évaluation ALIGNÉS avec TaskList & TaskDetails */

const isPositiveScore = (value) =>
  typeof value === 'number' && value > 0;

const isTaskEvaluated = (task) => {
  if (!task) return false;

  const hasAnyNumericScore =
    isPositiveScore(task.punctuality_score) ||
    isPositiveScore(task.quality_score) ||
    isPositiveScore(task.performance_rating);

  const hasFeedback =
    typeof task.feedback === 'string' && task.feedback.trim() !== '';

  const hasEvaluationDate =
    task.evaluation_date != null && String(task.evaluation_date).trim() !== '';

  return hasAnyNumericScore || hasFeedback || hasEvaluationDate;
};

const CollaboratorDashboard = () => {
  const { user, logout } = useAuth();

  const [stats, setStats] = useState({
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    not_evaluated_tasks: 0,
    avg_punctuality_score: 0,
    avg_quality_score: 0,
    evaluation_rate: 0
  });
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [error, setError] = useState('');
  const [calendarKey, setCalendarKey] = useState(0);
  const [activeTab, setActiveTab] = useState('tasks');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCheckedOverlaps, setHasCheckedOverlaps] = useState(false);

  const isFetchingRef = useRef(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const normalizeNotification = (notification) => {
    if (!notification) return null;
    
    return {
      ...notification,
      id: notification.id || notification._id,
      _mongoId: notification._id
    };
  };

  const updateNotificationLocally = (notificationId, updates) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, ...updates }
          : notif
      )
    );
  };

  const removeNotificationLocally = (notificationId) => {
    setNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
  };

  const markNotificationAsReadLocally = (notificationId) => {
    updateNotificationLocally(notificationId, { is_read: true });
  };

  const refreshNotificationsOnly = async () => {
    try {
      const timestamp = new Date().getTime();
      const response = await axios.get(`${API}/notifications?t=${timestamp}`, {
        headers: getAuthHeaders()
      });
      
      const normalizedNotifications = (response.data || [])
        .map(normalizeNotification)
        .filter(Boolean);
      
      setNotifications(normalizedNotifications);
    } catch (error) {
      console.error('❌ Error refreshing notifications:', error);
    }
  };

  const handleMarkNotificationAsRead = async (notificationId) => {
    try {
      console.log("📌 Collaborator: Marking notification as read:", notificationId);
      
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) {
        console.error('❌ Notification not found:', notificationId);
        return;
      }

      markNotificationAsReadLocally(notificationId);
      
      const mongoId = notification._mongoId || notification._id || notificationId;
      if (!mongoId) return;

      axios.put(
        `${API}/notifications/${mongoId}/read`,
        {},
        { headers: getAuthHeaders() }
      )
        .then(() => {
          console.log("✅ Notification marked as read on server");
        })
        .catch(error => {
          console.error('❌ Error marking notification as read on server:', error);
          updateNotificationLocally(notificationId, { is_read: false });
        });
        
    } catch (error) {
      console.error('Error in handleMarkNotificationAsRead:', error);
    }
  };

  const handleHideNotification = async (notificationId) => {
    try {
      console.log("👁️ Collaborator: Hiding notification:", notificationId);
      
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) {
        console.error('❌ Notification not found:', notificationId);
        return;
      }

      removeNotificationLocally(notificationId);
      
      const mongoId = notification._mongoId || notification._id || notificationId;
      if (!mongoId) return;
      
      axios.put(
        `${API}/notifications/${mongoId}`,
        {
          is_archived: true,
          is_read: true
        },
        { headers: getAuthHeaders() }
      )
        .then(() => {
          console.log("✅ Notification hidden on server");
        })
        .catch(error => {
          console.error('❌ Error hiding notification on server:', error);
          setNotifications(prev => [...prev, notification]);
        });
        
    } catch (error) {
      console.error('Error in handleHideNotification:', error);
    }
  };

  const handleNotificationUpdate = () => {
    refreshNotificationsOnly();
  };

  const taskStats = useMemo(() => {
    // On considère "completed" = tâches terminées (évaluées ou en attente d'évaluation)
    const completed = tasks.filter(t => t.status === 'completed').length;
    const notEvaluatedStatus = tasks.filter(t => t.status === 'not_evaluated').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    const totalCompleted = completed + notEvaluatedStatus;

    return {
      completed: totalCompleted,
      notEvaluated: notEvaluatedStatus,
      inProgress,
      pending,
      completionRate: tasks.length > 0 ? Math.round((totalCompleted / tasks.length) * 100) : 0,
      evaluationRate: totalCompleted > 0 ? Math.round((completed / totalCompleted) * 100) : 0
    };
  }, [tasks]);

  // ✅ ALIGNÉ avec TaskList / TaskDetails : "waiting evaluation" = complétée mais PAS évaluée
  const unevaluatedTasks = useMemo(
    () => tasks.filter(task => 
      task &&
      (task.status === 'not_evaluated' || task.status === 'completed') &&
      !isTaskEvaluated(task)
    ),
    [tasks]
  );

  const overallScoreStats = useMemo(() => {
    if (!performance || performance.length === 0) {
      return { average: 0, count: 0 };
    }

    let total = 0;
    let count = 0;

    performance.forEach((evaluation) => {
      const p = Number(evaluation.punctuality_score);
      const q = Number(evaluation.quality_score);
      const overall = Number(
        evaluation.overall_score ?? evaluation.performance_rating
      );

      if (!isNaN(overall)) {
        total += overall;
        count += 1;
      } else if (!isNaN(p) && !isNaN(q)) {
        total += (p + q) / 2;
        count += 1;
      }
    });

    const avg = count > 0 ? total / count : 0;

    return { average: avg, count };
  }, [performance]);

  const updateStatsAfterCompletion = () => {
    setStats(prevStats => ({
      ...prevStats,
      completed_tasks: (prevStats.completed_tasks || 0) + 1,
      not_evaluated_tasks: (prevStats.not_evaluated_tasks || 0) + 1
    }));
  };

  useEffect(() => {
    if (!loading && performance.length > 0) {
      const recentEvaluations = performance.filter(evaluation => {
        const evalDate = new Date(evaluation.created_at);
        const now = new Date();
        const hoursDiff = (now - evalDate) / (1000 * 60 * 60);
        return hoursDiff < 24;
      });

      if (recentEvaluations.length > 0) {
        const latestEval = recentEvaluations[0];
        toast.success(
          `🎉 New evaluation received! Punctuality ${latestEval.punctuality_score}/5, Quality ${latestEval.quality_score}/5`,
          {
            duration: 6000,
            action: {
              label: 'View',
              onClick: () => setActiveTab('performance')
            }
          }
        );
      }
    }
  }, [loading, performance]);

  const convertedMeetings = useMemo(() => {
    if (!meetings || !Array.isArray(meetings)) {
      return [];
    }

    const validMeetings = meetings
      .filter(meeting => meeting && typeof meeting === 'object')
      .map(meeting => {
        try {
          let startDate, endDate;
          
          if (meeting.meeting_date && meeting.start_time && meeting.end_time) {
            const meetingDate = new Date(meeting.meeting_date);
            if (isNaN(meetingDate.getTime())) {
              throw new Error(`Invalid meeting_date: ${meeting.meeting_date}`);
            }

            const startTimeParts = meeting.start_time.split(':');
            const endTimeParts = meeting.end_time.split(':');
            
            if (startTimeParts.length !== 2 || endTimeParts.length !== 2) {
              throw new Error(`Invalid time format: ${meeting.start_time} - ${meeting.end_time}`);
            }

            const startHours = parseInt(startTimeParts[0], 10);
            const startMinutes = parseInt(startTimeParts[1], 10);
            const endHours = parseInt(endTimeParts[0], 10);
            const endMinutes = parseInt(endTimeParts[1], 10);

            if (
              isNaN(startHours) || isNaN(startMinutes) ||
              isNaN(endHours) || isNaN(endMinutes)
            ) {
              throw new Error(`Invalid time values: ${meeting.start_time} - ${meeting.end_time}`);
            }

            startDate = new Date(meetingDate);
            startDate.setHours(startHours, startMinutes, 0, 0);
            
            endDate = new Date(meetingDate);
            endDate.setHours(endHours, endMinutes, 0, 0);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              throw new Error('Date conversion resulted in invalid dates');
            }
          } else if (meeting.start && meeting.end) {
            startDate = new Date(meeting.start);
            endDate = new Date(meeting.end);
          } else {
            startDate = new Date();
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          }
          
          return {
            id: meeting.id,
            title: meeting.title || 'Untitled Meeting',
            start: startDate,
            end: endDate,
            type: 'meeting',
            status: meeting.status || 'pending',
            organizer: meeting.organizer_name,
            organizer_id: meeting.organizer_id || null,
            location: meeting.location,
            start_time: meeting.start_time,
            end_time: meeting.end_time,
            meeting_date: meeting.meeting_date,
            participant_ids: meeting.participant_ids || [],
            participant_names: meeting.participant_names || [],
            participant_responses: meeting.participant_responses || {},
            organizer_name: meeting.organizer_name || 'Manager',
            description: meeting.description || ''
          };
        } catch (error) {
          console.error(`Error processing meeting ${meeting.id}:`, error);
          
          const fallbackStart = new Date();
          const fallbackEnd = new Date(fallbackStart.getTime() + 60 * 60 * 1000);
          
          return {
            ...meeting,
            id: meeting.id || `error-${Date.now()}`,
            title: meeting.title || 'Meeting (Date Error)',
            start: fallbackStart,
            end: fallbackEnd,
            type: 'meeting',
            status: meeting.status || 'error',
            organizer_name: meeting.organizer_name || 'Manager',
            organizer_id: meeting.organizer_id || null,
            participant_ids: meeting.participant_ids || [],
            _hasError: true
          };
        }
      });

    return validMeetings;
  }, [meetings]);

  const overlappingMeetings = useMemo(() => {
    if (!convertedMeetings || convertedMeetings.length === 0) {
      return [];
    }

    const overlaps = [];
    const validMeetings = convertedMeetings.filter(meeting => 
      meeting &&
      meeting.start &&
      meeting.end && 
      !isNaN(meeting.start.getTime()) && 
      !isNaN(meeting.end.getTime())
    );

    if (validMeetings.length === 0) return [];

    const sortedMeetings = [...validMeetings].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sortedMeetings.length - 1; i++) {
      const meetingA = sortedMeetings[i];
      
      for (let j = i + 1; j < sortedMeetings.length; j++) {
        const meetingB = sortedMeetings[j];
        
        if (meetingB.start < meetingA.end) {
          overlaps.push({
            meeting1: meetingA,
            meeting2: meetingB,
            overlapDuration: Math.max(
              0, 
              Math.min(meetingA.end, meetingB.end) - Math.max(meetingA.start, meetingB.start)
            )
          });
        } else {
          break;
        }
      }
    }
    
    return overlaps;
  }, [convertedMeetings]);

  useEffect(() => {
    if (!loading && convertedMeetings.length > 0 && !hasCheckedOverlaps) {
      if (overlappingMeetings.length > 0) {
        toast.warning(`⚠️ ${overlappingMeetings.length} meeting overlap(s) detected`);
      }
      setHasCheckedOverlaps(true);
    }
  }, [loading, convertedMeetings, overlappingMeetings, hasCheckedOverlaps]);

  useEffect(() => {
    if (user && user.id) {
      fetchDashboardData();
    }
    // eslint-disable-next-line
  }, [user]);

  const mergeTasksWithEvaluations = (tasksData, performanceData) => {
    if (!Array.isArray(tasksData) || !Array.isArray(performanceData)) {
      return {
        mergedTasks: tasksData || [],
        performanceWithTaskInfo: []
      };
    }

    const latestEvalByTask = {};

    performanceData.forEach((evaluation) => {
      const taskId = evaluation.task_id || evaluation.taskId || evaluation.task?.id;
      if (!taskId) return;

      const existing = latestEvalByTask[taskId];
      const currentDate = evaluation.created_at ? new Date(evaluation.created_at) : null;
      const existingDate = existing?.created_at ? new Date(existing.created_at) : null;

      if (!existing || (currentDate && (!existingDate || currentDate > existingDate))) {
        latestEvalByTask[taskId] = evaluation;
      }
    });

    const toNumber = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    const mergedTasks = tasksData.map((task) => {
      const evalData = latestEvalByTask[task.id];
      if (!evalData) return task;

      const punctuality = toNumber(
        evalData.punctuality_score ?? task.punctuality_score
      );
      const quality = toNumber(
        evalData.quality_score ?? task.quality_score
      );
      const overall = toNumber(
        evalData.overall_score ??
        evalData.performance_rating ??
        task.performance_rating
      );

      const hasScores =
        (punctuality !== null && punctuality > 0) ||
        (quality !== null && quality > 0) ||
        (overall !== null && overall > 0);

      let effectiveStatus =
        task.status ||
        evalData.task_status ||
        evalData.status ||
        'pending';

      if (hasScores) {
        effectiveStatus = 'completed';
      }

      return {
        ...task,
        punctuality_score: punctuality,
        quality_score: quality,
        performance_rating: overall,
        feedback: evalData.comments ?? evalData.feedback ?? task.feedback,
        evaluation_date: evalData.created_at ?? task.evaluation_date,
        status: effectiveStatus
      };
    });

    const latestEvaluationsArray = Object.values(latestEvalByTask);

    const performanceWithTaskInfo = latestEvaluationsArray.map((ev) => {
      const taskId = ev.task_id || ev.taskId || ev.task?.id;
      const task = mergedTasks.find(t => t.id === taskId);
      if (!task) return ev;

      const effectiveStatus =
        task.status ||
        ev.task_status ||
        ev.status;

      return {
        ...ev,
        task_title: ev.task_title || task.title,
        task_status: effectiveStatus,
      };
    });

    return { mergedTasks, performanceWithTaskInfo };
  };

  const fetchDashboardData = async () => {
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError('');
      setHasCheckedOverlaps(false);
      
      const timestamp = new Date().getTime();
      const headers = getAuthHeaders();
      
      const results = await Promise.allSettled([
        axios.get(`${API}/dashboard/stats/${user.id}?t=${timestamp}`, { headers }),
        axios.get(`${API}/tasks/user/${user.id}?t=${timestamp}`, { headers }),
        axios.get(`${API}/performance/${user.id}?t=${timestamp}`, { headers }),
        axios.get(`${API}/notifications?t=${timestamp}`, { headers }),
        axios.get(`${API}/meetings/user/${user.id}?t=${timestamp}`, { headers }),
        axios.get(`${API}/users?t=${timestamp}`, { headers })
      ]);

      const [
        statsRes, 
        tasksRes, 
        performanceRes, 
        notificationsRes, 
        meetingsRes, 
        collaboratorsRes
      ] = results;

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value.data;
        setStats({
          ...statsData,
          not_evaluated_tasks: statsData.not_evaluated_tasks || 0,
          evaluation_rate: statsData.evaluation_rate || 0
        });
      }

      let tasksData = [];
      let performanceData = [];

      if (tasksRes.status === 'fulfilled') {
        tasksData = tasksRes.value.data || [];
      }

      if (performanceRes.status === 'fulfilled') {
        performanceData = performanceRes.value.data || [];
      }

      const { mergedTasks, performanceWithTaskInfo } = mergeTasksWithEvaluations(tasksData, performanceData);

      setTasks(mergedTasks);
      setPerformance(performanceWithTaskInfo);

      if (notificationsRes.status === 'fulfilled') {
        const notificationsData = notificationsRes.value.data || [];
        const normalizedNotifications = notificationsData.map(normalizeNotification).filter(Boolean);
        setNotifications(normalizedNotifications);
      }

      if (meetingsRes.status === 'fulfilled') {
        setMeetings(meetingsRes.value.data || []);
      }

      if (collaboratorsRes.status === 'fulfilled') {
        setCollaborators(collaboratorsRes.value.data || []);
      }

      const errors = results.filter(result => result.status === 'rejected');
      if (errors.length > 0) {
        console.warn(`${errors.length} requests failed:`, errors);
        
        const authError = errors.find(error => 
          error.reason?.response?.status === 401 || 
          error.reason?.message?.includes('401')
        );
        
        if (authError) {
          setError('Session expired. Please log in again.');
          toast.error('Session expired. Please log in again.');
          setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }, 3000);
        }
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      if (error.response?.status === 401) {
        setError('Session expired. Please log in again.');
        toast.error('Session expired. Please log in again.');
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 3000);
      } else {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to load dashboard data';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const refreshTasksAndPerformance = async () => {
    try {
      const timestamp = new Date().getTime();
      const headers = getAuthHeaders();

      const [tasksRes, performanceRes] = await Promise.all([
        axios.get(`${API}/tasks/user/${user.id}?t=${timestamp}`, { headers }),
        axios.get(`${API}/performance/${user.id}?t=${timestamp}`, { headers })
      ]);

      const tasksData = tasksRes.data || [];
      const performanceData = performanceRes.data || [];

      const { mergedTasks, performanceWithTaskInfo } = mergeTasksWithEvaluations(tasksData, performanceData);

      setTasks(mergedTasks);
      setPerformance(performanceWithTaskInfo);
    } catch (error) {
      console.error('Error refreshing tasks/performance:', error);
      toast.error("Failed to refresh tasks");
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await fetchDashboardData();
      toast.success("Dashboard refreshed");
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      const errorMessage = error.response?.data?.message || error.message || "Error refreshing dashboard";
      toast.error(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCalendarRefresh = async () => {
    try {
      setIsRefreshing(true);
      const timestamp = new Date().getTime();
      
      const meetingsResponse = await axios.get(
        `${API}/meetings/user/${user.id}?t=${timestamp}`,
        { headers: getAuthHeaders() }
      );
      const newMeetings = meetingsResponse.data || [];
      
      setMeetings(newMeetings);
      setCalendarKey(prev => prev + 1);
      setHasCheckedOverlaps(false);
      
      toast.success("Calendar refreshed");
      
    } catch (error) {
      console.error('Error refreshing calendar:', error);
      toast.error("Error refreshing calendar");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMeetingUpdate = async () => {
    await handleCalendarRefresh();
  };

  const handleTaskCompletion = async (taskId) => {
    try {
      const response = await axios.put(
        `${API}/tasks/${taskId}`,
        {
          status: 'not_evaluated',
          completed_at: new Date().toISOString()
        },
        { headers: getAuthHeaders() }
      );

      if (response.status === 200) {
        const updatedFromServer = response.data || {};

        toast.success("Task completed! Waiting for manager evaluation");

        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { 
                  ...task, 
                  ...updatedFromServer,
                  status: updatedFromServer.status || 'not_evaluated',
                  completed_at: updatedFromServer.completed_at || new Date().toISOString() 
                }
              : task
          )
        );

        updateStatsAfterCompletion();
      }
    } catch (error) {
      console.error('Error completing task:', error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to complete task";
      toast.error(errorMessage);
    }
  };

  const handleTaskUpdated = (updatedTask) => {
    if (updatedTask && updatedTask.id) {
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        )
      );
    } else {
      refreshTasksAndPerformance();
    }
  };

  const getTaskTitleForEvaluation = (evaluation) => {
    if (!evaluation) return 'Task';

    if (evaluation.task_title) return evaluation.task_title;

    if (evaluation.task && evaluation.task.title) return evaluation.task.title;

    if (evaluation.task_id && tasks && tasks.length > 0) {
      const found = tasks.find(t => t.id === evaluation.task_id);
      if (found && found.title) return found.title;
    }

    if (evaluation.taskId && tasks && tasks.length > 0) {
      const found = tasks.find(t => t.id === evaluation.taskId);
      if (found && found.title) return found.title;
    }

    return evaluation.task_id 
      ? `Task ${evaluation.task_id}` 
      : 'Task';
  };

  const hasEvaluationScores = (evaluation) => {
    if (!evaluation) return false;
    const p = Number(evaluation.punctuality_score);
    const q = Number(evaluation.quality_score);
    const overall = Number(
      evaluation.overall_score ?? evaluation.performance_rating
    );

    return (
      (!isNaN(p) && p > 0) ||
      (!isNaN(q) && q > 0) ||
      (!isNaN(overall) && overall > 0)
    );
  };

  const formatTaskStatus = (status, evaluation) => {
    const hasScores = hasEvaluationScores(evaluation);

    if (!status) {
      return hasScores ? 'Completed & Evaluated' : null;
    }

    switch (status) {
      case 'completed':
        return hasScores ? 'Completed & Evaluated' : 'Completed';
      case 'not_evaluated':
        return hasScores
          ? 'Completed & Evaluated'
          : 'Completed (Not Evaluated)';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
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
              {unevaluatedTasks.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative text-amber-600 hover:text-amber-700"
                  onClick={() => {
                    setActiveTab('tasks');
                    setTimeout(() => {
                      toast.info(
                        `Showing ${unevaluatedTasks.length} task(s) waiting for manager evaluation`
                      );
                    }, 500);
                  }}
                >
                  <Star className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unevaluatedTasks.length}
                  </span>
                </Button>
              )}

              {overlappingMeetings.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative text-amber-600 hover:text-amber-700"
                  onClick={() => toast.warning(`You have ${overlappingMeetings.length} overlapping meeting(s)`)}
                >
                  <AlertTriangle className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {overlappingMeetings.length}
                  </span>
                </Button>
              )}

              <Button
                onClick={() => setShowNotifications(true)}
                variant="ghost"
                size="sm"
                className="relative"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>

              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button
                onClick={logout}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        {error && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
            <p className="text-yellow-700">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </p>
            <Button 
              onClick={fetchDashboardData} 
              variant="outline" 
              size="sm" 
              className="ml-4"
              disabled={isFetchingRef.current}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetchingRef.current ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/60 border-slate-200/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">My Tasks</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {tasks.length}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span>{taskStats.completed} completed</span>
              </div>
              {unevaluatedTasks.length > 0 && (
                <div className="mt-2 flex items-center text-sm text-amber-600">
                  <Star className="h-4 w-4 mr-1" />
                  <span>{unevaluatedTasks.length} waiting evaluation</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/60 border-slate-200/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Completion Rate</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {taskStats.completionRate}%
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4">
                <Progress value={taskStats.completionRate} className="h-2 bg-slate-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 border-slate-200/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Punctuality</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.avg_punctuality_score > 0 ? `${stats.avg_punctuality_score}/5` : '0/5'}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4">
                <Progress 
                  value={(stats.avg_punctuality_score || 0) * 20} 
                  className="h-2 bg-slate-200" 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 border-slate-200/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Quality</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {stats.avg_quality_score > 0 ? `${stats.avg_quality_score}/5` : '0/5'}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Award className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4">
                <Progress 
                  value={(stats.avg_quality_score || 0) * 20} 
                  className="h-2 bg-slate-200" 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/80 border border-slate-200/50">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-50">
              <Calendar className="h-4 w-4 mr-2" />
              My Tasks ({tasks.length})
              {unevaluatedTasks.length > 0 && (
                <span className="ml-1 text-amber-600">⭐</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-blue-50">
              <CheckCircle className="h-4 w-4 mr-2" />
              Calendar ({convertedMeetings.length})
              {overlappingMeetings.length > 0 && (
                <span className="ml-1 text-amber-600">⚠️</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-blue-50">
              <BarChart3 className="h-4 w-4 mr-2" />
              Performance ({performance.length})
              {performance.length > 0 && (
                <span className="ml-1 text-green-600">📈</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card className="border-slate-200/50">
              <CardHeader>
                <CardTitle>
                  My Tasks ({tasks.length})
                  {unevaluatedTasks.length > 0 && (
                    <Badge 
                      variant="outline" 
                      className="ml-2 bg-amber-50 text-amber-700 border-amber-200"
                    >
                      <Star className="h-3 w-3 mr-1" />
                      {unevaluatedTasks.length} waiting evaluation
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {tasks.length === 0 ? "No tasks assigned yet" : "Track your assigned tasks"}
                  {unevaluatedTasks.length > 0 && (
                    <span className="text-amber-600 ml-2">
                      • {unevaluatedTasks.length} task(s) completed and waiting for manager evaluation
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length > 0 ? (
                  <TaskList 
                    tasks={tasks} 
                    onTaskUpdate={handleTaskUpdated}
                    userRole="collaborator"
                    onTaskCompletion={handleTaskCompletion}
                  />
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks assigned yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card className="border-slate-200/50">
              <CardHeader>
                <CardTitle>
                  My Calendar ({convertedMeetings.length})
                  {overlappingMeetings.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-amber-600 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      {overlappingMeetings.length} overlap(s) detected
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {convertedMeetings.length === 0 
                    ? "No meetings scheduled" 
                    : "View your scheduled meetings"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnhancedCalendar 
                  key={`calendar-${calendarKey}`}
                  events={convertedMeetings}
                  userRole="collaborator"
                  onMeetingUpdate={handleMeetingUpdate}
                  collaborators={collaborators}
                  currentUser={user}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card className="border-slate-200/50">
              <CardHeader>
                <CardTitle>
                  Performance History ({performance.length})
                  {stats.evaluation_rate > 0 && (
                    <Badge 
                      variant="outline" 
                      className="ml-2 bg-green-50 text-green-700 border-green-200"
                    >
                      <Target className="h-3 w-3 mr-1" />
                      {stats.evaluation_rate}% evaluation rate
                    </Badge>
                  )}
                  {overallScoreStats.count > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-200"
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Avg score {overallScoreStats.average.toFixed(1)}/5
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {performance.length === 0 
                    ? "No evaluations yet" 
                    : "Your performance evaluations from completed tasks"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overallScoreStats.count > 0 && (
                  <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-blue-100">
                      <CardContent className="p-4">
                        <p className="text-xs font-medium text-slate-600">
                          Overall Performance Score
                        </p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                          {overallScoreStats.average.toFixed(1)}/5
                        </p>
                        <Progress
                          value={overallScoreStats.average * 20}
                          className="h-2 mt-3 bg-slate-200"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          Based on {overallScoreStats.count} evaluated task(s)
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {performance.length > 0 ? (
                  <div className="space-y-4">
                    {performance.map((evaluation) => {
                      const taskTitle = getTaskTitleForEvaluation(evaluation);
                      const taskStatusLabel = formatTaskStatus(
                        evaluation.task_status || evaluation.status,
                        evaluation
                      );

                      const punctualityValue = Number(evaluation.punctuality_score || 0);
                      const qualityValue = Number(evaluation.quality_score || 0);

                      return (
                        <Card 
                          key={evaluation.id} 
                          className="border-l-4 border-l-green-500"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <Award className="h-5 w-5 text-blue-600" />
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {taskTitle}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    Task ID: {evaluation.task_id || '—'} • Evaluated on{" "}
                                    {evaluation.created_at
                                      ? new Date(evaluation.created_at).toLocaleDateString()
                                      : '—'}
                                  </p>
                                </div>
                              </div>

                              {taskStatusLabel && (
                                <Badge 
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200"
                                >
                                  {taskStatusLabel}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-3">
                              <div>
                                <p className="text-sm font-medium">Punctuality</p>
                                <div className="flex items-center mt-1">
                                  <Progress 
                                    value={punctualityValue * 20} 
                                    className="h-2 flex-1 mr-2" 
                                  />
                                  <span className="text-sm font-medium">
                                    {punctualityValue > 0 ? `${punctualityValue}/5` : '—'}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Quality</p>
                                <div className="flex items-center mt-1">
                                  <Progress 
                                    value={qualityValue * 20} 
                                    className="h-2 flex-1 mr-2" 
                                  />
                                  <span className="text-sm font-medium">
                                    {qualityValue > 0 ? `${qualityValue}/5` : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {evaluation.comments && (
                              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                <p className="text-sm text-slate-700">
                                  {evaluation.comments}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No performance evaluations yet</p>
                    <p className="text-sm mt-2">
                      Complete tasks to receive evaluations from your manager
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {showNotifications && (
        <NotificationPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onNotificationUpdate={handleNotificationUpdate}
          onMarkAsRead={handleMarkNotificationAsRead}
          onDeleteNotification={handleHideNotification}
        />
      )}
    </div>
  );
};

export default CollaboratorDashboard;
