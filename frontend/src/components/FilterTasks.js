// src/components/FilterTasks.js
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, X, CheckCircle, AlertTriangle, PlayCircle, PauseCircle, Star, ArrowUpDown } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const FilterTasks = ({ tasks = [], onFilterChange, onClearFilters, collaborators = [] }) => {
  const [filters, setFilters] = useState({
    priority: 'all',
    status: 'all',
    dateFrom: null,
    dateTo: null,
    assignee: 'all',
    sortBy: 'none',
  });

  // 🔁 Appliquer les filtres automatiquement quand ils changent
  useEffect(() => {
    applyFilters();
  
  }, [filters, tasks]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // 🧠 logique partagée pour savoir si une tâche est en retard (alignée avec TaskList / TaskDetails)
  const isOverdue = (task) => {
    if (!task?.due_date) return false;

    const dueDate = new Date(task.due_date);
    const today = new Date();

    // comparaison par jour uniquement
    dueDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return (
      dueDate < today &&
      task.status !== 'completed' &&
      task.status !== 'not_evaluated'
    );
  };

  // 🔽 tri des tâches après filtrage
  const sortTasks = (list, sortBy) => {
    if (!sortBy || sortBy === 'none') return list;

    const copy = [...list];

    const getDate = (task, field) => {
      if (!task || !task[field]) return null;
      const d = new Date(task[field]);
      return isNaN(d.getTime()) ? null : d;
    };

    switch (sortBy) {
      case 'last_updated_desc': {
        return copy.sort((a, b) => {
          const dateB = getDate(b, 'updated_at') || getDate(b, 'created_at') || new Date(0);
          const dateA = getDate(a, 'updated_at') || getDate(a, 'created_at') || new Date(0);
          return dateB - dateA; // plus récent en haut
        });
      }
      case 'due_date_asc': {
        return copy.sort((a, b) => {
          const dateA = getDate(a, 'due_date') || new Date(8640000000000000);
          const dateB = getDate(b, 'due_date') || new Date(8640000000000000);
          return dateA - dateB; // deadline la plus proche en haut
        });
      }
      case 'due_date_desc': {
        return copy.sort((a, b) => {
          const dateA = getDate(a, 'due_date') || new Date(0);
          const dateB = getDate(b, 'due_date') || new Date(0);
          return dateB - dateA;
        });
      }
      default:
        return list;
    }
  };

  const applyFilters = () => {
    let filtered = tasks.filter(task => {
      if (!task) return false;

      // Filtre par priorité
      const priorityMatch =
        filters.priority === 'all' || task.priority === filters.priority;

      // Filtre par statut (cas spécial pour 'overdue')
      let statusMatch = true;
      if (filters.status === 'overdue') {
        statusMatch = isOverdue(task);
      } else if (filters.status !== 'all') {
        statusMatch = task.status === filters.status;
      }

      // Filtre par assigné
      const assigneeMatch =
        filters.assignee === 'all' ||
        (task.assignee_id && String(task.assignee_id) === String(filters.assignee));

      // Filtre par date (sur due_date)
      let dateMatch = true;
      if (filters.dateFrom && task.due_date) {
        const taskDate = new Date(task.due_date);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        dateMatch = dateMatch && taskDate >= fromDate;
      }

      if (filters.dateTo && task.due_date) {
        const taskDate = new Date(task.due_date);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        dateMatch = dateMatch && taskDate <= toDate;
      }

      return priorityMatch && statusMatch && assigneeMatch && dateMatch;
    });

    // 🔽 appliquer le tri choisi
    filtered = sortTasks(filtered, filters.sortBy);

    if (onFilterChange) onFilterChange(filtered);
  };

  const clearFilters = () => {
    setFilters({
      priority: 'all',
      status: 'all',
      dateFrom: null,
      dateTo: null,
      assignee: 'all',
      sortBy: 'none',
    });
    if (onClearFilters) onClearFilters();
  };

  const hasActiveFilters =
    filters.priority !== 'all' ||
    filters.status !== 'all' ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.assignee !== 'all' ||
    filters.sortBy !== 'none';

  const formatStatusDisplay = (status) => {
    switch (status) {
      case 'not_evaluated': return 'Completed (Not Evaluated)';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed & Evaluated';
      case 'pending': return 'Pending';
      case 'overdue': return 'Overdue';
      default: return status;
    }
  };

  const formatSortLabel = (sortBy) => {
    switch (sortBy) {
      case 'last_updated_desc': return 'Last updated (newest first)';
      case 'due_date_asc': return 'Due date (closest first)';
      case 'due_date_desc': return 'Due date (farthest first)';
      default: return 'Default';
    }
  };

  // Helpers pour l'évaluation (alignés avec TaskList / KanbanView)
  const isPositiveScore = (value) =>
    typeof value === 'number' && value > 0;

  const isTaskEvaluated = (task) => {
    if (!task) return false;

    const hasAnyNumericScore =
      isPositiveScore(task.punctuality_score) ||
      isPositiveScore(task.quality_score) ||
      isPositiveScore(task.performance_rating);

    const hasFeedback =
      typeof task.feedback === 'string' && task.feedback.trim() !== '';

    const hasEvaluationDate =
      task.evaluation_date != null && String(task.evaluation_date).trim() !== '';

    return hasAnyNumericScore || hasFeedback || hasEvaluationDate;
  };

  // 📊 Statistiques pour les KPI en bas
  const getFilterStats = () => {
    const totalTasks = tasks.length;

    let pendingTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;       // Completed & evaluated
    let notEvaluatedTasks = 0;    // Completed (not evaluated)
    let overdueTasks = 0;

    tasks.forEach((task) => {
      if (!task) return;

      const overdue = isOverdue(task);
      const evaluated = isTaskEvaluated(task);

      // 1) Tâches complétées (avec ou sans évaluation)
      if (task.status === 'completed' || task.status === 'not_evaluated') {
        if (evaluated) {
          completedTasks += 1;        // Completed & Evaluated
        } else {
          notEvaluatedTasks += 1;     // Completed (Not Evaluated)
        }
        // Une fois classée comme complétée, on ne la compte ni en overdue, ni en pending/in_progress
        return;
      }

      // 2) Tâches non complétées
      if (overdue) {
        overdueTasks += 1;            // Overdue non complétée
        return;                       // ne pas la compter dans pending/in_progress
      }

      if (task.status === 'in_progress') {
        inProgressTasks += 1;
      } else {
        // tout le reste est considéré "pending"
        pendingTasks += 1;
      }
    });

    const readyForEvaluation = notEvaluatedTasks;

    return {
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      notEvaluatedTasks,
      overdueTasks,
      readyForEvaluation,
    };
  };

  const stats = getFilterStats();

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Tasks
          </h3>
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Priority Filter */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={filters.priority}
            onValueChange={(value) => handleFilterChange('priority', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>

              <SelectItem value="pending" className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-yellow-500" />
                Pending ({stats.pendingTasks})
              </SelectItem>

              <SelectItem value="in_progress" className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-blue-500" />
                In Progress ({stats.inProgressTasks})
              </SelectItem>

              <SelectItem value="not_evaluated" className="flex items-center gap-2">
                <Star className="h-4 w-4 text-orange-500" />
                Completed (Not Evaluated) ({stats.notEvaluatedTasks})
              </SelectItem>

              <SelectItem value="completed" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Completed & Evaluated ({stats.completedTasks})
              </SelectItem>

              <SelectItem value="overdue" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Overdue ({stats.overdueTasks})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assignee Filter */}
        <div className="space-y-2">
          <Label htmlFor="assignee">Assigned To</Label>
          <Select
            value={filters.assignee}
            onValueChange={(value) => handleFilterChange('assignee', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {collaborators.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Start Date Filter */}
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(date) => handleFilterChange('dateFrom', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date Filter */}
        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => handleFilterChange('dateTo', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Sort By */}
        <div className="space-y-2">
          <Label>Sort By</Label>
          <Select
            value={filters.sortBy}
            onValueChange={(value) => handleFilterChange('sortBy', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Default order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="flex items-center gap-2">
                Default
              </SelectItem>
              <SelectItem value="last_updated_desc" className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Last updated (newest first)
              </SelectItem>
              <SelectItem value="due_date_asc" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Due date (closest first)
              </SelectItem>
              <SelectItem value="due_date_desc" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Due date (farthest first)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Active filters:</strong>
            {filters.priority !== 'all' && ` Priority: ${filters.priority}`}
            {filters.status !== 'all' && ` Status: ${formatStatusDisplay(filters.status)}`}
            {filters.assignee !== 'all' && ` Assignee: ${
              collaborators.find(u => String(u.id) === String(filters.assignee))?.full_name ||
              filters.assignee
            }`}
            {filters.dateFrom && ` From: ${format(filters.dateFrom, 'dd/MM/yyyy')}`}
            {filters.dateTo && ` To: ${format(filters.dateTo, 'dd/MM/yyyy')}`}
            {filters.sortBy !== 'none' && ` • Sort: ${formatSortLabel(filters.sortBy)}`}
          </p>
        </div>
      )}

      {/* Statistiques simplifiées */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-200">
          <div className="font-semibold text-slate-900 text-lg">{stats.totalTasks}</div>
          <div className="text-slate-600 font-medium">Total Tasks</div>
        </div>

        <div className="bg-orange-50 p-3 rounded-lg text-center border border-orange-200">
          <div className="font-semibold text-orange-700 text-lg">{stats.readyForEvaluation}</div>
          <div className="text-orange-600 font-medium flex items-center justify-center gap-1">
            <Star className="h-3 w-3" />
            Completed (Not Evaluated)
          </div>
        </div>

        <div className="bg-yellow-50 p-3 rounded-lg text-center border border-yellow-200">
          <div className="font-semibold text-yellow-700 text-lg">{stats.pendingTasks}</div>
          <div className="text-yellow-600 font-medium flex items-center justify-center gap-1">
            <PauseCircle className="h-3 w-3" />
            Pending
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-200">
          <div className="font-semibold text-blue-700 text-lg">{stats.inProgressTasks}</div>
          <div className="text-blue-600 font-medium flex items-center justify-center gap-1">
            <PlayCircle className="h-3 w-3" />
            In Progress
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded-lg text-center border border-green-200">
          <div className="font-semibold text-green-700 text-lg">{stats.completedTasks}</div>
          <div className="text-green-600 font-medium flex items-center justify-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed & Evaluated
          </div>
        </div>

        <div className="bg-red-50 p-3 rounded-lg text-center border border-red-200">
          <div className="font-semibold text-red-700 text-lg">{stats.overdueTasks}</div>
          <div className="text-red-600 font-medium flex items-center justify-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Overdue
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterTasks;
