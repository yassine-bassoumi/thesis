// src/components/MeetingResponsesModal.js
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle, XCircle, Clock, Users, MapPin, Calendar } from 'lucide-react';

const MeetingResponsesModal = ({ isOpen, onClose, meeting, responses }) => {
  if (!isOpen || !meeting) return null;

  const getResponseIcon = (response) => {
    switch (response) {
      case 'accept': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'decline': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getResponseColor = (response) => {
    switch (response) {
      case 'accept': return 'bg-green-50 text-green-700 border-green-200';
      case 'decline': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getResponseText = (response) => {
    switch (response) {
      case 'accept': return 'Accepted';
      case 'decline': return 'Declined';
      default: return 'Pending';
    }
  };

  // Handle missing data
  const summary = responses?.summary || { accepted: 0, declined: 0, pending: 0 };
  const participantResponses = responses?.responses || [];

  // Format date only
  const formatMeetingDate = (meeting) => {
    if (meeting.meeting_date) {
      const meetingDate = new Date(meeting.meeting_date);
      return meetingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else if (meeting.start) {
      const startDate = new Date(meeting.start);
      return startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else {
      return 'Date not specified';
    }
  };

  // Format time only
  const formatMeetingTime = (meeting) => {
    if (meeting.start_time && meeting.end_time) {
      // New structure
      return `${meeting.start_time} - ${meeting.end_time}`;
    } else if (meeting.start && meeting.end) {
      // Fallback (old structure)
      const startDate = new Date(meeting.start);
      const endDate = new Date(meeting.end);
      const startTime = startDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const endTime = endDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return `${startTime} - ${endTime}`;
    } else {
      return 'Time not specified';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">
              Meeting Responses
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Meeting info */}
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-4">
            <h3 className="font-semibold text-slate-900 mb-2 text-lg">{meeting.title}</h3>
            <p className="text-sm text-slate-600 mb-3">
              {meeting.description || 'No description provided'}
            </p>
            
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <div>
                  <span className="font-medium">Date: </span>
                  {formatMeetingDate(meeting)}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <div>
                  <span className="font-medium">Time: </span>
                  {formatMeetingTime(meeting)}
                </div>
              </div>
              
              {meeting.location && meeting.location !== 'Virtual' && (
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <div>
                    <span className="font-medium">Location: </span>
                    {meeting.location}
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <div>
                  <span className="font-medium">Status: </span>
                  <span className="capitalize">{meeting.status || 'pending'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {summary.accepted}
              </div>
              <div className="text-sm text-green-700">Accepted</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {summary.declined}
              </div>
              <div className="text-sm text-red-700">Declined</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {summary.pending}
              </div>
              <div className="text-sm text-blue-700">Pending</div>
            </CardContent>
          </Card>
        </div>

        {/* Participants responses */}
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900 flex items-center">
            <Users className="h-4 w-4 mr-2" />
            Participants Responses ({participantResponses.length})
          </h3>
          
          {participantResponses.length > 0 ? (
            participantResponses.map((participant) => (
              <div
                key={participant.participant_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {getResponseIcon(participant.response)}
                  <div>
                    <span className="font-medium block">
                      {participant.participant_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {participant.participant_email || `ID: ${participant.participant_id}`}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={getResponseColor(participant.response)}
                >
                  {getResponseText(participant.response)}
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No responses yet</p>
              <p className="text-sm mt-1">
                Participants haven't responded to the meeting invitation
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default MeetingResponsesModal;
