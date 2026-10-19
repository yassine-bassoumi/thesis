// src/components/NotificationPanel.js
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  X,
  Check,
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Star,
  Award,
  FileText,
  EyeOff,
  Trash2,
  PlayCircle,
  PauseCircle
} from 'lucide-react';
import { useAuth } from '../App';
import { toast } from "sonner";

const NotificationPanel = ({
  isOpen,
  onClose,
  notifications = [],
  onNotificationUpdate,
  onMarkAsRead,
  onDeleteNotification,
}) => {
  const { user } = useAuth();
  const [deletingNotifications, setDeletingNotifications] = useState(new Set());
  const [markingAsRead, setMarkingAsRead] = useState(new Set());

  const updateCallbackRef = useRef(onNotificationUpdate);

  useEffect(() => {
    updateCallbackRef.current = onNotificationUpdate;
  }, [onNotificationUpdate]);

  // 🔁 Auto-refresh every 30s while panel is open
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      if (updateCallbackRef.current) {
        updateCallbackRef.current();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Refresh once when panel opens
  useEffect(() => {
    if (isOpen && updateCallbackRef.current) {
      updateCallbackRef.current();
    }
  }, [isOpen]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }

      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Date formatting error:', error, dateString);
      return 'Unknown date';
    }
  };

  const getNotificationTitle = (type, title) => {
    if (title && title !== 'Task Status Updated' && title !== 'No title') {
      return title;
    }

    switch (type) {
      case 'task_completed': return 'Task Completed';
      case 'task_in_progress': return 'Task Started';
      case 'task_pending': return 'Task Pending';
      case 'task_assigned': return 'New Task Assigned';
      case 'task_created': return 'Task Created';
      case 'task_updated': return 'Task Updated';
      case 'task_deleted': return 'Task Deleted';
      case 'task_not_evaluated': return 'Awaiting Evaluation';
      case 'deadline_reminder': return 'Deadline Reminder';
      case 'overdue': return 'Task Overdue';
      case 'meeting_invitation': return 'Meeting Invitation';
      case 'meeting_scheduled': return 'Meeting Scheduled';
      case 'meeting_updated': return 'Meeting Updated';
      case 'meeting_cancelled': return 'Meeting Cancelled';
      case 'performance_review': return 'Performance Review';
      case 'evaluation_completed': return 'Evaluation Completed';
      case 'evaluation_updated': return 'Evaluation Updated'; // ✅ ajouté
      default: return 'Notification';
    }
  };

  const getNotificationMessage = (type, message) => {
    if (message && !message.toLowerCase().includes('status updated')) {
      return message;
    }

    switch (type) {
      case 'task_completed':
        return 'A task has been marked as completed.';
      case 'task_in_progress':
        return 'A task has been started.';
      case 'task_pending':
        return 'A task is pending.';
      case 'task_not_evaluated':
        return 'A completed task is awaiting evaluation.';
      case 'evaluation_completed':
        return 'Your task performance has been evaluated.';
      case 'evaluation_updated': // ✅ ajouté
        return 'Your task evaluation has been updated.';
      default:
        return message || 'New notification';
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const notificationExists = notifications.find(n => n.id === notificationId);
      if (!notificationExists) {
        console.error('Notification not found:', notificationId);
        return;
      }

      setMarkingAsRead(prev => {
        const newSet = new Set(prev);
        newSet.add(notificationId);
        return newSet;
      });

      if (onMarkAsRead) {
        await onMarkAsRead(notificationId);
        if (updateCallbackRef.current) {
          setTimeout(() => {
            updateCallbackRef.current && updateCallbackRef.current();
          }, 500);
        }
      } else {
        toast.error('Mark-as-read handler is not available.');
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Failed to mark notification as read.');
    } finally {
      setMarkingAsRead(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      const notificationExists = notifications.find(n => n.id === notificationId);
      if (!notificationExists) {
        console.error('Notification not found for deletion:', notificationId);
        return;
      }

      setDeletingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.add(notificationId);
        return newSet;
      });

      if (onDeleteNotification) {
        await onDeleteNotification(notificationId);
        if (updateCallbackRef.current) {
          setTimeout(() => {
            updateCallbackRef.current && updateCallbackRef.current();
          }, 500);
        }
      } else {
        toast.error('Delete handler is not available.');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification.');
    } finally {
      setDeletingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      if (unreadNotifications.length === 0) {
        toast.info('No unread notifications.');
        return;
      }

      const unreadIds = unreadNotifications.map(n => n.id);
      setMarkingAsRead(prev => new Set([...prev, ...unreadIds]));

      if (onMarkAsRead) {
        for (const notification of unreadNotifications) {
          await onMarkAsRead(notification.id);
        }
        toast.success(`${unreadNotifications.length} notifications marked as read.`);
        if (updateCallbackRef.current) {
          setTimeout(() => {
            updateCallbackRef.current && updateCallbackRef.current();
          }, 800);
        }
      } else {
        toast.error('Mark-as-read handler is not available.');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark notifications as read.');
    } finally {
      setMarkingAsRead(new Set());
    }
  };

  const canDeleteNotification = user?.role === 'manager';

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_assigned':
      case 'task_assignment':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'task_completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'task_in_progress':
        return <PlayCircle className="h-5 w-5 text-orange-500" />;
      case 'task_pending':
        return <PauseCircle className="h-5 w-5 text-yellow-500" />;
      case 'deadline_reminder':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'overdue':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'meeting_invitation':
        return <Calendar className="h-5 w-5 text-purple-500" />;
      case 'meeting_scheduled':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'meeting_updated':
        return <Calendar className="h-5 w-5 text-orange-500" />;
      case 'meeting_cancelled':
        return <Calendar className="h-5 w-5 text-red-500" />;
      case 'performance_review':
        return <Star className="h-5 w-5 text-orange-500" />;
      case 'evaluation_completed':
        return <Award className="h-5 w-5 text-amber-500" />;
      case 'evaluation_updated': // ✅ ajouté
        return <Award className="h-5 w-5 text-blue-500" />;
      case 'task_updated':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'task_created':
        return <FileText className="h-5 w-5 text-green-500" />;
      case 'task_deleted':
        return <Trash2 className="h-5 w-5 text-red-500" />;
      case 'task_not_evaluated':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationStyle = (type, isRead, isDeleting = false, isMarking = false) => {
    const baseStyle = "p-4 border rounded-lg transition-all duration-300 ease-in-out";
    const readStyle = isRead ? "bg-slate-50 border-slate-200 opacity-75" : "";
    const deletingStyle = isDeleting
      ? "opacity-0 scale-95 -translate-x-4 transition-all duration-300 ease-in-out"
      : "opacity-100 scale-100 translate-x-0";
    const markingAsReadStyle = isMarking
      ? "bg-green-50 border-green-200 scale-[1.02] transition-all duration-200"
      : "";

    let typeStyle = "";
    switch (type) {
      case 'task_assigned':
      case 'task_assignment':
        typeStyle = !isRead ? 'bg-blue-50 border-blue-200' : '';
        break;
      case 'task_completed':
      case 'task_created':
      case 'task_updated':
        typeStyle = !isRead ? 'bg-green-50 border-green-200' : '';
        break;
      case 'task_in_progress':
        typeStyle = !isRead ? 'bg-orange-50 border-orange-200' : '';
        break;
      case 'task_pending':
      case 'deadline_reminder':
        typeStyle = !isRead ? 'bg-yellow-50 border-yellow-200' : '';
        break;
      case 'overdue':
        typeStyle = !isRead ? 'bg-red-50 border-red-200' : '';
        break;
      case 'meeting_invitation':
        typeStyle = !isRead ? 'bg-purple-50 border-purple-200' : '';
        break;
      case 'performance_review':
        typeStyle = !isRead ? 'bg-orange-50 border-orange-200' : '';
        break;
      case 'evaluation_completed':
      case 'evaluation_updated': // ✅ ajouté
        typeStyle = !isRead ? 'bg-amber-50 border-amber-200' : '';
        break;
      case 'task_deleted':
      case 'meeting_cancelled':
        typeStyle = !isRead ? 'bg-red-50 border-red-200' : '';
        break;
      case 'meeting_scheduled':
        typeStyle = !isRead ? 'bg-blue-50 border-blue-200' : '';
        break;
      case 'meeting_updated':
        typeStyle = !isRead ? 'bg-orange-50 border-orange-200' : '';
        break;
      case 'task_not_evaluated':
        typeStyle = !isRead ? 'bg-blue-50 border-blue-200' : '';
        break;
      default:
        typeStyle = !isRead ? 'bg-gray-50 border-gray-200' : '';
    }

    return `${baseStyle} ${readStyle} ${typeStyle} ${deletingStyle} ${markingAsReadStyle}`;
  };

  const activeNotifications = notifications.filter(
    n => !n.is_archived && !deletingNotifications.has(n.id)
  );
  const unreadNotifications = activeNotifications.filter(
    n => !n.is_read && !markingAsRead.has(n.id)
  );
  const readNotifications = activeNotifications.filter(
    n => n.is_read && !markingAsRead.has(n.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="
          max-w-md w-full
          max-h-[80vh]
          flex flex-col
          p-0
          bg-white
          rounded-lg
        "
      >
        {/* Header fixé */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center justify-between">
            <div className="flex items-center">
              <Bell className="h-5 w-5 mr-2 text-blue-600" />
              Notifications
              {unreadNotifications.length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white animate-pulse">
                  {unreadNotifications.length}
                </Badge>
              )}
            </div>

            {unreadNotifications.length > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                disabled={markingAsRead.size > 0}
              >
                {markingAsRead.size > 0 ? (
                  <div className="animate-spin h-4 w-4 mr-1 border-2 border-blue-600 border-t-transparent rounded-full" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Mark all read
              </Button>
            )}
          </DialogTitle>

          <DialogDescription className="text-slate-600">
            {activeNotifications.length} total • {unreadNotifications.length} unread
          </DialogDescription>
        </DialogHeader>

        {/* Zone scrollable */}
        <ScrollArea className="px-6 h-[55vh]">
          <div className="space-y-3 py-2">

            {/* Unread */}
            {unreadNotifications.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  New notifications
                </h3>
                <div className="space-y-3">
                  {unreadNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={getNotificationStyle(
                        notification.type,
                        false,
                        deletingNotifications.has(notification.id),
                        markingAsRead.has(notification.id)
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 p-1 mt-0.5">
                            {markingAsRead.has(notification.id) ? (
                              <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full" />
                            ) : (
                              getNotificationIcon(notification.type)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 mb-1 truncate">
                              {getNotificationTitle(notification.type, notification.title)}
                            </h4>
                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                              {getNotificationMessage(notification.type, notification.message)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(notification.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col space-y-2 ml-2 flex-shrink-0">
                          <Button
                            onClick={() => handleMarkAsRead(notification.id)}
                            variant="ghost"
                            size="sm"
                            className="p-1 h-8 w-8 text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors border border-green-200"
                            title="Mark as read"
                            disabled={
                              markingAsRead.has(notification.id) ||
                              deletingNotifications.has(notification.id)
                            }
                          >
                            {markingAsRead.has(notification.id) ? (
                              <div className="animate-spin h-3 w-3 border-2 border-green-600 border-t-transparent rounded-full" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                          </Button>

                          <Button
                            onClick={() => handleDeleteNotification(notification.id)}
                            variant="ghost"
                            size="sm"
                            className={`p-1 h-8 w-8 transition-colors border ${
                              canDeleteNotification
                                ? 'text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200'
                                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                            }`}
                            title={canDeleteNotification ? "Delete notification" : "Hide notification"}
                            disabled={
                              deletingNotifications.has(notification.id) ||
                              markingAsRead.has(notification.id)
                            }
                          >
                            {deletingNotifications.has(notification.id) ? (
                              <div className="animate-spin h-3 w-3 border-2 border-red-600 border-t-transparent rounded-full" />
                            ) : canDeleteNotification ? (
                              <Trash2 className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Read */}
            {readNotifications.length > 0 && (
              <div className={unreadNotifications.length > 0 ? 'mt-6 pt-6 border-t border-slate-200' : ''}>
                {unreadNotifications.length > 0 && (
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Previous notifications
                  </h3>
                )}
                <div className="space-y-3">
                  {readNotifications.slice(0, 30).map((notification) => (
                    <div
                      key={notification.id}
                      className={getNotificationStyle(
                        notification.type,
                        true,
                        deletingNotifications.has(notification.id)
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 p-1 mt-0.5 opacity-60">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 mb-1 truncate">
                              {getNotificationTitle(notification.type, notification.title)}
                            </h4>
                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                              {getNotificationMessage(notification.type, notification.message)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(notification.created_at)}
                            </p>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleDeleteNotification(notification.id)}
                          variant="ghost"
                          size="sm"
                          className={`p-1 h-8 w-8 opacity-60 hover:opacity-100 transition-all border flex-shrink-0 ${
                            canDeleteNotification
                              ? 'text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200'
                              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 border-slate-200'
                          }`}
                          title={canDeleteNotification ? "Delete notification" : "Hide notification"}
                          disabled={deletingNotifications.has(notification.id)}
                        >
                          {deletingNotifications.has(notification.id) ? (
                            <div className="animate-spin h-3 w-3 border-2 border-red-600 border-t-transparent rounded-full" />
                          ) : canDeleteNotification ? (
                            <Trash2 className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {activeNotifications.length === 0 && (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 mx-auto mb-4 text-slate-400 opacity-50" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No notifications</h3>
                <p className="text-slate-600">
                  {user?.role === 'manager'
                    ? 'No notifications to manage at the moment.'
                    : "You're all caught up! New notifications will appear here."
                  }
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-3">
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              size="sm"
              disabled={unreadNotifications.length === 0 || markingAsRead.size > 0}
              className="flex-1"
            >
              {markingAsRead.size > 0 ? (
                <>
                  <div className="animate-spin h-3 w-3 mr-1 border-2 border-blue-600 border-t-transparent rounded-full" />
                  Marking...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </>
              )}
            </Button>

            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="flex-1"
            >
              <X className="h-4 w-4 mr-1" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPanel;
