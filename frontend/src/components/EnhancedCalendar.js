// src/components/EnhancedCalendar.js
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  List, 
  Clock, 
  MapPin,
  Edit,
  Trash2,
  MoreHorizontal,
  User,
  Users,
  RefreshCw
} from 'lucide-react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { API } from '../App';
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditMeetingModal from './EditMeetingModal';

// Semaine qui commence le lundi
moment.locale('en', { week: { dow: 1, doy: 4 } });
const localizer = momentLocalizer(moment);

// Headers d’auth
const getAuthHeadersGlobal = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Helpers dates
const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

const parseTime = (timeStr, fallback) => {
  if (!timeStr || typeof timeStr !== 'string') return fallback;
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback;
  return { h, m };
};

// Construction start / end robuste à partir d’un meeting
const buildStartEndFromMeeting = (meeting) => {
  const now = new Date();

  // 1) baseDate à partir de meeting_date ou start
  let baseDate = null;

  if (meeting?.meeting_date) {
    const md = meeting.meeting_date;

    if (typeof md === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(md)) {
      // format "YYYY-MM-DD"
      const [y, m, d] = md.split('-').map(Number);
      baseDate = new Date(y, m - 1, d);
    } else {
      const tmp = new Date(md);
      if (isValidDate(tmp)) {
        baseDate = new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
      }
    }
  }

  // fallback : ancien format avec start
  if (!baseDate && meeting?.start) {
    const tmp = new Date(meeting.start);
    if (isValidDate(tmp)) {
      baseDate = new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
    }
  }

  // si toujours rien → aujourd’hui
  if (!baseDate || !isValidDate(baseDate)) {
    console.warn('⚠️ Invalid meeting_date/start for meeting', meeting?.id, meeting);
    baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // 2) heures (avec valeurs par défaut)
  const defaultStart = { h: 9, m: 0 };
  const defaultEnd = { h: 10, m: 0 };

  const startParsed = parseTime(meeting.start_time, defaultStart);
  const endParsed = parseTime(meeting.end_time, defaultEnd);

  const startDate = new Date(baseDate);
  startDate.setHours(startParsed.h, startParsed.m, 0, 0);

  const endDate = new Date(baseDate);
  endDate.setHours(endParsed.h, endParsed.m, 0, 0);

  // si end ≤ start → +1h
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate <= startDate) {
    console.warn('⚠️ Invalid start/end time for meeting', meeting?.id, {
      meeting_date: meeting.meeting_date,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
    });
    startDate.setHours(9, 0, 0, 0);
    endDate.setTime(startDate.getTime() + 60 * 60 * 1000);
  }

  return { startDate, endDate };
};

const EnhancedCalendar = ({ events, userRole, onMeetingUpdate, collaborators = [], currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [editMeeting, setEditMeeting] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [respondingMeetingId, setRespondingMeetingId] = useState(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const meetingsListRef = useRef(null);

  // local meetings pour updates optimistes
  const [localMeetings, setLocalMeetings] = useState([]);

  const getAuthHeaders = getAuthHeadersGlobal;

  // user id courant
  const getCurrentUserId = useCallback(() => {
    if (currentUser?.id) return currentUser.id;
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) return storedUserId;
    console.warn('No user ID found');
    return null;
  }, [currentUser]);

  // sync props → state local
  useEffect(() => {
    if (Array.isArray(events)) {
      setLocalMeetings(events);
    } else {
      console.warn('EnhancedCalendar received invalid events:', events);
      setLocalMeetings([]);
    }
  }, [events]);

  // scroll vers la meeting sélectionnée
  useEffect(() => {
    if (selectedMeetingId && meetingsListRef.current) {
      const selectedElement = document.getElementById(`meeting-${selectedMeetingId}`);
      if (selectedElement) {
        setTimeout(() => {
          selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          selectedElement.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
          setTimeout(() => {
            selectedElement.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
          }, 2000);
        }, 300);
      }
    }
  }, [selectedMeetingId]);

  // refresh via parent
  const handleRefreshCalendar = async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      if (onMeetingUpdate) await onMeetingUpdate();
      toast.success("Calendar refreshed");
    } catch (error) {
      console.error('Error refreshing calendar:', error);
      toast.error("Error refreshing calendar");
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (date) =>
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);
    if (currentView === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setDate(newDate.getDate() + direction);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  // conversion finale pour react-big-calendar
  const meetingEvents = useMemo(() => {
    if (!Array.isArray(localMeetings)) return [];

    return localMeetings
      .filter((m) => m && typeof m === 'object')
      .map((meeting) => {
        try {
          const { startDate, endDate } = buildStartEndFromMeeting(meeting);
          return {
            ...meeting,
            start: startDate,
            end: endDate,
            type: 'meeting',
            title: meeting.title || 'Untitled Meeting',
            organizer_name: meeting.organizer_name || 'Manager',
            location: meeting.location || '',
            description: meeting.description || ''
          };
        } catch (error) {
          console.error(`Error processing meeting ${meeting.id}:`, error);
          const fallbackStart = new Date();
          const fallbackEnd = new Date(fallbackStart.getTime() + 60 * 60 * 1000);
          return {
            ...meeting,
            start: fallbackStart,
            end: fallbackEnd,
            type: 'meeting',
            title: meeting.title || 'Meeting (Date Error)',
            organizer_name: meeting.organizer_name || 'Manager',
            location: meeting.location || '',
            description: meeting.description || '',
            _hasError: true
          };
        }
      });
  }, [localMeetings]);

  // réponse accept / decline (utilise les endpoints /accept et /decline)
  const handleMeetingResponse = useCallback(
    async (meetingId, action) => {
      if (respondingMeetingId) return;

      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        toast.error('User not found. Please log in again.');
        return;
      }

      try {
        setRespondingMeetingId(meetingId);

        // ✅ Update optimiste côté UI
        setLocalMeetings((prev) =>
          prev.map((meeting) =>
            meeting.id === meetingId
              ? {
                  ...meeting,
                  participant_responses: {
                    ...(meeting.participant_responses || {}),
                    [currentUserId]: action,
                  },
                  _hideButtons: true,
                }
              : meeting
          )
        );

        // ✅ Endpoints legacy que tu as dans ton backend
        const endpoint =
          action === 'accept'
            ? `${API}/meetings/${meetingId}/accept`
            : `${API}/meetings/${meetingId}/decline`;

        const res = await axios.put(
          endpoint,
          {},
          { headers: getAuthHeaders() }
        );

        console.log('Meeting response result:', res.status, res.data);

        toast.success(
          `Meeting ${action === 'accept' ? 'accepted' : 'declined'} successfully`
        );

        if (onMeetingUpdate) {
          setTimeout(() => onMeetingUpdate(), 800);
        }
      } catch (error) {
        console.error('Error responding to meeting:', error?.response?.data || error);

        // ❌ rollback: on ré-affiche les boutons
        setLocalMeetings((prev) =>
          prev.map((meeting) =>
            meeting.id === meetingId ? { ...meeting, _hideButtons: false } : meeting
          )
        );

        toast.error('Failed to respond to meeting');
      } finally {
        setRespondingMeetingId(null);
      }
    },
    [getCurrentUserId, onMeetingUpdate, respondingMeetingId]
  );

  // tri par date
  const sortedMeetings = useMemo(() => {
    try {
      const validEvents = meetingEvents.filter(
        (event) => event && event.start && !Number.isNaN(new Date(event.start).getTime())
      );
      return [...validEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
    } catch (error) {
      console.error('Error sorting meetings:', error);
      return meetingEvents;
    }
  }, [meetingEvents]);

  const handleDeleteMeeting = async (meetingId, meetingTitle) => {
    if (!window.confirm(`Are you sure you want to delete the meeting "${meetingTitle}"?`)) {
      return;
    }

    try {
      setDeleteLoading(meetingId);

      const res = await axios.delete(`${API}/meetings/${meetingId}`, {
        headers: getAuthHeaders(),
      });

      console.log('Delete meeting result:', res.status, res.data);

      // ✅ Suppression locale immédiate
      setLocalMeetings((prev) => prev.filter((m) => m.id !== meetingId));

      toast.success('Meeting deleted successfully');
      if (onMeetingUpdate) onMeetingUpdate();
    } catch (error) {
      console.error('Error deleting meeting:', error?.response?.data || error);
      const msg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        'Failed to delete meeting';
      toast.error(msg);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleEditMeeting = (meeting) => {
    if (!meeting) return;
    setEditMeeting(meeting);
    setShowEditModal(true);
  };

  // IMPORTANT : on reçoit le meeting mis à jour depuis le modal
  const handleMeetingUpdated = (updatedMeeting) => {
    setShowEditModal(false);
    setEditMeeting(null);

    if (updatedMeeting && updatedMeeting.id) {
      setLocalMeetings((prev) =>
        prev.map((m) => (m.id === updatedMeeting.id ? { ...m, ...updatedMeeting } : m))
      );
    }

    if (onMeetingUpdate) {
      onMeetingUpdate();
    }
  };

  // styles events calendar
  const eventStyleGetter = (event) => {
    let backgroundColor = '#3174ad';
    let borderColor = '#3174ad';

    if (event?.status === 'accepted') {
      backgroundColor = '#28a745';
      borderColor = '#28a745';
    } else if (event?.status === 'declined') {
      backgroundColor = '#dc3545';
      borderColor = '#dc3545';
    } else if (event?.status === 'pending') {
      backgroundColor = '#ffc107';
      borderColor = '#ffc107';
    } else if (event?.status === 'partially_accepted') {
      backgroundColor = '#fd7e14';
      borderColor = '#fd7e14';
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '2px solid',
        display: 'block',
        fontSize: '0.875rem',
        padding: '2px 5px',
      },
    };
  };

  const handleSelectEvent = (event) => {
    if (!event) return;
    setSelectedMeetingId(event.id);
  };

  const handleSelectSlot = ({ start, end }) => {
    console.log('Slot selected:', start, end);
  };

  const formatParticipants = (participants) => {
    if (!Array.isArray(participants)) return 'No participants';

    const validParticipants = participants
      .filter((p) => typeof p === 'string')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (validParticipants.length === 0) return 'No participants';
    if (validParticipants.length === 1) return validParticipants[0];
    if (validParticipants.length === 2) return validParticipants.join(' and ');

    return `${validParticipants.slice(0, 2).join(', ')} and ${validParticipants.length - 2} more`;
  };

  const ResponseButton = ({ meeting, action }) => {
    const isResponding = respondingMeetingId === meeting.id;
    const currentUserId = getCurrentUserId();
    const hasResponded = meeting.participant_responses?.[currentUserId];
    const hideButtons = meeting._hideButtons;

    if (hideButtons || hasResponded) return null;

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleMeetingResponse(meeting.id, action);
    };

    return (
      <Button
        size="sm"
        variant="outline"
        className={
          action === 'accept'
            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
        }
        onClick={handleClick}
        disabled={isResponding}
      >
        {isResponding ? (
          <div
            className={`h-4 w-4 animate-spin rounded-full border-b-2 ${
              action === 'accept' ? 'border-green-600' : 'border-red-600'
            }`}
          />
        ) : action === 'accept' ? (
          'Accept'
        ) : (
          'Decline'
        )}
      </Button>
    );
  };

  const CalendarEventComponent = ({ event }) => {
    if (!event) return <div className="p-1 text-xs">Invalid event</div>;
    return (
      <div className="p-1">
        <div className="font-semibold text-sm truncate">
          {event.title || 'Untitled Meeting'}
        </div>
        <div className="text-xs opacity-75 truncate">
          {event.organizer_name || 'Manager'}
        </div>
      </div>
    );
  };

  const formatTimeDisplay = (meeting) => {
    try {
      if (meeting.start_time && meeting.end_time) {
        return `${meeting.start_time.substring(0, 5)} - ${meeting.end_time.substring(0, 5)}`;
      } else if (meeting.start && meeting.end) {
        const startTime = new Date(meeting.start).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const endTime = new Date(meeting.end).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${startTime} - ${endTime}`;
      }
      return 'Time not specified';
    } catch {
      return 'Invalid time';
    }
  };

  const currentUserIdForList = getCurrentUserId();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {formatDate(currentDate)}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1">
            <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshCalendar}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <div className="flex items-center space-x-1">
            <Button
              variant={currentView === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('month')}
            >
              Month
            </Button>
            <Button
              variant={currentView === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('week')}
            >
              Week
            </Button>
            <Button
              variant={currentView === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('day')}
            >
              Day
            </Button>
            <Button
              variant={currentView === 'agenda' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('agenda')}
            >
              <List className="h-4 w-4 mr-1" />
              Agenda
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <Card className="border-slate-200/50">
        <CardContent className="p-4">
          <div className="h-[500px]">
            <Calendar
              localizer={localizer}
              events={meetingEvents}
              startAccessor="start"
              endAccessor="end"
              view={currentView}
              date={currentDate}
              onView={setCurrentView}
              onNavigate={setCurrentDate}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              showMultiDayTimes
              eventPropGetter={eventStyleGetter}
              components={{ event: CalendarEventComponent }}
              messages={{
                next: 'Next',
                previous: 'Prev',
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day',
                agenda: 'Agenda',
                date: 'Date',
                time: 'Time',
                event: 'Event',
                noEventsInRange: 'No meetings in this range',
              }}
              formats={{
                agendaHeaderFormat: ({ start, end }, culture, loc) =>
                  `${loc.format(start, 'DD/MM/YYYY')} – ${loc.format(end, 'DD/MM/YYYY')}`,
              }}
              length={currentView === 'agenda' ? 7 : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Meetings list */}
      <Card className="border-slate-200/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              All Meetings ({sortedMeetings.length})
            </h3>
            <div className="text-sm text-slate-500">Sorted by date</div>
          </div>

          <div ref={meetingsListRef} className="space-y-3 max-h-80 overflow-y-auto">
            {sortedMeetings.length > 0 ? (
              sortedMeetings.map((event) => {
                if (!event) return null;

                const hasResponded = event.participant_responses?.[currentUserIdForList];
                const canRespond =
                  userRole === 'collaborator' &&
                  (event.status === 'pending' || event.status === 'partially_accepted') &&
                  !hasResponded &&
                  !event._hideButtons;

                return (
                  <div
                    key={event.id}
                    id={`meeting-${event.id}`}
                    className={`flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors ${
                      selectedMeetingId === event.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-3 h-3 rounded-full mt-2 ${
                            event.status === 'accepted'
                              ? 'bg-green-500'
                              : event.status === 'declined'
                              ? 'bg-red-500'
                              : event.status === 'partially_accepted'
                              ? 'bg-yellow-500'
                              : event.status === 'pending'
                              ? 'bg-blue-500'
                              : 'bg-gray-500'
                          }`}
                        ></div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <p className="font-medium text-slate-900">
                              {event.title || 'Untitled Meeting'}
                            </p>
                            <span
                              className={`inline-block px-2 py-1 text-xs rounded-full ${
                                event.status === 'accepted'
                                  ? 'bg-green-100 text-green-700'
                                  : event.status === 'declined'
                                  ? 'bg-red-100 text-red-700'
                                  : event.status === 'partially_accepted'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : event.status === 'pending'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {event.status === 'accepted'
                                ? '✓ All Accepted'
                                : event.status === 'declined'
                                ? '✗ All Declined'
                                : event.status === 'partially_accepted'
                                ? '⚠ Some Responses'
                                : event.status === 'pending'
                                ? '⏳ Waiting Responses'
                                : 'Scheduled'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-2">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                {event.start
                                  ? new Date(event.start).toLocaleDateString()
                                  : 'Date TBD'}{' '}
                                • {formatTimeDisplay(event)}
                              </span>
                            </div>

                            {event.location && event.location !== 'Virtual' && (
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-4 w-4" />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                            <div className="flex items-center space-x-1">
                              <User className="h-4 w-4" />
                              <span className="text-slate-500">Organized by:</span>
                              <span className="font-medium">
                                {event.organizer_name || 'Manager'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4" />
                              <span className="text-slate-500">Participants:</span>
                              <span
                                className="font-medium cursor-help bg-blue-50 px-2 py-1 rounded text-blue-700 text-xs"
                                title={
                                  event.participant_names && event.participant_names.length > 0
                                    ? event.participant_names.join(', ')
                                    : 'No participants'
                                }
                              >
                                {formatParticipants(event.participant_names)}
                              </span>
                            </div>
                          </div>

                          {/* Manager: résumé des réponses (clarifié avec noms complets) */}
                          {userRole === 'manager' &&
                            event.participant_responses &&
                            Object.keys(event.participant_responses).length > 0 && (
                              <div className="flex items-start space-x-1 mt-2">
                                <Users className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div className="flex flex-col">
                                  <span className="text-slate-500 text-xs mb-1">
                                    Responses:
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(event.participant_responses).map(
                                      ([participantId, response]) => {
                                        const idx = event.participant_ids?.indexOf(participantId);
                                        const participantName =
                                          idx !== -1 && event.participant_names
                                            ? event.participant_names[idx]
                                            : 'Unknown';

                                        const isAccept = response === 'accept';
                                        const label = isAccept ? 'Accepted' : 'Declined';

                                        return (
                                          <span
                                            key={participantId}
                                            className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                                              isAccept
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}
                                          >
                                            <span className="font-semibold">
                                              {participantName}
                                            </span>
                                            <span>
                                              {isAccept ? '✓ Accepted' : '✗ Declined'}
                                            </span>
                                          </span>
                                        );
                                      }
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                          {event.description && (
                            <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Colonne actions */}
                    <div className="flex space-x-2 ml-4">
                      {canRespond && (
                        <>
                          <ResponseButton meeting={event} action="accept" />
                          <ResponseButton meeting={event} action="decline" />
                        </>
                      )}

                      {userRole === 'collaborator' && hasResponded && (
                        <div
                          className={`px-3 py-1 rounded text-xs font-medium ${
                            hasResponded === 'accept'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {hasResponded === 'accept' ? '✓ You Accepted' : '✗ You Declined'}
                        </div>
                      )}

                      {userRole === 'manager' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleEditMeeting(event)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Meeting
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() =>
                                handleDeleteMeeting(event.id, event.title || 'this meeting')
                              }
                              className="text-red-600"
                              disabled={deleteLoading === event.id}
                            >
                              {deleteLoading === event.id ? (
                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-b-2 border-red-600" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Delete Meeting
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No meetings scheduled</p>
                <p className="text-sm">
                  {userRole === 'manager'
                    ? 'Create meetings to see them here'
                    : 'Your manager will schedule meetings with you'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit meeting modal */}
      {showEditModal && (
        <EditMeetingModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          meeting={editMeeting}
          collaborators={collaborators}
          onMeetingUpdated={handleMeetingUpdated}
        />
      )}
    </div>
  );
};

export default EnhancedCalendar;
