import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Award, 
  Star, 
  Clock, 
  CheckCircle, 
  User, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  Loader 
} from 'lucide-react';
import { API, useAuth } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const PerformanceEvaluationModal = ({ 
  isOpen, 
  onClose, 
  onComplete, 
  taskId, 
  collaboratorId,
  taskTitle,
  collaboratorName 
}) => {
  const [formData, setFormData] = useState({
    punctuality_score: '',
    quality_score: '',
    comments: ''
  });
  const [loading, setLoading] = useState(false);
  const [taskDetails, setTaskDetails] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const { logout } = useAuth();

  // ✅ Helper headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return { headers };
  };

  // ✅ Quand le modal s'ouvre : on charge la tâche et on pré-remplit si déjà évaluée
  useEffect(() => {
    if (isOpen && taskId) {
      checkEvaluationStatus();
    }
    if (isOpen) {
      setFormData({
        punctuality_score: '',
        quality_score: '',
        comments: ''
      });
    }
  }, [isOpen, taskId]);

  const checkEvaluationStatus = async () => {
    setCheckingStatus(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        setTimeout(() => logout(), 1500);
        return;
      }

      const response = await axios.get(
        `${API}/tasks/${taskId}`,
        getAuthHeaders()
      );
      const taskData = response.data;
      setTaskDetails(taskData);

      const canEvaluate =
        taskData.status === 'not_evaluated' ||
        taskData.status === 'completed';

      if (!canEvaluate) {
        toast.error(`Task is not completed yet. Current status: ${taskData.status}`);
        setTimeout(() => onClose(), 2000);
        return;
      }

      const hasExistingEvaluation =
        taskData.punctuality_score != null ||
        taskData.quality_score != null ||
        taskData.evaluation_date != null ||
        taskData.performance_rating != null ||
        (taskData.feedback && taskData.feedback.trim() !== '');

      if (hasExistingEvaluation) {
        setFormData({
          punctuality_score: taskData.punctuality_score != null 
            ? String(taskData.punctuality_score) 
            : '',
          quality_score: taskData.quality_score != null 
            ? String(taskData.quality_score) 
            : '',
          comments: (taskData.feedback || taskData.comments || '').trim()
        });
      }

    } catch (error) {
      console.error('Error checking task status:', error);

      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        setTimeout(() => logout(), 1500);
        return;
      }

      toast.error('Failed to verify task status');
      setTimeout(() => onClose(), 2000);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.punctuality_score || !formData.quality_score) {
      toast.error('Please provide scores for both punctuality and quality');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        setTimeout(() => logout(), 1500);
        return;
      }
      
      const numericPunctuality = parseInt(formData.punctuality_score, 10);
      const numericQuality = parseInt(formData.quality_score, 10);
      const overallScore = (numericPunctuality + numericQuality) / 2;

      const response = await axios.post(
        `${API}/tasks/${taskId}/evaluate`,
        {
          task_id: taskId,
          collaborator_id: collaboratorId,
          punctuality_score: numericPunctuality,
          quality_score: numericQuality,
          performance_rating: overallScore,
          overall_score: overallScore,
          comments: formData.comments.trim() || null
        },
        getAuthHeaders()
      );
      
      const serverData = response.data || {};
      const nowIso = new Date().toISOString();

      let updatedTask = null;

      if (taskDetails) {
        updatedTask = {
          ...taskDetails,
          ...serverData,
          punctuality_score:
            serverData.punctuality_score ??
            taskDetails.punctuality_score ??
            numericPunctuality,
          quality_score:
            serverData.quality_score ??
            taskDetails.quality_score ??
            numericQuality,
          performance_rating:
            serverData.performance_rating ??
            serverData.overall_score ??
            taskDetails.performance_rating ??
            taskDetails.overall_score ??
            overallScore,
          feedback:
            serverData.feedback ??
            serverData.comments ??
            taskDetails.feedback ??
            (formData.comments.trim() || null),
          evaluation_date:
            serverData.evaluation_date ||
            serverData.created_at ||
            taskDetails.evaluation_date ||
            nowIso,
          status: serverData.status || taskDetails.status || 'completed',
        };
      } else if (serverData.id) {
        updatedTask = serverData;
      }

      if (updatedTask) {
        setTaskDetails(updatedTask);
      }

      setFormData({
        punctuality_score: '',
        quality_score: '',
        comments: ''
      });
      
      if (onComplete) {
        onComplete(updatedTask);
      }
      
    } catch (error) {
      console.error('❌ Error submitting evaluation:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        setTimeout(() => logout(), 1500);
        return;
      }

      const errorMessage = error.response?.data?.detail || 'Failed to submit evaluation';
      toast.error(`Evaluation failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = (fieldName, currentValue, icon, title, description) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {icon}
          <div>
            <Label style={{ color: 'black', fontSize: '16px', fontWeight: '500' }}>{title}</Label>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>{description}</p>
          </div>
        </div>
        
        <RadioGroup
          value={currentValue}
          onValueChange={(value) => setFormData({...formData, [fieldName]: value})}
          className="flex space-x-1"
        >
          {[1, 2, 3, 4, 5].map((score) => (
            <div key={score} className="flex items-center space-x-1">
              <RadioGroupItem 
                value={score.toString()} 
                id={`${fieldName}-${score}`}
                className="sr-only"
                disabled={checkingStatus}
              />
              <Label
                htmlFor={`${fieldName}-${score}`}
                className={`cursor-pointer p-2 rounded-lg transition-all ${
                  checkingStatus 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : parseInt(currentValue || '0', 10) >= score
                    ? 'text-yellow-500 bg-yellow-50'
                    : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                }`}
              >
                <Star 
                  className={`h-8 w-8 ${
                    parseInt(currentValue || '0', 10) >= score ? 'fill-current' : ''
                  }`} 
                />
              </Label>
            </div>
          ))}
        </RadioGroup>
        
        {currentValue && (
          <div className="flex items-center justify-between">
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Selected: <strong>{currentValue}/5</strong> stars
            </p>
            <p className={`text-sm font-medium ${
              parseInt(currentValue, 10) >= 4 ? 'text-green-600' :
              parseInt(currentValue, 10) >= 3 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {parseInt(currentValue, 10) >= 4 ? 'Excellent' :
               parseInt(currentValue, 10) >= 3 ? 'Good' :
               'Needs Improvement'}
            </p>
          </div>
        )}
      </div>
    );
  };

  const getAverageScore = () => {
    if (!formData.punctuality_score || !formData.quality_score) return null;
    return (
      (parseInt(formData.punctuality_score, 10) + 
       parseInt(formData.quality_score, 10)) / 2
    );
  };

  const averageScore = getAverageScore();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'white',
          color: 'black',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          padding: '0'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{
              padding: '8px',
              backgroundColor: '#fed7aa',
              borderRadius: '8px',
              marginRight: '12px'
            }}>
              <Award style={{ color: '#ea580c', width: '24px', height: '24px' }} />
            </div>
            <h2 style={{
              color: 'black',
              fontSize: '24px',
              fontWeight: '600',
              margin: 0
            }}>
              Performance Evaluation
            </h2>
          </div>
          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: 0,
            lineHeight: '1.5'
          }}>
            Evaluate or update the collaborator's performance on this completed task.
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', maxHeight: 'calc(90vh - 200px)', overflowY: 'auto' }}>
          {checkingStatus && (
            <div style={{
              padding: '16px',
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Loader style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#1e40af', margin: 0, fontSize: '14px' }}>
                  Verifying task status...
                </p>
              </div>
            </div>
          )}

          {/* Task info */}
          {taskDetails && (
            <div style={{
              padding: '16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <h3 style={{ color: 'black', fontSize: '16px', fontWeight: '500', marginBottom: '12px' }}>
                Task Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText style={{ color: '#2563eb', width: '16px', height: '16px' }} />
                  <span style={{ color: '#374151' }}>
                    <strong>Task:</strong> {taskTitle || taskDetails.title}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User style={{ color: '#059669', width: '16px', height: '16px' }} />
                  <span style={{ color: '#374151' }}>
                    <strong>Collaborator:</strong> {collaboratorName || taskDetails.assignee_name || 'Unknown'}
                  </span>
                </div>
                {taskDetails.completed_at && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar style={{ color: '#7c3aed', width: '16px', height: '16px' }} />
                    <span style={{ color: '#374151' }}>
                      <strong>Completed:</strong> {new Date(taskDetails.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Punctuality Rating */}
            <div style={{
              padding: '24px',
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '8px'
            }}>
              {renderStarRating(
                'punctuality_score',
                formData.punctuality_score,
                <div style={{ padding: '8px', backgroundColor: '#bfdbfe', borderRadius: '8px' }}>
                  <Clock style={{ color: '#2563eb', width: '24px', height: '24px' }} />
                </div>,
                'Punctuality & Timeliness',
                'How well did the collaborator meet deadlines and manage time?'
              )}
            </div>

            {/* Quality Rating */}
            <div style={{
              padding: '24px',
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: '8px'
            }}>
              {renderStarRating(
                'quality_score',
                formData.quality_score,
                <div style={{ padding: '8px', backgroundColor: '#bbf7d0', borderRadius: '8px' }}>
                  <CheckCircle style={{ color: '#059669', width: '24px', height: '24px' }} />
                </div>,
                'Quality of Work',
                'How would you rate the overall quality and completeness of the delivered work?'
              )}
            </div>

            {/* Average Score */}
            {averageScore && (
              <div style={{
                padding: '16px',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ color: 'black', fontSize: '16px', fontWeight: '500', margin: 0 }}>
                      Overall Performance Score
                    </h4>
                    <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0 0' }}>
                      Based on your ratings
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>
                      {averageScore.toFixed(1)}/5
                    </div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: averageScore >= 4 ? '#059669' : averageScore >= 3 ? '#d97706' : '#dc2626'
                    }}>
                      {averageScore >= 4 ? 'Excellent' :
                       averageScore >= 3 ? 'Good' :
                       'Needs Improvement'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Label htmlFor="comments" style={{ color: 'black', fontSize: '16px', fontWeight: '500' }}>
                Additional Comments & Feedback
              </Label>
              <Textarea
                id="comments"
                placeholder="Provide feedback, recognition for excellent work, or suggestions for improvement..."
                value={formData.comments}
                onChange={(e) => setFormData({...formData, comments: e.target.value})}
                rows={4}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  color: 'black',
                  borderRadius: '6px',
                  padding: '12px',
                  resize: 'none'
                }}
                disabled={checkingStatus}
              />
              <p style={{ color: '#6b7280', fontSize: '12px', margin: 0 }}>
                Your comments will be shared with the collaborator and stored in their performance records.
              </p>
            </div>

            {/* Warning for low scores */}
            {(formData.punctuality_score && parseInt(formData.punctuality_score, 10) <= 2) || 
             (formData.quality_score && parseInt(formData.quality_score, 10) <= 2) ? (
              <div style={{
                padding: '16px',
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '8px'
              }}>
                <h4 style={{ color: '#dc2626', fontSize: '14px', fontWeight: '500', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle style={{ width: '16px', height: '16px' }} />
                  Important Notice
                </h4>
                <p style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>
                  You've selected a low rating. Please provide constructive feedback in the comments section.
                </p>
              </div>
            ) : null}

            {/* Buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '24px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <Button
                type="button"
                onClick={onClose}
                disabled={loading || checkingStatus}
                style={{
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  padding: '8px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={loading || !formData.punctuality_score || !formData.quality_score || checkingStatus}
                onClick={handleSubmit}
                style={{
                  backgroundColor: loading || !formData.punctuality_score || !formData.quality_score || checkingStatus ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '8px 24px',
                  borderRadius: '6px',
                  cursor: loading || !formData.punctuality_score || !formData.quality_score || checkingStatus ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {loading ? (
                  <>
                    <Loader style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Award style={{ width: '16px', height: '16px' }} />
                    Save Evaluation
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PerformanceEvaluationModal;