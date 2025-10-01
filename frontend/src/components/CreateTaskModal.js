import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Users, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { format } from "date-fns";
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const CreateTaskModal = ({ isOpen, onClose, onTaskCreated, collaborators }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    due_date: null,
    priority: 'medium'
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.assignee_id || !formData.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/tasks`, {
        ...formData,
        due_date: formData.due_date.toISOString()
      });
      
      toast.success('Task created successfully!');
      onTaskCreated();
      setFormData({
        title: '',
        description: '',
        assignee_id: '',
        due_date: null,
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error.response?.data?.detail || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-slate-900 flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            Create New Task
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Assign a new task to a team member with deadline and priority settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-slate-700 font-medium">
              Task Title *
            </Label>
            <Input
              id="title"
              name="title"
              type="text"
              placeholder="Enter task title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="bg-white border-slate-200 h-12"
              data-testid="task-title-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-slate-700 font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Provide detailed task description..."
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="bg-white border-slate-200 resize-none"
              data-testid="task-description-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="assignee" className="text-slate-700 font-medium">
                Assign To *
              </Label>
              <Select 
                onValueChange={(value) => setFormData({...formData, assignee_id: value})}
                required
              >
                <SelectTrigger className="bg-white border-slate-200 h-12" data-testid="assignee-select">
                  <SelectValue placeholder="Select collaborator" />
                </SelectTrigger>
                <SelectContent>
                  {collaborators.map((collaborator) => (
                    <SelectItem key={collaborator.id} value={collaborator.id} data-testid={`assignee-${collaborator.id}`}>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {collaborator.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{collaborator.full_name}</p>
                          <p className="text-xs text-slate-500">{collaborator.email}</p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority" className="text-slate-700 font-medium">
                Priority
              </Label>
              <Select 
                onValueChange={(value) => setFormData({...formData, priority: value})}
                defaultValue="medium"
              >
                <SelectTrigger className="bg-white border-slate-200 h-12" data-testid="priority-select">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high" data-testid="priority-high">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon('high')}
                      <span>High Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium" data-testid="priority-medium">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon('medium')}
                      <span>Medium Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="low" data-testid="priority-low">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon('low')}
                      <span>Low Priority</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">
              Due Date *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full h-12 justify-start text-left font-normal bg-white border-slate-200 ${
                    !formData.due_date && "text-slate-500"
                  }`}
                  data-testid="due-date-picker"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, "PPP") : "Pick a due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData({...formData, due_date: date})}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="px-6"
              data-testid="cancel-task-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="btn-primary px-6"
              data-testid="create-task-submit"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="loading-spinner mr-2"></div>
                  Creating...
                </div>
              ) : (
                'Create Task'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal;