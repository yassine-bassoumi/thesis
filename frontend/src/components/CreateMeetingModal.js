// src/components/CreateMeetingModal.js
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, MapPin, Users, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import axios from 'axios';
import { API } from '../App';
import { toast } from "sonner";

const CreateMeetingModal = ({ isOpen, onClose, collaborators, onMeetingCreated }) => {
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

  // ✅ Headers avec token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        title: '',
        description: '',
        location: 'Virtual',
        participant_ids: []
      });
      setMeetingDate(null);
      setStartTime('09:00');
      setEndTime('10:00');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ✅ Basic validation côté front
      if (!formData.title.trim()) {
        throw new Error('Meeting title is required');
      }

      if (!meetingDate) {
        throw new Error('Meeting date is required');
      }

      if (formData.participant_ids.length === 0) {
        throw new Error('Please select at least one participant');
      }

      // ✅ Date must be today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(meetingDate);
      selectedDate.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        throw new Error('Meeting date cannot be in the past');
      }

      // ✅ Start time < End time
      if (startTime >= endTime) {
        throw new Error('Start time must be before end time');
      }

      // ✅ Date envoyée en "YYYY-MM-DD" (sans timezone)
      const meetingDateISO = format(meetingDate, 'yyyy-MM-dd');

      const meetingData = {
        title: formData.title,
        description: formData.description,
        meeting_date: meetingDateISO,
        start_time: startTime,
        end_time: endTime,
        location: formData.location,
        participant_ids: formData.participant_ids,
        meeting_type: "team_meeting"
      };

      console.log('📤 Sending meeting data:', meetingData);

      const response = await axios.post(
        `${API}/meetings`,
        meetingData,
        { headers: getAuthHeaders() }
      );

      console.log('✅ Meeting created successfully:', response.data);

      toast.success('Meeting scheduled successfully! 🎉', {
        description: `Meeting with ${formData.participant_ids.length} participant(s) scheduled for ${format(meetingDate, 'MMM dd, yyyy')} from ${startTime} to ${endTime}`,
        duration: 5000,
      });

      if (onMeetingCreated) {
        onMeetingCreated(response.data || null);
      }

      onClose();

    } catch (error) {
      console.error('❌ Error creating meeting:', error);

      if (error.response?.status === 409) {
        const backendDetail = error.response.data?.detail;
        const conflictMessage = backendDetail || "Some participants already have a meeting at this time. Please choose a different time slot.";
        setError(conflictMessage);
        toast.error('Schedule conflict', {
          description: conflictMessage,
          duration: 8000,
        });
      } else if (error.response) {
        const errorMessage = error.response.data?.detail || `Error: ${error.response.status}`;
        setError(errorMessage);
        toast.error('Failed to schedule meeting', {
          description: errorMessage
        });
      } else if (error.request) {
        const errorMessage = 'Network error: Could not connect to server';
        setError(errorMessage);
        toast.error('Connection error', {
          description: errorMessage
        });
      } else {
        const errorMessage = error.message || 'Failed to create meeting';
        setError(errorMessage);
        toast.error('Failed to schedule meeting', {
          description: errorMessage || 'Please try again later'
        });
      }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Schedule New Meeting</h2>
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
                <p className="text-red-700 font-medium mb-1">Cannot schedule meeting</p>
                <pre className="text-red-600 text-sm whitespace-pre-wrap">{error}</pre>
              </div>
            </div>
          </div>
        )}

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

          {/* Date & Time */}
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
                    {meetingDate ? format(meetingDate, 'PPP') : 'Select date'}
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
                      return date < today; // Block past dates
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
              Add Participants *
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
                  Creating...
                </>
              ) : (
                'Create Meeting'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMeetingModal;
