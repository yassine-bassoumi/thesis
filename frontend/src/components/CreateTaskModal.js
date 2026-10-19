import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Users, AlertTriangle, Clock, CheckCircle, Loader } from 'lucide-react';
import { format } from "date-fns";
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const CreateTaskModal = ({ isOpen, onClose, onTaskCreated, collaborators = [] }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    due_date: null,
    priority: 'medium',
    status: 'pending',
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
    
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    
    if (!formData.assignee_id) {
      toast.error('Please assign the task to a collaborator');
      return;
    }

    if (!formData.due_date) {
      toast.error('Due date is required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Authentication required. Please login again.');
        setLoading(false);
        return;
      }
      
      const payload = {
        ...formData,
        status: 'pending',
        due_date: formData.due_date.toISOString(),
      };

      const response = await axios.post(`${API}/tasks`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Task created successfully:', response.data);
      toast.success('Task created successfully!');

      setFormData({
        title: '',
        description: '',
        assignee_id: '',
        due_date: null,
        priority: 'medium',
        status: 'pending',
      });
      
      if (onTaskCreated) {
        onTaskCreated(response.data);
      }
      
      onClose();
      
    } catch (error) {
      console.error('❌ Error creating task:', error);
      
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          const errorMessages = error.response.data.detail.map(err => 
            `${err.loc?.join('.') || 'unknown'}: ${err.msg}`
          ).join(', ');
          toast.error(`Validation errors: ${errorMessages}`);
        } else {
          toast.error(`Creation failed: ${error.response.data.detail}`);
        }
      } else if (error.response?.status) {
        toast.error(`Server error: ${error.response.status} - ${error.response.statusText}`);
      } else {
        toast.error('Failed to create task. Please check your connection and try again.');
      }
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

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        assignee_id: '',
        due_date: null,
        priority: 'medium',
        status: 'pending',
      });
    }
  }, [isOpen]);

  // 🔥 STYLES FORCÉS POUR RÉSOUDRE LE PROBLÈME DE COULEUR
  const modalStyles = {
    dialogContent: {
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
    },
    input: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: 'black',
    },
    textarea: {
      backgroundColor: 'white', 
      border: '1px solid #d1d5db',
      color: 'black',
    },
    select: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: 'black',
    },
    button: {
      backgroundColor: '#2563eb',
      color: 'white',
    },
    buttonOutline: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: '#374151',
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        style={modalStyles.dialogContent}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'black' }} className="text-2xl font-semibold flex items-center">
            <div style={{ backgroundColor: '#dbeafe', padding: '8px', borderRadius: '8px', marginRight: '12px' }}>
              <Users style={{ color: '#2563eb', width: '24px', height: '24px' }} />
            </div>
            Create New Task
          </DialogTitle>
          <DialogDescription style={{ color: '#4b5563' }}>
            Assign a new task to a team member with deadline and priority settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title" style={{ color: 'black' }} className="font-medium">
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
              className="h-12"
              style={modalStyles.input}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" style={{ color: 'black' }} className="font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Provide detailed task description..."
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="resize-none"
              style={modalStyles.textarea}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="assignee" style={{ color: 'black' }} className="font-medium">
                Assign To *
              </Label>
              <Select 
                value={formData.assignee_id}
                onValueChange={(value) => setFormData({...formData, assignee_id: value})}
                required
              >
                <SelectTrigger className="h-12" style={modalStyles.select}>
                  <SelectValue placeholder="Select collaborator" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}>
                  {collaborators.length > 0 ? (
                    collaborators.map((collaborator) => (
                      <SelectItem 
                        key={collaborator.id} 
                        value={collaborator.id}
                        style={{ color: 'black' }}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {collaborator.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p style={{ color: 'black' }} className="font-medium">{collaborator.full_name || 'Unknown User'}</p>
                            <p style={{ color: '#6b7280' }} className="text-xs">{collaborator.email || 'No email'}</p>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-collaborators" disabled>
                      No collaborators available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority" style={{ color: 'black' }} className="font-medium">
                Priority
              </Label>
              <Select 
                value={formData.priority}
                onValueChange={(value) => setFormData({...formData, priority: value})}
              >
                <SelectTrigger className="h-12" style={modalStyles.select}>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}>
                  <SelectItem value="high">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon('high')}
                      <span style={{ color: 'black' }}>High Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon('medium')}
                      <span style={{ color: 'black' }}>Medium Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="low">
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon('low')}
                      <span style={{ color: 'black' }}>Low Priority</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label style={{ color: 'black' }} className="font-medium">
              Due Date *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full h-12 justify-start text-left font-normal ${
                    !formData.due_date && "text-gray-500"
                  }`}
                  style={modalStyles.buttonOutline}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date ? format(formData.due_date, "PPP") : "Pick a due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0" 
                align="start" 
                style={{ backgroundColor: 'white', color: 'black', border: '1px solid #d1d5db' }}
              >
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData({...formData, due_date: date})}
                  disabled={isPastDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-6"
              disabled={loading}
              style={modalStyles.buttonOutline}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="px-6"
              style={modalStyles.button}
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
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