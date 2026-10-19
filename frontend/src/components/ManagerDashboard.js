// src/components/ManagerDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, API } from '../App';
import AnalyticsDashboard from './AnalyticsDashboard';
import RealTimeMetrics from './RealTimeMetrics';
import TaskTemplates from './TaskTemplates';
import TaskList from './TaskList';
import KanbanView from './KanbanView';
import FilterTasks from './FilterTasks';
import EnhancedCalendar from './EnhancedCalendar';
import CreateMeetingModal from './CreateMeetingModal';
import PerformanceEvaluationModal from './PerformanceEvaluationModal';
import NotificationPanel from './NotificationPanel';
import OverviewTab from './OverviewTab';
import { toast } from "sonner";

import { 
  Users, 
  Plus, 
  BarChart3, 
  LogOut,
  Bell,
  Calendar as CalendarIcon,
  Calendar,
  FileText,
  Home,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Star,
  Award
} from 'lucide-react';
import axios from 'axios';
import CreateTaskModal from './CreateTaskModal';

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const locationState = location.state || {};
  const initialTab = locationState.tab || 'overview';
  const initialTasksView = locationState.viewType || 'list';

  const [stats, setStats] = useState({
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    not_evaluated_tasks: 0,
    total_meetings: 0,
    scheduled_meetings: 0,
    pending_meetings: 0,
    declined_meetings: 0,
    avg_punctuality_score: 0,
    avg_quality_score: 0,
    evaluation_rate: 0
  });
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [evaluationModal, setEvaluationModal] = useState({
    isOpen: false,
    task: null,
    collaborator: null
  });
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tasksView, setTasksView] = useState(initialTasksView);
  const [calendarKey, setCalendarKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [shownToasts, setShownToasts] = useState({
    evaluation: false,
    overlaps: false,
    performance: false
  });

  // ✅ même logique que KanbanView / EditTaskModal
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

  // ✅ Normalize notifications - VERSION CORRIGÉE
const normalizeNotification = (notification) => {
  if (!notification) return null;
  
  // Le backend retourne 'id' qui est déjà une string (ObjectId converti en string)
  // Il retourne aussi '_id' en tant qu'ObjectId
  const notificationId = notification.id || notification._id;
  
  return {
    ...notification,
    id: notificationId,  // Toujours 'id' comme clé principale
    _id: notification._id || notificationId,  // Garder _id si disponible
    _mongoId: notification._id || notificationId  // Pour compatibilité
  };
};

  // ✅ Refresh notifications only
  const refreshNotificationsOnly = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const timestamp = new Date().getTime();
      const response = await axios.get(`${API}/notifications?t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const normalizedNotifications = (response.data || [])
        .map(normalizeNotification)
        .filter(Boolean);
      
      setNotifications(normalizedNotifications);
    } catch (error) {
      console.error('❌ Error refreshing notifications:', error);
    }
  }, []);

  // ✅ Refresh only tasks
  const refreshTasksOnly = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const timestamp = new Date().getTime();
      const response = await axios.get(`${API}/tasks?t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const tasksData = response.data || [];
      setTasks(tasksData);
      setFilteredTasks(tasksData); // 🔄 garder la vue cohérente
    } catch (error) {
      console.error('Error refreshing tasks:', error);
    }
  }, []);

  const handleNotificationUpdate = () => {
    refreshNotificationsOnly();
  };

  // ✅ Mark notification as read
  const handleMarkNotificationAsRead = async (notificationId) => {
    try {
      console.log("📌 ManagerDashboard - Marking notification as read:", notificationId);
      
      const originalNotification = notifications.find(n => n.id === notificationId);
      
      if (!originalNotification) {
        console.error('❌ Notification not found in ManagerDashboard:', notificationId);
        return;
      }
      
      // Optimistic update
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, is_read: true }
            : notif
        )
      );
      
      const mongoId = originalNotification._mongoId || originalNotification._id || notificationId;
      const token = localStorage.getItem('token');
      
      if (mongoId && token) {
        axios.put(
          `${API}/notifications/${mongoId}/read`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        .then(() => {
          console.log("✅ Notification marked as read on server");
        })
        .catch(error => {
          console.error('❌ Error marking notification as read:', error);
          refreshNotificationsOnly();
        });
      }
    } catch (error) {
      console.error('Error in handleMarkNotificationAsRead:', error);
    }
  };

  // ✅ Delete notification - VERSION CORRIGÉE
const handleDeleteNotification = async (notificationId) => {
  try {
    console.log("🗑️ ManagerDashboard - Deleting notification:", notificationId);
    console.log("📋 Available notifications:", notifications.map(n => ({ id: n.id, _id: n._id, _mongoId: n._mongoId })));
    
    const originalNotification = notifications.find(n => n.id === notificationId);
    
    if (!originalNotification) {
      console.error('❌ Notification not found for deletion:', notificationId);
      toast.error('Notification not found');
      return;
    }
    
    // 🔥 UTILISEZ DIRECTEMENT notificationId (déjà string)
    // Le backend attend une string (ObjectId converti en string)
    console.log("🔍 Using ID for deletion (string):", notificationId);
    console.log("🔍 Original notification details:", {
      id: originalNotification.id,
      _id: originalNotification._id,
      _mongoId: originalNotification._mongoId,
      title: originalNotification.title,
      user_id: originalNotification.user_id
    });
    
    // Optimistic remove IMMÉDIAT
    setNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
    
    const token = localStorage.getItem('token');
    
    if (!token) {
      toast.error('Authentication required');
      // Restaurer la notification
      refreshNotificationsOnly();
      return;
    }
    
    // Appel API avec notificationId (string)
    try {
      const response = await axios.delete(`${API}/notifications/${notificationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log("✅ Notification deleted successfully:", response.data);
      
    } catch (error) {
      console.error('❌ Error deleting notification:', error.response || error);
      
      // Restaurer la notification en cas d'erreur
      refreshNotificationsOnly();
      
      // Message d'erreur détaillé
      const errorMsg = error.response?.data?.detail || 
                      error.response?.data?.message || 
                      'Failed to delete notification';
      toast.error(`Error: ${errorMsg}`);
    }
    
  } catch (error) {
    console.error('❌ Error in handleDeleteNotification:', error);
    toast.error('An unexpected error occurred');
  }
};

  // ✅ Task updated - instant update (pas de refresh global)
  const handleTaskUpdated = (updatedTask) => {
    if (updatedTask && updatedTask.id) {
      try {
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === updatedTask.id ? updatedTask : task
          )
        );
        setFilteredTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === updatedTask.id ? updatedTask : task
          )
        );
        
        // ✅ Rafraîchir les notifications après modification
        refreshNotificationsOnly();
      } catch (error) {
        console.error('❌ Error in handleTaskUpdated:', error);
      }
    } else {
      refreshTasksOnly();
      refreshNotificationsOnly();
    }
  };

  // ✅ Task deleted - instant update
  const handleTaskDeleted = (taskId) => {
    if (!taskId) {
      console.error('❌ Invalid task ID for deletion');
      return;
    }
    
    try {
      const deletedTask = tasks.find(task => task.id === taskId);
      
      if (!deletedTask) {
        console.error('❌ Task not found for deletion:', taskId);
        return;
      }
      
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      setFilteredTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      
      setStats(prevStats => ({
        ...prevStats,
        total_tasks: Math.max(0, (prevStats.total_tasks || 0) - 1),
        completed_tasks: deletedTask.status === 'completed' 
          ? Math.max(0, (prevStats.completed_tasks || 0) - 1) 
          : prevStats.completed_tasks,
        pending_tasks: (deletedTask.status === 'pending' || deletedTask.status === 'in_progress') 
          ? Math.max(0, (prevStats.pending_tasks || 0) - 1) 
          : prevStats.pending_tasks,
        not_evaluated_tasks: deletedTask.status === 'not_evaluated'
          ? Math.max(0, (prevStats.not_evaluated_tasks || 0) - 1)
          : prevStats.not_evaluated_tasks
      }));

      // ✅ Rafraîchir les notifications après suppression
      refreshNotificationsOnly();
      
    } catch (error) {
      console.error('❌ Error in handleTaskDeleted:', error);
    }
  };

  // ✅ Task created - instant update
  const handleTaskCreated = (newTask = null) => {
    setShowCreateTask(false);
    
    if (newTask && newTask.id) {
      setTasks(prevTasks => [...prevTasks, newTask]);
      setFilteredTasks(prevTasks => [...prevTasks, newTask]);
      setStats(prevStats => ({
        ...prevStats,
        total_tasks: (prevStats.total_tasks || 0) + 1,
        pending_tasks: (prevStats.pending_tasks || 0) + 1
      }));
      
      // ✅ Rafraîchir les notifications après création
      refreshNotificationsOnly();
    } else {
      fetchDashboardData();
    }
  };

  // ✅ Meeting created - instant update
  const handleMeetingCreated = (newMeeting = null) => {
    setShowCreateMeeting(false);
    
    if (newMeeting && newMeeting.id) {
      setMeetings(prevMeetings => [...prevMeetings, newMeeting]);
      // ✅ Rafraîchir les notifications après création
      refreshNotificationsOnly();
    } else {
      fetchDashboardData();
    }
  };

  // ✅ Meetings conversion
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

  // ✅ Overlaps
  const overlappingMeetings = useMemo(() => {
    if (!convertedMeetings || convertedMeetings.length === 0) {
      return [];
    }

    const userId = user?.id;

    const validMeetings = convertedMeetings.filter(meeting => 
      meeting &&
      meeting.start &&
      meeting.end && 
      !isNaN(meeting.start.getTime()) && 
      !isNaN(meeting.end.getTime())
    );

    if (validMeetings.length === 0) return [];

    const isRelevantForUser = (meeting) => {
      if (!userId) return true;
      const participants = meeting.participant_ids || [];
      return participants.includes(userId) || meeting.organizer_id === userId;
    };

    const hasCommonParticipant = (a, b) => {
      const aParticipants = a.participant_ids || [];
      const bParticipants = b.participant_ids || [];

      if (a.organizer_id && b.organizer_id && a.organizer_id === b.organizer_id) {
        return true;
      }

      if (a.organizer_id && bParticipants.includes(a.organizer_id)) return true;
      if (b.organizer_id && aParticipants.includes(b.organizer_id)) return true;

      return aParticipants.some(id => bParticipants.includes(id));
    };

    const relevantMeetings = validMeetings.filter(isRelevantForUser);
    if (relevantMeetings.length === 0) return [];

    const sortedMeetings = [...relevantMeetings].sort((a, b) => a.start - b.start);
    const overlaps = [];

    for (let i = 0; i < sortedMeetings.length - 1; i++) {
      const meetingA = sortedMeetings[i];
      
      for (let j = i + 1; j < sortedMeetings.length; j++) {
        const meetingB = sortedMeetings[j];
        
        if (meetingB.start >= meetingA.end) break;

        if (!hasCommonParticipant(meetingA, meetingB)) continue;

        const overlapDuration = Math.max(
          0, 
          Math.min(meetingA.end, meetingB.end) - Math.max(meetingA.start, meetingB.start)
        );

        if (overlapDuration > 0) {
          overlaps.push({
            meeting1: meetingA,
            meeting2: meetingB,
            overlapDuration
          });
        }
      }
    }
    
    return overlaps;
  }, [convertedMeetings, user]);

 const unevaluatedTasks = useMemo(
  () => tasks.filter(task =>
    task &&
    (task.status === 'not_evaluated' || task.status === 'completed') &&
    !isTaskEvaluated(task)
  ),
  [tasks]
);

  // ✅ Performance-related notifications
  const performanceNotifications = useMemo(
    () => notifications.filter(n => 
      n.type === 'performance_review' || 
      n.type === 'evaluation_completed' ||
      n.type === 'task_evaluation'
    ),
    [notifications]
  );

  // ✅ Smart toasts (seulement pour les alertes globales)
  useEffect(() => {
    if (!loading) {
      if (unevaluatedTasks.length > 0 && !shownToasts.evaluation) {
        toast.info(`📋 ${unevaluatedTasks.length} task(s) waiting for evaluation`, {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => setActiveTab('tasks')
          }
        });
        setShownToasts(prev => ({ ...prev, evaluation: true }));
      }

      if (overlappingMeetings.length > 0 && !shownToasts.overlaps) {
        toast.warning(`⚠️ ${overlappingMeetings.length} meeting overlap(s) detected`, {
          duration: 6000,
        });
        setShownToasts(prev => ({ ...prev, overlaps: true }));
      }

      if (performanceNotifications.length > 0 && !shownToasts.performance) {
        toast.info(`⭐ ${performanceNotifications.length} performance notification(s)`, {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => setActiveTab('analytics')
          }
        });
        setShownToasts(prev => ({ ...prev, performance: true }));
      }
    }
  }, [
    loading, 
    unevaluatedTasks.length, 
    overlappingMeetings.length, 
    performanceNotifications.length, 
    shownToasts
  ]);

  // ✅ Reset toasts when counts go back to 0
  useEffect(() => {
    if (unevaluatedTasks.length === 0) {
      setShownToasts(prev => ({ ...prev, evaluation: false }));
    }
    if (overlappingMeetings.length === 0) {
      setShownToasts(prev => ({ ...prev, overlaps: false }));
    }
    if (performanceNotifications.length === 0) {
      setShownToasts(prev => ({ ...prev, performance: false }));
    }
  }, [unevaluatedTasks.length, overlappingMeetings.length, performanceNotifications.length]);

  // ✅ Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      const timestamp = new Date().getTime();
      const headers = {
        'Authorization': `Bearer ${token}`
      };
      
      const results = await Promise.allSettled([
        axios.get(`${API}/dashboard/stats/${user.id}?t=${timestamp}`, { headers }),
        axios.get(`${API}/tasks?t=${timestamp}`, { headers }),
        axios.get(`${API}/users/team?t=${timestamp}`, { headers }),
        axios.get(`${API}/templates?t=${timestamp}`, { headers }),
        axios.get(`${API}/meetings?t=${timestamp}`, { headers }),
        axios.get(`${API}/analytics/team-performance?t=${timestamp}`, { headers }),
        axios.get(`${API}/notifications?t=${timestamp}`, { headers })
      ]);

      const [
        statsRes, 
        tasksRes, 
        teamRes, 
        templatesRes, 
        meetingsRes, 
        analyticsRes, 
        notificationsRes
      ] = results;

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value.data;
        const updatedStats = {
          ...statsData,
          not_evaluated_tasks: statsData.not_evaluated_tasks || 0,
          evaluation_rate: statsData.evaluation_rate || 0
        };
        setStats(updatedStats);
      }

      if (tasksRes.status === 'fulfilled') {
        const tasksData = tasksRes.value.data || [];
        setTasks(tasksData);
        setFilteredTasks(tasksData); // 🔄 reset des filtres sur full refresh
      }

      if (teamRes.status === 'fulfilled') {
        setTeamMembers(teamRes.value.data || []);
      }

      if (templatesRes.status === 'fulfilled') {
        setTemplates(templatesRes.value.data || []);
      }

      if (meetingsRes.status === 'fulfilled') {
        setMeetings(meetingsRes.value.data || []);
      }

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data || {});
      }

      if (notificationsRes.status === 'fulfilled') {
        const notificationsData = notificationsRes.value.data || [];
        const normalizedNotifications = notificationsData.map(normalizeNotification).filter(Boolean);
        setNotifications(normalizedNotifications);
      }

      const errors = results.filter(result => result.status === 'rejected');
      if (errors.length > 0) {
        console.warn(`${errors.length} requests failed:`, errors);
        const authError = errors.find(error => error.reason?.response?.status === 401);
        if (authError) {
          setError('Session expired. Please log in again.');
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
        setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 3000);
      } else {
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ✅ Exposer les fonctions globalement
  useEffect(() => {
    window.refreshDashboardData = fetchDashboardData;
    window.refreshNotifications = refreshNotificationsOnly;
    window.refreshTasksData = refreshTasksOnly;
    
    return () => {
      window.refreshDashboardData = undefined;
      window.refreshNotifications = undefined;
      window.refreshTasksData = undefined;
    };
  }, [fetchDashboardData, refreshNotificationsOnly, refreshTasksOnly]);

  // ✅ Initial fetch
  useEffect(() => {
    if (user && user.id) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // ✅ Refresh dashboard (manuel)
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      setShownToasts({
        evaluation: false,
        overlaps: false,
        performance: false
      });
      await fetchDashboardData();
      toast.success("Dashboard refreshed successfully");
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      const errorMessage = error.response?.data?.message || error.message || "Error refreshing dashboard";
      toast.error(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ✅ Evaluation
  const handleEvaluateTask = (task) => {
    const collaborator = teamMembers.find(member => member.id === task.assignee_id);
    
    if (!collaborator) {
      toast.error('Cannot evaluate task: Collaborator not found');
      return;
    }

    if (task.status !== 'not_evaluated' && task.status !== 'completed') {
      toast.error('This task is not ready for evaluation');
      return;
    }

    setEvaluationModal({
      isOpen: true,
      task,
      collaborator
    });
  };

  // ✅ Fin de l’évaluation
  const handleEvaluationComplete = (updatedTask) => {
    if (updatedTask && updatedTask.id) {
      setTasks(prev =>
        prev.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t)
      );

      setFilteredTasks(prev =>
        prev.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t)
      );

      setStats(prev => ({
        ...prev,
        not_evaluated_tasks: Math.max(
          0,
          (prev.not_evaluated_tasks || 0) - (evaluationModal.task?.status === 'not_evaluated' ? 1 : 0)
        )
      }));
    } else {
      refreshTasksOnly();
    }

    setEvaluationModal({
      isOpen: false,
      task: null,
      collaborator: null
    });

    // ✅ Notifications après évaluation
    refreshNotificationsOnly();

    // ✅ Toast de succès après soumission de l’évaluation
    toast.success("Performance evaluation submitted successfully");
  };

  const handleEvaluationClose = () => {
    setEvaluationModal({
      isOpen: false,
      task: null,
      collaborator: null
    });
  };

  // ✅ Calendar refresh
  const handleCalendarRefresh = async () => {
    try {
      setIsRefreshing(true);
      const token = localStorage.getItem('token');
      const timestamp = new Date().getTime();
      
      const meetingsResponse = await axios.get(`${API}/meetings?t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const newMeetings = meetingsResponse.data || [];
      
      setMeetings(newMeetings);
      setCalendarKey(prev => prev + 1);
      
      toast.success("Calendar refreshed");
      
    } catch (error) {
      console.error('Error refreshing calendar:', error);
      toast.error("Error refreshing calendar");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTabChange = (tabValue) => {
    setActiveTab(tabValue);
  };

  const handleViewAllTasks = () => {
    setActiveTab('tasks');
  };

  const handleFilterChange = (filtered) => {
    setFilteredTasks(filtered);
  };

  const handleClearFilters = () => {
    setFilteredTasks(tasks);
  };

  // ✅ Réponse aux meetings
  const handleMeetingResponse = async (meetingId, action) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API}/meetings/${meetingId}/respond`,
        { response: action },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        toast.success(`Meeting ${action === 'accept' ? 'accepted' : 'declined'} successfully`);
        handleCalendarRefresh();
      }
    } catch (error) {
      console.error('Error responding to meeting:', error);
      toast.error('Failed to respond to meeting');
    }
  };

  // ✅ Filtre direct sur les tâches non évaluées
  const handleViewUnevaluatedTasks = () => {
    setActiveTab('tasks');
    setFilteredTasks(unevaluatedTasks);
    toast.info(`Showing ${unevaluatedTasks.length} task(s) waiting for evaluation`, {
      duration: 3000,
    });
  };

  const handleViewPerformance = () => {
    setActiveTab('analytics');
    toast.info(
      `Showing performance analytics with ${performanceNotifications.length} notification(s)`,
      {
        duration: 3000,
      }
    );
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
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Manager Dashboard</h1>
                <p className="text-slate-600">Welcome back, {user?.full_name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {unevaluatedTasks.length > 0 && (
                <div className="relative">
                  <div 
                    className="p-2 text-amber-600 cursor-pointer rounded-md hover:bg-amber-50 transition-colors"
                    onClick={handleViewUnevaluatedTasks}
                    title={`${unevaluatedTasks.length} tasks to evaluate`}
                  >
                    <Award className="h-5 w-5" />
                  </div>
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unevaluatedTasks.length}
                  </span>
                </div>
              )}

              {performanceNotifications.length > 0 && (
                <div className="relative">
                  <div 
                    className="p-2 text-blue-600 cursor-pointer rounded-md hover:bg-blue-50 transition-colors"
                    onClick={handleViewPerformance}
                    title={`${performanceNotifications.length} performance notifications`}
                  >
                    <Star className="h-5 w-5" />
                  </div>
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {performanceNotifications.length}
                  </span>
                </div>
              )}

              {overlappingMeetings.length > 0 && (
                <div className="relative">
                  <div 
                    className="p-2 text-orange-600 cursor-pointer rounded-md hover:bg-orange-50 transition-colors"
                    onClick={() => toast.warning(`You have ${overlappingMeetings.length} overlapping meeting(s)`)}
                    title={`${overlappingMeetings.length} meeting overlaps`}
                  >
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {overlappingMeetings.length}
                  </span>
                </div>
              )}

              <div className="relative">
                <div 
                  className="p-2 text-slate-600 cursor-pointer rounded-md hover:bg-slate-100 transition-colors"
                  onClick={() => setShowNotifications(true)}
                  title="Notifications"
                >
                  <Bell className="h-5 w-5" />
                </div>
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </div>

              <div 
                className="p-2 text-slate-600 cursor-pointer rounded-md hover:bg-slate-100 transition-colors"
                onClick={handleRefresh}
                title="Refresh dashboard"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </div>
              
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowCreateMeeting(true)}
                  variant="outline"
                  size="sm"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  New Meeting
                </Button>
                <Button
                  onClick={() => setShowCreateTask(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </div>
              
              <div 
                className="p-2 text-slate-600 cursor-pointer rounded-md hover:bg-slate-100 transition-colors"
                onClick={logout}
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        {error && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
            <p className="text-yellow-700">{error}</p>
            <Button 
              onClick={fetchDashboardData} 
              variant="outline" 
              size="sm" 
              className="ml-4"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        )}

        <RealTimeMetrics tasks={tasks} users={teamMembers} stats={stats} />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-white/80 border border-slate-200/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50">
              <Home className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-50">
              <Calendar className="h-4 w-4 mr-2" />
              Tasks ({filteredTasks.length || tasks.length})
              {unevaluatedTasks.length > 0 && (
                <span className="ml-1 text-amber-600">⭐</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-blue-50">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar ({convertedMeetings.length})
              {overlappingMeetings.length > 0 && (
                <span className="ml-1 text-amber-600">⚠️</span>
              )}
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

          <TabsContent value="overview">
            <OverviewTab 
              stats={stats}
              tasks={tasks}
              users={teamMembers}
              meetings={meetings}
              unevaluatedTasks={unevaluatedTasks}
              onShowCreateTask={() => setShowCreateTask(true)}
              onShowCreateMeeting={() => setShowCreateMeeting(true)}
              onViewAllTasks={handleViewAllTasks}
              onViewUnevaluatedTasks={handleViewUnevaluatedTasks}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <Card className="border-slate-200/50 w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>
                    Tasks ({filteredTasks.length || tasks.length})
                    {unevaluatedTasks.length > 0 && (
                      <Badge 
                        variant="outline" 
                        onClick={handleViewUnevaluatedTasks}
                        className="ml-2 bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100"
                      >
                        <Award className="h-3 w-3 mr-1" />
                        {unevaluatedTasks.length} to evaluate
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {filteredTasks.length === 0 && tasks.length > 0
                      ? `0 of ${tasks.length} tasks match your filters`
                      : filteredTasks.length === tasks.length || filteredTasks.length === 0
                        ? 'Manage and track task progress'
                        : `${filteredTasks.length} of ${tasks.length} tasks match your filters`
                    }
                    {unevaluatedTasks.length > 0 && (
                      <span className="text-amber-600 ml-2">
                        • {unevaluatedTasks.length} task(s) waiting for evaluation
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setShowCreateTask(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </CardHeader>
              <CardContent className="w-full">
                <div className="mb-6 w-full">
                  <FilterTasks 
                    tasks={tasks}
                    onFilterChange={handleFilterChange}
                    onClearFilters={handleClearFilters}
                    collaborators={teamMembers.filter(u => u.role === 'collaborator')}
                  />
                </div>
                
                <div className="w-full">
                  <Tabs 
                    value={tasksView} 
                    onValueChange={setTasksView} 
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
                      <TabsTrigger value="list">
                        <Calendar className="h-4 w-4 mr-2" />
                        List View
                      </TabsTrigger>
                      <TabsTrigger value="kanban">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Kanban View
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="list" className="mt-0 w-full">
                      <TaskList 
                        tasks={filteredTasks.length ? filteredTasks : tasks} 
                        onTaskUpdate={handleTaskUpdated}
                        onTaskDeleted={handleTaskDeleted}
                        userRole="manager"
                        collaborators={teamMembers.filter(u => u.role === 'collaborator')}
                        onEvaluateTask={handleEvaluateTask}
                      />
                    </TabsContent>
                    
                    <TabsContent value="kanban" className="mt-0 w-full">
                      <div className="w-full">
                        <KanbanView 
                          tasks={filteredTasks.length ? filteredTasks : tasks} 
                          onTaskUpdate={handleTaskUpdated}
                          userRole="manager"
                          collaborators={teamMembers.filter(u => u.role === 'collaborator')}
                          onEvaluateTask={handleEvaluateTask}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card className="border-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>
                    Meeting Calendar ({convertedMeetings.length})
                    {overlappingMeetings.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-amber-600 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {overlappingMeetings.length} overlap(s) detected
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {convertedMeetings.length > 0 
                      ? `Manage ${convertedMeetings.length} meetings` 
                      : 'No meetings scheduled'}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleCalendarRefresh}
                    variant="outline"
                    size="sm"
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button 
                    onClick={() => setShowCreateMeeting(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Meeting
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <EnhancedCalendar 
                  key={`calendar-${calendarKey}`}
                  events={convertedMeetings}
                  userRole="manager"
                  onMeetingUpdate={handleCalendarRefresh}
                  collaborators={teamMembers}
                  onMeetingResponse={handleMeetingResponse}
                  currentUser={user}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card className="border-slate-200/50">
              <CardHeader>
                <CardTitle>Task Templates</CardTitle>
                <CardDescription>Create and manage task templates</CardDescription>
              </CardHeader>
              <CardContent>
                <TaskTemplates 
                  collaborators={teamMembers.filter(u => u.role === 'collaborator')}
                  onTaskCreated={fetchDashboardData}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card className="border-slate-200/50">
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage your team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {teamMembers.filter(u => u.role === 'collaborator').map((member) => (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between p-4 bg-white/60 rounded-lg border"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {member.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.full_name || 'Unknown User'}</p>
                          <p className="text-sm text-slate-600">
                            {member.email || 'No email'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Active
                      </Badge>
                    </div>
                  ))}
                  
                  {teamMembers.filter(u => u.role === 'collaborator').length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No team members yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card className="border-slate-200/50">
              <CardHeader>
                <CardTitle>Team Analytics</CardTitle>
                <CardDescription>Performance metrics and insights</CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsDashboard 
                  stats={stats}
                  tasks={tasks}
                  users={teamMembers}
                  meetings={meetings}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ✅ Evaluation modal */}
      {evaluationModal.isOpen && evaluationModal.task && evaluationModal.collaborator && (
        <PerformanceEvaluationModal
          isOpen={evaluationModal.isOpen}
          onClose={handleEvaluationClose}
          onComplete={handleEvaluationComplete}
          taskId={evaluationModal.task.id}
          collaboratorId={evaluationModal.collaborator.id}
          taskTitle={evaluationModal.task.title}
          collaboratorName={evaluationModal.collaborator.full_name}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          isOpen={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          onTaskCreated={handleTaskCreated}
          collaborators={teamMembers.filter(u => u.role === 'collaborator')}
        />
      )}

      {showCreateMeeting && (
        <CreateMeetingModal
          isOpen={showCreateMeeting}
          onClose={() => setShowCreateMeeting(false)}
          collaborators={teamMembers.filter(u => u.role === 'collaborator')}
          onMeetingCreated={handleMeetingCreated}
        />
      )}

      {showNotifications && (
        <NotificationPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onNotificationUpdate={handleNotificationUpdate}
          onMarkAsRead={handleMarkNotificationAsRead}
          onDeleteNotification={handleDeleteNotification}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;
