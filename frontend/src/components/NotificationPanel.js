import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, X, Check, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const NotificationPanel = ({ isOpen, onClose, notifications, onNotificationUpdate }) => {
  const handleMarkAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`);
      onNotificationUpdate();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to update notification');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_assignment':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'task_completed':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'deadline_reminder':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'overdue':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);
  const readNotifications = notifications.filter(n => n.is_read);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center">
            <Bell className="h-5 w-5 mr-2 text-blue-600" />
            Notifications
            {unreadNotifications.length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">
                {unreadNotifications.length}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Stay updated with your latest activities and assignments
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Unread Notifications */}
            {unreadNotifications.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">New Notifications</h3>
                <div className="space-y-3">
                  {unreadNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 bg-blue-50 border border-blue-200 rounded-lg animate-fadeIn"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="p-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900 mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-slate-600 mb-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(notification.created_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleMarkAsRead(notification.id)}
                          variant="ghost"
                          size="sm"
                          className="p-1 h-auto text-blue-600 hover:text-blue-800"
                          data-testid={`mark-read-${notification.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Read Notifications */}
            {readNotifications.length > 0 && (
              <div className={unreadNotifications.length > 0 ? 'mt-6 pt-6 border-t border-slate-200' : ''}>
                {unreadNotifications.length > 0 && (
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Previous Notifications</h3>
                )}
                <div className="space-y-3">
                  {readNotifications.slice(0, 10).map((notification) => (
                    <div
                      key={notification.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-lg opacity-75"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-1 opacity-60">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 mb-1">
                            {notification.title}
                          </h4>
                          <p className="text-sm text-slate-600 mb-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(notification.created_at)}
                          </p>
                        </div>
                        <div className="p-1">
                          <Check className="h-4 w-4 text-green-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {notifications.length === 0 && (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 mx-auto mb-4 text-slate-400 opacity-50" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No notifications yet</h3>
                <p className="text-slate-600">
                  You'll see updates about your tasks and activities here
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t border-slate-200">
          <Button onClick={onClose} variant="ghost" data-testid="close-notifications">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPanel;