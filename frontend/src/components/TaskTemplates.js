// src/components/TaskTemplates.js
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarIcon,
  Plus,
  FileText,
  Trash2,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { format } from "date-fns";
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const TaskTemplates = ({ collaborators = [], onTaskCreated }) => {
  const [templates, setTemplates] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInstantiateForm, setShowInstantiateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [instantiateData, setInstantiateData] = useState({
    assignee_ids: [],
    due_date: null
  });
  const [isCreating, setIsCreating] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    default_priority: 'medium',
    estimated_duration_hours: 1
  });

  // 🔥 STYLES FORCÉS comme CreateTaskModal
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

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await axios.get(`${API}/task-templates`, {
        headers: getAuthHeaders()
      });
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load task templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const createTemplate = async (e) => {
    e.preventDefault();

    if (!newTemplate.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      setIsCreating(true);
      await axios.post(
        `${API}/task-templates`,
        newTemplate,
        { headers: getAuthHeaders() }
      );

      toast.success('Template created successfully!');
      setShowCreateForm(false);

      setNewTemplate({
        name: '',
        description: '',
        default_priority: 'medium',
        estimated_duration_hours: 1
      });

      await fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCollaboratorToggle = (collaboratorId) => {
    setInstantiateData(prev => {
      const currentIds = prev.assignee_ids || [];
      if (currentIds.includes(collaboratorId)) {
        return {
          ...prev,
          assignee_ids: currentIds.filter(id => id !== collaboratorId)
        };
      } else {
        return {
          ...prev,
          assignee_ids: [...currentIds, collaboratorId]
        };
      }
    });
  };

  const toggleSelectAll = () => {
    setInstantiateData(prev => {
      const allIds = collaborators.map(c => c.id);
      const currentIds = prev.assignee_ids || [];

      if (currentIds.length === collaborators.length) {
        return { ...prev, assignee_ids: [] };
      } else {
        return { ...prev, assignee_ids: allIds };
      }
    });
  };

  const instantiateTemplate = async () => {
    if (!selectedTemplate) {
      toast.error('No template selected');
      return;
    }

    if (!instantiateData.assignee_ids || instantiateData.assignee_ids.length === 0) {
      toast.error('Please select at least one collaborator');
      return;
    }

    if (!instantiateData.due_date) {
      toast.error('Please select a due date');
      return;
    }

    setIsCreating(true);
    try {
      const tasks = await Promise.all(
        instantiateData.assignee_ids.map(assignee_id =>
          axios.post(
            `${API}/task-templates/${selectedTemplate.id}/instantiate`,
            {
              assignee_id: assignee_id,
              due_date: instantiateData.due_date.toISOString()
            },
            { headers: getAuthHeaders() }
          )
        )
      );

      toast.success(`Created ${tasks.length} task(s) successfully!`);

      setShowInstantiateForm(false);
      setSelectedTemplate(null);
      setInstantiateData({ assignee_ids: [], due_date: null });

      if (typeof onTaskCreated === 'function') {
        onTaskCreated();
      }
    } catch (error) {
      console.error('Error instantiating template:', error);
      toast.error('Failed to create tasks from template');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await axios.delete(`${API}/task-templates/${templateId}`, {
        headers: getAuthHeaders()
      });
      toast.success('Template deleted successfully!');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
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
    <div className="space-y-6">
      {/* Header + bouton New Template */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Task Templates</h2>
          <p className="text-slate-600">Create and manage reusable task templates</p>
        </div>

        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            style={modalStyles.dialogContent}
          >
            <DialogHeader>
              <DialogTitle
                className="text-2xl font-semibold"
                style={{ color: 'black' }}
              >
                Create Task Template
              </DialogTitle>
              <DialogDescription style={{ color: '#4b5563' }}>
                Create a reusable template for common tasks.
              </DialogDescription>
            </DialogHeader>

            {/* Formulaire de création */}
            <form onSubmit={createTemplate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name" style={{ color: 'black' }} className="font-medium">
                  Template Name *
                </Label>
                <Input
                  id="name"
                  placeholder="Enter template name"
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                  required
                  className="h-11"
                  style={modalStyles.input}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" style={{ color: 'black' }} className="font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the template purpose and requirements"
                  value={newTemplate.description}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, description: e.target.value })
                  }
                  rows={3}
                  className="resize-none"
                  style={modalStyles.textarea}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority" style={{ color: 'black' }} className="font-medium">
                    Default Priority
                  </Label>
                  <Select
                    value={newTemplate.default_priority}
                    onValueChange={(value) =>
                      setNewTemplate({ ...newTemplate, default_priority: value })
                    }
                  >
                    <SelectTrigger className="h-11" style={modalStyles.select}>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        backgroundColor: 'white',
                        color: 'black',
                        border: '1px solid #d1d5db'
                      }}
                    >
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration" style={{ color: 'black' }} className="font-medium">
                    Estimated Duration (hours)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="100"
                    value={newTemplate.estimated_duration_hours}
                    onChange={(e) =>
                      setNewTemplate({
                        ...newTemplate,
                        estimated_duration_hours:
                          parseInt(e.target.value, 10) || 1
                      })
                    }
                    className="h-11"
                    style={modalStyles.input}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isCreating}
                  className="px-5"
                  style={modalStyles.buttonOutline}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="px-5"
                  disabled={isCreating}
                  style={modalStyles.button}
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des templates */}
      {loadingTemplates ? (
        <div className="text-center py-10 text-slate-500">
          Loading templates...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:shadow-lg transition-shadow bg-white/90"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg text-slate-900">
                      {template.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTemplate(template.id)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="line-clamp-2 text-slate-600">
                  {template.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2 text-slate-700">
                    {getPriorityIcon(template.default_priority)}
                    <span className="capitalize">
                      {template.default_priority} priority
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {template.usage_count || 0} uses
                  </Badge>
                </div>

                <div className="flex items-center text-sm text-slate-600">
                  <Clock className="h-4 w-4 mr-1" />
                  {template.estimated_duration_hours}h estimated
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setInstantiateData({ assignee_ids: [], due_date: null });
                    setShowInstantiateForm(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}

          {templates.length === 0 && !loadingTemplates && (
            <div className="col-span-full text-center py-12 text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No templates yet</p>
              <p className="text-sm">
                Create your first template to get started
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal pour instancier un template */}
      <Dialog open={showInstantiateForm} onOpenChange={setShowInstantiateForm}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          style={modalStyles.dialogContent}
        >
          <DialogHeader>
            <DialogTitle
              className="text-2xl font-semibold"
              style={{ color: 'black' }}
            >
              Create Task from Template
            </DialogTitle>
            <DialogDescription style={{ color: '#4b5563' }}>
              Assign "{selectedTemplate?.name}" to team members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Choix des collaborateurs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label style={{ color: 'black' }} className="font-medium">
                  Assign To
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  style={modalStyles.buttonOutline}
                >
                  {instantiateData.assignee_ids?.length === collaborators.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>

              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-white">
                <div className="space-y-3">
                  {collaborators.map((collaborator) => (
                    <div
                      key={collaborator.id}
                      className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer"
                      onClick={() => handleCollaboratorToggle(collaborator.id)}
                    >
                      <Checkbox
                        checked={
                          instantiateData.assignee_ids?.includes(
                            collaborator.id
                          ) || false
                        }
                        onCheckedChange={() =>
                          handleCollaboratorToggle(collaborator.id)
                        }
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {collaborator.full_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {collaborator.email}
                        </p>
                      </div>
                      <Users className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-sm text-slate-600">
                {instantiateData.assignee_ids?.length || 0} collaborator(s) selected
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <Label style={{ color: 'black' }} className="font-medium">
                Due Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal h-11 ${
                      !instantiateData.due_date && "text-slate-500"
                    }`}
                    style={modalStyles.buttonOutline}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {instantiateData.due_date
                      ? format(instantiateData.due_date, "PPP")
                      : "Pick a due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                    border: '1px solid #d1d5db'
                  }}
                >
                  <Calendar
                    mode="single"
                    selected={instantiateData.due_date}
                    onSelect={(date) =>
                      setInstantiateData({
                        ...instantiateData,
                        due_date: date
                      })
                    }
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowInstantiateForm(false)}
                disabled={isCreating}
                className="px-5"
                style={modalStyles.buttonOutline}
              >
                Cancel
              </Button>
              <Button
                onClick={instantiateTemplate}
                className="px-5"
                style={modalStyles.button}
                disabled={
                  !instantiateData.assignee_ids?.length ||
                  !instantiateData.due_date ||
                  isCreating
                }
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Create {instantiateData.assignee_ids?.length || 0} Task(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskTemplates;
