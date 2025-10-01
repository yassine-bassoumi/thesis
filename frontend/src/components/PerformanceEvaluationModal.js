import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Award, Star, Clock, CheckCircle } from 'lucide-react';
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const PerformanceEvaluationModal = ({ isOpen, onClose, onComplete, taskId, collaboratorId }) => {
  const [formData, setFormData] = useState({
    punctuality_score: '',
    quality_score: '',
    comments: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.punctuality_score || !formData.quality_score) {
      toast.error('Please provide scores for both punctuality and quality');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/performance`, {
        task_id: taskId,
        collaborator_id: collaboratorId,
        punctuality_score: parseInt(formData.punctuality_score),
        quality_score: parseInt(formData.quality_score),
        comments: formData.comments.trim() || null
      });
      
      onComplete();
      setFormData({
        punctuality_score: '',
        quality_score: '',
        comments: ''
      });
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit evaluation');
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
            <Label className="text-base font-medium text-slate-900">{title}</Label>
            <p className="text-sm text-slate-600">{description}</p>
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
              />
              <Label
                htmlFor={`${fieldName}-${score}`}
                className={`cursor-pointer p-2 rounded-lg transition-all ${
                  parseInt(currentValue) >= score
                    ? 'text-yellow-500'
                    : 'text-slate-300 hover:text-slate-400'
                }`}
                data-testid={`${fieldName}-star-${score}`}
              >
                <Star 
                  className={`h-8 w-8 ${
                    parseInt(currentValue) >= score ? 'fill-current' : ''
                  }`} 
                />
              </Label>
            </div>
          ))}
        </RadioGroup>
        
        {currentValue && (
          <p className="text-sm text-slate-600">
            Selected: {currentValue}/5 stars
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-slate-900 flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg mr-3">
              <Award className="h-6 w-6 text-purple-600" />
            </div>
            Performance Evaluation
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Rate the collaborator's performance on this task. Your feedback helps improve team productivity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8 mt-6">
          {/* Punctuality Rating */}
          <div className="p-6 bg-slate-50 rounded-lg">
            {renderStarRating(
              'punctuality_score',
              formData.punctuality_score,
              <Clock className="h-6 w-6 text-blue-600" />,
              'Punctuality',
              'How well did the collaborator meet deadlines and time commitments?'
            )}
          </div>

          {/* Quality Rating */}
          <div className="p-6 bg-slate-50 rounded-lg">
            {renderStarRating(
              'quality_score',
              formData.quality_score,
              <CheckCircle className="h-6 w-6 text-green-600" />,
              'Quality of Work',
              'How would you rate the overall quality and completeness of the work?'
            )}
          </div>

          {/* Comments */}
          <div className="space-y-3">
            <Label htmlFor="comments" className="text-base font-medium text-slate-900">
              Additional Comments (Optional)
            </Label>
            <Textarea
              id="comments"
              placeholder="Provide specific feedback, suggestions for improvement, or recognition for excellent work..."
              value={formData.comments}
              onChange={(e) => setFormData({...formData, comments: e.target.value})}
              rows={4}
              className="bg-white border-slate-200 resize-none"
              data-testid="evaluation-comments"
            />
          </div>

          {/* Rating Guide */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">Rating Guide</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <p><strong>5 stars:</strong> Exceptional - Exceeded expectations</p>
              <p><strong>4 stars:</strong> Very Good - Met expectations well</p>
              <p><strong>3 stars:</strong> Good - Met basic expectations</p>
              <p><strong>2 stars:</strong> Fair - Below expectations, needs improvement</p>
              <p><strong>1 star:</strong> Poor - Did not meet expectations</p>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="px-6"
              data-testid="cancel-evaluation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="btn-primary px-6"
              data-testid="submit-evaluation"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="loading-spinner mr-2"></div>
                  Submitting...
                </div>
              ) : (
                'Submit Evaluation'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PerformanceEvaluationModal;