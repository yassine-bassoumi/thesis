// components/TaskTemplates.js
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
import { CalendarIcon, Plus, FileText, Trash2, Users, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from "date-fns";
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const TaskTemplates = ({ collaborators, onTaskCreated }) => {
  const [templates, setTemplates] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInstantiateForm, setShowInstantiateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [instantiateData, setInstantiateData] = useState({
    assignee_id: '',
    due_date: null
  });
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    default_priority: 'medium',
    estimated_duration_hours: 1,
    category: 'general'
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/task-templates`);
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const createTemplate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/task-templates`, newTemplate);
      toast.success('Template created successfully!');
      setShowCreateForm(false);
      setNewTemplate({
        name: '',
        description: '',
        default_priority: 'medium',
        estimated_duration_hours: 1,
        category: 'general'
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    }
  };

  const instantiateTemplate = async () => {
    if (!instantiateData.assignee_id || !instantiateData.due_date) {
      toast.error('Please select assignee and due date');
      return;
    }

    console.log('🎯 Instantiating template:', {
      templateId: selectedTemplate.id,
      assigneeId: instantiateData.assignee_id,
      dueDate: instantiateData.due_date.toISOString()
    });

    try {
      // 🔥 CORRECTION : Utilise les query parameters au lieu du body
      const response = await axios.post(
        `${API}/task-templates/${selectedTemplate.id}/instantiate?assignee_id=${instantiateData.assignee_id}&due_date=${encodeURIComponent(instantiateData.due_date.toISOString())}`
      );
      
      console.log('✅ Template instantiated:', response.data);
      toast.success('Task created from template!');
      setShowInstantiateForm(false);
      setSelectedTemplate(null);
      setInstantiateData({ assignee_id: '', due_date: null });
      onTaskCreated();
    } catch (error) {
      console.error('❌ Error instantiating template:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      toast.error('Failed to create task from template');
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await axios.delete(`${API}/task-templates/${templateId}`);
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

  const getPriorityBadge = (priority) => {
    const classes = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return classes[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Task Template</DialogTitle>
              <DialogDescription>
                Create a reusable template for common tasks
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={createTemplate} className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  placeholder="Enter template name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                  placeholder="Enter template description"
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Priority</Label>
                  <Select 
                    value={newTemplate.default_priority}
                    onValueChange={(value) => setNewTemplate({...newTemplate, default_priority: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Estimated Hours</Label>
                  <Input
                    type="number"
                    value={newTemplate.estimated_duration_hours}
                    onChange={(e) => setNewTemplate({...newTemplate, estimated_duration_hours: parseInt(e.target.value)})}
                    min="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
                  placeholder="e.g., marketing, development, design"
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="btn-primary">
                  Create Template
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow border-slate-200/50">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-lg">{template.name}</CardTitle>
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
              <CardDescription className="line-clamp-2">
                {template.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  {getPriorityIcon(template.default_priority)}
                  <Badge className={`${getPriorityBadge(template.default_priority)} capitalize`}>
                    {template.default_priority}
                  </Badge>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {template.usage_count || 0} uses
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {template.estimated_duration_hours}h estimated
                </div>
                {template.category && (
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setShowInstantiateForm(true);
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {templates.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No templates yet</p>
            <p className="text-sm">Create your first template to get started</p>
          </div>
        )}
      </div>

      {/* Instantiate Template Dialog */}
      <Dialog open={showInstantiateForm} onOpenChange={setShowInstantiateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task from Template</DialogTitle>
            <DialogDescription>
              Assign "{selectedTemplate?.name}" to a team member
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select 
                value={instantiateData.assignee_id}
                onValueChange={(value) => setInstantiateData({...instantiateData, assignee_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select collaborator" />
                </SelectTrigger>
                <SelectContent>
                  {collaborators.map((collaborator) => (
                    <SelectItem key={collaborator.id} value={collaborator.id}>
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-xs">
                            {collaborator.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span>{collaborator.full_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${
                      !instantiateData.due_date && "text-slate-500"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {instantiateData.due_date ? format(instantiateData.due_date, "PPP") : "Pick a due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={instantiateData.due_date}
                    onSelect={(date) => setInstantiateData({...instantiateData, due_date: date})}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {selectedTemplate && (
              <div className="p-3 bg-slate-50 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">Template Details:</h4>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>Priority: <span className="capitalize">{selectedTemplate.default_priority}</span></div>
                  <div>Estimated: {selectedTemplate.estimated_duration_hours} hours</div>
                  {selectedTemplate.category && <div>Category: {selectedTemplate.category}</div>}
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="ghost" onClick={() => setShowInstantiateForm(false)}>
                Cancel
              </Button>
              <Button onClick={instantiateTemplate} className="btn-primary">
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskTemplates;