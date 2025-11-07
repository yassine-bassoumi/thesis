import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, X, Download, CheckCircle } from 'lucide-react';
import { API } from '../App';
import axios from 'axios';
import { toast } from "sonner";

const TaskCompletion = ({ task, onTaskCompleted }) => {
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const completeTask = async () => {
    if (!window.confirm("Are you sure you want to mark this task as complete?")) {
      return;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      
      // Ajouter les données de completion
      const completionPayload = {
        completion_notes: completionNotes || ''
      };
      formData.append('completion_data', JSON.stringify(completionPayload));
      
      // Ajouter les fichiers
      files.forEach(file => {
        formData.append('files', file);
      });

      console.log('📤 Envoi completion...');

      // Récupérer le token
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Please login again');
        return;
      }

      // Utiliser fetch pour plus de fiabilité avec FormData
      const response = await fetch(`${API}/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Pas de Content-Type pour FormData, le navigateur le gère automatiquement
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Succès! Réponse:', data);
      
      toast.success('Task completed successfully!');
      setShowCompletionForm(false);
      setCompletionNotes('');
      setFiles([]);
      
      if (onTaskCompleted) {
        onTaskCompleted();
      }
      
    } catch (error) {
      console.error('❌ Erreur:', error);
      
      if (error.message.includes('401') || error.message.includes('Not authenticated')) {
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
      } else {
        toast.error(error.message || 'Failed to complete task');
      }
    } finally {
      setUploading(false);
    }
  };

 const downloadEvidence = (filename) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    toast.error('Please login again');
    return;
  }

  // 🔥 CORRECTION : Ajouter le token dans l'URL
  const url = `${API}/files/evidence/${filename}?token=${encodeURIComponent(token)}`;
  console.log('🔗 Download URL with token:', url);
  window.open(url, '_blank');
};

  return (
    <div>
      {task.status === 'completed' ? (
        <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <Badge className="bg-green-100 text-green-800 px-3 py-1 text-sm font-medium rounded-full">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
            <span className="text-sm text-green-600">
              {new Date(task.completed_at).toLocaleDateString()}
            </span>
          </div>
          
          {task.completion_notes && (
            <div>
              <Label className="text-sm font-medium">Completion Notes</Label>
              <p className="text-sm text-green-800 mt-1">{task.completion_notes}</p>
            </div>
          )}
          
          {task.completion_evidence && task.completion_evidence.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Evidence Files</Label>
              <div className="space-y-2 mt-2">
                {task.completion_evidence.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{file}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadEvidence(file)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Dialog open={showCompletionForm} onOpenChange={setShowCompletionForm}>
          <DialogTrigger asChild>
            <Button className="bg-green-500 hover:bg-green-600 text-white">
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Task</DialogTitle>
              <DialogDescription>
                Add completion notes and attach evidence files (optional)
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Completion Notes (Optional)</Label>
                <Textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Add any notes about the completion..."
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Evidence Files (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="evidence-files"
                    accept=".jpg,.jpeg,.png,.pdf"
                  />
                  <label htmlFor="evidence-files" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600">Click to upload evidence files</p>
                    <p className="text-xs text-gray-500">JPG, PNG, PDF (Max 10MB)</p>
                  </label>
                </div>
                
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-gray-600" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="ghost" onClick={() => setShowCompletionForm(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={completeTask} 
                  disabled={uploading}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {uploading ? 'Uploading...' : 'Complete Task'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TaskCompletion;