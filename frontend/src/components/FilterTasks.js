import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const FilterTasks = ({ tasks, onFilterChange, onClearFilters, collaborators }) => {
  const [filters, setFilters] = useState({
    priority: 'all',
    status: 'all',
    dateFrom: null,
    dateTo: null,
    assignee: 'all'
  });

  // Appliquer les filtres automatiquement quand ils changent
  useEffect(() => {
    applyFilters();
  }, [filters, tasks]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const applyFilters = () => {
    const filtered = tasks.filter(task => {
      // Filtre par priorité
      const priorityMatch = filters.priority === 'all' || task.priority === filters.priority;
      
      // Filtre par statut
      const statusMatch = filters.status === 'all' || task.status === filters.status;
      
      // Filtre par assigné
      const assigneeMatch = filters.assignee === 'all' || task.assignee_id === filters.assignee;
      
      // Filtre par date - CORRECTION ICI
      let dateMatch = true;
      if (filters.dateFrom && task.due_date) {
        const taskDate = new Date(task.due_date);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0); // Début de journée
        dateMatch = dateMatch && taskDate >= fromDate;
      }
      
      if (filters.dateTo && task.due_date) {
        const taskDate = new Date(task.due_date);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999); // Fin de journée
        dateMatch = dateMatch && taskDate <= toDate;
      }
      
      return priorityMatch && statusMatch && assigneeMatch && dateMatch;
    });
    
    onFilterChange(filtered);
  };

  const clearFilters = () => {
    setFilters({
      priority: 'all',
      status: 'all',
      dateFrom: null,
      dateTo: null,
      assignee: 'all'
    });
    onClearFilters();
  };

  const hasActiveFilters = filters.priority !== 'all' || filters.status !== 'all' || filters.dateFrom || filters.dateTo || filters.assignee !== 'all';

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filter Tasks
        </h3>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Priority Filter */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
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
          <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assignee Filter */}
        <div className="space-y-2">
          <Label htmlFor="assignee">Assigned To</Label>
          <Select value={filters.assignee} onValueChange={(value) => handleFilterChange('assignee', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {collaborators.map((user) => (
                <SelectItem key={user.id} value={user.id}>
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
                {filters.dateFrom ? format(filters.dateFrom, "MM/dd/yyyy") : "Select date"}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
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
                {filters.dateTo ? format(filters.dateTo, "MM/dd/yyyy") : "Select date"}
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
      </div>

      {/* SUPPRIMEZ le bouton en double - NE GARDEZ QUE CELUI DU HAUT */}

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Active filters:</strong>
            {filters.priority !== 'all' && ` Priority: ${filters.priority}`}
            {filters.status !== 'all' && ` Status: ${filters.status}`}
            {filters.assignee !== 'all' && ` Assignee: ${collaborators.find(u => u.id === filters.assignee)?.full_name || filters.assignee}`}
            {filters.dateFrom && ` From: ${format(filters.dateFrom, 'MM/dd/yyyy')}`}
            {filters.dateTo && ` To: ${format(filters.dateTo, 'MM/dd/yyyy')}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default FilterTasks;