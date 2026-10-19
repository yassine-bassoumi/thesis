// src/components/EditMeetingModal.js
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, MapPin, Users, X, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import axios from 'axios';
import { API } from '../App';
import { toast } from "sonner";

const EditMeetingModal = ({ isOpen, onClose, meeting, collaborators, onMeetingUpdated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: 'Virtual',
    participant_ids: []
  });

  const [meetingDate, setMeetingDate] = useState(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Headers avec token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  // Parse sécurisé de la date
  const safeParseDate = (dateValue) => {
    if (!dateValue) return null;

    try {
      if (dateValue instanceof Date) return dateValue;

      if (typeof dateValue === 'string') {
        // accepte "2025-11-27" ou ISO complet
        const parsed = parseISO(dateValue);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  useEffect(() => {
    if (isOpen && meeting) {
      console.log('📅 Meeting data for editing:', meeting);

      let parsedDate = null;
      let parsedStartTime = '09:00';
      let parsedEndTime = '10:00';

      if (meeting.meeting_date) {
        // Nouveau modèle : "YYYY-MM-DD"
        parsedDate = safeParseDate(meeting.meeting_date);
        parsedStartTime = meeting.start_time || '09:00';
        parsedEndTime = meeting.end_time || '10:00';
      } else if (
        meeting.start_time &&
        typeof meeting.start_time === 'string' &&
        meeting.start_time.includes('T')
      ) {
        // Ancien modèle : start_time en timestamp ISO
        const start = safeParseDate(meeting.start_time);
        if (start && !isNaN(start.getTime())) {
          parsedDate = new Date(start);
          parsedDate.setHours(0, 0, 0, 0);
          parsedStartTime = format(start, 'HH:mm');
        }
        if (meeting.end_time) {
          const end = safeParseDate(meeting.end_time);
          if (end && !isNaN(end.getTime())) {
            parsedEndTime = format(end, 'HH:mm');
          }
        }
      }

      setFormData({
        title: meeting.title || '',
        description: meeting.description || '',
        location: meeting.location || 'Virtual',
        participant_ids: meeting.participant_ids || []
      });

      setMeetingDate(parsedDate);
      setStartTime(parsedStartTime);
      setEndTime(parsedEndTime);

      console.log('🔄 Parsed meeting data:', {
        date: parsedDate,
        startTime: parsedStartTime,
        endTime: parsedEndTime
      });

      setError('');
    }
  }, [isOpen, meeting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation basique
      if (!formData.title.trim()) {
        throw new Error('Meeting title is required.');
      }

      if (!meetingDate) {
        throw new Error('Meeting date is required.');
      }

      if (!startTime || !endTime) {
        throw new Error('Start time and end time are required.');
      }

      if (startTime >= endTime) {
        throw new Error('End time must be after start time.');
      }

      if (!formData.participant_ids || formData.participant_ids.length === 0) {
        throw new Error('At least one participant must be selected.');
      }

      const meetingDateISO = format(meetingDate, 'yyyy-MM-dd');

      const meetingData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        meeting_date: meetingDateISO,
        start_time: startTime,
        end_time: endTime,
        participant_ids: formData.participant_ids,
      };

      console.log('📤 Sending meeting update payload:', meetingData);

      const response = await axios.put(
        `${API}/meetings/${meeting.id}`,
        meetingData,
        { headers: getAuthHeaders() }
      );

      // Le backend renvoie { message: "..." } => on reconstruit l'objet côté front
      const updatedMeeting = {
        ...(meeting || {}),
        ...meetingData,
        status: meeting.status || 'pending',
      };

      console.log('✅ Meeting updated successfully:', response.data, updatedMeeting);

      toast.success('Meeting updated successfully!', {
        description: `Meeting "${updatedMeeting.title}" has been updated for ${format(meetingDate, 'MMM dd, yyyy')} from ${updatedMeeting.start_time} to ${updatedMeeting.end_time}`,
        duration: 5000,
      });

      if (onMeetingUpdated) {
        onMeetingUpdated(updatedMeeting);
      }
      onClose();

    } catch (error) {
      console.error('❌ Error updating meeting:', error);

      let errorMessage = 'Failed to update meeting';
      let toastTitle = 'Error';

      if (error.response?.status === 401) {
        toastTitle = 'Session expired';
        errorMessage = 'Your session has expired or is invalid. Please log in again.';
      } else if (error.response?.status === 409) {
        errorMessage =
          error.response?.data?.detail ||
          "Schedule conflict detected: one or more participants already have a meeting at this time.";
        toastTitle = 'Schedule conflict';
      } else if (error.response) {
        errorMessage = error.response?.data?.detail || `Error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Network error: Could not connect to server';
        toastTitle = 'Connection error';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      toast.error(toastTitle, {
        description: errorMessage,
        duration: 6000,
      });

    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (participantId) => {
    setFormData(prev => ({
      ...prev,
      participant_ids: prev.participant_ids.includes(participantId)
        ? prev.participant_ids.filter(id => id !== participantId)
        : [...prev.participant_ids, participantId]
    }));
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(timeString);
      }
    }
    return times;
  };

  const safeFormatDate = (date) => {
    if (!date || isNaN(date.getTime())) {
      return 'Select date';
    }
    try {
      return format(date, 'PPP');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  if (!isOpen || !meeting) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Edit Meeting</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-700 font-medium mb-1">Cannot update meeting</p>
                <pre className="text-red-600 text-sm whitespace-pre-wrap">{error}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Meeting info header */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-6">
          <h4 className="font-medium text-blue-800 mb-2">Meeting Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <span className="font-medium">Meeting ID:</span>
              <p className="truncate font-mono text-xs">{meeting.id}</p>
            </div>
            <div>
              <span className="font-medium">Current Status:</span>
              <Badge
                className="ml-1 capitalize"
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
            <div className="col-span-2">
              <span className="font-medium">Organizer:</span>
              <p>{meeting.organizer_name || 'Unknown'}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium mb-2">
              Meeting Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter meeting title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium mb-2">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Meeting agenda and details"
              rows={3}
            />
          </div>

          {/* Date + times */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date */}
            <div className="md:col-span-1">
              <Label className="text-sm font-medium mb-2">
                Meeting Date *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {safeFormatDate(meetingDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={meetingDate}
                    onSelect={setMeetingDate}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Start time */}
            <div>
              <Label className="text-sm font-medium mb-2">
                Start Time *
              </Label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md"
              >
                {generateTimeOptions().map(time => (
                  <option key={`start-${time}`} value={time}>{time}</option>
                ))}
              </select>
            </div>

            {/* End time */}
            <div>
              <Label className="text-sm font-medium mb-2">
                End Time *
              </Label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-md"
              >
                {generateTimeOptions().map(time => (
                  <option key={`end-${time}`} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location" className="text-sm font-medium mb-2">
              Location
            </Label>
            <div className="flex items-center">
              <MapPin className="h-4 w-4 text-slate-400 mr-2" />
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Virtual meeting"
              />
            </div>
          </div>

          {/* Participants */}
          <div>
            <Label className="text-sm font-medium mb-2">
              Participants *
            </Label>
            <div className="flex items-center mb-3">
              <Users className="h-4 w-4 text-slate-400 mr-2" />
              <span className="text-sm text-slate-600">
                Select team members to invite ({formData.participant_ids.length} selected)
              </span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {collaborators.map((collaborator) => (
                <div
                  key={collaborator.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                    formData.participant_ids.includes(collaborator.id)
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-slate-50'
                  }`}
                  onClick={() => toggleParticipant(collaborator.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-semibold">
                        {collaborator.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {collaborator.full_name || 'Unknown User'}
                      </p>
                      <p className="text-slate-600 text-xs">{collaborator.email}</p>
                    </div>
                  </div>
                  {formData.participant_ids.includes(collaborator.id) && (
                    <Badge className="bg-green-100 text-green-700">Selected</Badge>
                  )}
                </div>
              ))}

              {collaborators.length === 0 && (
                <div className="text-center py-4 text-slate-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No team members available</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                loading ||
                !formData.title.trim() ||
                !meetingDate ||
                formData.participant_ids.length === 0
              }
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </>
              ) : (
                'Update Meeting'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMeetingModal;
