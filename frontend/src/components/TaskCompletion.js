// src/components/TaskCompletion.js
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Upload, 
  X, 
  Download, 
  CheckCircle, 
  Clock,
  Eye,
} from 'lucide-react';
import { API } from '../App';
import { toast } from "sonner";

const TaskCompletion = ({ task, onTaskCompleted }) => {
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // 🎨 Styles forcés pour rester cohérent avec CreateTaskModal
  const modalStyles = {
    dialogContent: {
      backgroundColor: 'white',
      color: 'black',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
    },
    inputArea: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: 'black',
    },
    secondaryBox: {
      backgroundColor: '#eff6ff',
      border: '1px solid #bfdbfe',
    },
    button: {
      backgroundColor: '#16a34a',
      color: 'white',
    },
    buttonOutline: {
      backgroundColor: 'white',
      border: '1px solid #d1d5db',
      color: '#374151',
    }
  };

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
      
      const completionPayload = {
        completion_notes: completionNotes || ''
      };
      formData.append('completion_data', JSON.stringify(completionPayload));
      
      files.forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Please login again');
        setUploading(false);
        return;
      }

      const response = await fetch(`${API}/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (e) {
          // ignore JSON error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      toast.success('Task completed successfully! Waiting for manager evaluation.');
      setShowCompletionForm(false);
      setCompletionNotes('');
      setFiles([]);
      
      if (onTaskCompleted) {
        // ✅ On renvoie au parent une tâche cohérente, avec evidence normalisée
        let updatedTask;

        if (data && data.id) {
          // L’API retourne la tâche complète → merge
          const evidenceFiles =
            data.completion_evidence ||
            data.evidence_files ||
            task.completion_evidence ||
            [];

          updatedTask = {
            ...task,
            ...data,
            status: data.status || 'not_evaluated',
            completion_evidence: Array.isArray(evidenceFiles) ? evidenceFiles : [],
          };
        } else {
          // Fallback : on construit à partir de ce qu’on sait
          const evidenceFiles =
            data?.completion_evidence ||
            data?.evidence_files ||
            task.completion_evidence ||
            [];

          updatedTask = {
            ...task,
            status: 'not_evaluated',
            completed_at: new Date().toISOString(),
            completion_notes: completionNotes || task.completion_notes || '',
            completion_evidence: Array.isArray(evidenceFiles) ? evidenceFiles : [],
          };
        }

        onTaskCompleted(updatedTask);
      }
      
    } catch (error) {
      console.error('❌ Error completing task:', error);
      
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

  // 🔎 Helpers pour evidence (string ou objet)
  const getEvidenceList = (task) => {
    if (!task) return [];
    if (Array.isArray(task.completion_evidence)) return task.completion_evidence;
    if (Array.isArray(task.evidence_files)) return task.evidence_files;
    return [];
  };

  const getEvidenceLabel = (evidence, index) => {
    if (!evidence) return `Evidence ${index + 1}`;
    if (typeof evidence === 'string') return evidence;
    if (evidence.original_name) return evidence.original_name;
    if (evidence.file_name) return evidence.file_name;
    if (evidence.filename) return evidence.filename;
    return `Evidence ${index + 1}`;
  };

  const getEvidenceFileName = (evidence) => {
    if (!evidence) return '';
    if (typeof evidence === 'string') return evidence;
    return (
      evidence.file_name ||
      evidence.filename ||
      evidence.original_name ||
      ''
    );
  };

  // 👁️ View evidence → ouvre dans un nouvel onglet (preview)
  const viewEvidence = (evidence) => {
    const fileName = getEvidenceFileName(evidence);
    if (!fileName) {
      toast.error('Invalid file name');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login again');
      return;
    }

    const url = `${API}/files/evidence/preview/${encodeURIComponent(fileName)}?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 💾 Download evidence → même logique que TaskList / TaskDetails
  const downloadEvidence = (evidence) => {
    const fileName = getEvidenceFileName(evidence);
    if (!fileName) {
      toast.error('Invalid file name');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login again');
      return;
    }

    const url = `${API}/files/evidence/${encodeURIComponent(fileName)}?token=${encodeURIComponent(token)}`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || 'evidence_file');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getStatusBadge = (task) => {
    if (task.status === 'completed') {
      return (
        <Badge className="bg-green-100 text-green-800 px-3 py-1 text-sm font-medium rounded-full">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed & Evaluated
        </Badge>
      );
    } else if (task.status === 'not_evaluated') {
      return (
        <Badge className="bg-orange-100 text-orange-800 px-3 py-1 text-sm font-medium rounded-full">
          <Clock className="h-3 w-3 mr-1" />
          Completed - Awaiting Evaluation
        </Badge>
      );
    }
    return null;
  };

  const getStatusMessage = (task) => {
    if (task.status === 'completed') {
      return 'Task completed and evaluated by manager';
    } else if (task.status === 'not_evaluated') {
      return 'Task completed - waiting for manager performance evaluation';
    }
    return '';
  };

  const evidenceList = getEvidenceList(task);

  return (
    <div>
      {(task.status === 'completed' || task.status === 'not_evaluated') ? (
        <div className={`space-y-3 p-4 rounded-lg border ${
          task.status === 'completed' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center justify-between">
            {getStatusBadge(task)}
            <span className={`text-sm ${
              task.status === 'completed' ? 'text-green-600' : 'text-orange-600'
            }`}>
              {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
            </span>
          </div>
          
          <div className={`text-xs ${
            task.status === 'completed' ? 'text-green-700' : 'text-orange-700'
          }`}>
            {getStatusMessage(task)}
          </div>
          
          {task.completion_notes && (
            <div>
              <Label className="text-sm font-medium">Completion Notes</Label>
              <p className={`text-sm mt-1 ${
                task.status === 'completed' ? 'text-green-800' : 'text-orange-800'
              }`}>
                {task.completion_notes}
              </p>
            </div>
          )}
          
          {evidenceList.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Evidence Files</Label>
              <div className="space-y-2 mt-2">
                {evidenceList.map((evidence, index) => {
                  const label = getEvidenceLabel(evidence, index);
                  return (
                    <div 
                      key={index} 
                      className={`flex items-center justify-between p-2 rounded border ${
                        task.status === 'completed' ? 'bg-white border-green-200' : 'bg-white border-orange-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className={`h-4 w-4 ${
                          task.status === 'completed' ? 'text-green-600' : 'text-orange-600'
                        }`} />
                        <span className="text-sm">{label}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {/* View */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewEvidence(evidence)}
                          className="h-7 w-7 p-0"
                          title="View evidence"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>

                        {/* Download */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadEvidence(evidence)}
                          className="h-7 w-7 p-0"
                          title="Download evidence"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
          <DialogContent 
            className="max-w-2xl max-h-[90vh] overflow-y-auto"
            style={modalStyles.dialogContent}
          >
            <DialogHeader>
              <DialogTitle 
                className="text-2xl font-semibold"
                style={{ color: 'black' }}
              >
                Complete Task
              </DialogTitle>
              <DialogDescription style={{ color: '#4b5563' }}>
                Add completion notes and attach evidence files. The task will be marked as completed and sent to your manager for performance evaluation.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="font-medium" style={{ color: 'black' }}>
                  Completion Notes (Optional)
                </Label>
                <Textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Add any notes about the completion that would help your manager evaluate your performance..."
                  rows={4}
                  className="resize-none"
                  style={modalStyles.inputArea}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="font-medium" style={{ color: 'black' }}>
                  Evidence Files (Optional)
                </Label>
                <div 
                  className="border-2 border-dashed rounded-lg p-4 text-center"
                  style={{
                    borderColor: '#d1d5db',
                    backgroundColor: '#f9fafb'
                  }}
                >
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
                    <p className="text-sm text-gray-700">
                      Click to upload evidence files
                    </p>
                    <p className="text-xs text-gray-500">
                      JPG, PNG, PDF (Max 10MB)
                    </p>
                  </label>
                </div>
                
                {files.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {files.map((file, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-200"
                      >
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-gray-600" />
                          <span className="text-sm text-gray-800">{file.name}</span>
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

              <div 
                className="p-3 rounded-lg flex items-start space-x-2"
                style={modalStyles.secondaryBox}
              >
                <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Evaluation Process
                  </p>
                  <p className="text-xs text-blue-700">
                    After completion, your manager will evaluate your performance based on punctuality and quality of work.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCompletionForm(false)}
                  disabled={uploading}
                  style={modalStyles.buttonOutline}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={completeTask} 
                  disabled={uploading}
                  style={modalStyles.button}
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
